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
// MOCK SCOPE
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
  listCompetencies,
  createCompetency,
  getStudentCompetencies,
  upsertStudentCompetency,
  getCompetencyHistory,
  getGroupCompetencies,
  addGroupCompetency,
  removeGroupCompetency,
} from '../../src/controllers/competencies.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('competencies controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // listCompetencies
  // ============================================================

  describe('listCompetencies', () => {
    it('should return all competencies successfully', async () => {
      const competencies = [
        {
          id: 1,
          name: 'JavaScript',
          description: 'JavaScript programming skills',
        },
        {
          id: 2,
          name: 'React',
          description: 'React development skills',
        },
      ]

      pool.query.mockResolvedValueOnce([
        competencies,
      ])

      const req = {}

      const res = {
        json: vi.fn(),
      }

      await listCompetencies(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: competencies,
      })
    })

    it('should return an empty array when there are no competencies', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {}

      const res = {
        json: vi.fn(),
      }

      await listCompetencies(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })
  })

  // ============================================================
  // createCompetency
  // ============================================================

  describe('createCompetency', () => {
    it('should create a competency successfully without a group', async () => {
      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query.mockResolvedValueOnce([
        { insertId: 1 },
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            name: 'JavaScript',
            description: 'JavaScript programming skills',
          },
        ],
      ])

      const req = {
        body: {
          name: 'JavaScript',
          description: 'JavaScript programming skills',
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

      await createCompetency(req, res)

      expect(pool.getConnection).toHaveBeenCalledTimes(1)

      expect(conn.beginTransaction).toHaveBeenCalledTimes(1)

      expect(conn.query).toHaveBeenCalledTimes(1)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(conn.rollback).not.toHaveBeenCalled()

      expect(conn.release).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          name: 'JavaScript',
          description: 'JavaScript programming skills',
        },
      })
    })

    it('should create a competency and connect it to a group successfully', async () => {
      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query.mockResolvedValueOnce([
        { insertId: 5 },
      ])

      conn.query.mockResolvedValueOnce([
        {},
      ])

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 5,
            name: 'React',
            description: 'React skills',
          },
        ],
      ])

      const req = {
        body: {
          name: 'React',
          description: 'React skills',
          group_id: 1,
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

      await createCompetency(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(conn.query).toHaveBeenCalledTimes(2)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 5,
          name: 'React',
          description: 'React skills',
        },
      })
    })

    it('should return a 400 error when name is missing', async () => {
      const req = {
        body: {
          description: 'Programming skill',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        createCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'name is required',
      })

      expect(pool.query).not.toHaveBeenCalled()

      expect(pool.getConnection).not.toHaveBeenCalled()
    })

    it('should return a 400 error when name is only whitespace', async () => {
      const req = {
        body: {
          name: '   ',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        createCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'name is required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 403 error when teacher does not own the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        body: {
          name: 'React',
          group_id: 1,
        },
        user: {
          sub: 10,
          role: 'teacher',
        },
      }

      const res = {}

      await expect(
        createCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        10,
        1
      )

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 404 error when group does not exist', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        body: {
          name: 'React',
          group_id: 999,
        },
        user: {
          sub: 10,
          role: 'teacher',
        },
      }

      const res = {}

      await expect(
        createCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Group not found',
      })
    })

    it('should rollback transaction when competency creation fails', async () => {
      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query.mockRejectedValueOnce(
        new Error('Database error')
      )

      const req = {
        body: {
          name: 'JavaScript',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        createCompetency(req, res)
      ).rejects.toThrow('Database error')

      expect(conn.beginTransaction).toHaveBeenCalledTimes(1)

      expect(conn.rollback).toHaveBeenCalledTimes(1)

      expect(conn.commit).not.toHaveBeenCalled()

      expect(conn.release).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // getStudentCompetencies
  // ============================================================

  describe('getStudentCompetencies', () => {
    it('should return competencies for the logged-in student', async () => {
      const rows = [
        {
          competency_id: 1,
          name: 'JavaScript',
          description: 'JavaScript skills',
          score: 80,
          previous_score: null,
        },
      ]

      pool.query.mockResolvedValueOnce([
        rows,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'student',
        },
        params: {},
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getStudentCompetencies(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            competency_id: 1,
            name: 'JavaScript',
            description: 'JavaScript skills',
            score: 80,
            previous_score: null,
            trend: 'stable',
          },
        ],
      })
    })

    it('should return improving trend when score increased by more than 2', async () => {
      const rows = [
        {
          competency_id: 1,
          name: 'JavaScript',
          score: 85,
          previous_score: 80,
        },
      ]

      pool.query.mockResolvedValueOnce([
        rows,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'student',
        },
        params: {},
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getStudentCompetencies(req, res)

      const response = res.json.mock.calls[0][0]

      expect(response.data[0].trend).toBe('improving')
    })

    it('should return declining trend when score decreased by more than 2', async () => {
      const rows = [
        {
          competency_id: 1,
          name: 'JavaScript',
          score: 70,
          previous_score: 75,
        },
      ]

      pool.query.mockResolvedValueOnce([
        rows,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'student',
        },
        params: {},
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getStudentCompetencies(req, res)

      const response = res.json.mock.calls[0][0]

      expect(response.data[0].trend).toBe('declining')
    })

    it('should return stable trend when score difference is 2 or less', async () => {
      const rows = [
        {
          competency_id: 1,
          name: 'JavaScript',
          score: 82,
          previous_score: 80,
        },
      ]

      pool.query.mockResolvedValueOnce([
        rows,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'student',
        },
        params: {},
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getStudentCompetencies(req, res)

      const response = res.json.mock.calls[0][0]

      expect(response.data[0].trend).toBe('stable')
    })

    it('should allow teacher to view a student in their group', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 10,
          role: 'teacher',
        },
        params: {
          studentId: '5',
        },
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getStudentCompetencies(req, res)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        10,
        '5'
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })

    it('should return a 403 error when teacher tries to view an unauthorized student', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 10,
          role: 'teacher',
        },
        params: {
          studentId: '999',
        },
        query: {},
      }

      const res = {}

      await expect(
        getStudentCompetencies(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 400 error when student id is missing for non-student user', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {},
        query: {},
      }

      const res = {}

      await expect(
        getStudentCompetencies(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'student_id is required',
      })
    })
  })

  // ============================================================
  // upsertStudentCompetency
  // ============================================================

  describe('upsertStudentCompetency', () => {
    it('should create or update a student competency successfully', async () => {
      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      pool.query.mockResolvedValueOnce([
        [{ id: 5 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query.mockResolvedValueOnce([
        {},
      ])

      conn.query.mockResolvedValueOnce([
        {},
      ])

      const req = {
        body: {
          student_id: 5,
          competency_id: 1,
          score: 85,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await upsertStudentCompetency(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(conn.beginTransaction).toHaveBeenCalledTimes(1)

      expect(conn.query).toHaveBeenCalledTimes(2)

      expect(conn.commit).toHaveBeenCalledTimes(1)

      expect(conn.release).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Competency updated',
      })
    })

    it('should return a 400 error when required fields are missing', async () => {
      const req = {
        body: {
          student_id: 5,
          competency_id: 1,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        upsertStudentCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'student_id, competency_id and score are required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 403 error when teacher does not have access to student', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        body: {
          student_id: 999,
          competency_id: 1,
          score: 80,
        },
        user: {
          sub: 10,
          role: 'teacher',
        },
      }

      const res = {}

      await expect(
        upsertStudentCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 404 error when student does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        body: {
          student_id: 999,
          competency_id: 1,
          score: 80,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        upsertStudentCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Student not found',
      })

      expect(pool.getConnection).not.toHaveBeenCalled()
    })

    it('should return a 404 error when competency does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 5 }],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        body: {
          student_id: 5,
          competency_id: 999,
          score: 80,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        upsertStudentCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Competency not found',
      })

      expect(pool.getConnection).not.toHaveBeenCalled()
    })

    it('should rollback transaction when database update fails', async () => {
      const conn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      }

      pool.query.mockResolvedValueOnce([
        [{ id: 5 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)

      conn.query.mockRejectedValueOnce(
        new Error('Database error')
      )

      const req = {
        body: {
          student_id: 5,
          competency_id: 1,
          score: 80,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        upsertStudentCompetency(req, res)
      ).rejects.toThrow('Database error')

      expect(conn.rollback).toHaveBeenCalledTimes(1)

      expect(conn.commit).not.toHaveBeenCalled()

      expect(conn.release).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // getCompetencyHistory
  // ============================================================

  describe('getCompetencyHistory', () => {
    it('should return competency history for logged-in student', async () => {
      const history = [
        {
          id: 1,
          competency_id: 1,
          score: 70,
          competency_name: 'JavaScript',
        },
      ]

      pool.query.mockResolvedValueOnce([
        history,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'student',
        },
        params: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getCompetencyHistory(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: history,
      })
    })

    it('should allow teacher to view history of an authorized student', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 10,
          role: 'teacher',
        },
        params: {
          studentId: '5',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await getCompetencyHistory(req, res)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        10,
        '5'
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })

    it('should return a 403 error when teacher is not authorized', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 10,
          role: 'teacher',
        },
        params: {
          studentId: '999',
        },
      }

      const res = {}

      await expect(
        getCompetencyHistory(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this student',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 400 error when student id is missing for admin', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {},
      }

      const res = {}

      await expect(
        getCompetencyHistory(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'student_id is required',
      })
    })
  })

  // ============================================================
  // getGroupCompetencies
  // ============================================================

  describe('getGroupCompetencies', () => {
    it('should return competencies for a group successfully', async () => {
      const competencies = [
        {
          id: 1,
          name: 'JavaScript',
          description: 'JavaScript skills',
        },
      ]

      pool.query.mockResolvedValueOnce([
        competencies,
      ])

      const req = {
        params: {
          groupId: '1',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await getGroupCompetencies(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: competencies,
      })
    })

    it('should return a 400 error when group id is missing', async () => {
      const req = {
        params: {},
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        getGroupCompetencies(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'group_id is required',
      })
    })

    it('should return a 403 error when teacher does not own the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        params: {
          groupId: '999',
        },
        user: {
          sub: 10,
          role: 'teacher',
        },
      }

      const res = {}

      await expect(
        getGroupCompetencies(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // addGroupCompetency
  // ============================================================

  describe('addGroupCompetency', () => {
    it('should add competency to a group successfully', async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ id: 2 }],
      ])

      pool.query.mockResolvedValueOnce([
        { affectedRows: 1 },
      ])

      const req = {
        body: {
          group_id: 1,
          competency_id: 2,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await addGroupCompetency(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Competency added to group',
      })
    })

    it('should return a 400 error when required fields are missing', async () => {
      const req = {
        body: {
          group_id: 1,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        addGroupCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'group_id and competency_id are required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 403 error when teacher does not own the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        body: {
          group_id: 1,
          competency_id: 2,
        },
        user: {
          sub: 10,
          role: 'teacher',
        },
      }

      const res = {}

      await expect(
        addGroupCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 404 error when group does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        body: {
          group_id: 999,
          competency_id: 1,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        addGroupCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Group not found',
      })
    })

    it('should return a 404 error when competency does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        body: {
          group_id: 1,
          competency_id: 999,
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        addGroupCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Competency not found',
      })
    })
  })

  // ============================================================
  // removeGroupCompetency
  // ============================================================

  describe('removeGroupCompetency', () => {
    it('should remove competency from group successfully', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = {
        params: {
          groupId: '1',
          competencyId: '2',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await removeGroupCompetency(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
      })
    })

    it('should return a 403 error when teacher does not own the group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        params: {
          groupId: '1',
          competencyId: '2',
        },
        user: {
          sub: 10,
          role: 'teacher',
        },
      }

      const res = {}

      await expect(
        removeGroupCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this group',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return a 404 error when group competency relationship does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = {
        params: {
          groupId: '1',
          competencyId: '999',
        },
        user: {
          sub: 1,
          role: 'admin',
        },
      }

      const res = {}

      await expect(
        removeGroupCompetency(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Group competency not found',
      })
    })
  })
})