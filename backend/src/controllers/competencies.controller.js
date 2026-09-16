import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherHasStudent, teacherOwnsGroup } from '../utils/scope.js';

// =====================================================
// HELPERS
// =====================================================

async function teacherOwnsCourse(teacherId, courseId) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM group_teachers gt
     JOIN student_groups sg ON sg.id = gt.group_id
     WHERE gt.teacher_id = ? AND sg.course_id = ?
     LIMIT 1`,
    [teacherId, courseId]
  );
  return rows.length > 0;
}

// =====================================================
// COMPETENCIES (course-level master list)
// =====================================================

export const listCompetencies = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM competencies ORDER BY name');
  res.json({ success: true, data: rows });
});

// GET /api/courses/:courseId/competencies
// Course'un ortak (master) competency listesi
export const getCourseCompetencies = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  if (!courseId) throw new ApiError(400, 'course_id is required');

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsCourse(req.user.sub, courseId))
  ) {
    throw new ApiError(403, 'You do not have access to this course');
  }

  const [rows] = await pool.query(
    `SELECT id, course_id, name, description
       FROM competencies
      WHERE course_id = ?
      ORDER BY name`,
    [courseId]
  );

  res.json({ success: true, data: rows });
});

// POST /api/competencies
// Bir group üzerinden çağrılır: course'da aynı isim varsa onu kullanır,
// yoksa course'a yeni bir master competency oluşturur; sonra bu group'a bağlar.
export const createCompetency = asyncHandler(async (req, res) => {
  const { name, description, group_id } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'name is required');
  }

  if (!group_id) {
    throw new ApiError(400, 'group_id is required');
  }

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, group_id))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  const [group] = await pool.query(
    'SELECT id, course_id FROM student_groups WHERE id = ?',
    [group_id]
  );

  if (!group.length) {
    throw new ApiError(404, 'Group not found');
  }

  const courseId = group[0].course_id;
  const cleanName = name.trim();

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Bu course'da aynı isimde competency zaten var mı?
    const [existing] = await conn.query(
      `SELECT id, course_id, name, description FROM competencies
       WHERE course_id = ? AND name = ?`,
      [courseId, cleanName]
    );

    let competencyId;
    let competencyRow;

    if (existing.length) {
      // Varsa yeni satır oluşturma, mevcut master'ı kullan
      competencyId = existing[0].id;
      competencyRow = existing[0];
    } else {
      const [result] = await conn.query(
        `INSERT INTO competencies (course_id, name, description)
         VALUES (?, ?, ?)`,
        [courseId, cleanName, description?.trim() || null]
      );
      competencyId = result.insertId;
      competencyRow = {
        id: competencyId,
        course_id: courseId,
        name: cleanName,
        description: description?.trim() || null
      };
    }

    // Bu group'a bağla (zaten bağlıysa no-op)
    await conn.query(
      `INSERT INTO group_competencies (group_id, competency_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE competency_id = competency_id`,
      [group_id, competencyId]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      data: competencyRow
    });

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

// PUT /api/competencies/:competencyId
// Course seviyesinde master'ı günceller — override yapmamış TÜM group'ları etkiler
export const updateCompetency = asyncHandler(async (req, res) => {
  const { competencyId } = req.params;
  const { name, description } = req.body;

  const [existing] = await pool.query(
    'SELECT id, course_id FROM competencies WHERE id = ?',
    [competencyId]
  );
  if (!existing.length) throw new ApiError(404, 'Competency not found');

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsCourse(req.user.sub, existing[0].course_id))
  ) {
    throw new ApiError(403, 'You do not have access to this course');
  }

  await pool.query(
    `UPDATE competencies SET
       name = COALESCE(?, name),
       description = COALESCE(?, description)
     WHERE id = ?`,
    [name?.trim() || null, description?.trim() || null, competencyId]
  );

  const [rows] = await pool.query(
    'SELECT id, course_id, name, description FROM competencies WHERE id = ?',
    [competencyId]
  );

  res.json({ success: true, data: rows[0] });
});

// =====================================================
// STUDENT COMPETENCY SCORES
// =====================================================

export const getStudentCompetencies = asyncHandler(async (req, res) => {
  const sid =
    req.user.role === 'student'
      ? req.user.sub
      : req.params.studentId || req.query.student_id;

  if (!sid) {
    throw new ApiError(400, 'student_id is required');
  }

  if (
    req.user.role === 'teacher' &&
    !(await teacherHasStudent(req.user.sub, sid))
  ) {
    throw new ApiError(403, 'You do not have access to this student');
  }

  const [rows] = await pool.query(
    `SELECT DISTINCT
        c.id AS competency_id,
        COALESCE(gco.name, c.name) AS name,
        COALESCE(gco.description, c.description) AS description,
        COALESCE(sc.score, 0) AS score,
        (
          SELECT h.score
          FROM student_competency_history h
          WHERE h.student_id = ?
            AND h.competency_id = c.id
          ORDER BY h.recorded_at DESC
          LIMIT 1 OFFSET 1
        ) AS previous_score
     FROM group_students gs
     JOIN group_competencies gc
       ON gc.group_id = gs.group_id
     JOIN competencies c
       ON c.id = gc.competency_id
     LEFT JOIN group_competency_overrides gco
       ON gco.group_id = gs.group_id AND gco.competency_id = c.id
     LEFT JOIN student_competencies sc
       ON sc.student_id = ?
      AND sc.competency_id = c.id
     WHERE gs.student_id = ?
     ORDER BY name`,
    [sid, sid, sid]
  );

  const data = rows.map((r) => ({
    ...r,
    trend:
      r.previous_score === null
        ? 'stable'
        : Number(r.score) > Number(r.previous_score) + 2
        ? 'improving'
        : Number(r.score) < Number(r.previous_score) - 2
        ? 'declining'
        : 'stable',
  }));

  res.json({
    success: true,
    data,
  });
});

export const upsertStudentCompetency = asyncHandler(async (req, res) => {
  const { student_id, competency_id, score } = req.body;
  if (!student_id || !competency_id || score === undefined) {
    throw new ApiError(400, 'student_id, competency_id and score are required');
  }

  if (req.user.role === 'teacher' && !(await teacherHasStudent(req.user.sub, student_id))) {
    throw new ApiError(403, 'You do not have access to this student');
  }

  const [s] = await pool.query("SELECT id FROM users WHERE id=? AND role='student'", [student_id]);
  if (!s.length) throw new ApiError(404, 'Student not found');

  const [c] = await pool.query('SELECT id FROM competencies WHERE id=?', [competency_id]);
  if (!c.length) throw new ApiError(404, 'Competency not found');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO student_competencies(student_id,competency_id,score) VALUES(?,?,?)
       ON DUPLICATE KEY UPDATE score=VALUES(score)`,
      [student_id, competency_id, score]
    );
    await conn.query(
      `INSERT INTO student_competency_history(student_id,competency_id,score) VALUES(?,?,?)`,
      [student_id, competency_id, score]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  res.json({ success: true, message: 'Competency updated' });
});

