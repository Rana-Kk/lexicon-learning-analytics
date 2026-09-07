import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  teacherHasStudent,
  teacherOwnsGroup
} from '../utils/scope.js';
const VALID_SESSIONS = ['morning', 'afternoon'];
const VALID_STATUSES = ['present', 'late', 'absent', 'excused'];

// POST /api/attendance/bulk (Admin or Teacher)
// Records attendance for a whole group at once — one session, many students.
// body: { group_id, attendance_date, session, records: [{ student_id, status, note? }] }
export const recordBulkAttendance = asyncHandler(async (req, res) => {
  const { group_id, attendance_date, session, records } = req.body;
  const recorded_by = req.user.sub;

  if (!group_id || !attendance_date || !session) {
    throw new ApiError(400, 'group_id, attendance_date and session are required');
  }
  if (!VALID_SESSIONS.includes(session)) {
    throw new ApiError(400, `session must be one of: ${VALID_SESSIONS.join(', ')}`);
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'records must be a non-empty array of { student_id, status }');
  }
  for (const r of records) {
    if (!r.student_id || !VALID_STATUSES.includes(r.status)) {
      throw new ApiError(400, `Each record needs a student_id and a status in: ${VALID_STATUSES.join(', ')}`);
    }
  }

const [group] = await pool.query(
  'SELECT id FROM student_groups WHERE id = ?',
  [group_id]
);

if (group.length === 0) {
  throw new ApiError(404, 'Group not found');
}

if (
  req.user.role === 'teacher' &&
  !(await teacherOwnsGroup(req.user.sub, group_id))
) {
  throw new ApiError(
    403,
    'You do not have access to this group'
  );
}
if (req.user.role === 'teacher') {
  for (const r of records) {
    const [membership] = await pool.query(
      `
      SELECT 1
      FROM group_students
      WHERE group_id = ?
        AND student_id = ?
      LIMIT 1
      `,
      [group_id, r.student_id]
    );

    if (!membership.length) {
      throw new ApiError(
        403,
        `Student ${r.student_id} is not a member of this group`
      );
    }
  }
}

const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const r of records) {
      await conn.query(
        `INSERT INTO attendance (student_id, group_id, attendance_date, session, status, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), recorded_by = VALUES(recorded_by)`,
        [r.student_id, group_id, attendance_date, session, r.status, r.note || null, recorded_by]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [saved] = await pool.query(
    'SELECT * FROM attendance WHERE group_id = ? AND attendance_date = ? AND session = ?',
    [group_id, attendance_date, session]
  );

  res.status(200).json({
    success: true,
    message: 'Attendance recorded successfully',
    data: saved
  });
});

