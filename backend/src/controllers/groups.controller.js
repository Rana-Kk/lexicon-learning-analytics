import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper function to auto-format and sanitize date strings to YYYY-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Case 1: YYYY-MM-DD or YYYY-DD-MM
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|[12]\d|3[01])/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const p1 = parseInt(ymdMatch[2], 10);
    const p2 = parseInt(ymdMatch[3], 10);

    let month, day;
    // If first part > 12, it's YYYY-DD-MM (e.g. 2023-23-12 -> 2023-12-23)
    if (p1 > 12 && p2 <= 12) {
      day = String(p1).padStart(2, '0');
      month = String(p2).padStart(2, '0');
    } else {
      month = String(p1).padStart(2, '0');
      day = String(p2).padStart(2, '0');
    }
    return `${year}-${month}-${day}`;
  }

  // Case 2: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback: Standard JS Date parser
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// =====================================================
// 1. GROUP CRUD OPERATIONS
// =====================================================

// GET /api/groups (Get all groups with optional course_id filter)
export const getAllGroups = asyncHandler(async (req, res) => {
  const { course_id } = req.query

  let query = `
    SELECT
      sg.*,
      c.name AS course_name,
      (
        SELECT COUNT(*)
        FROM group_students gs
        WHERE gs.group_id = sg.id
      ) AS student_count
    FROM student_groups sg
    JOIN courses c ON c.id = sg.course_id
    WHERE 1=1
  `

  const params = []

  // Student sadece kendi gruplarını görebilir
  if (req.user.role === 'student') {
    query += `
      AND EXISTS (
        SELECT 1
        FROM group_students gs_student
        WHERE gs_student.group_id = sg.id
          AND gs_student.student_id = ?
      )
    `

    params.push(req.user.sub)
  }

  if (req.user.role === 'teacher') {
    query += `
      AND EXISTS (
        SELECT 1
        FROM group_teachers gt_teacher
        WHERE gt_teacher.group_id = sg.id
          AND gt_teacher.teacher_id = ?
      )
    `

    params.push(req.user.sub)
  }

  if (course_id) {
    query += ' AND sg.course_id = ?'
    params.push(course_id)
  }

  query += ' ORDER BY sg.id DESC'

  const [groups] = await pool.query(
    query,
    params
  )

  res.status(200).json({
    success: true,
    count: groups.length,
    data: groups,
  })
})

export const getGroups = getAllGroups;
// GET /api/groups/my
export const getMyGroups = asyncHandler(async (req, res) => {
  const teacherId = req.user.sub;

  const [groups] = await pool.query(
    `
    SELECT
      sg.id,
      sg.name,
      sg.course_id,
      c.name AS course_name,
      sg.start_date,
      sg.end_date,
      (
        SELECT COUNT(*)
        FROM group_students gs
        WHERE gs.group_id = sg.id
      ) AS student_count
    FROM student_groups sg
    JOIN group_teachers gt
      ON gt.group_id = sg.id
    JOIN courses c
      ON c.id = sg.course_id
    WHERE gt.teacher_id = ? OR sg.created_by = ?
    ORDER BY sg.name ASC
    `,
    [teacherId, teacherId]
  );

  res.status(200).json({
    success: true,
    count: groups.length,
    data: groups
  });
});
// GET /api/groups/:id
export const getGroupById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [group] = await pool.query('SELECT * FROM student_groups WHERE id = ?', [id]);

  if (group.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  if (req.user.role === 'teacher' && group[0].created_by !== req.user.sub) {
    const [assigned] = await pool.query(
      'SELECT 1 FROM group_teachers WHERE group_id = ? AND teacher_id = ? LIMIT 1',
      [id, req.user.sub]
    );
    if (!assigned.length) {
      throw new ApiError(403, 'You are not assigned to this group');
    }
  }

  res.status(200).json({ success: true, data: group[0] });
});