export const getCompetencyHistory = asyncHandler(async (req, res) => {
  const sid = req.user.role === 'student' ? req.user.sub : req.params.studentId;
  if (!sid) throw new ApiError(400, 'student_id is required');

  if (req.user.role === 'teacher' && !(await teacherHasStudent(req.user.sub, sid))) {
    throw new ApiError(403, 'You do not have access to this student');
  }

  const [rows] = await pool.query(
    `SELECT h.*, c.name competency_name
     FROM student_competency_history h
     JOIN competencies c ON c.id=h.competency_id
     WHERE h.student_id=?
     ORDER BY h.recorded_at ASC`,
    [sid]
  );
  res.json({ success: true, data: rows });
});

// =====================================================
// GROUP COMPETENCIES (assignment + per-group override)
// =====================================================

// GET /api/groups/:groupId/competencies
export const getGroupCompetencies = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  if (!groupId) throw new ApiError(400, 'group_id is required');

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, groupId))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  const [rows] = await pool.query(
    `SELECT
        c.id,
        COALESCE(gco.name, c.name) AS name,
        COALESCE(gco.description, c.description) AS description,
        c.name AS course_default_name,
        c.description AS course_default_description,
        c.course_id,
        (gco.competency_id IS NOT NULL) AS is_overridden
       FROM group_competencies gc
       JOIN competencies c ON c.id = gc.competency_id
       LEFT JOIN group_competency_overrides gco
         ON gco.group_id = gc.group_id AND gco.competency_id = gc.competency_id
      WHERE gc.group_id = ?
      ORDER BY name`,
    [groupId]
  );

  res.json({ success: true, data: rows });
});

