import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherHasStudent, teacherOwnsGroup, getTeacherGroupIds } from '../utils/scope.js';

export const overview = asyncHandler(async (req, res) => {
  let groupId = req.query.group_id;
  let studentId = req.user.role === 'student' ? req.user.sub : req.query.student_id;

  if (req.user.role === 'teacher') {
    if (groupId && !(await teacherOwnsGroup(req.user.sub, groupId))) {
      throw new ApiError(403, 'You do not have access to this group');
    }
    if (studentId && !(await teacherHasStudent(req.user.sub, studentId))) {
      throw new ApiError(403, 'You do not have access to this student');
    }
  }

  let teacherGroupIds = null;
  if (req.user.role === 'teacher' && !groupId && !studentId) {
    teacherGroupIds = await getTeacherGroupIds(req.user.sub);
    if (!teacherGroupIds.length) {
      return res.json({
        success: true,
        data: {
          attendance: { total: 0, present: 0, late: 0, rate: 0 },
          quiz_average: 0,
          assessment_average: 0,
          quiz_count: 0,
          assessment_count: 0,
        },
      });
    }
  }

  let attendance = `
    SELECT
      COUNT(*) total,
      SUM(status = 'present') present,
      SUM(status = 'late') late
    FROM attendance
    WHERE 1=1
  `;

  let quizzes = `
    SELECT
      COUNT(*) count,
      AVG(qr.score / q.max_score * 100) avg
    FROM quiz_results qr
    JOIN quizzes q ON q.id = qr.quiz_id
    WHERE 1=1
  `;

  let scores = `
    SELECT
      COUNT(*) count,
      AVG(s.score / a.max_score * 100) avg
    FROM assessment_scores s
    JOIN assessments a ON a.id = s.assessment_id
    WHERE 1=1
  `;

  if (groupId) {
    attendance += ` AND group_id = ?`;
    quizzes += ` AND q.group_id = ?`;
    scores += ` AND a.group_id = ?`;
  } else if (teacherGroupIds) {
    attendance += ` AND group_id IN (?)`;
    quizzes += ` AND q.group_id IN (?)`;
    scores += ` AND a.group_id IN (?)`;
  }

  if (studentId) {
    attendance += ` AND student_id = ?`;
    quizzes += ` AND qr.student_id = ?`;
    scores += ` AND s.student_id = ?`;
  }

  const scopeValue = groupId || teacherGroupIds;

  const attendanceParams = [];
  if (scopeValue) attendanceParams.push(scopeValue);
  if (studentId) attendanceParams.push(studentId);

  const quizParams = [];
  if (scopeValue) quizParams.push(scopeValue);
  if (studentId) quizParams.push(studentId);

  const scoreParams = [];
  if (scopeValue) scoreParams.push(scopeValue);
  if (studentId) scoreParams.push(studentId);

  const [[att], [quiz], [score]] = await Promise.all([
    pool.query(attendance, attendanceParams),
    pool.query(quizzes, quizParams),
    pool.query(scores, scoreParams),
  ]);

  res.json({
    success: true,
    data: {
      attendance: {
        total: Number(att[0].total || 0),
        present: Number(att[0].present || 0),
        late: Number(att[0].late || 0),
        rate: att[0].total
          ? Math.round(((Number(att[0].present) + Number(att[0].late) * 0.5) / Number(att[0].total)) * 100)
          : 0,
      },
      quiz_average: Number(quiz[0].avg || 0),
      assessment_average: Number(score[0].avg || 0),
      quiz_count: Number(quiz[0].count || 0),
      assessment_count: Number(score[0].count || 0),
    },
  });
});

