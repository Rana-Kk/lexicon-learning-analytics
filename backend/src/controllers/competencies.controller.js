import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherHasStudent, teacherOwnsGroup } from '../utils/scope.js';

export const listCompetencies = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM competencies ORDER BY name');
  res.json({ success: true, data: rows });
});

export const createCompetency = asyncHandler(async (req, res) => {
  const { name, description, group_id } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'name is required');
  }

  // Eğer öğretmen grup seçerek competency oluşturuyorsa,
  // o grubun gerçekten öğretmene ait olduğunu kontrol et.
  if (
    req.user.role === 'teacher' &&
    group_id &&
    !(await teacherOwnsGroup(req.user.sub, group_id))
  ) {
    throw new ApiError(403, 'You do not have access to this group');
  }

  // Grup gerçekten var mı?
  if (group_id) {
    const [group] = await pool.query(
      'SELECT id FROM student_groups WHERE id = ?',
      [group_id]
    );

    if (!group.length) {
      throw new ApiError(404, 'Group not found');
    }
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Competency oluştur
    const [result] = await conn.query(
      `INSERT INTO competencies (name, description)
       VALUES (?, ?)`,
      [name.trim(), description?.trim() || null]
    );

    const competencyId = result.insertId;

    // 2. Eğer grup seçildiyse otomatik olarak gruba bağla
    if (group_id) {
      await conn.query(
        `INSERT INTO group_competencies (group_id, competency_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE competency_id = competency_id`,
        [group_id, competencyId]
      );
    }

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT id, name, description
       FROM competencies
       WHERE id = ?`,
      [competencyId]
    );

    res.status(201).json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});
export const getStudentCompetencies = asyncHandler(async (req, res) => {
  const sid =
    req.user.role === 'student'
      ? req.user.sub
      : req.params.studentId || req.query.student_id;

  if (!sid) {
    throw new ApiError(400, 'student_id is required');
  }

  // Teacher can only access students in their own groups.
  if (
    req.user.role === 'teacher' &&
    !(await teacherHasStudent(req.user.sub, sid))
  ) {
    throw new ApiError(403, 'You do not have access to this student');
  }

  const [rows] = await pool.query(
    `SELECT DISTINCT
        c.id AS competency_id,
        c.name,
        c.description,
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
     LEFT JOIN student_competencies sc
       ON sc.student_id = ?
      AND sc.competency_id = c.id
     WHERE gs.student_id = ?
     ORDER BY c.name`,
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
    `SELECT c.id, c.name, c.description
       FROM group_competencies gc
       JOIN competencies c ON c.id = gc.competency_id
      WHERE gc.group_id = ?
      ORDER BY c.name`,
    [groupId]
  );

  res.json({ success: true, data: rows });
});

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