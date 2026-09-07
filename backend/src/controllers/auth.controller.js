import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  })
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body

  if (!name || !email || !password || !role) {
    throw new ApiError(400, 'name, email, password and role are required')
  }
  if (!['admin', 'teacher', 'student'].includes(role)) {
    throw new ApiError(400, 'role must be admin, teacher or student')
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    [name, email, passwordHash, role]
  )

  const user = { id: result.insertId, name, email, role }
  const token = signToken(user)
  res.status(201).json({ user, token })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required')
  }

  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash, role, github_username, is_active, must_change_password, bio, avatar
FROM users
WHERE email = ?`,
    [email]
  )
  const dbUser = rows[0]

  if (!dbUser || !dbUser.is_active) {
    throw new ApiError(401, 'Invalid email or password')
  }

  const passwordMatches = await bcrypt.compare(password, dbUser.password_hash)
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password')
  }
const user = {
  id: dbUser.id,
  name: dbUser.name,
  email: dbUser.email,
  role: dbUser.role,
  github_username: dbUser.github_username,
  bio: dbUser.bio,
  avatar: dbUser.avatar,
  must_change_password: Boolean(dbUser.must_change_password)
}
  const token = signToken(user)
  res.json({ user, token })
})


export const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password || new_password.length < 8) {
    throw new ApiError(400, 'Current password and a new password of at least 8 characters are required')
  }
  const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE id = ?', [req.user.sub])
  if (!rows[0]) throw new ApiError(404, 'User not found')
  if (!(await bcrypt.compare(current_password, rows[0].password_hash))) throw new ApiError(401, 'Current password is incorrect')
  const hash = await bcrypt.hash(new_password, 10)
  await pool.query('UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?', [hash, req.user.sub])
  res.json({ success: true, message: 'Password changed successfully' })
})

export const me = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
      id,
      name,
      email,
      role,
      github_username,
      is_active,
      bio,
      avatar,
      must_change_password,
      created_at
     FROM users
     WHERE id = ?`,
    [req.user.sub]
  )

  if (!rows[0]) {
    throw new ApiError(404, 'User not found')
  }

  res.json(rows[0])
})