// POST /api/groups/:groupId/competencies (body: { competency_id })
// Course'un mevcut bir master competency'sini bu group'a bağlar
export const addGroupCompetency = asyncHandler(async (req, res) => {
  const { group_id, competency_id } = req.body;

  if (!group_id || !competency_id) {
    throw new ApiError(400, 'group_id and competency_id are required');
  }

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, group_id))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  const [group] = await pool.query(
    'SELECT id FROM student_groups WHERE id = ?',
    [group_id]
  );
  if (!group.length) throw new ApiError(404, 'Group not found');

  const [competency] = await pool.query(
    'SELECT id FROM competencies WHERE id = ?',
    [competency_id]
  );
  if (!competency.length) throw new ApiError(404, 'Competency not found');

  await pool.query(
    `INSERT IGNORE INTO group_competencies (group_id, competency_id)
     VALUES (?, ?)`,
    [group_id, competency_id]
  );

  res.json({ success: true, message: 'Competency added to group' });
});

// DELETE /api/groups/:groupId/competencies/:competencyId
// Bu group'un competency listesinden tamamen çıkarır (override da varsa cascade ile silinir)
export const removeGroupCompetency = asyncHandler(async (req, res) => {
  const { groupId, competencyId } = req.params;

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, groupId))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  const [result] = await pool.query(
    `DELETE FROM group_competencies
      WHERE group_id = ? AND competency_id = ?`,
    [groupId, competencyId]
  );

  if (!result.affectedRows) {
    throw new ApiError(404, 'Group competency not found');
  }

  res.json({ success: true });
});

// PUT /api/groups/:groupId/competencies/:competencyId/override
// Bu competency'yi SADECE bu group için özelleştirir; diğer group'ları etkilemez
export const upsertGroupCompetencyOverride = asyncHandler(async (req, res) => {
  const { groupId, competencyId } = req.params;
  const { name, description } = req.body;

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, groupId))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  const [link] = await pool.query(
    'SELECT 1 FROM group_competencies WHERE group_id = ? AND competency_id = ?',
    [groupId, competencyId]
  );
  if (!link.length) {
    throw new ApiError(404, 'This competency is not assigned to this group');
  }

  await pool.query(
    `INSERT INTO group_competency_overrides (group_id, competency_id, name, description)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
    [groupId, competencyId, name?.trim() || null, description?.trim() || null]
  );

  res.json({ success: true, message: 'Group override saved' });
});

// DELETE /api/groups/:groupId/competencies/:competencyId/override
// Override'ı kaldırır, bu group course default'una geri döner
export const removeGroupCompetencyOverride = asyncHandler(async (req, res) => {
  const { groupId, competencyId } = req.params;

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, groupId))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  await pool.query(
    'DELETE FROM group_competency_overrides WHERE group_id = ? AND competency_id = ?',
    [groupId, competencyId]
  );

  res.json({ success: true, message: 'Reverted to course default' });
});