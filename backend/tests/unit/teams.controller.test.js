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
  teacherOwnsGroup: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherOwnsGroup,
} from '../../src/utils/scope.js'

import {
  getTeams,
  getMyTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
} from '../../src/controllers/teams.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('teams controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getTeams
  // ============================================================

  describe('getTeams', () => {
    it('should return all teams for admin', async () => {
      const teams = [
        {
          id: 1,
          name: 'Team Alpha',
          group_id: 10,
          group_name: 'Group A',
        },
        {
          id: 2,
          name: 'Team Beta',
          group_id: 20,
          group_name: 'Group B',
        },
      ]

      const members1 = [
        {
          id: 101,
          name: 'Student One',
          email: 'student1@test.com',
        },
      ]

      const members2 = [
        {
          id: 102,
          name: 'Student Two',
          email: 'student2@test.com',
        },
      ]

      // Get teams
      pool.query.mockResolvedValueOnce([
        teams,
      ])

      // Team 1 members
      pool.query.mockResolvedValueOnce([
        members1,
      ])

      // Team 2 members
      pool.query.mockResolvedValueOnce([
        members2,
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

      await getTeams(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...teams[0],
            members: members1,
          },
          {
            ...teams[1],
            members: members2,
          },
        ],
      })
    })

    it('should return only teacher accessible teams', async () => {
      const teams = [
        {
          id: 1,
          name: 'Teacher Team',
          group_id: 10,
          group_name: 'My Group',
        },
      ]

      const members = [
        {
          id: 101,
          name: 'Student One',
        },
      ]

      // Get teams
      pool.query.mockResolvedValueOnce([
        teams,
      ])

      // Get members
      pool.query.mockResolvedValueOnce([
        members,
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

      await getTeams(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      const firstQuery =
        pool.query.mock.calls[0]

      expect(firstQuery[0]).toContain(
        'group_teachers'
      )

      expect(firstQuery[1]).toEqual([
        5,
      ])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...teams[0],
            members,
          },
        ],
      })
    })

    it('should filter teams by group_id', async () => {
      const teams = [
        {
          id: 1,
          name: 'Team Alpha',
          group_id: 10,
          group_name: 'Group A',
        },
      ]

      const members = []

      // Get teams
      pool.query.mockResolvedValueOnce([
        teams,
      ])

      // Get members
      pool.query.mockResolvedValueOnce([
        members,
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

      await getTeams(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      const firstQuery =
        pool.query.mock.calls[0]

      expect(firstQuery[1]).toEqual([
        '10',
      ])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...teams[0],
            members,
          },
        ],
      })
    })

    it('should return empty array when no teams exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
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

      await getTeams(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })
  })

  // ============================================================
  // getMyTeam
  // ============================================================

  describe('getMyTeam', () => {
    it('should return student teams with members', async () => {
      const teams = [
        {
          id: 1,
          name: 'Team Alpha',
          group_id: 10,
          group_name: 'Group A',
        },
      ]

      const members = [
        {
          id: 101,
          name: 'Student One',
          email: 'student1@test.com',
        },
        {
          id: 102,
          name: 'Student Two',
          email: 'student2@test.com',
        },
      ]

      // Get teams
      pool.query.mockResolvedValueOnce([
        teams,
      ])

      // Get members
      pool.query.mockResolvedValueOnce([
        members,
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

      await getMyTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(pool.query.mock.calls[0][1]).toEqual([
        101,
      ])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...teams[0],
            members,
          },
        ],
      })
    })

    it('should return empty array when student has no teams', async () => {
      pool.query.mockResolvedValueOnce([
        [],
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

      await getMyTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })

    it('should return multiple teams with their members', async () => {
      const teams = [
        {
          id: 1,
          name: 'Team Alpha',
          group_id: 10,
          group_name: 'Group A',
        },
        {
          id: 2,
          name: 'Team Beta',
          group_id: 20,
          group_name: 'Group B',
        },
      ]

      const members1 = [
        {
          id: 101,
          name: 'Student One',
        },
      ]

      const members2 = [
        {
          id: 101,
          name: 'Student One',
        },
        {
          id: 102,
          name: 'Student Two',
        },
      ]

      pool.query.mockResolvedValueOnce([
        teams,
      ])

      pool.query.mockResolvedValueOnce([
        members1,
      ])

      pool.query.mockResolvedValueOnce([
        members2,
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

      await getMyTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...teams[0],
            members: members1,
          },
          {
            ...teams[1],
            members: members2,
          },
        ],
      })
    })
  })

  // ============================================================
  // createTeam
  // ============================================================

  describe('createTeam', () => {
    it('should create a team successfully as admin', async () => {
      const createdTeam = {
        id: 1,
        group_id: 10,
        name: 'Team Alpha',
      }

      // Check group
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      // Insert team
      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      // Get created team
      pool.query.mockResolvedValueOnce([
        [createdTeam],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
          name: 'Team Alpha',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await createTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdTeam,
      })
    })

    it('should create a team with students', async () => {
      const createdTeam = {
        id: 1,
        group_id: 10,
        name: 'Team Alpha',
      }

      // Check group
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      // Insert team
      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      // Add student 101
      pool.query.mockResolvedValueOnce([
        {},
      ])

      // Add student 102
      pool.query.mockResolvedValueOnce([
        {},
      ])

      // Get created team
      pool.query.mockResolvedValueOnce([
        [createdTeam],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 10,
          name: 'Team Alpha',
          student_ids: [
            101,
            102,
          ],
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await createTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(5)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdTeam,
      })
    })

    it('should return an error when group_id is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          name: 'Team Alpha',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        createTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'group_id and name are required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return an error when name is missing', async () => {
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

      await expect(
        createTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'group_id and name are required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return an error when group does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 999,
          name: 'Team Alpha',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        createTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Group not found',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should allow teacher to create team in their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      const createdTeam = {
        id: 1,
        group_id: 10,
        name: 'Team Alpha',
      }

      // Check group
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      // Insert team
      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      // Get team
      pool.query.mockResolvedValueOnce([
        [createdTeam],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          group_id: 10,
          name: 'Team Alpha',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await createTeam(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdTeam,
      })
    })

    it('should return 403 when teacher tries to create team in another group', async () => {
      // Check group
      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          group_id: 10,
          name: 'Team Alpha',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        createTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not assigned to this group',
      })

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(pool.query).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // updateTeam
  // ============================================================

  describe('updateTeam', () => {
    it('should update team successfully as admin', async () => {
      const updatedTeam = {
        id: 1,
        group_id: 10,
        name: 'Updated Team',
      }

      // Get existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Update
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      // Get updated team
      pool.query.mockResolvedValueOnce([
        [updatedTeam],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
        body: {
          name: 'Updated Team',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await updateTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTeam,
      })
    })

    it('should return 404 when team does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
        },
        body: {
          name: 'Updated Team',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await expect(
        updateTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Team not found',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should allow teacher to update team in their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      const updatedTeam = {
        id: 1,
        group_id: 10,
        name: 'Updated Team',
      }

      // Existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Update
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      // Get updated team
      pool.query.mockResolvedValueOnce([
        [updatedTeam],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
        body: {
          name: 'Updated Team',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await updateTeam(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTeam,
      })
    })

    it('should return 403 when teacher tries to update another group team', async () => {
      // Existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
        body: {
          name: 'Updated Team',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await expect(
        updateTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not assigned to this group',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )
    })
  })

  // ============================================================
  // deleteTeam
  // ============================================================

  describe('deleteTeam', () => {
    it('should delete team successfully as admin', async () => {
      // Existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Delete
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

      await deleteTeam(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
      })
    })

    it('should return 404 when team does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
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

      await expect(
        deleteTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Team not found',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should allow teacher to delete team in their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Delete
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

      await deleteTeam(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
      })
    })

    it('should return 403 when teacher tries to delete another group team', async () => {
      // Existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

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

      await expect(
        deleteTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not assigned to this group',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when delete affects no rows', async () => {
      // Existing team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Delete
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
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await expect(
        deleteTeam(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Team not found',
      })
    })
  })

  // ============================================================
  // addMember
  // ============================================================

  describe('addMember', () => {
    it('should add student to team successfully as admin', async () => {
      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Student
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 101,
          },
        ],
      ])

      // Add member
      pool.query.mockResolvedValueOnce([
        {},
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
        body: {
          student_id: 101,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await addMember(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Student added to team successfully',
      })
    })

    it('should return error when student_id is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
        body: {},
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        addMember(req, res)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'student_id is required',
      })

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('should return 404 when team does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
        },
        body: {
          student_id: 101,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        addMember(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Team not found',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when student does not exist', async () => {
      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Student
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
        body: {
          student_id: 999,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        addMember(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Student not found',
      })

      expect(pool.query).toHaveBeenCalledTimes(2)
    })

    it('should allow teacher to add student to team in their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Student
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 101,
          },
        ],
      ])

      // Add member
      pool.query.mockResolvedValueOnce([
        {},
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
        body: {
          student_id: 101,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await addMember(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should return 403 when teacher tries to add member to another group team', async () => {
      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
        body: {
          student_id: 101,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await expect(
        addMember(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not assigned to this group',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // removeMember
  // ============================================================

  describe('removeMember', () => {
    it('should remove student from team successfully as admin', async () => {
      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Remove member
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
          studentId: '101',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await removeMember(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Student removed from team successfully',
      })
    })

    it('should return 404 when team does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
          studentId: '101',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await expect(
        removeMember(req, res)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Team not found',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should allow teacher to remove student from team in their own group', async () => {
      teacherOwnsGroup.mockResolvedValueOnce(true)

      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Remove member
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
          studentId: '101',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await removeMember(req, res)

      expect(teacherOwnsGroup).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Student removed from team successfully',
      })
    })

    it('should return 403 when teacher tries to remove member from another group team', async () => {
      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
          studentId: '101',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await expect(
        removeMember(req, res)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not assigned to this group',
      })

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should execute delete query with correct team and student ids', async () => {
      // Team
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      // Delete
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
          studentId: '101',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await removeMember(req, res)

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'DELETE FROM team_members'
        ),
        [
          '1',
          '101',
        ]
      )
    })
  })
})