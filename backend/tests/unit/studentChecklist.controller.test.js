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
    getConnection: vi.fn(),
  },
}))

// ============================================================
// MOCK SCOPE FUNCTIONS
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherOwnsGroup: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherOwnsGroup,
} from '../../src/utils/scope.js'

import {
  getStudentChecklist,
  saveStudentChecklist,
} from '../../src/controllers/studentChecklist.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('studentChecklist controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getStudentChecklist
  // ============================================================

  describe('getStudentChecklist', () => {

    it('should return student checklist evaluations successfully', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Check student membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      const assessments = [
        {
          id: 1,
          title: 'JavaScript Assessment',
          type: 'assignment',
          due_date: '2026-09-10',
          assessment_date: null,
          max_score: 100,
        },
        {
          id: 2,
          title: 'React Assessment',
          type: 'assignment',
          due_date: '2026-09-15',
          assessment_date: null,
          max_score: 100,
        },
      ]

      // Get assessments
      pool.query.mockResolvedValueOnce([
        assessments,
      ])

      const criteria = [
        {
          id: 1,
          assessment_id: 1,
          name: 'Repository exists',
          description: 'Repository should exist',
          criterion_type: 'yes_no',
          max_score: null,
          sort_order: 1,
          result_id: 10,
          ai_yes_no_value: 1,
          ai_score_value: null,
          ai_text_value: null,
          ai_feedback: 'Repository found',
          teacher_yes_no_value: null,
          teacher_score_value: null,
          teacher_text_value: null,
          teacher_feedback: null,
        },
        {
          id: 2,
          assessment_id: 1,
          name: 'Code quality',
          description: 'Code should be clean',
          criterion_type: 'score',
          max_score: 10,
          sort_order: 2,
          result_id: 11,
          ai_yes_no_value: null,
          ai_score_value: 8,
          ai_text_value: null,
          ai_feedback: 'Good code quality',
          teacher_yes_no_value: null,
          teacher_score_value: 9,
          teacher_text_value: null,
          teacher_feedback: 'Looks good',
        },
        {
          id: 3,
          assessment_id: 2,
          name: 'Documentation',
          description: 'Project documentation',
          criterion_type: 'text',
          max_score: null,
          sort_order: 1,
          result_id: null,
          ai_yes_no_value: null,
          ai_score_value: null,
          ai_text_value: null,
          ai_feedback: null,
          teacher_yes_no_value: null,
          teacher_score_value: null,
          teacher_text_value: null,
          teacher_feedback: null,
        },
      ]

      // Get criteria
      pool.query.mockResolvedValueOnce([
        criteria,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        3
      )

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...assessments[0],
            criteria: [
              criteria[0],
              criteria[1],
            ],
          },
          {
            ...assessments[1],
            criteria: [
              criteria[2],
            ],
          },
        ],
      })

      expect(next).not.toHaveBeenCalled()
    })


    it('should return 400 when studentId is missing', async () => {
      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '0',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'studentId and group_id are required',
      })
    })


    it('should return 400 when group_id is missing', async () => {
      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
        },
        query: {},
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'studentId and group_id are required',
      })
    })


    it('should return 403 when teacher does not own the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        3
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })
    })


    it('should return 404 when student is not a member of the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership check
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message: 'Student is not a member of this group',
      })
    })


    it('should return empty array when group has no assessments', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessments
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })

      expect(next).not.toHaveBeenCalled()
    })


    it('should allow admin to access checklist without teacher ownership check', async () => {
      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessments
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          studentId: '10',
        },
        query: {
          group_id: '3',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getStudentChecklist(req, res, next)

      expect(teacherOwnsGroup).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })

      expect(next).not.toHaveBeenCalled()
    })
  })


  // ============================================================
  // saveStudentChecklist
  // ============================================================

  describe('saveStudentChecklist', () => {

    function createMockConnection() {
      return {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }
    }


    it('should save a teacher yes/no checklist evaluation successfully', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessment
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 20,
            group_id: 3,
          },
        ],
      ])

      // Criteria
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 100,
            criterion_type: 'yes_no',
            max_score: null,
          },
        ],
      ])

      // AI Evaluation
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 50,
          },
        ],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      // Existing result
      connection.query.mockResolvedValueOnce([
        [
          {
            id: 200,
          },
        ],
      ])

      // Update result
      connection.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 100,
              teacher_yes_no_value: true,
              teacher_feedback: 'Confirmed by teacher',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        3
      )

      expect(pool.query).toHaveBeenCalledTimes(4)

      expect(pool.getConnection).toHaveBeenCalledTimes(1)

      expect(connection.beginTransaction)
        .toHaveBeenCalledTimes(1)

      expect(connection.query)
        .toHaveBeenCalledTimes(2)

      expect(connection.commit)
        .toHaveBeenCalledTimes(1)

      expect(connection.rollback)
        .not.toHaveBeenCalled()

      expect(connection.release)
        .toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Checklist evaluation saved successfully',
      })

      expect(next).not.toHaveBeenCalled()
    })


    it('should save a teacher score checklist evaluation successfully', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessment
      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      // Criteria
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 101,
            criterion_type: 'score',
            max_score: 10,
          },
        ],
      ])

      // AI Evaluation
      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      // No existing result
      connection.query.mockResolvedValueOnce([
        [],
      ])

      // Insert result
      connection.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 101,
              teacher_score_value: 8,
              teacher_feedback: 'Good work',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.beginTransaction)
        .toHaveBeenCalledTimes(1)

      expect(connection.commit)
        .toHaveBeenCalledTimes(1)

      expect(connection.rollback)
        .not.toHaveBeenCalled()

      expect(connection.release)
        .toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Checklist evaluation saved successfully',
      })

      expect(next).not.toHaveBeenCalled()
    })


    it('should save a teacher text checklist evaluation successfully', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 102,
            criterion_type: 'text',
            max_score: null,
          },
        ],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      connection.query.mockResolvedValueOnce([
        [],
      ])

      connection.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 102,
              teacher_text_value:
                '  Excellent documentation.  ',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.commit)
        .toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Checklist evaluation saved successfully',
      })

      expect(next).not.toHaveBeenCalled()
    })


    it('should return 400 when results is missing', async () => {
      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'group_id and results are required',
      })
    })


    it('should return 400 when group_id is missing', async () => {
      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          results: [],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'group_id and results are required',
      })
    })


    it('should return 403 when teacher does not own the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        3
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })
    })


    it('should return 404 when student is not a member of the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message:
          'Student is not a member of this group',
      })
    })


    it('should return 404 when assessment does not belong to group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessment
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message:
          'Assessment not found in this group',
      })
    })


    it('should return 400 when no AI evaluation exists', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessment
      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      // Criteria
      pool.query.mockResolvedValueOnce([
        [],
      ])

      // AI evaluation
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message:
          'No AI evaluation found for this student and assessment yet',
      })
    })


    it('should return 400 when checklist criterion is invalid', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Membership
      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      // Assessment
      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      // Criteria
      pool.query.mockResolvedValueOnce([
        [],
      ])

      // AI evaluation
      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 999,
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.beginTransaction)
        .toHaveBeenCalledTimes(1)

      expect(connection.rollback)
        .toHaveBeenCalledTimes(1)

      expect(connection.commit)
        .not.toHaveBeenCalled()

      expect(connection.release)
        .toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'Invalid checklist criterion',
      })
    })


    it('should return 400 when teacher score is not a valid number', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 101,
            criterion_type: 'score',
            max_score: 10,
          },
        ],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 101,
              teacher_score_value: 'invalid',
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.rollback)
        .toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message:
          'Teacher score must be a valid number',
      })
    })


    it('should return 400 when teacher score exceeds maximum score', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 101,
            criterion_type: 'score',
            max_score: 10,
          },
        ],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 101,
              teacher_score_value: 15,
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.rollback)
        .toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message:
          'Score must be between 0 and 10',
      })
    })


    it('should return 400 when teacher score is below zero', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 101,
            criterion_type: 'score',
            max_score: 10,
          },
        ],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 101,
              teacher_score_value: -1,
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.rollback)
        .toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message:
          'Score must be between 0 and 10',
      })
    })


    it('should rollback transaction when database query fails', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [{ exists: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 20, group_id: 3 }],
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 100,
            criterion_type: 'yes_no',
            max_score: null,
          },
        ],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 50 }],
      ])

      const connection = createMockConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      connection.query.mockRejectedValueOnce(
        new Error('Database error')
      )

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          studentId: '10',
          assessmentId: '20',
        },
        body: {
          group_id: 3,
          results: [
            {
              checklist_criterion_id: 100,
              teacher_yes_no_value: true,
            },
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await saveStudentChecklist(req, res, next)

      expect(connection.rollback)
        .toHaveBeenCalledTimes(1)

      expect(connection.commit)
        .not.toHaveBeenCalled()

      expect(connection.release)
        .toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)
    })
  })
})