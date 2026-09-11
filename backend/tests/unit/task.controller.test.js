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
// MOCK SCOPE UTILITIES
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherOwnsGroup: vi.fn(),
}))

import { pool } from '../../src/config/db.js'
import { teacherOwnsGroup } from '../../src/utils/scope.js'

import {
  getTasks,
  createTask,
} from '../../src/controllers/tasks.controller.js'

// ============================================================
// HELPERS
// ============================================================

function createReq({ body = {}, query = {}, user = { sub: 2, role: 'teacher' } } = {}) {
  return { body, query, user }
}

function createRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function createConn() {
  return {
    beginTransaction: vi.fn(),
    query: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  }
}

describe('tasks controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // createTask
  // ============================================================

  describe('createTask', () => {
    it('creates a task and derives course_id from the selected teams\' group', async () => {
      const req = createReq({
        body: {
          title: 'Week 5 discussion',
          description: 'Discuss REST vs GraphQL',
          team_ids: [1, 2],
        },
        user: { sub: 2, role: 'teacher' },
      })
      const res = createRes()
      const conn = createConn()

      // teams lookup — both teams belong to the same group
      pool.query.mockResolvedValueOnce([
        [
          { id: 1, group_id: 10 },
          { id: 2, group_id: 10 },
        ],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(true)

      // group -> course lookup
      pool.query.mockResolvedValueOnce([
        [{ course_id: 7 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)
      conn.query
        .mockResolvedValueOnce([{ insertId: 55 }]) // insert task
        .mockResolvedValueOnce([{ affectedRows: 2 }]) // insert task_teams

      // final select
      pool.query.mockResolvedValueOnce([
        [{ id: 55, teacher_id: 2, course_id: 7, title: 'Week 5 discussion' }],
      ])

      await createTask(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(2, 10)

      expect(conn.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO tasks'),
        [2, 7, 'Week 5 discussion', 'Discuss REST vs GraphQL']
      )

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 55,
          course_id: 7,
          group_id: 10,
          team_ids: [1, 2],
        }),
      })
    })

    it('rejects when the selected teams belong to different groups', async () => {
      const req = createReq({
        body: {
          title: 'Mixed group task',
          description: 'Should not be allowed',
          team_ids: [1, 2],
        },
        user: { sub: 2, role: 'teacher' },
      })
      const res = createRes()

      pool.query.mockResolvedValueOnce([
        [
          { id: 1, group_id: 10 },
          { id: 2, group_id: 11 },
        ],
      ])

      await expect(
        createTask(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
      })

      expect(teacherOwnsGroup).not.toHaveBeenCalled()
    })

    it('rejects a teacher who is not assigned to the teams\' group', async () => {
      const req = createReq({
        body: {
          title: 'Task',
          description: 'Desc',
          team_ids: [1],
        },
        user: { sub: 2, role: 'teacher' },
      })
      const res = createRes()

      pool.query.mockResolvedValueOnce([
        [{ id: 1, group_id: 10 }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      await expect(
        createTask(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('allows an admin to create a task without an ownership check', async () => {
      const req = createReq({
        body: {
          title: 'Admin task',
          description: 'Desc',
          team_ids: [1],
        },
        user: { sub: 1, role: 'admin' },
      })
      const res = createRes()
      const conn = createConn()

      pool.query.mockResolvedValueOnce([
        [{ id: 1, group_id: 10 }],
      ])

      pool.query.mockResolvedValueOnce([
        [{ course_id: 7 }],
      ])

      pool.getConnection.mockResolvedValueOnce(conn)
      conn.query
        .mockResolvedValueOnce([{ insertId: 56 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])

      pool.query.mockResolvedValueOnce([
        [{ id: 56, teacher_id: 1, course_id: 7, title: 'Admin task' }],
      ])

      await createTask(req, res)

      expect(teacherOwnsGroup).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('rejects when required fields are missing', async () => {
      const req = createReq({
        body: { title: 'Only a title' },
        user: { sub: 2, role: 'teacher' },
      })
      const res = createRes()

      await expect(
        createTask(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('rejects when one or more teams do not exist', async () => {
      const req = createReq({
        body: {
          title: 'Task',
          description: 'Desc',
          team_ids: [1, 2],
        },
        user: { sub: 2, role: 'teacher' },
      })
      const res = createRes()

      pool.query.mockResolvedValueOnce([
        [{ id: 1, group_id: 10 }],
      ])

      await expect(
        createTask(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  // ============================================================
  // getTasks
  // ============================================================

  describe('getTasks', () => {
    it('filters by group_id for a teacher', async () => {
      const req = createReq({
        query: { group_id: '10' },
        user: { sub: 2, role: 'teacher' },
      })
      const res = createRes()

      pool.query.mockResolvedValueOnce([[]])

      await getTasks(req, res)

      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).toContain('JOIN teams tm_filter ON tm_filter.id = tt.team_id')
      expect(sql).toContain('tm_filter.group_id=?')
      expect(params).toEqual([2, '10'])
    })

    it('returns a student\'s active tasks from their own team(s)', async () => {
      const req = createReq({
        user: { sub: 101, role: 'student' },
      })
      const res = createRes()

      pool.query.mockResolvedValueOnce([
        [{ id: 1, title: 'Task A', status: 'active' }],
      ])

      await getTasks(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 1, title: 'Task A', status: 'active' }],
      })
    })
  })
})