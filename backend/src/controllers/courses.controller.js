import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper function to auto-format and sanitize date strings to YYYY-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();

  if (!trimmed) {
    return null;
  }

  // YYYY-MM-DD
  const ymdMatch = trimmed.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
  );

  if (ymdMatch) {
    const year = ymdMatch[1];
    const first = Number(ymdMatch[2]);
    const second = Number(ymdMatch[3]);

    // YYYY-MM-DD
    if (first >= 1 && first <= 12) {
      const month = String(first).padStart(2, '0');
      const day = String(second).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    // YYYY-DD-MM
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
      const day = String(first).padStart(2, '0');
      const month = String(second).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    return null;
  }

  // DD-MM-YYYY
  const dmyMatch = trimmed.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/
  );

  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];

    return `${year}-${month}-${day}`;
  }

  return null;
}
// 1. Get all courses
export const getAllCourses = asyncHandler(async (req, res) => {
  const [courses] = await pool.query('SELECT * FROM courses ORDER BY id DESC');
  res.status(200).json({ success: true, count: courses.length, data: courses });
});

// Alias for route compatibility
export const getCourses = getAllCourses;

// 2. Get single course by ID
export const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [course] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);

  if (course.length === 0) {
    throw new ApiError(404, 'Course not found');
  }

  res.status(200).json({ success: true, data: course[0] });
});

// 3. Create new course (Admin only)
export const createCourse = asyncHandler(async (req, res) => {
  const { name, description, start_date, end_date } = req.body;

  if (!name) {
    throw new ApiError(400, 'Course name is required');
  }

  const cleanStartDate = normalizeDate(start_date);
  const cleanEndDate = normalizeDate(end_date);

  const [result] = await pool.query(
    'INSERT INTO courses (name, description, start_date, end_date) VALUES (?, ?, ?, ?)',
    [name, description || null, cleanStartDate, cleanEndDate]
  );

  const [newCourse] = await pool.query('SELECT * FROM courses WHERE id = ?', [result.insertId]);

  res.status(201).json({ 
    success: true, 
    message: 'Course created successfully', 
    data: newCourse[0] 
  });
});

// 4. Update course (Admin only)
export const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, start_date, end_date } = req.body;

  const [existing] = await pool.query('SELECT id FROM courses WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new ApiError(404, 'Course not found');
  }

  const cleanStartDate = start_date !== undefined ? normalizeDate(start_date) : undefined;
  const cleanEndDate = end_date !== undefined ? normalizeDate(end_date) : undefined;

  await pool.query(
    'UPDATE courses SET name = COALESCE(?, name), description = COALESCE(?, description), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date) WHERE id = ?',
    [name, description, cleanStartDate ?? null, cleanEndDate ?? null, id]
  );

  const [updatedCourse] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);

  res.status(200).json({ 
    success: true, 
    message: 'Course updated successfully', 
    data: updatedCourse[0] 
  });
});

// 5. Delete course (Admin only)
export const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [existing] = await pool.query('SELECT id FROM courses WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new ApiError(404, 'Course not found');
  }

  await pool.query('DELETE FROM courses WHERE id = ?', [id]);

  res.status(200).json({ success: true, message: 'Course deleted successfully' });
});