// POST /api/groups (Admin or Teacher)
export const createGroup = asyncHandler(async (req, res) => {
  const { course_id, name, start_date, end_date, teacherId, teacherIds } = req.body;
  const created_by = req.user.sub;

  if (!course_id || !name) {
    throw new ApiError(400, 'Course ID and group name are required');
  }

  const [courseCheck] = await pool.query('SELECT id FROM courses WHERE id = ?', [course_id]);
  if (courseCheck.length === 0) {
    throw new ApiError(404, 'Course not found');
  }

  const cleanStartDate = normalizeDate(start_date);
  const cleanEndDate = normalizeDate(end_date);

  const [result] = await pool.query(
    'INSERT INTO student_groups (course_id, name, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?)',
    [course_id, name, cleanStartDate, cleanEndDate, created_by]
  );

  if (req.user.role === 'teacher') {
    await pool.query(
  `INSERT IGNORE INTO group_teachers (group_id, teacher_id)
   VALUES (?, ?)`,
  [result.insertId, created_by]
);
  } else if (req.user.role === 'admin') {
    const requestedTeacherIds = Array.isArray(teacherIds)
      ? teacherIds
      : teacherId
        ? [teacherId]
        : [];

    for (const tId of requestedTeacherIds) {
      const [teacherCheck] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'teacher'", [tId]);
      if (teacherCheck.length) {
        await pool.query(
  `INSERT IGNORE INTO group_teachers (group_id, teacher_id)
   VALUES (?, ?)`,
  [result.insertId, tId]
);
      }
    }
  }

  const [newGroup] = await pool.query('SELECT * FROM student_groups WHERE id = ?', [result.insertId]);

  res.status(201).json({ 
    success: true, 
    message: 'Group created successfully', 
    data: newGroup[0] 
  });
});

// PUT /api/groups/:id (Admin or Teacher)
export const updateGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { course_id, name, start_date, end_date } = req.body;

  const [existing] = await pool.query('SELECT id, created_by FROM student_groups WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  if (req.user.role === 'teacher' && existing[0].created_by !== req.user.sub) {
    const [assigned] = await pool.query(
      'SELECT 1 FROM group_teachers WHERE group_id = ? AND teacher_id = ? LIMIT 1',
      [id, req.user.sub]
    );
    if (!assigned.length) {
      throw new ApiError(403, 'You are not assigned to this group');
    }
  }

  if (course_id) {
    const [courseCheck] = await pool.query('SELECT id FROM courses WHERE id = ?', [course_id]);
    if (courseCheck.length === 0) {
      throw new ApiError(404, 'Course not found');
    }
  }

  const cleanStartDate = start_date !== undefined ? normalizeDate(start_date) : undefined;
  const cleanEndDate = end_date !== undefined ? normalizeDate(end_date) : undefined;

  await pool.query(
    'UPDATE student_groups SET course_id = COALESCE(?, course_id), name = COALESCE(?, name), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date) WHERE id = ?',
    [course_id, name, cleanStartDate ?? null, cleanEndDate ?? null, id]
  );

  const [updatedGroup] = await pool.query('SELECT * FROM student_groups WHERE id = ?', [id]);

  res.status(200).json({ 
    success: true, 
    message: 'Group updated successfully', 
    data: updatedGroup[0] 
  });
});

// DELETE /api/groups/:id (Admin only)
export const deleteGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [existing] = await pool.query('SELECT id FROM student_groups WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  await pool.query('DELETE FROM student_groups WHERE id = ?', [id]);

  res.status(200).json({ success: true, message: 'Group deleted successfully' });
});

// =====================================================
// 2. GROUP STUDENTS MANAGEMENT
// =====================================================

// GET /api/groups/:id/students
export const getGroupStudents = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [group] = await pool.query('SELECT id, name, created_by FROM student_groups WHERE id = ?', [id]);
  if (group.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  if (req.user.role === 'teacher' && group[0].created_by !== req.user.sub) {
    const [assigned] = await pool.query(
      'SELECT 1 FROM group_teachers WHERE group_id = ? AND teacher_id = ? LIMIT 1',
      [id, req.user.sub]
    );
    if (!assigned.length) {
      throw new ApiError(403, 'You are not assigned to this group');
    }
  }
  

  const [students] = await pool.query(
    `SELECT u.id, u.name, u.email, u.github_username, gs.joined_at 
     FROM group_students gs
     JOIN users u ON gs.student_id = u.id
     WHERE gs.group_id = ? AND u.role = 'student'
     ORDER BY u.name ASC`,
    [id]
  );

  res.status(200).json({
    success: true,
    count: students.length,
    data: students
  });
});

