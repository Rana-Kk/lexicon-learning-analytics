import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseXlsx } from '../utils/xlsx.js';

const publicUserSelect = `
  u.id,
  u.name,
  u.email,
  u.role,
  u.github_username,
  u.is_active,
  u.bio,
  u.avatar,
  u.created_at,
  u.updated_at,
  GROUP_CONCAT(DISTINCT ug.group_id ORDER BY ug.group_id SEPARATOR ',') AS group_ids,
  GROUP_CONCAT(DISTINCT ug.group_name ORDER BY ug.group_name SEPARATOR ', ') AS group_names,
  GROUP_CONCAT(DISTINCT ug.course_id ORDER BY ug.course_id SEPARATOR ',') AS course_ids,
  GROUP_CONCAT(DISTINCT ug.course_name ORDER BY ug.course_name SEPARATOR ', ') AS course_names
`;

async function getUserRows(query = '1=1', params = []) {
  const [rows] = await pool.query(
    `
      SELECT ${publicUserSelect}
      FROM users u
      LEFT JOIN (
        SELECT
          gs.student_id AS user_id,
          g.id AS group_id,
          g.name AS group_name,
          c.id AS course_id,
          c.name AS course_name
        FROM group_students gs
        JOIN student_groups g ON g.id = gs.group_id
        JOIN courses c ON c.id = g.course_id

        UNION ALL

        SELECT
          gt.teacher_id AS user_id,
          g.id AS group_id,
          g.name AS group_name,
          c.id AS course_id,
          c.name AS course_name
        FROM group_teachers gt
        JOIN student_groups g ON g.id = gt.group_id
        JOIN courses c ON c.id = g.course_id
      ) ug ON ug.user_id = u.id
      WHERE ${query}
      GROUP BY u.id
      ORDER BY u.created_at DESC, u.name ASC
    `,
    params
  )

  return rows
}
export const getUsers = asyncHandler(async (req, res) => {
  const { role, search, is_active } = req.query;

  const where = ['1=1'];
  const params = [];

  if (req.user.role === 'admin') {
    if (role) {
      where.push('u.role = ?');
      params.push(role);
    }
  }

  
  if (req.user.role === 'teacher') {
    where.push(`u.role = 'student'`);

    where.push(`
      EXISTS (
        SELECT 1
        FROM group_students gs_scope
        JOIN group_teachers gt_scope
          ON gt_scope.group_id = gs_scope.group_id
        WHERE gs_scope.student_id = u.id
          AND gt_scope.teacher_id = ?
      )
    `);

    params.push(req.user.sub);
  }

  if (is_active !== undefined) {
    where.push('u.is_active = ?');
    params.push(
      is_active === 'true' || is_active === '1'
    );
  }

  if (search) {
    where.push(
      '(u.name LIKE ? OR u.email LIKE ? OR u.github_username LIKE ?)'
    );

    const p = `%${search}%`;

    params.push(p, p, p);
  }

  const users = await getUserRows(
    where.join(' AND '),
    params
  );

  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});
