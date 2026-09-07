import { pool } from '../config/db.js';

// Shared helpers for restricting a teacher to only the groups/courses they
// are actually assigned to (via the group_teachers table). Used by every
// controller that lets a teacher look up data for "a student" or "a group"
// so a teacher can never read another teacher's class by guessing an id.

/** Group ids the given teacher is assigned to. */
export async function getTeacherGroupIds(teacherId) {
  const [rows] = await pool.query(
    'SELECT group_id FROM group_teachers WHERE teacher_id = ?',
    [teacherId]
  );
  return rows.map((r) => r.group_id);
}

/** True if `groupId` is one of the teacher's assigned groups. */
export async function teacherOwnsGroup(teacherId, groupId) {
  if (!groupId) return false;
  const [rows] = await pool.query(
    'SELECT 1 FROM group_teachers WHERE teacher_id = ? AND group_id = ? LIMIT 1',
    [teacherId, groupId]
  );
  return rows.length > 0;
}

/**
 * True if `studentId` is enrolled in at least one group the teacher is
 * assigned to.
 */
export async function teacherHasStudent(teacherId, studentId) {
  if (!studentId) return false;
  const [rows] = await pool.query(
    `SELECT 1
       FROM group_teachers gt
       JOIN group_students gs ON gs.group_id = gt.group_id
      WHERE gt.teacher_id = ? AND gs.student_id = ?
      LIMIT 1`,
    [teacherId, studentId]
  );
  return rows.length > 0;
}
