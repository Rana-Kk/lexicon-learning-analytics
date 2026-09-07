import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest'

// ============================================================
// MOCKS
// ============================================================

const mockQuery = vi.fn()

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: mockQuery,
  },
}))

// ============================================================
// IMPORT CONTROLLER
// ============================================================

const controller = await import(
  '../../src/controllers/groups.controller.js'
)

// ============================================================
// HELPERS
// ============================================================

function createReq({
  params = {},
  body = {},
  query = {},
  user = {
    sub: 1,
    role: 'admin',
  },
} = {}) {
  return {
    params,
    body,
    query,
    user,
  }
}

function createRes() {
  const res = {}

  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)

  return res
}

function getResponseData(res) {
  return res.json.mock.calls[0]?.[0]
}

// ============================================================
// DEFAULT MOCK DATA
// ============================================================

const adminUser = {
  sub: 1,
  role: 'admin',
}

const teacherUser = {
  sub: 2,
  role: 'teacher',
}

const assignedTeacherUser = {
  sub: 3,
  role: 'teacher',
}

const studentUser = {
  sub: 10,
  role: 'student',
}

const sampleGroup = {
  id: 1,
  course_id: 1,
  name: 'React Group',
  start_date: '2026-01-10',
  end_date: '2026-03-10',
  created_by: 2,
}

const sampleCourse = {
  id: 1,
  name: 'React Course',
}

// ============================================================
// RESET
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// TESTS
// ============================================================