export const groupComparison = asyncHandler(async (req, res) => {
  const p = [];
  let where = '1=1';

  if (req.user.role === 'teacher') {
    const groupIds = await getTeacherGroupIds(req.user.sub);
    if (!groupIds.length) {
      return res.json({ success: true, data: [] });
    }
    where = 'sg.id IN (?)';
    p.push(groupIds);
  }

  const [rows] = await pool.query(
    `
  SELECT
    sg.id,
    sg.name,

    COALESCE((
      SELECT ROUND(
        AVG(
          CASE
            WHEN a.status = 'present' THEN 100
            WHEN a.status = 'late' THEN 50
            ELSE 0
          END
        ),
        1
      )
      FROM attendance a
      WHERE a.group_id = sg.id
    ), 0) attendance,

    COALESCE((
      SELECT ROUND(
        AVG(
          CASE
            WHEN q.max_score > 0
            THEN (qr.score / q.max_score) * 100
            ELSE 0
          END
        ),
        1
      )
      FROM quiz_results qr
      JOIN quizzes q
        ON q.id = qr.quiz_id
      WHERE q.group_id = sg.id
    ), 0) quizAvg,

    COALESCE((
      SELECT ROUND(
        AVG(
          CASE
            WHEN asm.max_score > 0
            THEN (sc.score / asm.max_score) * 100
            ELSE 0
          END
        ),
        1
      )
      FROM assessment_scores sc
      JOIN assessments asm
        ON asm.id = sc.assessment_id
      WHERE asm.group_id = sg.id
    ), 0) assessmentAvg

  FROM student_groups sg
  WHERE ${where}
  ORDER BY sg.name
`,
    p
  );

  res.json({
    success: true,
    data: rows,
  });
});

export const studentComparison = asyncHandler(async (req, res) => {
  const groupId = req.query.group_id;

  const p = [];
  let where = `u.role = 'student'`;

  if (req.user.role === 'teacher') {
    if (groupId) {
      if (!(await teacherOwnsGroup(req.user.sub, groupId))) {
        throw new ApiError(403, 'You do not have access to this group');
      }
      where += `
        AND EXISTS (
          SELECT 1 FROM group_students gs
          WHERE gs.student_id = u.id AND gs.group_id = ?
        )
      `;
      p.push(groupId);
    } else {
      const groupIds = await getTeacherGroupIds(req.user.sub);
      if (!groupIds.length) {
        return res.json({ success: true, data: [] });
      }
      where += `
        AND EXISTS (
          SELECT 1 FROM group_students gs
          WHERE gs.student_id = u.id AND gs.group_id IN (?)
        )
      `;
      p.push(groupIds);
    }
  } else if (groupId) {
    where += `
      AND EXISTS (
        SELECT 1
        FROM group_students gs
        WHERE gs.student_id = u.id
          AND gs.group_id = ?
      )
    `;
    p.push(groupId);
  }

  const [rows] = await pool.query(
    `
  SELECT
    u.id,
    u.name,

    COALESCE((
      SELECT ROUND(
        AVG(
          CASE
            WHEN a.status = 'present' THEN 100
            WHEN a.status = 'late' THEN 50
            ELSE 0
          END
        ),
        1
      )
      FROM attendance a
      WHERE a.student_id = u.id
    ), 0) attendance,

    COALESCE((
      SELECT ROUND(
        AVG(
          CASE
            WHEN q.max_score > 0
            THEN (qr.score / q.max_score) * 100
            ELSE 0
          END
        ),
        1
      )
      FROM quiz_results qr
      JOIN quizzes q
        ON q.id = qr.quiz_id
      WHERE qr.student_id = u.id
    ), 0) quizAvg,

    COALESCE((
      SELECT ROUND(
        AVG(
          CASE
            WHEN asm.max_score > 0
            THEN (sc.score / asm.max_score) * 100
            ELSE 0
          END
        ),
        1
      )
      FROM assessment_scores sc
      JOIN assessments asm
        ON asm.id = sc.assessment_id
      WHERE sc.student_id = u.id
    ), 0) assessmentAvg

  FROM users u
  WHERE ${where}
  ORDER BY u.name
`,
    p
  );

  res.json({
    success: true,
    data: rows,
  });
});