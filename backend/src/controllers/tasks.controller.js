import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherOwnsGroup } from '../utils/scope.js';

export const getTasks = asyncHandler(async (req, res) => {
  const { role, sub: userId } = req.user;
  const { course_id, group_id, status } = req.query;

  if (role === 'teacher' || role === 'admin') {
    const joins = [];
    const p = [];

    if (group_id) {
      joins.push('JOIN teams tm_filter ON tm_filter.id = tt.team_id');
    }

    let q = `SELECT t.*, GROUP_CONCAT(tt.team_id) team_ids
             FROM tasks t
             LEFT JOIN task_teams tt ON tt.task_id=t.id
             ${joins.join(' ')}
             WHERE 1=1`;

    if (role === 'teacher') {
      q += ' AND t.teacher_id=?';
      p.push(userId);
    }
    if (course_id) { q += ' AND t.course_id=?'; p.push(course_id); }
    if (group_id) { q += ' AND tm_filter.group_id=?'; p.push(group_id); }
    if (status) { q += ' AND t.status=?'; p.push(status); }

    q += ' GROUP BY t.id ORDER BY t.created_at DESC';
    const [rows] = await pool.query(q, p);
    return res.json({ success: true, data: rows });
  }

  // student — active tasks assigned to their own team(s), same pattern as getMyTeam
  const [rows] = await pool.query(
    `SELECT DISTINCT t.id, t.title, t.description, t.status, t.created_at
     FROM tasks t
     JOIN task_teams tt ON tt.task_id=t.id
     JOIN team_members tm ON tm.team_id=tt.team_id
     WHERE tm.student_id=? AND t.status='active'
     ORDER BY t.created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: rows });
});

export const getTaskById = asyncHandler(async (req, res) => {
  const { role, sub: userId } = req.user;
  const { id } = req.params;

  const [t] = await pool.query('SELECT * FROM tasks WHERE id=?', [id]);
  if (!t.length) throw new ApiError(404, 'Task not found');
  const task = t[0];

  if (role === 'teacher' && task.teacher_id !== userId) {
    throw new ApiError(403, 'You do not have access to this task');
  }

  const [teams] = await pool.query(
    `SELECT tm.id, tm.name, tm.group_id FROM teams tm
     JOIN task_teams tt ON tt.team_id=tm.id WHERE tt.task_id=?`,
    [id]
  );

  if (role === 'student') {
    return res.json({ success: true, data: { ...task, teams } });
  }

const [summary] = await pool.query(
  `SELECT
      pe.evaluated_id,
      u.name AS student_name,
      tm.team_id,
      t.name AS team_name,
      AVG(pe.score) AS avg_score,
      COUNT(*) AS vote_count
   FROM peer_evaluations pe
   JOIN users u ON u.id = pe.evaluated_id
   JOIN team_members tm ON tm.student_id = pe.evaluated_id
   JOIN teams t ON t.id = tm.team_id
   JOIN task_teams tt ON tt.team_id = tm.team_id
   WHERE pe.context_type='task'
     AND pe.context_id=?
     AND tt.task_id=?
   GROUP BY pe.evaluated_id, u.name, tm.team_id, t.name`,
  [id, id]
);
  const [details] = await pool.query(
    `SELECT evaluator_id, evaluated_id, score, comment
     FROM peer_evaluations WHERE context_type='task' AND context_id=?`,
    [id]
  );

  res.json({
    success: true,
    data: { ...task, teams, peer_evaluation_summary: summary, peer_evaluation_details: details }
  });
});

export const createTask = asyncHandler(async (req, res) => {
  const teacherId = req.user.sub;
  const { title, description, team_ids } = req.body;

  if (!title || !description || !Array.isArray(team_ids) || !team_ids.length) {
    throw new ApiError(400, 'title, description and at least one team_id are required');
  }

  const [teams] = await pool.query('SELECT id, group_id FROM teams WHERE id IN (?)', [team_ids]);
  if (teams.length !== team_ids.length) throw new ApiError(404, 'One or more teams not found');

  // A weekly task belongs to a single group, not a whole course — a course
  // can have several groups (cohorts) running in parallel, and mixing teams
  // from different groups into one task would leak visibility across them.
  const groupIds = [...new Set(teams.map((t) => t.group_id))];
  if (groupIds.length > 1) {
    throw new ApiError(400, 'All selected teams must belong to the same group');
  }
  const groupId = groupIds[0];

  if (req.user.role === 'teacher' && !(await teacherOwnsGroup(teacherId, groupId))) {
    throw new ApiError(403, 'You are not assigned to the group of the selected teams');
  }

  const [groupRows] = await pool.query('SELECT course_id FROM student_groups WHERE id = ?', [groupId]);
  if (!groupRows.length) throw new ApiError(404, 'Group not found');
  const course_id = groupRows[0].course_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [r] = await conn.query(
      `INSERT INTO tasks(teacher_id, course_id, title, description, status)
       VALUES(?,?,?,?,'active')`,
      [teacherId, course_id, title, description]
    );
    const taskId = r.insertId;

    await conn.query(
      'INSERT INTO task_teams(task_id, team_id) VALUES ?',
      [team_ids.map((tid) => [taskId, tid])]
    );

    await conn.commit();

    const [x] = await pool.query('SELECT * FROM tasks WHERE id=?', [taskId]);
    res.status(201).json({ success: true, data: { ...x[0], group_id: groupId, team_ids } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

export const updateTaskNote = asyncHandler(async (req, res) => {
  const teacherId = req.user.sub;
  const { id } = req.params;
  const { teacher_note } = req.body;

  const [r] = await pool.query(
    'UPDATE tasks SET teacher_note=? WHERE id=? AND teacher_id=?',
    [teacher_note, id, teacherId]
  );
  if (!r.affectedRows) throw new ApiError(404, 'Task not found');

  const [x] = await pool.query('SELECT * FROM tasks WHERE id=?', [id]);
  res.json({ success: true, data: x[0] });
});

export const closeTask = asyncHandler(async (req, res) => {
  const teacherId = req.user.sub;
  const { id } = req.params;
  const { teacher_note } = req.body;

  const [r] = await pool.query(
    `UPDATE tasks SET status='inactive', closed_at=NOW(), teacher_note=COALESCE(?, teacher_note)
     WHERE id=? AND teacher_id=?`,
    [teacher_note || null, id, teacherId]
  );
  if (!r.affectedRows) throw new ApiError(404, 'Task not found');

  const [x] = await pool.query('SELECT * FROM tasks WHERE id=?', [id]);
  res.json({ success: true, data: x[0] });
});