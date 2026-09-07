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
  teacherOwnsGroup: vi.fn(),
  teacherHasStudent: vi.fn(),
  getTeacherGroupIds: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherOwnsGroup,
  teacherHasStudent,
  getTeacherGroupIds,
} from '../../src/utils/scope.js'

import {
  getQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizResults,
  upsertQuizResult,
  bulkImportQuizResults,
} from '../../src/controllers/quizzes.controller.js'

// ============================================================
// HELPERS
// ============================================================

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
})

const createConnection = () => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(),
})

// ============================================================
// TESTS
// ============================================================

describe('quizzes controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getQuizzes
  // ============================================================

  describe('getQuizzes', () => {
    it('should return all quizzes for admin', async () => {
      const quizzes = [
        {
          id: 1,
          title: 'JavaScript Quiz',
          group_id: 1,
          result_count: 5,
        },
        {
          id: 2,
          title: 'React Quiz',
          group_id: 2,
          result_count: 3,
        },
      ]

      pool.query.mockResolvedValueOnce([quizzes])

      const req = {
        query: {},
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: quizzes,
      })
    })

    it('should filter quizzes by group for admin', async () => {
      const quizzes = [
        {
          id: 1,
          title: 'JavaScript Quiz',
          group_id: 5,
        },
      ]

      pool.query.mockResolvedValueOnce([quizzes])

      const req = {
        query: {
          group_id: '5',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toContain('5')

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: quizzes,
      })
    })

    it('should filter quizzes by student for admin', async () => {
      const quizzes = [
        {
          id: 1,
          title: 'JavaScript Quiz',
        },
      ]

      pool.query.mockResolvedValueOnce([quizzes])

      const req = {
        query: {
          student_id: '10',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toContain('10')

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: quizzes,
      })
    })

    it('should return quizzes from owned group for teacher', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      const quizzes = [
        {
          id: 1,
          title: 'JavaScript Quiz',
          group_id: 5,
        },
      ]

      pool.query.mockResolvedValueOnce([quizzes])

      const req = {
        query: {
          group_id: '5',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(2, '5')

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: quizzes,
      })
    })

    it('should return 403 when teacher tries to access another group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        query: {
          group_id: '99',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(getQuizzes(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return empty array when teacher has no groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([])

      const req = {
        query: {},
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(2)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })
    })

    it('should return quizzes from all teacher groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([1, 2, 3])

      const quizzes = [
        {
          id: 1,
          title: 'Quiz 1',
          group_id: 1,
        },
      ]

      pool.query.mockResolvedValueOnce([quizzes])

      const req = {
        query: {},
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toEqual([[1, 2, 3]])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: quizzes,
      })
    })

    it('should return 403 when teacher tries to filter inaccessible student', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([1])
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        query: {
          student_id: '99',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(getQuizzes(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })
    })

    it('should return quizzes for student from their groups', async () => {
      const quizzes = [
        {
          id: 1,
          title: 'Student Quiz',
          group_id: 3,
        },
      ]

      pool.query.mockResolvedValueOnce([quizzes])

      const req = {
        query: {},
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await getQuizzes(req, res)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toEqual([10])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: quizzes,
      })
    })

    it('should return 403 when student requests another student data', async () => {
      const req = {
        query: {
          student_id: '99',
        },
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await expect(getQuizzes(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You can only access your own quiz data',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // getQuizById
  // ============================================================

  describe('getQuizById', () => {
    it('should return quiz details for admin', async () => {
      const quiz = {
        id: 1,
        title: 'JavaScript Quiz',
        group_id: 2,
        group_name: 'Group A',
      }

      const results = [
        {
          id: 1,
          student_id: 10,
          score: 85,
        },
      ]

      pool.query
        .mockResolvedValueOnce([[quiz]])
        .mockResolvedValueOnce([results])

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await getQuizById(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...quiz,
          results,
        },
      })
    })

    it('should return 404 when quiz does not exist', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const req = {
        params: {
          id: '999',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(getQuizById(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Quiz not found',
      })
    })

    it('should allow teacher to access quiz from owned group', async () => {
      const quiz = {
        id: 1,
        group_id: 5,
      }

      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query
        .mockResolvedValueOnce([[quiz]])
        .mockResolvedValueOnce([[]])

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await getQuizById(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(2, 5)

      expect(res.json).toHaveBeenCalled()
    })

    it('should return 403 when teacher does not own quiz group', async () => {
      const quiz = {
        id: 1,
        group_id: 99,
      }

      pool.query.mockResolvedValueOnce([[quiz]])
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(getQuizById(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this quiz',
      })
    })

    it('should allow student who belongs to quiz group', async () => {
      const quiz = {
        id: 1,
        group_id: 5,
      }

      const results = [
        {
          student_id: 10,
          score: 90,
        },
      ]

      pool.query
        .mockResolvedValueOnce([[quiz]])
        .mockResolvedValueOnce([[{ 1: 1 }]])
        .mockResolvedValueOnce([results])

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await getQuizById(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...quiz,
          results,
        },
      })

      const [, resultParams] = pool.query.mock.calls[2]

      expect(resultParams).toEqual(['1', 10])
    })

    it('should return 403 when student does not belong to quiz group', async () => {
      const quiz = {
        id: 1,
        group_id: 5,
      }

      pool.query
        .mockResolvedValueOnce([[quiz]])
        .mockResolvedValueOnce([[]])

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await expect(getQuizById(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this quiz',
      })
    })
  })

  // ============================================================
  // createQuiz
  // ============================================================

  describe('createQuiz', () => {
    it('should create a quiz successfully', async () => {
      const createdQuiz = {
        id: 1,
        group_id: 5,
        title: 'JavaScript Quiz',
        topic: 'Functions',
        max_score: 100,
      }

      pool.query
        .mockResolvedValueOnce([[{ id: 5 }]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([[createdQuiz]])

      const req = {
        body: {
          group_id: 5,
          title: 'JavaScript Quiz',
          topic: 'Functions',
          quiz_date: '2026-09-01',
          max_score: 100,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await createQuiz(req, res)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quiz created successfully',
        data: createdQuiz,
      })
    })

    it('should return 400 when required fields are missing', async () => {
      const req = {
        body: {
          title: 'Quiz',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(createQuiz(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: 'group_id, title and max_score are required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return 404 when group does not exist', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const req = {
        body: {
          group_id: 99,
          title: 'Quiz',
          max_score: 100,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(createQuiz(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Group not found',
      })
    })

    it('should return 403 when teacher does not own group', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5 }]])
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        body: {
          group_id: 5,
          title: 'Quiz',
          max_score: 100,
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(createQuiz(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })
    })
  })

  // ============================================================
  // updateQuiz
  // ============================================================

  describe('updateQuiz', () => {
    it('should update quiz successfully for admin', async () => {
      const updatedQuiz = {
        id: 1,
        group_id: 5,
        title: 'Updated Quiz',
      }

      pool.query
        .mockResolvedValueOnce([[{ id: 1, group_id: 5 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[updatedQuiz]])

      const req = {
        params: {
          id: '1',
        },
        body: {
          title: 'Updated Quiz',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await updateQuiz(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedQuiz,
      })
    })

    it('should return 404 when quiz does not exist', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const req = {
        params: {
          id: '999',
        },
        body: {},
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(updateQuiz(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Quiz not found',
      })
    })

    it('should return 403 when teacher does not own current quiz group', async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1, group_id: 99 }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        params: {
          id: '1',
        },
        body: {
          title: 'Updated',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(updateQuiz(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this quiz',
      })
    })

    it('should return 403 when teacher tries to move quiz to inaccessible group', async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1, group_id: 5 }],
      ])

      teacherOwnsGroup
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)

      const req = {
        params: {
          id: '1',
        },
        body: {
          group_id: 99,
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(updateQuiz(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to the target group',
      })
    })
  })

  // ============================================================
  // deleteQuiz
  // ============================================================

  describe('deleteQuiz', () => {
    it('should delete quiz successfully', async () => {
      pool.query
        .mockResolvedValueOnce([
          [{ id: 1, group_id: 5 }],
        ])
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await deleteQuiz(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quiz deleted successfully',
      })
    })

    it('should return 404 when quiz does not exist before deleting', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const req = {
        params: {
          id: '999',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(deleteQuiz(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Quiz not found',
      })
    })

    it('should return 403 when teacher does not own quiz group', async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1, group_id: 99 }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(deleteQuiz(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this quiz',
      })
    })

    it('should return 404 when delete affects no rows', async () => {
      pool.query
        .mockResolvedValueOnce([
          [{ id: 1, group_id: 5 }],
        ])
        .mockResolvedValueOnce([
          { affectedRows: 0 },
        ])

      const req = {
        params: {
          id: '1',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(deleteQuiz(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Quiz not found',
      })
    })
  })

  // ============================================================
  // getQuizResults
  // ============================================================

  describe('getQuizResults', () => {
    it('should return quiz results with calculated percentage for admin', async () => {
      const rows = [
        {
          id: 1,
          score: 80,
          max_score: 100,
        },
        {
          id: 2,
          score: 45,
          max_score: 50,
        },
      ]

      pool.query.mockResolvedValueOnce([rows])

      const req = {
        query: {},
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await getQuizResults(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: [
          {
            ...rows[0],
            percentage: 80,
          },
          {
            ...rows[1],
            percentage: 90,
          },
        ],
      })
    })

    it('should return 403 when teacher accesses another group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        query: {
          group_id: '99',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(getQuizResults(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })
    })

    it('should return empty results when teacher has no groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([])

      const req = {
        query: {},
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await getQuizResults(req, res)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })
    })

    it('should return 403 when teacher accesses inaccessible student', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([1])
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        query: {
          student_id: '99',
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(getQuizResults(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })
    })

    it('should return 403 when student requests another student results', async () => {
      const req = {
        query: {
          student_id: '99',
        },
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await expect(getQuizResults(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You can only access your own quiz results',
      })
    })

    it('should return only own quiz results for student', async () => {
      const rows = [
        {
          id: 1,
          student_id: 10,
          score: 90,
          max_score: 100,
        },
      ]

      pool.query.mockResolvedValueOnce([rows])

      const req = {
        query: {},
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await getQuizResults(req, res)

      const [, params] = pool.query.mock.calls[0]

      expect(params).toEqual([10, 10])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: [
          {
            ...rows[0],
            percentage: 90,
          },
        ],
      })
    })

    it('should return 0 percentage when max_score is zero', async () => {
      const rows = [
        {
          id: 1,
          score: 10,
          max_score: 0,
        },
      ]

      pool.query.mockResolvedValueOnce([rows])

      const req = {
        query: {},
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await getQuizResults(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: [
          {
            ...rows[0],
            percentage: 0,
          },
        ],
      })
    })
  })

  // ============================================================
  // upsertQuizResult
  // ============================================================

  describe('upsertQuizResult', () => {
    it('should return 400 when required fields are missing', async () => {
      const req = {
        body: {
          quiz_id: 1,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(upsertQuizResult(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: 'quiz_id, student_id and score are required',
      })
    })

    it('should return 404 when quiz does not exist', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const req = {
        body: {
          quiz_id: 99,
          student_id: 10,
          score: 80,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(upsertQuizResult(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Quiz not found',
      })
    })

    it('should return 403 when teacher does not own quiz group', async () => {
      pool.query.mockResolvedValueOnce([
        [{
          id: 1,
          max_score: 100,
          group_id: 5,
        }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        body: {
          quiz_id: 1,
          student_id: 10,
          score: 80,
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(upsertQuizResult(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this quiz',
      })
    })

    it('should return 403 when teacher does not have access to student', async () => {
      pool.query.mockResolvedValueOnce([
        [{
          id: 1,
          max_score: 100,
          group_id: 5,
        }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(true)
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        body: {
          quiz_id: 1,
          student_id: 99,
          score: 80,
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await expect(upsertQuizResult(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })
    })

    it('should return 403 when student does not belong to quiz group', async () => {
      pool.query
        .mockResolvedValueOnce([
          [{
            id: 1,
            max_score: 100,
            group_id: 5,
          }],
        ])
        .mockResolvedValueOnce([[]])

      const req = {
        body: {
          quiz_id: 1,
          score: 80,
        },
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await expect(upsertQuizResult(req, res)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this quiz',
      })
    })

    it('should return 404 when student does not exist', async () => {
      pool.query
        .mockResolvedValueOnce([
          [{
            id: 1,
            max_score: 100,
            group_id: 5,
          }],
        ])
        .mockResolvedValueOnce([[]])

      const req = {
        body: {
          quiz_id: 1,
          student_id: 99,
          score: 80,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(upsertQuizResult(req, res)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Student not found',
      })
    })

    it('should save quiz result successfully', async () => {
      const savedResult = {
        id: 1,
        quiz_id: 1,
        student_id: 10,
        score: 80,
        max_score: 100,
        quiz_title: 'JavaScript Quiz',
      }

      pool.query
        .mockResolvedValueOnce([
          [{
            id: 1,
            max_score: 100,
            group_id: 5,
          }],
        ])
        .mockResolvedValueOnce([
          [{ id: 10 }],
        ])
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])
        .mockResolvedValueOnce([
          [savedResult],
        ])

      const req = {
        body: {
          quiz_id: 1,
          student_id: 10,
          score: 80,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await upsertQuizResult(req, res)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quiz result saved successfully',
        data: {
          ...savedResult,
          percentage: 80,
        },
      })
    })
  })

  // ============================================================
  // bulkImportQuizResults
  // ============================================================

  describe('bulkImportQuizResults', () => {
    it('should return 400 when results array is empty', async () => {
      const req = {
        body: {
          results: [],
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(
        bulkImportQuizResults(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'results array is required',
      })

      expect(pool.getConnection).not.toHaveBeenCalled()
    })

    it('should successfully import valid quiz result', async () => {
      const conn = createConnection()

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query
        // Create batch
        .mockResolvedValueOnce([
          { insertId: 100 },
        ])

        // Find student
        .mockResolvedValueOnce([
          [{ id: 10 }],
        ])

        // Find quiz
        .mockResolvedValueOnce([
          [{
            id: 5,
            group_id: 2,
          }],
        ])

        // Import row
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])

        // Insert quiz result
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])

      const req = {
        body: {
          file_name: 'quiz-results.xlsx',
          results: [
            {
              email: 'student@test.com',
              quiz_id: 5,
              quiz_title: 'JavaScript Quiz',
              score: 85,
            },
          ],
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await bulkImportQuizResults(req, res)

      expect(conn.beginTransaction).toHaveBeenCalledTimes(1)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(conn.rollback).not.toHaveBeenCalled()

      expect(conn.release).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quiz import completed',
        data: {
          batch_id: 100,
          imported: 1,
          skipped: 0,
        },
      })
    })

    it('should skip invalid student during import', async () => {
      const conn = createConnection()

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query
        // Create batch
        .mockResolvedValueOnce([
          { insertId: 100 },
        ])

        // Student not found
        .mockResolvedValueOnce([[]])

        // Import row
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])

      const req = {
        body: {
          results: [
            {
              email: 'unknown@test.com',
              quiz_id: 5,
              score: 85,
            },
          ],
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await bulkImportQuizResults(req, res)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quiz import completed',
        data: {
          batch_id: 100,
          imported: 0,
          skipped: 1,
        },
      })
    })

    it('should rollback transaction when an error occurs', async () => {
      const conn = createConnection()

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.beginTransaction.mockRejectedValueOnce(
        new Error('Database connection failed')
      )

      const req = {
        body: {
          results: [
            {
              email: 'student@test.com',
              score: 80,
            },
          ],
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = createResponse()

      await expect(
        bulkImportQuizResults(req, res)
      ).rejects.toThrow('Database connection failed')

      expect(conn.rollback).toHaveBeenCalledTimes(1)

      expect(conn.release).toHaveBeenCalledTimes(1)

      expect(conn.commit).not.toHaveBeenCalled()
    })

    it('should create a new quiz for teacher when matching quiz does not exist', async () => {
      const conn = createConnection()

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query
        // Create import batch
        .mockResolvedValueOnce([
          { insertId: 100 },
        ])

        // Find student
        .mockResolvedValueOnce([
          [{ id: 10 }],
        ])

        // Quiz not found
        .mockResolvedValueOnce([[]])

        // Find teacher-owned student group
        .mockResolvedValueOnce([
          [{ group_id: 5 }],
        ])

        // Create quiz
        .mockResolvedValueOnce([
          { insertId: 20 },
        ])

        // Check teacher ownership
        .mockResolvedValueOnce([
          [{ 1: 1 }],
        ])

        // Check student access
        .mockResolvedValueOnce([
          [{ 1: 1 }],
        ])

        // Insert import row
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])

        // Insert result
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])

      const req = {
        body: {
          results: [
            {
              email: 'student@test.com',
              quiz_title: 'New Quiz',
              score: 90,
            },
          ],
        },
        user: {
          sub: 2,
          role: 'teacher',
        },
      }

      const res = createResponse()

      await bulkImportQuizResults(req, res)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quiz import completed',
        data: {
          batch_id: 100,
          imported: 1,
          skipped: 0,
        },
      })
    })
  })
})