describe('groups.controller', () => {

  // ==========================================================
  // 1. GET ALL GROUPS
  // ==========================================================

  describe('getAllGroups', () => {

    it('gets all groups for admin', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            ...sampleGroup,
            course_name: 'React Course',
            student_count: 5,
          },
        ],
      ])

      const req = createReq({
        user: adminUser,
      })

      const res = createRes()

      await controller.getAllGroups(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: [
          expect.objectContaining({
            id: 1,
            name: 'React Group',
          }),
        ],
      })
    })

    it('filters groups by course_id', async () => {
      mockQuery.mockResolvedValueOnce([
        [sampleGroup],
      ])

      const req = createReq({
        query: {
          course_id: '1',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.getAllGroups(
        req,
        res
      )

      const [sql, params] =
        mockQuery.mock.calls[0]

      expect(sql).toContain(
        'sg.course_id = ?'
      )

      expect(params).toEqual(['1'])

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('only returns groups belonging to the logged-in student', async () => {
      mockQuery.mockResolvedValueOnce([
        [sampleGroup],
      ])

      const req = createReq({
        user: studentUser,
      })

      const res = createRes()

      await controller.getAllGroups(
        req,
        res
      )

      const [sql, params] =
        mockQuery.mock.calls[0]

      expect(sql).toContain(
        'gs_student.student_id = ?'
      )

      expect(params).toEqual([10])
    })

    it('only returns groups assigned to the logged-in teacher', async () => {
      mockQuery.mockResolvedValueOnce([
        [sampleGroup],
      ])

      const req = createReq({
        user: teacherUser,
      })

      const res = createRes()

      await controller.getAllGroups(
        req,
        res
      )

      const [sql, params] =
        mockQuery.mock.calls[0]

      expect(sql).toContain(
        'gt_teacher.teacher_id = ?'
      )

      expect(params).toEqual([2])
    })

    it('supports student filter and course_id together', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        user: studentUser,
        query: {
          course_id: '5',
        },
      })

      const res = createRes()

      await controller.getAllGroups(
        req,
        res
      )

      const [sql, params] =
        mockQuery.mock.calls[0]

      expect(sql).toContain(
        'gs_student.student_id = ?'
      )

      expect(sql).toContain(
        'sg.course_id = ?'
      )

      expect(params).toEqual([
        10,
        '5',
      ])
    })

    it('returns an empty array when no groups exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        user: adminUser,
      })

      const res = createRes()

      await controller.getAllGroups(
        req,
        res
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })
    })
  })

  // ==========================================================
  // 2. GET GROUPS ALIAS
  // ==========================================================

  describe('getGroups alias', () => {

    it('getGroups is an alias of getAllGroups', () => {
      expect(
        controller.getGroups
      ).toBe(
        controller.getAllGroups
      )
    })
  })

  // ==========================================================
  // 3. GET MY GROUPS
  // ==========================================================

  describe('getMyGroups', () => {

    it('gets groups belonging to or created by the teacher', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            ...sampleGroup,
            course_name: 'React Course',
            student_count: 4,
          },
        ],
      ])

      const req = createReq({
        user: teacherUser,
      })

      const res = createRes()

      await controller.getMyGroups(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'gt.teacher_id = ? OR sg.created_by = ?'
        ),
        [2, 2]
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(getResponseData(res)).toEqual({
        success: true,
        count: 1,
        data: expect.any(Array),
      })
    })

    it('returns empty array when teacher has no groups', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        user: teacherUser,
      })

      const res = createRes()

      await controller.getMyGroups(
        req,
        res
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })
    })
  })

  // ==========================================================
  // 4. GET GROUP BY ID
  // ==========================================================

  describe('getGroupById', () => {

    it('gets a group successfully', async () => {
      mockQuery.mockResolvedValueOnce([
        [sampleGroup],
      ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.getGroupById(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM student_groups WHERE id = ?',
        ['1']
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: sampleGroup,
      })
    })

    it('throws 404 when group does not exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.getGroupById(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('allows a teacher who created the group', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            ...sampleGroup,
            created_by: 2,
          },
        ],
      ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: teacherUser,
      })

      const res = createRes()

      await controller.getGroupById(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('allows an assigned teacher', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              created_by: 99,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [{ 1: 1 }],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await controller.getGroupById(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('rejects an unassigned teacher', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              created_by: 99,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await expect(
        controller.getGroupById(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })
  })

  // ==========================================================
  // 5. CREATE GROUP
  // ==========================================================

  describe('createGroup', () => {

    it('creates a group as a teacher and assigns creator automatically', async () => {
      mockQuery
        // course check
        .mockResolvedValueOnce([
          [sampleCourse],
        ])
        // insert group
        .mockResolvedValueOnce([
          {
            insertId: 10,
          },
        ])
        // insert teacher
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        // get new group
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              id: 10,
            },
          ],
        ])

      const req = createReq({
        body: {
          course_id: 1,
          name: 'New React Group',
          start_date: '2026-01-10',
          end_date: '2026-03-10',
        },
        user: teacherUser,
      })

      const res = createRes()

      await controller.createGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group created successfully',
        data: expect.objectContaining({
          id: 10,
        }),
      })

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT IGNORE INTO group_teachers'
        ),
        [10, 2]
      )
    })

    it('creates a group as admin and assigns one teacher', async () => {
      mockQuery
        // course
        .mockResolvedValueOnce([
          [sampleCourse],
        ])
        // insert group
        .mockResolvedValueOnce([
          {
            insertId: 10,
          },
        ])
        // teacher exists
        .mockResolvedValueOnce([
          [{ id: 5 }],
        ])
        // insert teacher
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        // new group
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              id: 10,
            },
          ],
        ])

      const req = createReq({
        body: {
          course_id: 1,
          name: 'Admin Group',
          teacherId: 5,
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.createGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT IGNORE INTO group_teachers'
        ),
        [10, 5]
      )
    })

    it('creates a group as admin and assigns multiple teachers', async () => {
      mockQuery
        // course
        .mockResolvedValueOnce([
          [sampleCourse],
        ])
        // group insert
        .mockResolvedValueOnce([
          {
            insertId: 10,
          },
        ])
        // teacher 5 check
        .mockResolvedValueOnce([
          [{ id: 5 }],
        ])
        // teacher 5 insert
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        // teacher 6 check
        .mockResolvedValueOnce([
          [{ id: 6 }],
        ])
        // teacher 6 insert
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        // new group
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              id: 10,
            },
          ],
        ])

      const req = createReq({
        body: {
          course_id: 1,
          name: 'Multi Teacher Group',
          teacherIds: [5, 6],
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.createGroup(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT IGNORE INTO group_teachers'
        ),
        [10, 5]
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT IGNORE INTO group_teachers'
        ),
        [10, 6]
      )
    })

    it('throws 400 when course_id is missing', async () => {
      const req = createReq({
        body: {
          name: 'Group',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.createGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('throws 400 when name is missing', async () => {
      const req = createReq({
        body: {
          course_id: 1,
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.createGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('throws 404 when course does not exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        body: {
          course_id: 999,
          name: 'Group',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.createGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('normalizes dates when creating a group', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [sampleCourse],
        ])
        .mockResolvedValueOnce([
          {
            insertId: 10,
          },
        ])
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              id: 10,
            },
          ],
        ])

      const req = createReq({
        body: {
          course_id: 1,
          name: 'Date Group',
          start_date: '10-01-2026',
          end_date: '10-03-2026',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.createGroup(
        req,
        res
      )

      const insertCall =
        mockQuery.mock.calls.find(
          ([sql]) =>
            sql.includes(
              'INSERT INTO student_groups'
            )
        )

      expect(insertCall).toBeDefined()

      expect(insertCall[1]).toEqual([
        1,
        'Date Group',
        '2026-01-10',
        '2026-03-10',
        1,
      ])
    })
  })

  // ==========================================================
  // 6. UPDATE GROUP
  // ==========================================================

  describe('updateGroup', () => {

    it('updates a group successfully as admin', async () => {
      mockQuery
        // existing
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        // update
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        // updated group
        .mockResolvedValueOnce([
          [
            {
              ...sampleGroup,
              name: 'Updated Group',
            },
          ],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          name: 'Updated Group',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.updateGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group updated successfully',
        data: expect.objectContaining({
          name: 'Updated Group',
        }),
      })
    })

    it('throws 404 when updating a missing group', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        body: {
          name: 'Updated',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.updateGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('allows teacher who created the group to update it', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        .mockResolvedValueOnce([
          [sampleGroup],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          name: 'Updated',
        },
        user: teacherUser,
      })

      const res = createRes()

      await controller.updateGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('allows an assigned teacher to update a group', async () => {
      mockQuery
        // existing
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 99,
            },
          ],
        ])
        // assigned
        .mockResolvedValueOnce([
          [{ 1: 1 }],
        ])
        // update
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        // get updated
        .mockResolvedValueOnce([
          [sampleGroup],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          name: 'Updated',
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await controller.updateGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('rejects unassigned teacher from updating group', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 99,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          name: 'Updated',
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await expect(
        controller.updateGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('throws 404 when the new course does not exist', async () => {
      mockQuery
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        // course check
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          course_id: 999,
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.updateGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('normalizes dates when updating', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])
        .mockResolvedValueOnce([
          [sampleGroup],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          start_date: '10-01-2026',
          end_date: '10-03-2026',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.updateGroup(
        req,
        res
      )

      const updateCall =
        mockQuery.mock.calls.find(
          ([sql]) =>
            sql.includes(
              'UPDATE student_groups'
            )
        )

      expect(updateCall[1]).toEqual([
        undefined,
        undefined,
        '2026-01-10',
        '2026-03-10',
        '1',
      ])
    })
  })

  // ==========================================================
  // 7. DELETE GROUP
  // ==========================================================

  describe('deleteGroup', () => {

    it('deletes a group successfully', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 1 }],
        ])
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.deleteGroup(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM student_groups WHERE id = ?',
        ['1']
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group deleted successfully',
      })
    })

    it('throws 404 when deleting a missing group', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.deleteGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  // ==========================================================
  // 8. GET GROUP STUDENTS
  // ==========================================================

  describe('getGroupStudents', () => {

    it('gets students in a group', async () => {
      const students = [
        {
          id: 10,
          name: 'Student One',
          email: 'student@test.com',
        },
      ]

      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'React Group',
              created_by: 2,
            },
          ],
        ])
        .mockResolvedValueOnce([
          students,
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.getGroupStudents(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: students,
      })
    })

    it('throws 404 when group does not exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.getGroupStudents(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('allows assigned teacher to get students', async () => {
      mockQuery
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 99,
            },
          ],
        ])
        // assignment
        .mockResolvedValueOnce([
          [{ 1: 1 }],
        ])
        // students
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await controller.getGroupStudents(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('rejects unassigned teacher from getting students', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 99,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await expect(
        controller.getGroupStudents(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })
  })

  // ==========================================================
  // 9. ADD STUDENT TO GROUP
  // ==========================================================

  describe('addStudentToGroup', () => {

    it('adds a student using studentId', async () => {
      mockQuery
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        // student
        .mockResolvedValueOnce([
          [
            {
              id: 10,
              role: 'student',
            },
          ],
        ])
        // insert
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          studentId: 10,
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.addStudentToGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Student added to group successfully',
        data: {
          groupId: 1,
          studentId: 10,
        },
      })
    })

    it('resolves student using email', async () => {
      mockQuery
        // email lookup
        .mockResolvedValueOnce([
          [{ id: 10 }],
        ])
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        // student
        .mockResolvedValueOnce([
          [
            {
              id: 10,
              role: 'student',
            },
          ],
        ])
        // insert
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          email: 'student@test.com',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.addStudentToGroup(
        req,
        res
      )

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT id FROM users WHERE email = ? AND role = 'student'",
        ['student@test.com']
      )

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('throws 400 when studentId and email are missing', async () => {
      const req = createReq({
        params: {
          id: '1',
        },
        body: {},
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.addStudentToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('throws 404 when group does not exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        body: {
          studentId: 10,
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.addStudentToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('throws 404 when student is invalid', async () => {
      mockQuery
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 2,
            },
          ],
        ])
        // student
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          studentId: 999,
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.addStudentToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('rejects unassigned teacher from adding a student', async () => {
      mockQuery
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              created_by: 99,
            },
          ],
        ])
        // assigned
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          studentId: 10,
        },
        user: assignedTeacherUser,
      })

      const res = createRes()

      await expect(
        controller.addStudentToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })
  })

  // ==========================================================
  // 10. REMOVE STUDENT
  // ==========================================================

  describe('removeStudentFromGroup', () => {

    it('removes a student successfully', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = createReq({
        params: {
          id: '1',
          studentId: '10',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.removeStudentFromGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Student removed from group successfully',
      })
    })

    it('throws 404 when student is not in the group', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = createReq({
        params: {
          id: '1',
          studentId: '999',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.removeStudentFromGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  // ==========================================================
  // 11. GET GROUP TEACHERS
  // ==========================================================

  describe('getGroupTeachers', () => {

    it('gets all teachers assigned to a group', async () => {
      const teachers = [
        {
          id: 2,
          name: 'Teacher One',
          email: 'teacher@test.com',
        },
      ]

      mockQuery
        // group
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'React Group',
            },
          ],
        ])
        // teachers
        .mockResolvedValueOnce([
          teachers,
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.getGroupTeachers(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: teachers,
      })
    })

    it('throws 404 when group does not exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.getGroupTeachers(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  // ==========================================================
  // 12. ASSIGN TEACHER
  // ==========================================================

  describe('assignTeacherToGroup', () => {

    it('assigns a teacher successfully', async () => {
      mockQuery
        // group
        .mockResolvedValueOnce([
          [{ id: 1 }],
        ])
        // teacher
        .mockResolvedValueOnce([
          [
            {
              id: 2,
              role: 'teacher',
            },
          ],
        ])
        // insert
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          teacherId: 2,
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.assignTeacherToGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Teacher assigned to group successfully',
        data: {
          groupId: 1,
          teacherId: 2,
        },
      })
    })

    it('throws 400 when teacherId is missing', async () => {
      const req = createReq({
        params: {
          id: '1',
        },
        body: {},
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.assignTeacherToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('throws 404 when group does not exist', async () => {
      mockQuery.mockResolvedValueOnce([
        [],
      ])

      const req = createReq({
        params: {
          id: '999',
        },
        body: {
          teacherId: 2,
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.assignTeacherToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('throws 404 when teacher is invalid', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 1 }],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = createReq({
        params: {
          id: '1',
        },
        body: {
          teacherId: 999,
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.assignTeacherToGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  // ==========================================================
  // 13. REMOVE TEACHER
  // ==========================================================

  describe('removeTeacherFromGroup', () => {

    it('removes a teacher successfully', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = createReq({
        params: {
          id: '1',
          teacherId: '2',
        },
        user: adminUser,
      })

      const res = createRes()

      await controller.removeTeacherFromGroup(
        req,
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Teacher removed from group successfully',
      })
    })

    it('throws 404 when teacher is not assigned', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = createReq({
        params: {
          id: '1',
          teacherId: '999',
        },
        user: adminUser,
      })

      const res = createRes()

      await expect(
        controller.removeTeacherFromGroup(
          req,
          res
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })
})