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
  getTeacherGroupIds: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherHasStudent,
  getTeacherGroupIds,
} from '../../src/utils/scope.js'

import {
  getTemplates,
  createTemplate,
  deleteTemplate,
  getFeedback,
  createFeedback,
  deleteFeedback,
} from '../../src/controllers/feedback.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('feedback controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getTemplates
  // ============================================================

  describe('getTemplates', () => {
    it('should return all feedback templates', async () => {
      const templates = [
        {
          id: 1,
          category: 'General',
          content: 'Good work!',
          created_by: 1,
          created_by_name: 'Admin User',
        },
        {
          id: 2,
          category: 'Improvement',
          content: 'Please improve your code structure.',
          created_by: 2,
          created_by_name: 'Teacher User',
        },
      ]

      pool.query.mockResolvedValueOnce([
        templates,
      ])

      const req = {}

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await getTemplates(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: templates,
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // createTemplate
  // ============================================================

  describe('createTemplate', () => {
    it('should create a template successfully', async () => {
      const template = {
        id: 1,
        category: 'General',
        content: 'Excellent work!',
        created_by: 1,
      }

      // Insert template
      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      // Get created template
      pool.query.mockResolvedValueOnce([
        [template],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          category: 'General',
          content: 'Excellent work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createTemplate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: template,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return an error when category is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          content: 'Excellent work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createTemplate(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'category and content are required',
      })
    })

    it('should return an error when content is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          category: 'General',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createTemplate(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'category and content are required',
      })
    })
  })

  // ============================================================
  // deleteTemplate
  // ============================================================

  describe('deleteTemplate', () => {
    it('should delete a template successfully', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteTemplate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return an error when template does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteTemplate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message: 'Template not found',
      })
    })
  })

  // ============================================================
  // getFeedback
  // ============================================================

  describe('getFeedback', () => {
    it('should return all feedback for admin', async () => {
      const feedback = [
        {
          id: 1,
          student_id: 10,
          teacher_id: 5,
          content: 'Good work!',
        },
        {
          id: 2,
          student_id: 11,
          teacher_id: 6,
          content: 'Needs improvement.',
        },
      ]

      pool.query.mockResolvedValueOnce([
        feedback,
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

      await getFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return only logged-in student feedback', async () => {
      const feedback = [
        {
          id: 1,
          student_id: 10,
          teacher_id: 5,
          content: 'Good work!',
        },
      ]

      pool.query.mockResolvedValueOnce([
        feedback,
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

      await getFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should allow teacher to get feedback of their own student', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      const feedback = [
        {
          id: 1,
          student_id: 10,
          teacher_id: 5,
          content: 'Good work!',
        },
      ]

      pool.query.mockResolvedValueOnce([
        feedback,
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

      await getFeedback(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '10'
      )

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when teacher tries to access another student feedback', async () => {
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

      await getFeedback(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '999'
      )

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })
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

      await getFeedback(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return feedback from teacher groups when no student_id is provided', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([
        1,
        2,
      ])

      const feedback = [
        {
          id: 1,
          student_id: 10,
          teacher_id: 5,
          content: 'Good work!',
        },
      ]

      pool.query.mockResolvedValueOnce([
        feedback,
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

      await getFeedback(req, res, next)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should filter feedback by assessment_id', async () => {
      const feedback = [
        {
          id: 1,
          student_id: 10,
          assessment_id: 20,
          content: 'Good work!',
        },
      ]

      pool.query.mockResolvedValueOnce([
        feedback,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        query: {
          assessment_id: '20',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await getFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // createFeedback
  // ============================================================

  describe('createFeedback', () => {
    it('should create feedback successfully as admin', async () => {
      const feedback = {
        id: 1,
        student_id: 10,
        teacher_id: 1,
        content: 'Excellent work!',
      }

      // Check student
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      // Insert feedback
      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      // Get created feedback
      pool.query.mockResolvedValueOnce([
        [feedback],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          student_id: 10,
          content: 'Excellent work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return an error when student_id is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          content: 'Excellent work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createFeedback(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'student_id and content are required',
      })
    })

    it('should return an error when content is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          student_id: 10,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createFeedback(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 400,
        message: 'student_id and content are required',
      })
    })

    it('should return 403 when teacher tries to create feedback for another student', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          student_id: 999,
          content: 'Good work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createFeedback(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        999
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })
    })

    it('should allow teacher to create feedback for their own student', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      const feedback = {
        id: 1,
        student_id: 10,
        teacher_id: 5,
        content: 'Good work!',
      }

      // Check student
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      // Insert feedback
      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      // Get created feedback
      pool.query.mockResolvedValueOnce([
        [feedback],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          student_id: 10,
          content: 'Good work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createFeedback(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        10
      )

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: feedback,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return an error when student does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          student_id: 999,
          content: 'Good work!',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message: 'Student not found',
      })
    })
  })

  // ============================================================
  // deleteFeedback
  // ============================================================

  describe('deleteFeedback', () => {
    it('should allow admin to delete any feedback', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should allow teacher to delete their own feedback', async () => {
      pool.query.mockResolvedValueOnce([
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
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM teacher_feedback WHERE id=? AND teacher_id=?',
        ['1', 5]
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('should return an error when feedback does not exist for admin', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message: 'Feedback not found',
      })
    })

    it('should return an error when teacher tries to delete another teachers feedback', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteFeedback(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM teacher_feedback WHERE id=? AND teacher_id=?',
        ['999', 5]
      )

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,
        message: 'Feedback not found',
      })
    })
  })
})