// GET /api/attendance?group_id=&attendance_date=&session=
// Lists raw records, filterable. Students are restricted to their own records.
export const getAttendance = asyncHandler(async (req, res) => {
  const { group_id, attendance_date, session, student_id } = req.query;

  let query = `
    SELECT a.*, u.name AS student_name, sg.name AS group_name
    FROM attendance a
    JOIN users u ON a.student_id = u.id
    JOIN student_groups sg ON sg.id = a.group_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'student') {
    query += ' AND a.student_id = ?';
    params.push(req.user.sub);
  } else if (req.user.role === 'teacher') {
    query += ' AND EXISTS (SELECT 1 FROM group_teachers gt WHERE gt.group_id = a.group_id AND gt.teacher_id = ?)';
    params.push(req.user.sub);
    if (student_id) {
      query += ' AND a.student_id = ?';
      params.push(student_id);
    }
  } else if (student_id) {
    query += ' AND a.student_id = ?';
    params.push(student_id);
  }

  if (group_id) {
    query += ' AND a.group_id = ?';
    params.push(group_id);
  }
  if (attendance_date) {
    query += ' AND a.attendance_date = ?';
    params.push(attendance_date);
  }
  if (session) {
    query += ' AND a.session = ?';
    params.push(session);
  }

  query += ' ORDER BY a.attendance_date DESC, a.session ASC';

  const [rows] = await pool.query(query, params);
  res.status(200).json({ success: true, count: rows.length, data: rows });
});

// GET /api/attendance/student/:studentId/summary
// Present/late/absent/excused counts + overall percentage for one student.
export const getStudentAttendanceSummary = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  if (req.user.role === 'student' && Number(req.user.sub) !== Number(studentId)) {
    throw new ApiError(403, 'Access denied: You can only view your own attendance summary.');
  }

  // A teacher may only view the attendance summary of a student enrolled in
  // one of their own assigned groups (proposal §4: teachers are scoped to
  // their assigned groups/students).
  if (req.user.role === 'teacher' && !(await teacherHasStudent(req.user.sub, studentId))) {
    throw new ApiError(403, 'Access denied: This student is not in one of your assigned groups.');
  }

  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM attendance WHERE student_id = ? GROUP BY status`,
    [studentId]
  );

  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of rows) counts[r.status] = r.count;

  const total = counts.present + counts.late + counts.absent + counts.excused;
  const attendedSessions = counts.present + counts.late; // present or late still counts as attended
  const percentage = total > 0 ? Math.round((attendedSessions / total) * 1000) / 10 : null;

  res.status(200).json({
    success: true,
    data: {
      student_id: Number(studentId),
      total_sessions: total,
      counts,
      attendance_percentage: percentage
    }
  });
});

// GET /api/attendance/group/:groupId/summary
// Per-student breakdown for a whole group, plus a group-level average — used
// by teacher/admin analytics.
export const getGroupAttendanceSummary = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const [group] = await pool.query('SELECT id FROM student_groups WHERE id = ?', [groupId]);
  if (group.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  const [rows] = await pool.query(
    `SELECT a.student_id, u.name AS student_name, a.status, COUNT(*) AS count
     FROM attendance a
     JOIN users u ON a.student_id = u.id
     WHERE a.group_id = ?
     GROUP BY a.student_id, u.name, a.status`,
    [groupId]
  );

  const byStudent = {};
  for (const r of rows) {
    if (!byStudent[r.student_id]) {
      byStudent[r.student_id] = {
        student_id: r.student_id,
        student_name: r.student_name,
        counts: { present: 0, late: 0, absent: 0, excused: 0 }
      };
    }
    byStudent[r.student_id].counts[r.status] = r.count;
  }

  const students = Object.values(byStudent).map((s) => {
    const total = s.counts.present + s.counts.late + s.counts.absent + s.counts.excused;
    const attended = s.counts.present + s.counts.late;
    return {
      ...s,
      total_sessions: total,
      attendance_percentage: total > 0 ? Math.round((attended / total) * 1000) / 10 : null
    };
  });

  const validPercentages = students.map((s) => s.attendance_percentage).filter((p) => p !== null);
  const groupAverage = validPercentages.length > 0
    ? Math.round((validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length) * 10) / 10
    : null;

  res.status(200).json({
    success: true,
    data: {
      group_id: Number(groupId),
      group_average_percentage: groupAverage,
      students
    }
  });
});
export const createAttendanceAppeal = asyncHandler(async (req, res) => {
  const { attendance_id } = req.body;
  const student_id = req.user.sub;

  if (!attendance_id) {
    throw new ApiError(400, 'attendance_id is required');
  }

  const [attendance] = await pool.query(
    `SELECT id, student_id, status
     FROM attendance
     WHERE id = ?`,
    [attendance_id]
  );

  if (!attendance.length) {
    throw new ApiError(404, 'Attendance record not found');
  }

  const record = attendance[0];

  if (Number(record.student_id) !== Number(student_id)) {
    throw new ApiError(403, 'You can only appeal your own attendance');
  }

  if (record.status !== 'absent') {
    throw new ApiError(400, 'Only absent attendance can be appealed');
  }

  const [existing] = await pool.query(
    `SELECT id, status
     FROM attendance_appeals
     WHERE attendance_id = ?`,
    [attendance_id]
  );

  if (existing.length) {
    throw new ApiError(409, 'An appeal already exists for this attendance');
  }

  const [result] = await pool.query(
    `INSERT INTO attendance_appeals
      (attendance_id, student_id)
     VALUES (?, ?)`,
    [attendance_id, student_id]
  );

  res.status(201).json({
    success: true,
    message: 'Attendance appeal submitted',
    data: {
      id: result.insertId,
      attendance_id,
      status: 'pending'
    }
  });
});


