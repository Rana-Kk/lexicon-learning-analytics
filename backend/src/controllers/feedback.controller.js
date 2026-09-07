import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherHasStudent, getTeacherGroupIds } from '../utils/scope.js';

export const getTemplates = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ft.*, u.name created_by_name FROM feedback_templates ft
     LEFT JOIN users u ON u.id=ft.created_by ORDER BY ft.id DESC`
  );
  res.json({ success: true, data: rows });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const { category, content } = req.body;
  if (!category || !content) throw new ApiError(400, 'category and content are required');
  const [r] = await pool.query(
    'INSERT INTO feedback_templates(category,content,created_by) VALUES(?,?,?)',
    [category, content, req.user.sub]
  );
  const [x] = await pool.query('SELECT * FROM feedback_templates WHERE id=?', [r.insertId]);
  res.status(201).json({ success: true, data: x[0] });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const [r] = await pool.query('DELETE FROM feedback_templates WHERE id=?', [req.params.id]);
  if (!r.affectedRows) throw new ApiError(404, 'Template not found');
  res.json({ success: true });
});

export const getFeedback = asyncHandler(async (req, res) => {
  const sid = req.user.role === 'student' ? req.user.sub : req.query.student_id;

  if (req.user.role === 'teacher') {
    if (sid) {
      if (!(await teacherHasStudent(req.user.sub, sid))) {
        throw new ApiError(403, 'You do not have access to this student');
      }
    }
  }

  let q = `SELECT tf.*, s.name student_name, t.name teacher_name, a.title assessment_title, ft.category template_category
            FROM teacher_feedback tf
            JOIN users s ON s.id=tf.student_id
            JOIN users t ON t.id=tf.teacher_id
            LEFT JOIN assessments a ON a.id=tf.assessment_id
            LEFT JOIN feedback_templates ft ON ft.id=tf.template_id
            WHERE 1=1`;
  const p = [];

  if (sid) {
    q += ' AND tf.student_id=?';
    p.push(sid);
  } else if (req.user.role === 'teacher') {
    const groupIds = await getTeacherGroupIds(req.user.sub);
    if (!groupIds.length) {
      return res.json({ success: true, data: [] });
    }
    q += ` AND tf.student_id IN (
             SELECT gs.student_id FROM group_students gs WHERE gs.group_id IN (?)
           )`;
    p.push(groupIds);
  }

  if (req.query.assessment_id) {
    q += ' AND tf.assessment_id=?';
    p.push(req.query.assessment_id);
  }

  q += ' ORDER BY tf.created_at DESC';
  const [rows] = await pool.query(q, p);
  res.json({ success: true, data: rows });
});

export const createFeedback = asyncHandler(async (req, res) => {
  const { student_id, assessment_id, template_id, content } = req.body;
  if (!student_id || !content) throw new ApiError(400, 'student_id and content are required');

  if (req.user.role === 'teacher' && !(await teacherHasStudent(req.user.sub, student_id))) {
    throw new ApiError(403, 'You do not have access to this student');
  }

  const [s] = await pool.query("SELECT id FROM users WHERE id=? AND role='student'", [student_id]);
  if (!s.length) throw new ApiError(404, 'Student not found');

  const [r] = await pool.query(
    'INSERT INTO teacher_feedback(student_id,teacher_id,assessment_id,template_id,content) VALUES(?,?,?,?,?)',
    [student_id, req.user.sub, assessment_id || null, template_id || null, content.trim()]
  );
  const [x] = await pool.query('SELECT * FROM teacher_feedback WHERE id=?', [r.insertId]);
  res.status(201).json({ success: true, data: x[0] });
});

export const deleteFeedback = asyncHandler(async (req, res) => {
  const q =
    req.user.role === 'admin'
      ? 'DELETE FROM teacher_feedback WHERE id=?'
      : 'DELETE FROM teacher_feedback WHERE id=? AND teacher_id=?';
  const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.sub];
  const [r] = await pool.query(q, params);
  if (!r.affectedRows) throw new ApiError(404, 'Feedback not found');
  res.json({ success: true });
});
