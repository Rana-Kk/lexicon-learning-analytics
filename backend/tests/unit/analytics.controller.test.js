import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest'

// ============================================================
// MOCK DATABASE
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}))

// ============================================================
// MOCK SCOPE FUNCTIONS
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherHasStudent: vi.fn(),
  teacherOwnsGroup: vi.fn(),
  getTeacherGroupIds: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherHasStudent,
  teacherOwnsGroup,
  getTeacherGroupIds,
} from '../../src/utils/scope.js'

import {
  overview,
  groupComparison,
  studentComparison,
} from '../../src/controllers/analytics.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('analytics controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // overview
  // ============================================================

  describe('overview', () => {
    it('should return platform overview for admin', async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              total: 10,
              present: 7,
              late: 2,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 5,
              avg: 80,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 3,
              avg: 75,
            },
          ],
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

      await overview(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 10,
            present: 7,
            late: 2,
            rate: 80,
          },
          quiz_average: 80,
          assessment_average: 75,
          quiz_count: 5,
          assessment_count: 3,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return overview for logged-in student only', async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              total: 8,
              present: 6,
              late: 1,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 4,
              avg: 90,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 2,
              avg: 85,
            },
          ],
        ])

      const req = {
        user: {
          sub: 10,
          role: 'student',
        },
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await overview(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 8,
            present: 6,
            late: 1,
            rate: 81,
          },
          quiz_average: 90,
          assessment_average: 85,
          quiz_count: 4,
          assessment_count: 2,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should allow teacher to view overview of their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query
        .mockResolvedValueOnce([
          [
            {
              total: 10,
              present: 8,
              late: 0,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 5,
              avg: 70,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 4,
              avg: 80,
            },
          ],
        ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await overview(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        '3'
      )

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 10,
            present: 8,
            late: 0,
            rate: 80,
          },
          quiz_average: 70,
          assessment_average: 80,
          quiz_count: 5,
          assessment_count: 4,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when teacher accesses another group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          group_id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await overview(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        '999'
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })
    })

    it('should allow teacher to view their own student overview', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query
        .mockResolvedValueOnce([
          [
            {
              total: 5,
              present: 4,
              late: 1,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 3,
              avg: 88,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 2,
              avg: 90,
            },
          ],
        ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          student_id: '10',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await overview(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '10'
      )

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 5,
            present: 4,
            late: 1,
            rate: 90,
          },
          quiz_average: 88,
          assessment_average: 90,
          quiz_count: 3,
          assessment_count: 2,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when teacher accesses another student', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          student_id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await overview(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '999'
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })
    })

    it('should return empty overview when teacher has no groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([])

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

      await overview(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 0,
            present: 0,
            late: 0,
            rate: 0,
          },
          quiz_average: 0,
          assessment_average: 0,
          quiz_count: 0,
          assessment_count: 0,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return overview scoped to all teacher groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([
        1,
        2,
      ])

      pool.query
        .mockResolvedValueOnce([
          [
            {
              total: 20,
              present: 15,
              late: 2,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 10,
              avg: 75,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 8,
              avg: 70,
            },
          ],
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

      await overview(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 20,
            present: 15,
            late: 2,
            rate: 80,
          },
          quiz_average: 75,
          assessment_average: 70,
          quiz_count: 10,
          assessment_count: 8,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return zero values when there is no data', async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              total: 0,
              present: null,
              late: null,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 0,
              avg: null,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              count: 0,
              avg: null,
            },
          ],
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

      await overview(req, res, next)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          attendance: {
            total: 0,
            present: 0,
            late: 0,
            rate: 0,
          },
          quiz_average: 0,
          assessment_average: 0,
          quiz_count: 0,
          assessment_count: 0,
        },
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // groupComparison
  // ============================================================

  describe('groupComparison', () => {
    it('should return comparison for all groups for admin', async () => {
      const groups = [
        {
          id: 1,
          name: 'Group A',
          attendance: 80,
          quizAvg: 75,
          assessmentAvg: 90,
        },
        {
          id: 2,
          name: 'Group B',
          attendance: 70,
          quizAvg: 85,
          assessmentAvg: 80,
        },
      ]

      pool.query.mockResolvedValueOnce([
        groups,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await groupComparison(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: groups,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return only teacher groups for teacher', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([
        1,
        2,
      ])

      const groups = [
        {
          id: 1,
          name: 'Group A',
          attendance: 80,
          quizAvg: 75,
          assessmentAvg: 90,
        },
      ]

      pool.query.mockResolvedValueOnce([
        groups,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await groupComparison(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: groups,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return empty array when teacher has no groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await groupComparison(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // studentComparison
  // ============================================================

  describe('studentComparison', () => {
    it('should return all students for admin', async () => {
      const students = [
        {
          id: 10,
          name: 'Student One',
          attendance: 80,
          quizAvg: 75,
          assessmentAvg: 90,
        },
        {
          id: 11,
          name: 'Student Two',
          attendance: 70,
          quizAvg: 85,
          assessmentAvg: 80,
        },
      ]

      pool.query.mockResolvedValueOnce([
        students,
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

      await studentComparison(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: students,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return students filtered by group for admin', async () => {
      const students = [
        {
          id: 10,
          name: 'Student One',
          attendance: 80,
          quizAvg: 75,
          assessmentAvg: 90,
        },
      ]

      pool.query.mockResolvedValueOnce([
        students,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentComparison(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: students,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should allow teacher to view students in their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      const students = [
        {
          id: 10,
          name: 'Student One',
          attendance: 80,
          quizAvg: 75,
          assessmentAvg: 90,
        },
      ]

      pool.query.mockResolvedValueOnce([
        students,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentComparison(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        '3'
      )

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: students,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when teacher accesses another group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          group_id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentComparison(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        '999'
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })
    })

    it('should return students from all teacher groups when no group_id is provided', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([
        1,
        2,
      ])

      const students = [
        {
          id: 10,
          name: 'Student One',
          attendance: 80,
          quizAvg: 75,
          assessmentAvg: 90,
        },
      ]

      pool.query.mockResolvedValueOnce([
        students,
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

      await studentComparison(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: students,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return empty array when teacher has no groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([])

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

      await studentComparison(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })

      expect(next).not.toHaveBeenCalled()
    })
  })
})