import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// MOCK DATABASE
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
    getConnection: vi.fn(),
  },
}))

// ============================================================
// MOCK SCOPE UTILITIES
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherHasStudent: vi.fn(),
  teacherOwnsGroup: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherHasStudent,
  teacherOwnsGroup,
} from '../../src/utils/scope.js'

import {
  recordBulkAttendance,
  getAttendance,
  getStudentAttendanceSummary,
  getGroupAttendanceSummary,
  createAttendanceAppeal,
  getMyAttendanceAppeals,
  getPendingAttendanceAppeals,
  reviewAttendanceAppeal,
} from '../../src/controllers/attendance.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('attendance controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // recordBulkAttendance
  // ============================================================

  describe('recordBulkAttendance', () => {
    it('should record attendance successfully for an admin', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        
        body: {
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          records: [
            {
              student_id: 101,
              status: 'present',
            },
            {
              student_id: 102,
              status: 'absent',
              note: 'Sick',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      // Check group
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])

      // Get saved attendance
      const savedAttendance = [
        {
          id: 1,
          student_id: 101,
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          status: 'present',
        },
        {
          id: 2,
          student_id: 102,
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          status: 'absent',
          note: 'Sick',
        },
      ]

      pool.query.mockResolvedValueOnce([
        savedAttendance,
      ])

      await recordBulkAttendance(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(pool.getConnection).toHaveBeenCalledTimes(1)

      expect(conn.beginTransaction).toHaveBeenCalledTimes(1)

      expect(conn.query).toHaveBeenCalledTimes(2)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(conn.rollback).not.toHaveBeenCalled()

      expect(conn.release).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Attendance recorded successfully',
        data: savedAttendance,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 400 when required fields are missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await recordBulkAttendance(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)

      expect(error.message).toBe(
        'group_id, attendance_date and session are required'
      )
    })

    it('should return 400 for an invalid session', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'evening',
          records: [
            {
              student_id: 101,
              status: 'present',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await recordBulkAttendance(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
    })

    it('should return 400 when records is empty', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          records: [],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await recordBulkAttendance(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)

      expect(error.message).toBe(
        'records must be a non-empty array of { student_id, status }'
      )
    })

    it('should return 400 when a record has an invalid status', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          records: [
            {
              student_id: 101,
              status: 'unknown',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await recordBulkAttendance(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
    })

    it('should return 404 when the group does not exist', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 999,
          attendance_date: '2026-09-02',
          session: 'morning',
          records: [
            {
              student_id: 101,
              status: 'present',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      pool.query.mockResolvedValueOnce([
        [],
      ])

      await recordBulkAttendance(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(404)

      expect(error.message).toBe('Group not found')
    })

    it('should return 403 when a teacher does not own the group', async () => {
      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          records: [
            {
              student_id: 101,
              status: 'present',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      await recordBulkAttendance(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(403)

      expect(error.message).toBe(
        'You do not have access to this group'
      )
    })

    it('should rollback transaction when database insert fails', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
          attendance_date: '2026-09-02',
          session: 'morning',
          records: [
            {
              student_id: 101,
              status: 'present',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)

      const dbError = new Error('Database error')

      conn.query.mockRejectedValueOnce(dbError)

      await recordBulkAttendance(req, res, next)

      expect(conn.beginTransaction).toHaveBeenCalledTimes(1)

      expect(conn.rollback).toHaveBeenCalledTimes(1)

      expect(conn.commit).not.toHaveBeenCalled()

      expect(conn.release).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledWith(dbError)
    })
  })

  // ============================================================
  // getAttendance
  // ============================================================

  describe('getAttendance', () => {
    it('should return attendance records successfully', async () => {
      const attendance = [
        {
          id: 1,
          student_id: 101,
          student_name: 'John Doe',
          status: 'present',
        },
      ]

      pool.query.mockResolvedValueOnce([
        attendance,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        query: {},
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getAttendance(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: attendance,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should restrict students to their own attendance records', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        query: {},
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getAttendance(req, res, next)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toContain(101)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should allow teachers to filter by student', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          student_id: '101',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getAttendance(req, res, next)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toContain(5)

      expect(params).toContain('101')

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // getStudentAttendanceSummary
  // ============================================================

  describe('getStudentAttendanceSummary', () => {
    it('should return a student attendance summary successfully', async () => {
      pool.query.mockResolvedValueOnce([
        [
          {
            status: 'present',
            count: 8,
          },
          {
            status: 'late',
            count: 1,
          },
          {
            status: 'absent',
            count: 1,
          },
        ],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          studentId: '101',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentAttendanceSummary(
        req,
        res,
        next
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          student_id: 101,
          total_sessions: 10,
          counts: {
            present: 8,
            late: 1,
            absent: 1,
            excused: 0,
          },
          attendance_percentage: 90,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should prevent a student from viewing another student attendance', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        params: {
          studentId: '102',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentAttendanceSummary(
        req,
        res,
        next
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(403)

      expect(error.message).toBe(
        'Access denied: You can only view your own attendance summary.'
      )
    })

    it('should prevent a teacher from viewing a student outside their groups', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '101',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentAttendanceSummary(
        req,
        res,
        next
      )

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '101'
      )

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(403)
    })

    it('should allow a teacher to view a student in their group', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '101',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentAttendanceSummary(
        req,
        res,
        next
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          student_id: 101,
          total_sessions: 0,
          counts: {
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
          },
          attendance_percentage: null,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // getGroupAttendanceSummary
  // ============================================================

  describe('getGroupAttendanceSummary', () => {
    it('should return group attendance summary successfully', async () => {
      pool.query
        // Group exists
        .mockResolvedValueOnce([
          [{ id: 10 }],
        ])

        // Attendance rows
        .mockResolvedValueOnce([
          [
            {
              student_id: 101,
              student_name: 'John Doe',
              status: 'present',
              count: 8,
            },
            {
              student_id: 101,
              student_name: 'John Doe',
              status: 'absent',
              count: 2,
            },
            {
              student_id: 102,
              student_name: 'Jane Doe',
              status: 'present',
              count: 10,
            },
          ],
        ])

      const req = {
        params: {
          groupId: '10',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getGroupAttendanceSummary(
        req,
        res,
        next
      )

      expect(res.status).toHaveBeenCalledWith(200)

      const response =
        res.json.mock.calls[0][0]

      expect(response.success).toBe(true)

      expect(response.data.group_id).toBe(10)

      expect(
        response.data.students
      ).toHaveLength(2)

      expect(
        response.data.group_average_percentage
      ).toBe(90)

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 404 when the group does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        params: {
          groupId: '999',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getGroupAttendanceSummary(
        req,
        res,
        next
      )

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(404)

      expect(error.message).toBe('Group not found')
    })
  })

  // ============================================================
  // createAttendanceAppeal
  // ============================================================

  describe('createAttendanceAppeal', () => {
    it('should create an attendance appeal successfully', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        body: {
          attendance_id: 50,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      // Attendance exists
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 50,
            student_id: 101,
            status: 'absent',
          },
        ],
      ])

      // No existing appeal
      pool.query.mockResolvedValueOnce([
        [],
      ])

      // Insert appeal
      pool.query.mockResolvedValueOnce([
        {
          insertId: 20,
        },
      ])

      await createAttendanceAppeal(
        req,
        res,
        next
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Attendance appeal submitted',
        data: {
          id: 20,
          attendance_id: 50,
          status: 'pending',
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 400 when attendance_id is missing', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        body: {},
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createAttendanceAppeal(
        req,
        res,
        next
      )

      expect(pool.query).not.toHaveBeenCalled()

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)

      expect(error.message).toBe(
        'attendance_id is required'
      )
    })

    it('should return 404 when attendance record does not exist', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        body: {
          attendance_id: 999,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      pool.query.mockResolvedValueOnce([
        [],
      ])

      await createAttendanceAppeal(
        req,
        res,
        next
      )

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(404)

      expect(error.message).toBe(
        'Attendance record not found'
      )
    })

    it('should prevent students from appealing another student attendance', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        body: {
          attendance_id: 50,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 50,
            student_id: 999,
            status: 'absent',
          },
        ],
      ])

      await createAttendanceAppeal(
        req,
        res,
        next
      )

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(403)

      expect(error.message).toBe(
        'You can only appeal your own attendance'
      )
    })

    it('should only allow absent attendance to be appealed', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        body: {
          attendance_id: 50,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 50,
            student_id: 101,
            status: 'present',
          },
        ],
      ])

      await createAttendanceAppeal(
        req,
        res,
        next
      )

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)

      expect(error.message).toBe(
        'Only absent attendance can be appealed'
      )
    })

    it('should return 409 when an appeal already exists', async () => {
      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
        body: {
          attendance_id: 50,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 50,
              student_id: 101,
              status: 'absent',
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              status: 'pending',
            },
          ],
        ])

      await createAttendanceAppeal(
        req,
        res,
        next
      )

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(409)

      expect(error.message).toBe(
        'An appeal already exists for this attendance'
      )
    })
  })

  // ============================================================
  // getMyAttendanceAppeals
  // ============================================================

  describe('getMyAttendanceAppeals', () => {
    it('should return the current student attendance appeals', async () => {
      const appeals = [
        {
          id: 1,
          attendance_id: 50,
          status: 'pending',
        },
      ]

      pool.query.mockResolvedValueOnce([
        appeals,
      ])

      const req = {
        user: {
          sub: 101,
          role: 'student',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await getMyAttendanceAppeals(
        req,
        res,
        next
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: appeals,
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
// getPendingAttendanceAppeals
// ============================================================

describe('getPendingAttendanceAppeals', () => {
  it('should return pending appeals for an admin', async () => {
    const appeals = [
      {
        id: 1,
        student_id: 101,
        status: 'pending',
      },
    ]

    pool.query.mockResolvedValueOnce([
      appeals,
    ])

    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      query: {},
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    await getPendingAttendanceAppeals(
      req,
      res,
      next
    )

    expect(pool.query).toHaveBeenCalledTimes(1)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      data: appeals,
    })

    expect(next).not.toHaveBeenCalled()
  })

  it('should scope pending appeals to teacher groups', async () => {
    pool.query.mockResolvedValueOnce([
      [],
    ])

    const req = {
      user: {
        sub: 5,
        role: 'teacher',
      },
      query: {},
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    await getPendingAttendanceAppeals(
      req,
      res,
      next
    )

    expect(pool.query).toHaveBeenCalledTimes(1)

    const [, params] = pool.query.mock.calls[0]

    expect(params).toContain(5)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 0,
      data: [],
    })

    expect(next).not.toHaveBeenCalled()
  })

  it('should filter pending appeals by group_id', async () => {
    pool.query.mockResolvedValueOnce([
      [],
    ])

    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      query: {
        group_id: '10',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    await getPendingAttendanceAppeals(
      req,
      res,
      next
    )

    const [, params] = pool.query.mock.calls[0]

    expect(params).toContain('10')

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 0,
      data: [],
    })

    expect(next).not.toHaveBeenCalled()
  })
})
// ============================================================
// reviewAttendanceAppeal
// ============================================================

describe('reviewAttendanceAppeal', () => {
  it('should accept an attendance appeal successfully', async () => {
    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      params: {
        id: '10',
      },
      body: {
        status: 'accepted',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    pool.query
      // Appeal exists
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            attendance_id: 50,
            status: 'pending',
            group_id: 10,
          },
        ],
      ])

      // Update appeal
      .mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      // Update attendance
      .mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(pool.query).toHaveBeenCalledTimes(3)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Appeal accepted',
      data: {
        id: 10,
        status: 'accepted',
      },
    })

    expect(next).not.toHaveBeenCalled()
  })


  it('should reject an attendance appeal successfully', async () => {
    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      params: {
        id: '10',
      },
      body: {
        status: 'rejected',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    pool.query
      // Appeal exists
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            attendance_id: 50,
            status: 'pending',
            group_id: 10,
          },
        ],
      ])

      // Update appeal
      .mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(pool.query).toHaveBeenCalledTimes(2)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Appeal rejected',
      data: {
        id: 10,
        status: 'rejected',
      },
    })

    expect(next).not.toHaveBeenCalled()
  })


  it('should return 400 for an invalid appeal status', async () => {
    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      params: {
        id: '10',
      },
      body: {
        status: 'pending',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(pool.query).not.toHaveBeenCalled()

    expect(next).toHaveBeenCalledTimes(1)

    const error = next.mock.calls[0][0]

    expect(error.statusCode).toBe(400)
  })


  it('should return 404 when the appeal does not exist', async () => {
    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      params: {
        id: '999',
      },
      body: {
        status: 'accepted',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    pool.query.mockResolvedValueOnce([
      [],
    ])

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)

    const error = next.mock.calls[0][0]

    expect(error.statusCode).toBe(404)

    expect(error.message).toBe(
      'Appeal not found'
    )
  })


  it('should return 409 when the appeal was already reviewed', async () => {
    const req = {
      user: {
        sub: 1,
        role: 'admin',
      },
      params: {
        id: '10',
      },
      body: {
        status: 'accepted',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    pool.query.mockResolvedValueOnce([
      [
        {
          id: 10,
          attendance_id: 50,
          status: 'accepted',
          group_id: 10,
        },
      ],
    ])

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)

    const error = next.mock.calls[0][0]

    expect(error.statusCode).toBe(409)

    expect(error.message).toBe(
      'This appeal has already been reviewed'
    )
  })


  it('should prevent a teacher from reviewing an appeal outside their group', async () => {
    const req = {
      user: {
        sub: 5,
        role: 'teacher',
      },
      params: {
        id: '10',
      },
      body: {
        status: 'accepted',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    pool.query
      // Appeal exists and is pending
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            attendance_id: 50,
            status: 'pending',
            group_id: 10,
          },
        ],
      ])

      // Teacher ownership check
      .mockResolvedValueOnce([
        [],
      ])

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(pool.query).toHaveBeenCalledTimes(2)

    expect(next).toHaveBeenCalledTimes(1)

    const error = next.mock.calls[0][0]

    expect(error.statusCode).toBe(403)

    expect(error.message).toBe(
      'You are not assigned to this group'
    )
  })


  it('should allow a teacher to review an appeal in their group', async () => {
    const req = {
      user: {
        sub: 5,
        role: 'teacher',
      },
      params: {
        id: '10',
      },
      body: {
        status: 'rejected',
      },
    }

    const res = {
      json: vi.fn(),
    }

    const next = vi.fn()

    pool.query
      // Appeal exists
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            attendance_id: 50,
            status: 'pending',
            group_id: 10,
          },
        ],
      ])

      // Teacher owns group
      .mockResolvedValueOnce([
        [{ 1: 1 }],
      ])

      // Update appeal
      .mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

    await reviewAttendanceAppeal(
      req,
      res,
      next
    )

    expect(pool.query).toHaveBeenCalledTimes(3)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Appeal rejected',
      data: {
        id: 10,
        status: 'rejected',
      },
    })

    expect(next).not.toHaveBeenCalled()
  })
})
})