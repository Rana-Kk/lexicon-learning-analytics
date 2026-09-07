import { pool } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { teacherOwnsGroup } from '../utils/scope.js'


export const getTeams = asyncHandler(async (req, res) => {
  const { group_id } = req.query

  let q = `
  SELECT
    t.*,
    sg.name AS group_name,
    sg.course_id AS course_id,
    c.name AS course_name
  FROM teams t
  JOIN student_groups sg
    ON sg.id = t.group_id
  JOIN courses c
    ON c.id = sg.course_id
  WHERE 1 = 1
`

  const params = []

  if (req.user.role === 'teacher') {
    q += `
      AND EXISTS (
        SELECT 1 FROM group_teachers gt
        WHERE gt.group_id = t.group_id AND gt.teacher_id = ?
      )
    `
    params.push(req.user.sub)
  }

  if (group_id) {
    q += ' AND t.group_id = ?'
    params.push(group_id)
  }

  q += ' ORDER BY t.id DESC'

  const [teams] = await pool.query(q, params)

  for (const team of teams) {
    const [members] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.avatar,
        u.github_username
      FROM team_members tm
      JOIN users u
        ON u.id = tm.student_id
      WHERE tm.team_id = ?
      ORDER BY u.name
      `,
      [team.id]
    )

    team.members = members
  }

  res.json({
    success: true,
    data: teams
  })
})


export const getMyTeam = asyncHandler(async (req, res) => {
  const [teams] = await pool.query(
    `
    SELECT
      t.id,
      t.name,
      t.group_id,
      sg.name AS group_name
    FROM teams t
    JOIN student_groups sg
      ON sg.id = t.group_id
    JOIN team_members tm
      ON tm.team_id = t.id
    WHERE tm.student_id = ?
    ORDER BY t.id DESC
    `,
    [req.user.sub]
  )

  for (const team of teams) {
    const [members] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.avatar,
        u.github_username
      FROM team_members tm
      JOIN users u
        ON u.id = tm.student_id
      WHERE tm.team_id = ?
      ORDER BY u.name
      `,
      [team.id]
    )

    team.members = members
  }

  res.json({
    success: true,
    data: teams
  })
})


export const createTeam = asyncHandler(async (req, res) => {
  const {
    group_id,
    name,
    student_ids = []
  } = req.body

  if (!group_id || !name) {
    throw new ApiError(
      400,
      'group_id and name are required'
    )
  }

  const [groups] = await pool.query(
    'SELECT id FROM student_groups WHERE id = ?',
    [group_id]
  )

  if (!groups.length) {
    throw new ApiError(404, 'Group not found')
  }

  if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req.user.sub, group_id))) {
    throw new ApiError(403, 'You are not assigned to this group')
  }

  const [result] = await pool.query(
    `
    INSERT INTO teams
      (group_id, name)
    VALUES
      (?, ?)
    `,
    [
      group_id,
      name.trim()
    ]
  )

  for (const studentId of student_ids) {
    await pool.query(
      `
      INSERT IGNORE INTO team_members
        (team_id, student_id, joined_at)
      VALUES
        (?, ?, CURRENT_DATE)
      `,
      [
        result.insertId,
        studentId
      ]
    )
  }

  const [teams] = await pool.query(
    `
    SELECT
      *
    FROM teams
    WHERE id = ?
    `,
    [result.insertId]
  )

  res.status(201).json({
    success: true,
    data: teams[0]
  })
})


export const updateTeam = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT id, group_id FROM teams WHERE id = ?',
    [req.params.id]
  )

  if (!existing.length) {
    throw new ApiError(404, 'Team not found')
  }

  if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req.user.sub, existing[0].group_id))) {
    throw new ApiError(403, 'You are not assigned to this group')
  }

  const [result] = await pool.query(
    `
    UPDATE teams
    SET name = COALESCE(?, name)
    WHERE id = ?
    `,
    [
      req.body.name || null,
      req.params.id
    ]
  )

  if (!result.affectedRows) {
    throw new ApiError(
      404,
      'Team not found'
    )
  }

  const [teams] = await pool.query(
    `
    SELECT *
    FROM teams
    WHERE id = ?
    `,
    [req.params.id]
  )

  res.json({
    success: true,
    data: teams[0]
  })
})


export const deleteTeam = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT id, group_id FROM teams WHERE id = ?',
    [req.params.id]
  )

  if (!existing.length) {
    throw new ApiError(404, 'Team not found')
  }

  if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req.user.sub, existing[0].group_id))) {
    throw new ApiError(403, 'You are not assigned to this group')
  }

  const [result] = await pool.query(
    `
    DELETE FROM teams
    WHERE id = ?
    `,
    [req.params.id]
  )

  if (!result.affectedRows) {
    throw new ApiError(
      404,
      'Team not found'
    )
  }

  res.json({
    success: true
  })
})


export const addMember = asyncHandler(async (req, res) => {
  const {
    student_id
  } = req.body

  if (!student_id) {
    throw new ApiError(
      400,
      'student_id is required'
    )
  }

  const [team] = await pool.query(
    `
    SELECT id, group_id
    FROM teams
    WHERE id = ?
    `,
    [req.params.id]
  )

  if (!team.length) {
    throw new ApiError(
      404,
      'Team not found'
    )
  }

  if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req.user.sub, team[0].group_id))) {
    throw new ApiError(403, 'You are not assigned to this group')
  }

  const [student] = await pool.query(
    `
    SELECT id
    FROM users
    WHERE id = ?
      AND role = 'student'
    `,
    [student_id]
  )

  if (!student.length) {
    throw new ApiError(
      404,
      'Student not found'
    )
  }

  await pool.query(
    `
    INSERT INTO team_members
      (team_id, student_id, joined_at)
    VALUES
      (?, ?, CURRENT_DATE)
    ON DUPLICATE KEY UPDATE
      joined_at = VALUES(joined_at)
    `,
    [
      req.params.id,
      student_id
    ]
  )

  res.status(201).json({
    success: true,
    message: 'Student added to team successfully'
  })
})


export const removeMember = asyncHandler(async (req, res) => {
  const [team] = await pool.query(
    'SELECT id, group_id FROM teams WHERE id = ?',
    [req.params.id]
  )

  if (!team.length) {
    throw new ApiError(404, 'Team not found')
  }

  if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req.user.sub, team[0].group_id))) {
    throw new ApiError(403, 'You are not assigned to this group')
  }

  await pool.query(
    `
    DELETE FROM team_members
    WHERE team_id = ?
      AND student_id = ?
    `,
    [
      req.params.id,
      req.params.studentId
    ]
  )

  res.json({
    success: true,
    message: 'Student removed from team successfully'
  })
})