import { pool } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  teacherHasStudent,
  getTeacherGroupIds,
} from '../utils/scope.js'

export const getCertificates = asyncHandler(
  async (req, res) => {
    const sid =
      req.user.role === 'student'
        ? req.user.sub
        : req.query.student_id

    if (
      req.user.role === 'teacher' &&
      sid &&
      !(await teacherHasStudent(
        req.user.sub,
        sid
      ))
    ) {
      throw new ApiError(
        403,
        'You do not have access to this student'
      )
    }

    let q = `
      SELECT
        c.*,
        u.name AS student_name,
        u.email AS student_email
      FROM certificates c
      JOIN users u ON u.id = c.student_id
      WHERE 1=1
    `

    const p = []

    if (sid) {
      q += ' AND c.student_id = ?'
      p.push(sid)
    } else if (
      req.user.role === 'teacher'
    ) {
      const groupIds =
        await getTeacherGroupIds(
          req.user.sub
        )

      if (!groupIds.length) {
        return res.json({
          success: true,
          data: [],
        })
      }

      q += `
        AND c.student_id IN (
          SELECT gs.student_id
          FROM group_students gs
          WHERE gs.group_id IN (?)
        )
      `

      p.push(groupIds)
    }

    q += `
      ORDER BY
        c.issue_date DESC,
        c.id DESC
    `

    const [rows] =
      await pool.query(q, p)

    res.json({
      success: true,
      data: rows,
    })
  }
)

export const createCertificate =
  asyncHandler(async (req, res) => {
    const {
      student_id,
      name,
      issuing_organization,
      issue_date,
      expiry_date,
      certificate_code,
      file_url,
    } = req.body

    if (!student_id || !name) {
      throw new ApiError(
        400,
        'student_id and name are required'
      )
    }

    /*
     * Teacher scope
     */
    if (
      req.user.role === 'teacher' &&
      !(await teacherHasStudent(
        req.user.sub,
        student_id
      ))
    ) {
      throw new ApiError(
        403,
        'You do not have access to this student'
      )
    }

    const [students] =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE id = ?
        AND role = 'student'
        `,
        [student_id]
      )

    if (!students.length) {
      throw new ApiError(
        404,
        'Student not found'
      )
    }

   
    const [result] =
      await pool.query(
        `
        INSERT INTO certificates (
          student_id,
          added_by,
          name,
          issuing_organization,
          issue_date,
          expiry_date,
          certificate_code,
          file_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          student_id,
          req.user.sub,
          name,
          issuing_organization ||
            'Lexicon',
          issue_date ||
            new Date()
              .toISOString()
              .split('T')[0],
          expiry_date || null,
          certificate_code ||
            `LEX-${Date.now()}`,
          file_url || null,
        ]
      )

    const [certificate] =
      await pool.query(
        `
        SELECT
          c.*,
          u.name AS student_name,
          u.email AS student_email
        FROM certificates c
        JOIN users u
          ON u.id = c.student_id
        WHERE c.id = ?
        `,
        [result.insertId]
      )

    res.status(201).json({
      success: true,
      data: certificate[0],
    })
  })

export const updateCertificate =
  asyncHandler(async (req, res) => {
    const {
      name,
      issuing_organization,
      issue_date,
      expiry_date,
      certificate_code,
      file_url,
    } = req.body

    if (req.user.role === 'teacher') {
      const [existing] =
        await pool.query(
          `
          SELECT student_id
          FROM certificates
          WHERE id = ?
          `,
          [req.params.id]
        )

      if (!existing.length) {
        throw new ApiError(
          404,
          'Certificate not found'
        )
      }

      if (
        !(await teacherHasStudent(
          req.user.sub,
          existing[0].student_id
        ))
      ) {
        throw new ApiError(
          403,
          'You do not have access to this student'
        )
      }
    }

    const [result] =
      await pool.query(
        `
        UPDATE certificates
        SET
          name =
            COALESCE(?, name),
          issuing_organization =
            COALESCE(
              ?,
              issuing_organization
            ),
          issue_date =
            COALESCE(
              ?,
              issue_date
            ),
          expiry_date =
            COALESCE(
              ?,
              expiry_date
            ),
          certificate_code =
            COALESCE(
              ?,
              certificate_code
            ),
          file_url =
            COALESCE(
              ?,
              file_url
            )
        WHERE id = ?
        `,
        [
          name,
          issuing_organization,
          issue_date,
          expiry_date,
          certificate_code,
          file_url,
          req.params.id,
        ]
      )

    if (!result.affectedRows) {
      throw new ApiError(
        404,
        'Certificate not found'
      )
    }

    const [certificate] =
      await pool.query(
        `
        SELECT
          c.*,
          u.name AS student_name,
          u.email AS student_email
        FROM certificates c
        JOIN users u
          ON u.id = c.student_id
        WHERE c.id = ?
        `,
        [req.params.id]
      )

    res.json({
      success: true,
      data: certificate[0],
    })
  })

export const deleteCertificate =
  asyncHandler(async (req, res) => {
    if (req.user.role === 'teacher') {
      const [existing] =
        await pool.query(
          `
          SELECT student_id
          FROM certificates
          WHERE id = ?
          `,
          [req.params.id]
        )

      if (!existing.length) {
        throw new ApiError(
          404,
          'Certificate not found'
        )
      }

      if (
        !(await teacherHasStudent(
          req.user.sub,
          existing[0].student_id
        ))
      ) {
        throw new ApiError(
          403,
          'You do not have access to this student'
        )
      }
    }

    const [result] =
      await pool.query(
        `
        DELETE FROM certificates
        WHERE id = ?
        `,
        [req.params.id]
      )

    if (!result.affectedRows) {
      throw new ApiError(
        404,
        'Certificate not found'
      )
    }

    res.json({
      success: true,
      message: 'Certificate deleted',
    })
  })