export const getMyAttendanceAppeals = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
       aa.id,
       aa.attendance_id,
       aa.status,
       aa.created_at,
       a.attendance_date,
       a.session,
       a.status AS attendance_status
     FROM attendance_appeals aa
     JOIN attendance a ON a.id = aa.attendance_id
     WHERE aa.student_id = ?
     ORDER BY aa.created_at DESC`,
    [req.user.sub]
  );

  res.json({
    success: true,
    count: rows.length,
    data: rows
  });
});
const VALID_APPEAL_STATUSES = ['accepted', 'rejected'];

// GET /api/attendance/appeals/pending (Admin or Teacher)
export const getPendingAttendanceAppeals = asyncHandler(async (req, res) => {
  const { group_id } = req.query;

  let q = `SELECT
       aa.id,
       aa.attendance_id,
       aa.student_id,
       aa.status,
       aa.created_at,
       a.attendance_date,
       a.session,
       a.group_id,
       sg.name AS group_name,
       sg.course_id,
       c.name AS course_name,
       u.name AS student_name
     FROM attendance_appeals aa
     JOIN attendance a ON a.id = aa.attendance_id
     JOIN student_groups sg ON sg.id = a.group_id
     JOIN courses c ON c.id = sg.course_id
     JOIN users u ON u.id = aa.student_id
     WHERE aa.status = 'pending'`;
  const params = [];
  if (req.user.role === 'teacher') {
    q += ` AND EXISTS (SELECT 1 FROM group_teachers gt WHERE gt.group_id = a.group_id AND gt.teacher_id = ?)`;
    params.push(req.user.sub);
  }
  if (group_id) {
    q += ` AND a.group_id = ?`;
    params.push(group_id);
  }
  q += ' ORDER BY aa.created_at ASC';
  const [rows] = await pool.query(q, params);

  res.json({ success: true, count: rows.length, data: rows });
});
// PUT /api/attendance/appeals/:id/review (Admin or Teacher)
// body: { status: 'accepted' | 'rejected' }
// accepted -> ilgili yoklama kaydı 'present' yapılır (öğrenci aslında derste var sayılır)
export const reviewAttendanceAppeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_APPEAL_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${VALID_APPEAL_STATUSES.join(', ')}`);
  }

  const [appeals] = await pool.query(
    `SELECT aa.id, aa.attendance_id, aa.status, a.group_id
     FROM attendance_appeals aa
     JOIN attendance a ON a.id = aa.attendance_id
     WHERE aa.id = ?`,
    [id]
  );

  if (!appeals.length) {
    throw new ApiError(404, 'Appeal not found');
  }

  if (appeals[0].status !== 'pending') {
    throw new ApiError(409, 'This appeal has already been reviewed');
  }
  if (req.user.role === 'teacher') {
    const [owned] = await pool.query(
      'SELECT 1 FROM group_teachers WHERE teacher_id = ? AND group_id = ? LIMIT 1',
      [req.user.sub, appeals[0].group_id]
    );
    if (!owned.length) throw new ApiError(403, 'You are not assigned to this group');
  }

  await pool.query('UPDATE attendance_appeals SET status = ? WHERE id = ?', [status, id]);

  if (status === 'accepted') {
    await pool.query(
      "UPDATE attendance SET status = 'present' WHERE id = ?",
      [appeals[0].attendance_id]
    );
  }

  res.json({ success: true, message: `Appeal ${status}`, data: { id: Number(id), status } });
});