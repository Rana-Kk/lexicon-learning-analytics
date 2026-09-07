import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  teacherOwnsGroup,
  teacherHasStudent,
  getTeacherGroupIds,
} from '../utils/scope.js';

export const getQuizzes = asyncHandler(async (req, res) => {
  const { group_id, student_id } = req.query;

  let q = `
    SELECT
      q.*,
      sg.name AS group_name,
      COUNT(qr.id) AS result_count
    FROM quizzes q
    JOIN student_groups sg
      ON sg.id = q.group_id
    LEFT JOIN quiz_results qr
      ON qr.quiz_id = q.id
    WHERE 1=1
  `;

  const p = [];

  // --------------------------------------------------
  // TEACHER SCOPE
  // --------------------------------------------------
  if (req.user.role === 'teacher') {
    if (group_id) {
      if (!(await teacherOwnsGroup(req.user.sub, group_id))) {
        throw new ApiError(
          403,
          'You do not have access to this group'
        );
      }

      q += ` AND q.group_id = ?`;
      p.push(group_id);
    } else {
      const groupIds = await getTeacherGroupIds(req.user.sub);

      if (!groupIds.length) {
        return res.json({
          success: true,
          count: 0,
          data: [],
        });
      }

      q += ` AND q.group_id IN (?)`;
      p.push(groupIds);
    }

    if (student_id) {
      if (!(await teacherHasStudent(req.user.sub, student_id))) {
        throw new ApiError(
          403,
          'You do not have access to this student'
        );
      }

      q += `
        AND EXISTS (
          SELECT 1
          FROM quiz_results x
          WHERE x.quiz_id = q.id
            AND x.student_id = ?
        )
      `;
      p.push(student_id);
    }
  }

  // --------------------------------------------------
  // STUDENT SCOPE
  // --------------------------------------------------
  else if (req.user.role === 'student') {
    q += `
      AND EXISTS (
        SELECT 1
        FROM group_students gs
        WHERE gs.group_id = q.group_id
          AND gs.student_id = ?
      )
    `;
    p.push(req.user.sub);

    if (student_id && String(student_id) !== String(req.user.sub)) {
      throw new ApiError(
        403,
        'You can only access your own quiz data'
      );
    }

    if (student_id) {
      q += `
        AND EXISTS (
          SELECT 1
          FROM quiz_results x
          WHERE x.quiz_id = q.id
            AND x.student_id = ?
        )
      `;
      p.push(student_id);
    }
  }

  // --------------------------------------------------
  // ADMIN
  // --------------------------------------------------
  else if (req.user.role === 'admin') {
    if (group_id) {
      q += ` AND q.group_id = ?`;
      p.push(group_id);
    }

    if (student_id) {
      q += `
        AND EXISTS (
          SELECT 1
          FROM quiz_results x
          WHERE x.quiz_id = q.id
            AND x.student_id = ?
        )
      `;
      p.push(student_id);
    }
  }

  q += `
    GROUP BY q.id
    ORDER BY q.quiz_date DESC, q.id DESC
  `;

  const [rows] = await pool.query(q, p);

  res.json({
    success: true,
    count: rows.length,
    data: rows,
  });
});


/**
 * GET /api/quizzes/:id
 */