// POST /api/groups/:id/students
export const addStudentToGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { studentId, email } = req.body;

  let resolvedStudentId = studentId;
  if (!resolvedStudentId && email) {
    const [byEmail] = await pool.query("SELECT id FROM users WHERE email = ? AND role = 'student'", [email.trim()]);
    if (byEmail.length) resolvedStudentId = byEmail[0].id;
  }
  if (!resolvedStudentId) throw new ApiError(400, 'Student ID or email is required');

  const [group] = await pool.query('SELECT id, created_by FROM student_groups WHERE id = ?', [id]);
  if (group.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  if (req.user.role === 'teacher' && group[0].created_by !== req.user.sub) {
    const [assigned] = await pool.query(
      'SELECT 1 FROM group_teachers WHERE group_id = ? AND teacher_id = ? LIMIT 1',
      [id, req.user.sub]
    );
    if (!assigned.length) {
      throw new ApiError(403, 'You are not assigned to this group');
    }
  }

  const [student] = await pool.query("SELECT id, role FROM users WHERE id = ? AND role = 'student'", [resolvedStudentId]);
  if (student.length === 0) {
    throw new ApiError(404, 'Valid student not found');
  }

  await pool.query(
  `INSERT IGNORE INTO group_students (group_id, student_id, joined_at)
   VALUES (?, ?, CURRENT_DATE)`,
  [id, resolvedStudentId]
);

  res.status(201).json({
    success: true,
    message: 'Student added to group successfully',
    data: { groupId: Number(id), studentId: Number(resolvedStudentId) }
  });
});

// DELETE /api/groups/:id/students/:studentId
export const removeStudentFromGroup = asyncHandler(async (req, res) => {
  const { id, studentId } = req.params;

  const [result] = await pool.query(
    'DELETE FROM group_students WHERE group_id = ? AND student_id = ?',
    [id, studentId]
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Student is not enrolled in this group');
  }

  res.status(200).json({
    success: true,
    message: 'Student removed from group successfully'
  });
});

// =====================================================
// 3. GROUP TEACHERS MANAGEMENT
// =====================================================

// GET /api/groups/:id/teachers
export const getGroupTeachers = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [group] = await pool.query('SELECT id, name FROM student_groups WHERE id = ?', [id]);
  if (group.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  const [teachers] = await pool.query(
    `SELECT u.id, u.name, u.email, u.github_username
     FROM group_teachers gt
     JOIN users u ON gt.teacher_id = u.id
     WHERE gt.group_id = ? AND u.role = 'teacher'
     ORDER BY u.name ASC`,
    [id]
  );

  res.status(200).json({
    success: true,
    count: teachers.length,
    data: teachers
  });
});

// POST /api/groups/:id/teachers
export const assignTeacherToGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { teacherId } = req.body;

  if (!teacherId) {
    throw new ApiError(400, 'Teacher ID is required');
  }

  const [group] = await pool.query('SELECT id FROM student_groups WHERE id = ?', [id]);
  if (group.length === 0) {
    throw new ApiError(404, 'Group not found');
  }

  const [teacher] = await pool.query("SELECT id, role FROM users WHERE id = ? AND role = 'teacher'", [teacherId]);
  if (teacher.length === 0) {
    throw new ApiError(404, 'Valid teacher not found');
  }

  await pool.query(
  `INSERT IGNORE INTO group_teachers (group_id, teacher_id)
   VALUES (?, ?)`,
  [id, teacherId]
);

  res.status(201).json({
    success: true,
    message: 'Teacher assigned to group successfully',
    data: { groupId: Number(id), teacherId: Number(teacherId) }
  });
});

// DELETE /api/groups/:id/teachers/:teacherId
export const removeTeacherFromGroup = asyncHandler(async (req, res) => {
  const { id, teacherId } = req.params;

  const [result] = await pool.query(
    'DELETE FROM group_teachers WHERE group_id = ? AND teacher_id = ?',
    [id, teacherId]
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Teacher is not assigned to this group');
  }

  res.status(200).json({
    success: true,
    message: 'Teacher removed from group successfully'
  });
});