export const getUserById = asyncHandler(async (req, res) => {
  const requestedId = Number(req.params.id);
  const currentUserId = Number(req.user.sub);

  if (!Number.isInteger(requestedId)) {
    throw new ApiError(400, 'Invalid user id');
  }

  if (req.user.role === 'admin') {
    const rows = await getUserRows(
      'u.id = ?',
      [requestedId]
    );

    if (!rows.length) {
      throw new ApiError(404, 'User not found');
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  }

  if (requestedId === currentUserId) {
    const rows = await getUserRows(
      'u.id = ?',
      [requestedId]
    );

    if (!rows.length) {
      throw new ApiError(404, 'User not found');
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  }

  if (req.user.role === 'teacher') {
    const rows = await getUserRows(
      `
        u.id = ?
        AND u.role = 'student'
        AND EXISTS (
          SELECT 1
          FROM group_students gs
          JOIN group_teachers gt
            ON gt.group_id = gs.group_id
          WHERE gs.student_id = u.id
            AND gt.teacher_id = ?
        )
      `,
      [
        requestedId,
        currentUserId
      ]
    );

    if (!rows.length) {
      throw new ApiError(
        403,
        'You do not have access to this user'
      );
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  }

  
  throw new ApiError(
    403,
    'You do not have access to this user'
  );
});async function ensureUniqueUser(email, github_username, id = null) {
  const [emailRows] = await pool.query('SELECT id FROM users WHERE email = ? AND (? IS NULL OR id != ?)', [email, id, id]);
  if (emailRows.length) throw new ApiError(409, 'Email is already registered');
  if (github_username) {
    const [githubRows] = await pool.query('SELECT id FROM users WHERE github_username = ? AND (? IS NULL OR id != ?)', [github_username, id, id]);
    if (githubRows.length) throw new ApiError(409, 'GitHub username is already taken');
  }
}

async function enrollInGroup(studentId, groupId) {
  if (!groupId) return;
  const [group] = await pool.query('SELECT id FROM student_groups WHERE id = ?', [groupId]);
  if (!group.length) throw new ApiError(404, 'Group not found');
  await pool.query(`INSERT INTO group_students (group_id, student_id, joined_at)
    VALUES (?, ?, CURRENT_DATE) ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at)`, [groupId, studentId]);
}
async function syncStudentGroups(studentId, groupIds) {
  if (!Array.isArray(groupIds)) return;

  const cleanGroupIds = [
    ...new Set(
      groupIds
        .filter(Boolean)
        .map(Number)
        .filter(Number.isInteger)
    )
  ];

  if (cleanGroupIds.length > 0) {
    const placeholders = cleanGroupIds.map(() => '?').join(',');

    const [groups] = await pool.query(
      `SELECT id
       FROM student_groups
       WHERE id IN (${placeholders})`,
      cleanGroupIds
    );

    if (groups.length !== cleanGroupIds.length) {
      throw new ApiError(404, 'One or more groups not found');
    }
  }

  // Öğrencinin mevcut grup ilişkilerini temizle
  await pool.query(
    'DELETE FROM group_students WHERE student_id = ?',
    [studentId]
  );

  // Seçilen bütün grupları tekrar ekle
  for (const groupId of cleanGroupIds) {
    await enrollInGroup(studentId, groupId);
  }
}
export const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    github_username,
    group_id
  } = req.body;

  if (!name || !email || !password || !role) {
    throw new ApiError(
      400,
      'Name, email, password, and role are required'
    );
  }

  if (!['admin', 'teacher', 'student'].includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanGithub =
    github_username
      ? String(github_username).trim()
      : null;

  await ensureUniqueUser(
    cleanEmail,
    cleanGithub
  );

  const password_hash = await bcrypt.hash(
    String(password),
    10
  );

  const [result] = await pool.query(
    `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        github_username,
        must_change_password
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      cleanName,
      cleanEmail,
      password_hash,
      role,
      cleanGithub,
      role === 'student'
    ]
  );

  if (role === 'student' && group_id) {
    await enrollInGroup(
      result.insertId,
      group_id
    );
  }

  const rows = await getUserRows(
    'u.id = ?',
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: rows[0]
  });
});

export const importStudentsFile = asyncHandler(async (req, res) => {
  const { file_base64, filename } = req.body || {};
  if (!file_base64 || !String(filename || '').toLowerCase().endsWith('.xlsx')) throw new ApiError(400, 'Please upload an .xlsx file');
  let students;
  try { students = parseXlsx(Buffer.from(file_base64, 'base64')); }
  catch (e) { throw new ApiError(400, `Could not read Excel file: ${e.message}`); }
  req.body.students = students;
  return importStudents(req, res);
});

export const importStudents = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body?.students)
    ? req.body.students
    : [];

  if (!rows.length) {
    throw new ApiError(400, 'students array is required');
  }

  const imported = [];
  const skipped = [];

  for (const row of rows) {
    const name = String(row.name ?? '').trim();
    const surname = String(row.surname ?? '').trim();
    const email = String(row.email ?? '').trim().toLowerCase();

    if (!name || !email) {
      skipped.push({
        email,
        reason: 'Name and email are required'
      });
      continue;
    }

    try {
      const [exists] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (exists.length) {
        skipped.push({
          email,
          reason: 'Email already exists'
        });
        continue;
      }

      const fullName =
        `${name}${surname ? ` ${surname}` : ''}`.trim();

      // Excel'den gelen şifreyi kullan.
      // Boşsa mevcut otomatik şifre sistemine düş.
      const providedPassword =
        String(row.password ?? '').trim();

      const temporaryPassword =
        providedPassword ||
        `${surname || name}123`.replace(/\s+/g, '');

      const password_hash =
        await bcrypt.hash(temporaryPassword, 10);

      const [result] = await pool.query(
        `INSERT INTO users
          (
            name,
            email,
            password_hash,
            role,
            is_active,
            must_change_password
          )
         VALUES (?, ?, ?, 'student', TRUE, TRUE)`,
        [
          fullName,
          email,
          password_hash
        ]
      );

      let groupId = row.group_id || null;

      if (!groupId && row.course_id) {
        const [groups] = await pool.query(
          `SELECT id
             FROM student_groups
            WHERE course_id = ?
            ORDER BY id DESC`,
          [row.course_id]
        );

        if (groups.length === 1) {
          groupId = groups[0].id;
        }
      }

      if (groupId) {
        await enrollInGroup(
          result.insertId,
          groupId
        );
      }

      imported.push({
        id: result.insertId,
        name: fullName,
        email,
        temporaryPassword,
        groupId: groupId
          ? Number(groupId)
          : null
      });

    } catch (error) {
      skipped.push({
        email,
        reason: error.message
      });
    }
  }

  res.status(201).json({
    success: true,
    imported: imported.length,
    skipped: skipped.length,
    data: imported,
    skippedRows: skipped
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Kullanıcı kendi profilini güncelleyebilir.
  // Admin başka kullanıcıları da güncelleyebilir.
  const isOwnProfile = Number(req.user.sub) === Number(id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwnProfile && !isAdmin) {
    throw new ApiError(403, 'You can only update your own profile');
  }

  const {
    name,
    email,
    role,
    github_username,
    is_active,
    password,
    group_ids,
    bio,
    avatar
  } = req.body;

  const [existing] = await pool.query(
    'SELECT id, role FROM users WHERE id = ?',
    [id]
  );

  if (!existing.length) {
    throw new ApiError(404, 'User to update not found');
  }

  // Email değişiyorsa unique kontrolü yap
  if (email !== undefined) {
    await ensureUniqueUser(
      email.trim(),
      github_username?.trim() || null,
      id
    );
  }

  const fields = [];
  const params = [];

  // -------------------------
  // BASIC USER INFORMATION
  // -------------------------

  if (name !== undefined) {
    fields.push('name = ?');
    params.push(name.trim());
  }

  if (email !== undefined) {
    fields.push('email = ?');
    params.push(email.trim());
  }

  if (role !== undefined) {
    if (!['admin', 'teacher', 'student'].includes(role)) {
      throw new ApiError(400, 'Invalid role');
    }

    // Sadece admin başka kullanıcının rolünü değiştirebilir
    if (!isAdmin && role !== existing[0].role) {
      throw new ApiError(403, 'You cannot change your own role');
    }

    fields.push('role = ?');
    params.push(role);
  }

  if (github_username !== undefined) {
    fields.push('github_username = ?');
    params.push(github_username?.trim() || null);
  }

  if (is_active !== undefined) {
    if (!isAdmin) {
      throw new ApiError(403, 'Only an admin can activate or deactivate an account');
    }
    fields.push('is_active = ?');
    params.push(Boolean(is_active));
  }

  // -------------------------
  // PROFILE
  // -------------------------

  if (bio !== undefined) {
    fields.push('bio = ?');
    params.push(bio?.trim() || null);
  }

  if (avatar !== undefined) {
    fields.push('avatar = ?');
    params.push(avatar || null);
  }

  // -------------------------
  // PASSWORD
  // -------------------------

  if (password) {
    if (password.length < 8) {
      throw new ApiError(
        400,
        'Password must be at least 8 characters'
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    fields.push('password_hash = ?');
    params.push(passwordHash);

    fields.push('must_change_password = ?');
    params.push(true);
  }

  // Hiçbir normal alan ve group değişikliği yoksa hata
  if (!fields.length && group_ids === undefined) {
    throw new ApiError(400, 'No fields provided for update');
  }

  // -------------------------
  // UPDATE USER
  // -------------------------

  if (fields.length) {
    await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = ?`,
      [...params, id]
    );
  }

  // -------------------------
  // MULTIPLE GROUP SUPPORT
  // -------------------------

  if (
    (role === 'student' || existing[0].role === 'student') &&
    group_ids !== undefined
  ) {
    await syncStudentGroups(id, group_ids);
  }

  // Güncellenmiş kullanıcıyı tekrar getir
  const rows = await getUserRows('u.id = ?', [id]);

  res.json({
    success: true,
    message: 'User updated successfully',
    data: rows[0]
  });
});