export const getQuizById = asyncHandler(async (req, res) => {
  const quizId = req.params.id;

  const [rows] = await pool.query(
    `
      SELECT
        q.*,
        sg.name AS group_name
      FROM quizzes q
      JOIN student_groups sg
        ON sg.id = q.group_id
      WHERE q.id = ?
    `,
    [quizId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Quiz not found');
  }

  const quiz = rows[0];

  // --------------------------------------------------
  // TEACHER
  // --------------------------------------------------
  if (req.user.role === 'teacher') {
    if (!(await teacherOwnsGroup(req.user.sub, quiz.group_id))) {
      throw new ApiError(
        403,
        'You do not have access to this quiz'
      );
    }
  }

  // --------------------------------------------------
  // STUDENT
  // --------------------------------------------------
  if (req.user.role === 'student') {
    const [membership] = await pool.query(
      `
        SELECT 1
        FROM group_students
        WHERE group_id = ?
          AND student_id = ?
        LIMIT 1
      `,
      [quiz.group_id, req.user.sub]
    );

    if (!membership.length) {
      throw new ApiError(
        403,
        'You do not have access to this quiz'
      );
    }
  }

  let resultQuery = `
    SELECT
      qr.*,
      u.name AS student_name,
      u.email AS student_email
    FROM quiz_results qr
    JOIN users u
      ON u.id = qr.student_id
    WHERE qr.quiz_id = ?
  `;

  const resultParams = [quizId];

  if (req.user.role === 'student') {
    resultQuery += ` AND qr.student_id = ?`;
    resultParams.push(req.user.sub);
  }

  const [results] = await pool.query(
    `${resultQuery} ORDER BY u.name`,
    resultParams
  );

  res.json({
    success: true,
    data: {
      ...quiz,
      results,
    },
  });
});


/**
 * POST /api/quizzes
 */
export const createQuiz = asyncHandler(async (req, res) => {
  const {
    group_id,
    title,
    topic,
    quiz_date,
    max_score = 100,
    source = 'manual',
  } = req.body;

  if (!group_id || !title || max_score === undefined) {
    throw new ApiError(
      400,
      'group_id, title and max_score are required'
    );
  }

  const [g] = await pool.query(
    'SELECT id FROM student_groups WHERE id = ?',
    [group_id]
  );

  if (!g.length) {
    throw new ApiError(404, 'Group not found');
  }

  if (req.user.role === 'teacher') {
    if (!(await teacherOwnsGroup(req.user.sub, group_id))) {
      throw new ApiError(
        403,
        'You do not have access to this group'
      );
    }
  }

  const [r] = await pool.query(
    `
      INSERT INTO quizzes
        (
          group_id,
          title,
          topic,
          quiz_date,
          max_score,
          source,
          created_by
        )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      group_id,
      title.trim(),
      topic?.trim() || null,
      quiz_date || null,
      max_score,
      source,
      req.user.sub,
    ]
  );

  const [rows] = await pool.query(
    'SELECT * FROM quizzes WHERE id = ?',
    [r.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Quiz created successfully',
    data: rows[0],
  });
});


/**
 * PUT /api/quizzes/:id
 *
 */
export const updateQuiz = asyncHandler(async (req, res) => {
  const {
    title,
    topic,
    quiz_date,
    max_score,
    group_id,
  } = req.body;

  const [existing] = await pool.query(
    `
      SELECT id, group_id
      FROM quizzes
      WHERE id = ?
    `,
    [req.params.id]
  );

  if (!existing.length) {
    throw new ApiError(404, 'Quiz not found');
  }

  const currentGroupId = existing[0].group_id;

  if (req.user.role === 'teacher') {
    if (
      !(await teacherOwnsGroup(
        req.user.sub,
        currentGroupId
      ))
    ) {
      throw new ApiError(
        403,
        'You do not have access to this quiz'
      );
    }

    if (
      group_id !== undefined &&
      group_id !== null &&
      Number(group_id) !== Number(currentGroupId)
    ) {
      if (
        !(await teacherOwnsGroup(
          req.user.sub,
          group_id
        ))
      ) {
        throw new ApiError(
          403,
          'You do not have access to the target group'
        );
      }
    }
  }

  await pool.query(
    `
      UPDATE quizzes
      SET
        title = COALESCE(?, title),
        topic = COALESCE(?, topic),
        quiz_date = COALESCE(?, quiz_date),
        max_score = COALESCE(?, max_score),
        group_id = COALESCE(?, group_id)
      WHERE id = ?
    `,
    [
      title?.trim() || null,
      topic?.trim() || null,
      quiz_date || null,
      max_score ?? null,
      group_id ?? null,
      req.params.id,
    ]
  );

  const [rows] = await pool.query(
    'SELECT * FROM quizzes WHERE id = ?',
    [req.params.id]
  );

  res.json({
    success: true,
    data: rows[0],
  });
});


/**
 * DELETE /api/quizzes/:id
 *
 */
export const deleteQuiz = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    `
      SELECT id, group_id
      FROM quizzes
      WHERE id = ?
    `,
    [req.params.id]
  );

  if (!existing.length) {
    throw new ApiError(404, 'Quiz not found');
  }

  if (req.user.role === 'teacher') {
    if (
      !(await teacherOwnsGroup(
        req.user.sub,
        existing[0].group_id
      ))
    ) {
      throw new ApiError(
        403,
        'You do not have access to this quiz'
      );
    }
  }

  const [r] = await pool.query(
    'DELETE FROM quizzes WHERE id = ?',
    [req.params.id]
  );

  if (!r.affectedRows) {
    throw new ApiError(404, 'Quiz not found');
  }

  res.json({
    success: true,
    message: 'Quiz deleted successfully',
  });
});


/**
 * GET /api/quizzes/results
 */
export const getQuizResults = asyncHandler(async (req, res) => {
  const {
    quiz_id,
    student_id,
    group_id,
  } = req.query;

  let q = `
    SELECT
      qr.*,
      q.title AS quiz_title,
      q.topic,
      q.max_score,
      q.quiz_date,
      q.group_id,
      sg.name AS group_name,
      c.id AS course_id,
      c.name AS course_name,
      u.name AS student_name,
      u.email AS student_email
    FROM quiz_results qr
    JOIN quizzes q
      ON q.id = qr.quiz_id
    JOIN student_groups sg
      ON sg.id = q.group_id
    JOIN courses c
      ON c.id = sg.course_id
    JOIN users u
      ON u.id = qr.student_id
    WHERE 1=1
  `;

  const p = [];

  // --------------------------------------------------
  // TEACHER
  // --------------------------------------------------
  if (req.user.role === 'teacher') {
    if (group_id) {
      if (!(await teacherOwnsGroup(req.user.sub, group_id))) {
        throw new ApiError(
          403,
          'You do not have access to this group'
        );
      }

      q += ` AND q.group_id = ?`;
      p.push(group_id);
    } else {
      const groupIds = await getTeacherGroupIds(req.user.sub);

      if (!groupIds.length) {
        return res.json({
          success: true,
          count: 0,
          data: [],
        });
      }

      q += ` AND q.group_id IN (?)`;
      p.push(groupIds);
    }

    if (student_id) {
      if (!(await teacherHasStudent(req.user.sub, student_id))) {
        throw new ApiError(
          403,
          'You do not have access to this student'
        );
      }

      q += ` AND qr.student_id = ?`;
      p.push(student_id);
    }
  }

  // --------------------------------------------------
  // STUDENT
  // --------------------------------------------------
  else if (req.user.role === 'student') {
    if (
      student_id &&
      String(student_id) !== String(req.user.sub)
    ) {
      throw new ApiError(
        403,
        'You can only access your own quiz results'
      );
    }

    q += ` AND qr.student_id = ?`;
    p.push(req.user.sub);

    q += `
      AND EXISTS (
        SELECT 1
        FROM group_students gs
        WHERE gs.group_id = q.group_id
          AND gs.student_id = ?
      )
    `;
    p.push(req.user.sub);
  }

  // --------------------------------------------------
  // ADMIN
  // --------------------------------------------------
  else if (req.user.role === 'admin') {
    if (student_id) {
      q += ` AND qr.student_id = ?`;
      p.push(student_id);
    }

    if (group_id) {
      q += ` AND q.group_id = ?`;
      p.push(group_id);
    }
  }
  if (quiz_id) {
    q += ` AND qr.quiz_id = ?`;
    p.push(quiz_id);
  }

  q += `
    ORDER BY qr.completed_at DESC, qr.id DESC
  `;

  const [rows] = await pool.query(q, p);

  const data = rows.map((r) => ({
    ...r,
    percentage: r.max_score
      ? Math.round(
          (Number(r.score) / Number(r.max_score)) * 100
        )
      : 0,
  }));

  res.json({
    success: true,
    count: data.length,
    data,
  });
});


/**
 * POST /api/quizzes/results
 */
export const upsertQuizResult = asyncHandler(async (req, res) => {
  const {
    quiz_id,
    student_id,
    score,
    completed_at,
  } = req.body;

  const sid =
    req.user.role === 'student'
      ? req.user.sub
      : student_id;

  if (
    !quiz_id ||
    !sid ||
    score === undefined
  ) {
    throw new ApiError(
      400,
      'quiz_id, student_id and score are required'
    );
  }

  const [q] = await pool.query(
    `
      SELECT id, max_score, group_id
      FROM quizzes
      WHERE id = ?
    `,
    [quiz_id]
  );

  if (!q.length) {
    throw new ApiError(404, 'Quiz not found');
  }

  const quiz = q[0];

  if (req.user.role === 'teacher') {
    if (
      !(await teacherOwnsGroup(
        req.user.sub,
        quiz.group_id
      ))
    ) {
      throw new ApiError(
        403,
        'You do not have access to this quiz'
      );
    }

    if (
      !(await teacherHasStudent(
        req.user.sub,
        sid
      ))
    ) {
      throw new ApiError(
        403,
        'You do not have access to this student'
      );
    }
  }

  if (req.user.role === 'student') {
    const [membership] = await pool.query(
      `
        SELECT 1
        FROM group_students
        WHERE group_id = ?
          AND student_id = ?
        LIMIT 1
      `,
      [quiz.group_id, sid]
    );

    if (!membership.length) {
      throw new ApiError(
        403,
        'You do not have access to this quiz'
      );
    }
  }

  const [s] = await pool.query(
    `
      SELECT id
      FROM users
      WHERE id = ?
        AND role = 'student'
    `,
    [sid]
  );

  if (!s.length) {
    throw new ApiError(404, 'Student not found');
  }

  await pool.query(
    `
      INSERT INTO quiz_results
        (
          quiz_id,
          student_id,
          score,
          completed_at
        )
      VALUES (
        ?,
        ?,
        ?,
        COALESCE(?, NOW())
      )
      ON DUPLICATE KEY UPDATE
        score = VALUES(score),
        completed_at = VALUES(completed_at)
    `,
    [
      quiz_id,
      sid,
      score,
      completed_at || null,
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        qr.*,
        q.title AS quiz_title,
        q.topic,
        q.max_score,
        q.quiz_date,
        u.name AS student_name
      FROM quiz_results qr
      JOIN quizzes q
        ON q.id = qr.quiz_id
      JOIN users u
        ON u.id = qr.student_id
      WHERE qr.quiz_id = ?
        AND qr.student_id = ?
    `,
    [quiz_id, sid]
  );

  res.status(201).json({
    success: true,
    message: 'Quiz result saved successfully',
    data: {
      ...rows[0],
      percentage: Math.round(
        (Number(rows[0].score) /
          Number(rows[0].max_score)) *
          100
      ),
    },
  });
});


/**
 * POST /api/quizzes/import-results
 */
export const bulkImportQuizResults = asyncHandler(
  async (req, res) => {
    const {
      file_name = 'manual-import',
      results = [],
    } = req.body;

    if (
      !Array.isArray(results) ||
      !results.length
    ) {
      throw new ApiError(
        400,
        'results array is required'
      );
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [batch] = await conn.query(
        `
          INSERT INTO import_batches
            (
              import_type,
              file_name,
              imported_by,
              status
            )
          VALUES
            ('quiz', ?, ?, 'confirmed')
        `,
        [
          file_name,
          req.user.sub,
        ]
      );

      let imported = 0;
      let skipped = 0;

      for (
        let i = 0;
        i < results.length;
        i++
      ) {
        const r = results[i];

        const [stu] = await conn.query(
          `
            SELECT id
            FROM users
            WHERE email = ?
              AND role = 'student'
          `,
          [r.email]
        );

        let quiz = [];

        if (stu.length) {
          const quizParams = [r.quiz_id || 0, r.quiz_title || '', stu[0].id];
          let quizSql = `
            SELECT
              q.id,
              q.group_id
            FROM quizzes q
            JOIN group_students gs
              ON gs.group_id = q.group_id
             AND gs.student_id = ?
            WHERE (q.id = ? OR LOWER(TRIM(q.title)) = LOWER(TRIM(?)))
          `;

          quizParams.splice(0, quizParams.length, stu[0].id, r.quiz_id || 0, r.quiz_title || '');

          if (req.user.role === 'teacher') {
            quizSql += `
              AND EXISTS (
                SELECT 1
                FROM group_teachers gt2
                WHERE gt2.group_id = q.group_id
                  AND gt2.teacher_id = ?
              )
            `;
            quizParams.push(req.user.sub);
          }

          quizSql += ` ORDER BY q.id DESC LIMIT 1`;

          [quiz] = await conn.query(quizSql, quizParams);

          if (!quiz.length && req.user.role === 'teacher') {
            const [studentGroups] = await conn.query(
              `
                SELECT gs.group_id
                FROM group_students gs
                JOIN group_teachers gt
                  ON gt.group_id = gs.group_id
                WHERE gs.student_id = ?
                  AND gt.teacher_id = ?
                ORDER BY gs.group_id
                LIMIT 1
              `,
              [stu[0].id, req.user.sub]
            );

            if (studentGroups.length) {
              const [createdQuiz] = await conn.query(
                `
                  INSERT INTO quizzes
                    (group_id, title, topic, quiz_date, max_score, source, import_batch_id, created_by)
                  VALUES (?, ?, ?, ?, 100, 'imported', ?, ?)
                `,
                [
                  studentGroups[0].group_id,
                  String(r.quiz_title || '').trim(),
                  r.topic ? String(r.topic).trim() : null,
                  r.completed_at ? String(r.completed_at).slice(0, 10) : null,
                  batch.insertId,
                  req.user.sub,
                ]
              );

              quiz = [{
                id: createdQuiz.insertId,
                group_id: studentGroups[0].group_id,
              }];
            }
          }
        }

        let valid =
          stu.length &&
          quiz.length &&
          r.score !== undefined;

        let errorMessage = null;

        if (
          valid &&
          req.user.role === 'teacher'
        ) {
          const [ownership] =
            await conn.query(
              `
                SELECT 1
                FROM group_teachers gt
                WHERE gt.group_id = ?
                  AND gt.teacher_id = ?
                LIMIT 1
              `,
              [
                quiz[0].group_id,
                req.user.sub,
              ]
            );

          if (!ownership.length) {
            valid = false;
            errorMessage =
              'Teacher does not have access to quiz group';
          }

          if (valid) {
            const [studentAccess] =
              await conn.query(
                `
                  SELECT 1
                  FROM group_students gs
                  JOIN group_teachers gt
                    ON gt.group_id = gs.group_id
                  WHERE gs.student_id = ?
                    AND gs.group_id = ?
                    AND gt.teacher_id = ?
                  LIMIT 1
                `,
                [
                  stu[0].id,
                  quiz[0].group_id,
                  req.user.sub,
                ]
              );

            if (!studentAccess.length) {
              valid = false;
              errorMessage =
                'Teacher does not have access to this student';
            }
          }
        }

        await conn.query(
          `
            INSERT INTO import_rows
              (
                batch_id,
                row_no,
                raw_data,
                status,
                error_message,
                matched_user_id
              )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            batch.insertId,
            i + 1,
            JSON.stringify(r),
            valid
              ? 'valid'
              : 'invalid',
            valid
              ? null
              : (
                  errorMessage ||
                  'Student/quiz/score could not be matched'
                ),
            stu[0]?.id || null,
          ]
        );

        if (valid) {
          await conn.query(
            `
              INSERT INTO quiz_results
                (
                  quiz_id,
                  student_id,
                  score,
                  completed_at
                )
              VALUES
                (?, ?, ?, COALESCE(?, NOW()))
              ON DUPLICATE KEY UPDATE
                score = VALUES(score),
                completed_at = VALUES(completed_at)
            `,
            [
              quiz[0].id,
              stu[0].id,
              r.score,
              r.completed_at || null,
            ]
          );

          imported++;
        } else {
          skipped++;
        }
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: 'Quiz import completed',
        data: {
          batch_id: batch.insertId,
          imported,
          skipped,
        },
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
);