export const getStudentAcademicOverview = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.id);
  const groupId = Number(req.query.group_id);
  const teacherId = Number(req.user.sub);

  // =========================
  // VALIDATION
  // =========================

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ApiError(400, 'Invalid student id');
  }

  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new ApiError(400, 'A valid group_id is required');
  }

  // =========================
  // STUDENT
  // =========================

  const [studentRows] = await pool.query(
    `
      SELECT
        id,
        name,
        email,
        github_username
      FROM users
      WHERE id = ?
        AND role = 'student'
        AND is_active = TRUE
    `,
    [studentId]
  );

  if (!studentRows.length) {
    throw new ApiError(404, 'Student not found');
  }

  // =========================
  // GROUP MEMBERSHIP
  // =========================

  const [membershipRows] = await pool.query(
    `
      SELECT
        g.id AS group_id,
        g.name AS group_name,
        g.course_id,
        c.name AS course_name
      FROM group_students gs
      INNER JOIN student_groups g
        ON g.id = gs.group_id
      INNER JOIN courses c
        ON c.id = g.course_id
      WHERE gs.student_id = ?
        AND gs.group_id = ?
    `,
    [studentId, groupId]
  );

  if (!membershipRows.length) {
    throw new ApiError(
      404,
      'Student is not enrolled in this group'
    );
  }

  // =========================
  // TEACHER ACCESS
  // =========================

  if (req.user.role === 'teacher') {
    const [accessRows] = await pool.query(
      `
        SELECT 1
        FROM group_teachers
        WHERE group_id = ?
          AND teacher_id = ?
        LIMIT 1
      `,
      [groupId, teacherId]
    );

    if (!accessRows.length) {
      throw new ApiError(
        403,
        'You do not have access to this group'
      );
    }
  }

  const student = {
    ...studentRows[0],
    ...membershipRows[0]
  };

  // =========================
  // ASSESSMENTS
  // =========================

  const [assessmentRows] = await pool.query(
    `
      SELECT
        a.id,
        a.title,
        a.description,
        a.type,
        a.submission_mode,
        a.assessment_date,
        a.due_date,
        a.max_score,

        sc.score,
        sc.feedback,
        sc.evaluated_at,

        (
          SELECT sub.github_url
          FROM assessment_submissions sub
          WHERE sub.assessment_id = a.id
            AND (
              sub.student_id = ?
              OR sub.team_id IN (
                SELECT tm.team_id
                FROM team_members tm
                WHERE tm.student_id = ?
              )
            )
          ORDER BY sub.submitted_at DESC
          LIMIT 1
        ) AS github_url

      FROM assessments a

      LEFT JOIN assessment_scores sc
        ON sc.assessment_id = a.id
       AND sc.student_id = ?

      WHERE a.group_id = ?

      ORDER BY
        COALESCE(a.assessment_date, a.due_date) DESC,
        a.id DESC
    `,
    [
      studentId,
      studentId,
      studentId,
      groupId
    ]
  );

  // =========================
  // CHECKLIST RESULTS
  // =========================
  //
  // Doğru ilişki:
  //
  // assessment_checklist_criteria
  //        ↓ assessment_id
  // assessments
  //        ↓
  // assessment_submissions
  //        ↓ submission_id
  // ai_evaluations
  //        ↓ ai_evaluation_id
  // assessment_checklist_results
  //

  const assessmentIds = assessmentRows.map(
    (assessment) => Number(assessment.id)
  );

  let checklistRows = [];

  if (assessmentIds.length > 0) {
    const placeholders = assessmentIds
      .map(() => '?')
      .join(',');

    const [rows] = await pool.query(
      `
        SELECT
          acc.assessment_id,

          acc.id AS checklist_criterion_id,
          acc.name,
          acc.description,
          acc.criterion_type,
          acc.max_score,
          acc.sort_order,

          sub.id AS submission_id,

          ae.id AS ai_evaluation_id,

          acr.id AS result_id,

          -- AI VALUES
          acr.ai_yes_no_value,
          acr.ai_score_value,
          acr.ai_text_value,
          acr.ai_feedback,

          -- TEACHER VALUES
          acr.teacher_yes_no_value,
          acr.teacher_score_value,
          acr.teacher_text_value,
          acr.teacher_feedback

        FROM assessment_checklist_criteria acc

        LEFT JOIN assessment_submissions sub
          ON sub.assessment_id = acc.assessment_id
         AND (
           sub.student_id = ?
           OR sub.team_id IN (
             SELECT tm.team_id
             FROM team_members tm
             WHERE tm.student_id = ?
           )
         )

        LEFT JOIN ai_evaluations ae
          ON ae.submission_id = sub.id

        LEFT JOIN assessment_checklist_results acr
          ON acr.ai_evaluation_id = ae.id
         AND acr.checklist_criterion_id = acc.id

        WHERE acc.assessment_id IN (${placeholders})

        ORDER BY
          acc.assessment_id ASC,
          acc.sort_order ASC,
          acc.id ASC,
          ae.created_at DESC
      `,
      [
        studentId,
        studentId,
        ...assessmentIds
      ]
    );

    checklistRows = rows;
  }

  // =========================
  // CHECKLIST BY ASSESSMENT
  // =========================

  const checklistByAssessment = new Map();

  for (const row of checklistRows) {
    const assessmentId = Number(row.assessment_id);

    if (!checklistByAssessment.has(assessmentId)) {
      checklistByAssessment.set(
        assessmentId,
        new Map()
      );
    }

    const criteriaMap =
      checklistByAssessment.get(assessmentId);

    // Aynı kriter için birden fazla evaluation varsa
    // en güncel olanı kullanıyoruz.
    if (!criteriaMap.has(row.checklist_criterion_id)) {

      // =========================
      // TEACHER OVERRIDE
      // =========================
      //
      // Öğretmen bir değer girdiyse onu göster.
      // Girmediyse AI sonucunu göster.

      const finalYesNo =
        row.teacher_yes_no_value !== null &&
        row.teacher_yes_no_value !== undefined
          ? Boolean(row.teacher_yes_no_value)
          : row.ai_yes_no_value !== null &&
            row.ai_yes_no_value !== undefined
              ? Boolean(row.ai_yes_no_value)
              : null;

      const finalScore =
        row.teacher_score_value !== null &&
        row.teacher_score_value !== undefined
          ? Number(row.teacher_score_value)
          : row.ai_score_value !== null &&
            row.ai_score_value !== undefined
              ? Number(row.ai_score_value)
              : null;

      const finalText =
        row.teacher_text_value !== null &&
        row.teacher_text_value !== undefined
          ? row.teacher_text_value
          : row.ai_text_value;

      const finalFeedback =
        row.teacher_feedback !== null &&
        row.teacher_feedback !== undefined
          ? row.teacher_feedback
          : row.ai_feedback;

      criteriaMap.set(
        row.checklist_criterion_id,
        {
          id: row.checklist_criterion_id,

          name: row.name,
          description: row.description,

          criterion_type: row.criterion_type,

          max_score:
            row.max_score !== null &&
            row.max_score !== undefined
              ? Number(row.max_score)
              : null,

          sort_order: row.sort_order,

          submission_id: row.submission_id,

          ai_evaluation_id:
            row.ai_evaluation_id,

          result_id: row.result_id,

          // =========================
          // AI ORIGINAL VALUES
          // =========================

          ai: {
            yes_no_value:
              row.ai_yes_no_value !== null &&
              row.ai_yes_no_value !== undefined
                ? Boolean(row.ai_yes_no_value)
                : null,

            score_value:
              row.ai_score_value !== null &&
              row.ai_score_value !== undefined
                ? Number(row.ai_score_value)
                : null,

            text_value:
              row.ai_text_value,

            feedback:
              row.ai_feedback
          },

          // =========================
          // TEACHER VALUES
          // =========================

          teacher: {
            yes_no_value:
              row.teacher_yes_no_value !== null &&
              row.teacher_yes_no_value !== undefined
                ? Boolean(row.teacher_yes_no_value)
                : null,

            score_value:
              row.teacher_score_value !== null &&
              row.teacher_score_value !== undefined
                ? Number(row.teacher_score_value)
                : null,

            text_value:
              row.teacher_text_value,

            feedback:
              row.teacher_feedback
          },

          // =========================
          // FINAL DISPLAY VALUE
          // =========================

          final: {
            yes_no_value: finalYesNo,
            score_value: finalScore,
            text_value: finalText,
            feedback: finalFeedback
          }
        }
      );
    }
  }

  // =========================
  // ADD CHECKLIST TO ASSESSMENTS
  // =========================

  const assessmentsWithChecklist = assessmentRows.map(
    (assessment) => {
      const criteriaMap =
        checklistByAssessment.get(
          Number(assessment.id)
        );

      const checklist = criteriaMap
        ? Array.from(criteriaMap.values())
        : [];

      return {
        ...assessment,
        checklist
      };
    }
  );

  // =========================
  // QUIZZES
  // =========================

  const [quizRows] = await pool.query(
    `
      SELECT
        q.id,
        q.title,
        q.topic,
        q.quiz_date,
        q.max_score,

        qr.score,
        qr.completed_at

      FROM quizzes q

      LEFT JOIN quiz_results qr
        ON qr.quiz_id = q.id
       AND qr.student_id = ?

      WHERE q.group_id = ?

      ORDER BY
        q.quiz_date DESC,
        q.id DESC
    `,
    [
      studentId,
      groupId
    ]
  );

  // =========================
  // ATTENDANCE
  // =========================

  const [attendanceRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS total_sessions,

        SUM(
          CASE
            WHEN status IN ('present', 'late')
            THEN 1
            ELSE 0
          END
        ) AS attended_sessions,

        SUM(
          CASE
            WHEN status = 'absent'
            THEN 1
            ELSE 0
          END
        ) AS absent_sessions,

        SUM(
          CASE
            WHEN status = 'late'
            THEN 1
            ELSE 0
          END
        ) AS late_sessions,

        SUM(
          CASE
            WHEN status = 'excused'
            THEN 1
            ELSE 0
          END
        ) AS excused_sessions

      FROM attendance

      WHERE student_id = ?
        AND group_id = ?
    `,
    [
      studentId,
      groupId
    ]
  );

  const attendanceRow =
    attendanceRows[0] || {};

  const totalSessions = Number(
    attendanceRow.total_sessions || 0
  );

  const attendedSessions = Number(
    attendanceRow.attended_sessions || 0
  );

  // =========================
  // FINAL GRADE
  // =========================

  const [finalGradeRows] = await pool.query(
    `
      SELECT
        id,
        student_id,
        group_id,
        score,
        comment,
        teacher_id,
        created_at,
        updated_at

      FROM final_grades

      WHERE student_id = ?
        AND group_id = ?

      LIMIT 1
    `,
    [
      studentId,
      groupId
    ]
  );

  // =========================
  // ACADEMIC AVERAGE
  // =========================

  const percentages = [
    ...assessmentRows,
    ...quizRows
  ]
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        Number(item.max_score) > 0
    )
    .map(
      (item) =>
        (
          Number(item.score) /
          Number(item.max_score)
        ) * 100
    );

  const academicAverage =
    percentages.length > 0
      ? Number(
          (
            percentages.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / percentages.length
          ).toFixed(2)
        )
      : null;

  // =========================
  // RESPONSE
  // =========================

  res.json({
    success: true,

    data: {
      student,

      assessments:
        assessmentsWithChecklist,

      quizzes: quizRows,

      attendance: {
        total_sessions:
          totalSessions,

        attended_sessions:
          attendedSessions,

        absent_sessions:
          Number(
            attendanceRow.absent_sessions || 0
          ),

        late_sessions:
          Number(
            attendanceRow.late_sessions || 0
          ),

        excused_sessions:
          Number(
            attendanceRow.excused_sessions || 0
          ),

        percentage:
          totalSessions > 0
            ? Number(
                (
                  (
                    attendedSessions /
                    totalSessions
                  ) * 100
                ).toFixed(1)
              )
            : null
      },

      summary: {
        graded_assessments:
          assessmentRows.filter(
            (item) =>
              item.score !== null &&
              item.score !== undefined
          ).length,

        graded_quizzes:
          quizRows.filter(
            (item) =>
              item.score !== null &&
              item.score !== undefined
          ).length,

        graded_items:
          percentages.length,

        academic_average:
          academicAverage
      },

      final_grade:
        finalGradeRows[0] || null
    }
  });
});

export const saveFinalGrade = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.id);
  const groupId = Number(req.body?.group_id);
  const score = Number(req.body?.score);
  const comment = req.body?.comment == null ? null : String(req.body.comment).trim() || null;
  const teacherId = Number(req.user.sub);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ApiError(400, 'Invalid student id');
  }

  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new ApiError(400, 'A valid group_id is required');
  }

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new ApiError(400, 'Final grade must be between 0 and 100');
  }

  const [studentRows] = await pool.query(
    `SELECT 1 FROM group_students gs
     INNER JOIN users u ON u.id = gs.student_id
     WHERE gs.student_id = ? AND gs.group_id = ? AND u.role = 'student'
     LIMIT 1`,
    [studentId, groupId]
  );

  if (!studentRows.length) {
    throw new ApiError(404, 'Student is not enrolled in this group');
  }

  if (req.user.role === 'teacher') {
    const [accessRows] = await pool.query(
      `SELECT 1 FROM group_teachers
       WHERE group_id = ? AND teacher_id = ?
       LIMIT 1`,
      [groupId, teacherId]
    );

    if (!accessRows.length) {
      throw new ApiError(403, 'You do not have access to this group');
    }
  }

  await pool.query(
    `INSERT INTO final_grades (student_id, group_id, score, comment, teacher_id)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       score = VALUES(score),
       comment = VALUES(comment),
       teacher_id = VALUES(teacher_id),
       updated_at = CURRENT_TIMESTAMP`,
    [studentId, groupId, score, comment, teacherId]
  );

  const [rows] = await pool.query(
    `SELECT id, student_id, group_id, score, comment, teacher_id, created_at, updated_at
     FROM final_grades
     WHERE student_id = ? AND group_id = ?
     LIMIT 1`,
    [studentId, groupId]
  );

  res.json({
    success: true,
    message: 'Final grade saved successfully',
    data: rows[0]
  });
});

export const updateMyGithubUsername = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { github_username } = req.body;
  if (!github_username || typeof github_username !== 'string') throw new ApiError(400, 'Please provide a valid GitHub username');
  const cleanUsername = github_username.trim().replace(/^@/, '');
  const [existing] = await pool.query('SELECT id FROM users WHERE github_username = ? AND id != ?', [cleanUsername, userId]);
  if (existing.length) throw new ApiError(409, 'This GitHub username is already registered to another user');
  await pool.query('UPDATE users SET github_username = ? WHERE id = ?', [cleanUsername, userId]);
  res.json({ success: true, message: 'GitHub username updated successfully.', data: { user_id: userId, github_username: cleanUsername } });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const [user] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user.length) throw new ApiError(404, 'User not found');
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'User deleted successfully' });
});