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

// ============================================================
// DATABASE MOCK
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: mockQuery,
  },
}))

// ============================================================
// IMPORT CONTROLLER
// ============================================================

const {
  getAllCourses,
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} = await import(
  '../../src/controllers/courses.controller.js'
)

// ============================================================
// HELPERS
// ============================================================

function createMockReq({
  params = {},
  body = {},
} = {}) {
  return {
    params,
    body,
  }
}

function createMockRes() {
  const res = {}

  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)

  return res
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

describe('courses.controller', () => {

  // ==========================================================
  // 1. GET ALL COURSES
  // ==========================================================

  describe('getAllCourses', () => {

    it(
      'returns all courses successfully',
      async () => {

        const courses = [
          {
            id: 2,
            name: 'JavaScript',
          },
          {
            id: 1,
            name: 'Python',
          },
        ]

        mockQuery.mockResolvedValueOnce([
          courses,
        ])

        const req = createMockReq()
        const res = createMockRes()

        await getAllCourses(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenCalledWith(
          'SELECT * FROM courses ORDER BY id DESC'
        )

        expect(res.status).toHaveBeenCalledWith(
          200
        )

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          count: 2,
          data: courses,
        })
      }
    )

    it(
      'returns an empty array when there are no courses',
      async () => {

        mockQuery.mockResolvedValueOnce([
          [],
        ])

        const req = createMockReq()
        const res = createMockRes()

        await getAllCourses(
          req,
          res,
          vi.fn()
        )

        expect(res.status).toHaveBeenCalledWith(
          200
        )

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          count: 0,
          data: [],
        })
      }
    )
  })

  // ==========================================================
  // 2. GET COURSES ALIAS
  // ==========================================================

  describe('getCourses alias', () => {

    it(
      'is an alias for getAllCourses',
      () => {

        expect(getCourses).toBe(
          getAllCourses
        )
      }
    )
  })

  // ==========================================================
  // 3. GET COURSE BY ID
  // ==========================================================

  describe('getCourseById', () => {

    it(
      'returns a course when it exists',
      async () => {

        const course = {
          id: 1,
          name: 'Python',
          description:
            'Python programming course',
        }

        mockQuery.mockResolvedValueOnce([
          [course],
        ])

        const req = createMockReq({
          params: {
            id: '1',
          },
        })

        const res = createMockRes()

        await getCourseById(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenCalledWith(
          'SELECT * FROM courses WHERE id = ?',
          ['1']
        )

        expect(res.status).toHaveBeenCalledWith(
          200
        )

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: course,
        })
      }
    )

    it(
      'throws 404 when course does not exist',
      async () => {

        mockQuery.mockResolvedValueOnce([
          [],
        ])

        const req = createMockReq({
          params: {
            id: '999',
          },
        })

        const res = createMockRes()
        const next = vi.fn()

        await getCourseById(
          req,
          res,
          next
        )

        expect(next).toHaveBeenCalledTimes(
          1
        )

        const error =
          next.mock.calls[0][0]

        expect(error.statusCode).toBe(404)

        expect(error.message).toBe(
          'Course not found'
        )

        expect(res.status).not.toHaveBeenCalled()
      }
    )
  })

  // ==========================================================
  // 4. CREATE COURSE
  // ==========================================================

  describe('createCourse', () => {

    it(
      'creates a course with YYYY-MM-DD dates',
      async () => {

        const newCourse = {
          id: 10,
          name: 'React',
          description:
            'React course',
          start_date:
            '2026-01-10',
          end_date:
            '2026-03-10',
        }

        mockQuery
          .mockResolvedValueOnce([
            {
              insertId: 10,
            },
          ])
          .mockResolvedValueOnce([
            [newCourse],
          ])

        const req = createMockReq({
          body: {
            name: 'React',
            description:
              'React course',
            start_date:
              '2026-01-10',
            end_date:
              '2026-03-10',
          },
        })

        const res = createMockRes()

        await createCourse(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'INSERT INTO courses'
          ),
          [
            'React',
            'React course',
            '2026-01-10',
            '2026-03-10',
          ]
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          2,
          'SELECT * FROM courses WHERE id = ?',
          [10]
        )

        expect(res.status).toHaveBeenCalledWith(
          201
        )

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message:
            'Course created successfully',
          data: newCourse,
        })
      }
    )

    it(
      'creates a course with DD-MM-YYYY dates',
      async () => {

        mockQuery
          .mockResolvedValueOnce([
            {
              insertId: 11,
            },
          ])
          .mockResolvedValueOnce([
            [
              {
                id: 11,
                name: 'Node.js',
              },
            ],
          ])

        const req = createMockReq({
          body: {
            name: 'Node.js',
            start_date:
              '15-01-2026',
            end_date:
              '20-02-2026',
          },
        })

        const res = createMockRes()

        await createCourse(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'INSERT INTO courses'
          ),
          [
            'Node.js',
            null,
            '2026-01-15',
            '2026-02-20',
          ]
        )
      }
    )

    it(
      'creates a course with YYYY-DD-MM format when first value is greater than 12',
      async () => {

        mockQuery
          .mockResolvedValueOnce([
            {
              insertId: 12,
            },
          ])
          .mockResolvedValueOnce([
            [
              {
                id: 12,
                name: 'Java',
              },
            ],
          ])

        const req = createMockReq({
          body: {
            name: 'Java',
            start_date:
              '2026-15-02',
          },
        })

        const res = createMockRes()

        await createCourse(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'INSERT INTO courses'
          ),
          [
            'Java',
            null,
            '2026-02-15',
            null,
          ]
        )
      }
    )

    it(
      'creates a course with null dates when dates are empty',
      async () => {

        mockQuery
          .mockResolvedValueOnce([
            {
              insertId: 13,
            },
          ])
          .mockResolvedValueOnce([
            [
              {
                id: 13,
                name: 'SQL',
              },
            ],
          ])

        const req = createMockReq({
          body: {
            name: 'SQL',
            description: '',
            start_date: '',
            end_date: '',
          },
        })

        const res = createMockRes()

        await createCourse(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'INSERT INTO courses'
          ),
          [
            'SQL',
            null,
            null,
            null,
          ]
        )
      }
    )

    it(
      'throws 400 when course name is missing',
      async () => {

        const req = createMockReq({
          body: {
            description:
              'Some description',
          },
        })

        const res = createMockRes()
        const next = vi.fn()

        await createCourse(
          req,
          res,
          next
        )

        expect(next).toHaveBeenCalledTimes(
          1
        )

        const error =
          next.mock.calls[0][0]

        expect(error.statusCode).toBe(400)

        expect(error.message).toBe(
          'Course name is required'
        )

        expect(mockQuery).not.toHaveBeenCalled()
      }
    )
  })

  // ==========================================================
  // 5. UPDATE COURSE
  // ==========================================================

  describe('updateCourse', () => {

    it(
      'updates an existing course successfully',
      async () => {

        const updatedCourse = {
          id: 1,
          name: 'Advanced Python',
          description:
            'Updated description',
          start_date:
            '2026-01-10',
          end_date:
            '2026-06-20',
        }

        mockQuery
          // Existing course check
          .mockResolvedValueOnce([
            [{ id: 1 }],
          ])

          // UPDATE
          .mockResolvedValueOnce([
            {
              affectedRows: 1,
            },
          ])

          // SELECT updated
          .mockResolvedValueOnce([
            [updatedCourse],
          ])

        const req = createMockReq({
          params: {
            id: '1',
          },

          body: {
            name:
              'Advanced Python',

            description:
              'Updated description',

            start_date:
              '10-01-2026',

            end_date:
              '20-06-2026',
          },
        })

        const res = createMockRes()

        await updateCourse(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          1,
          'SELECT id FROM courses WHERE id = ?',
          ['1']
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'UPDATE courses SET'
          ),
          [
            'Advanced Python',
            'Updated description',
            '2026-01-10',
            '2026-06-20',
            '1',
          ]
        )

        expect(res.status).toHaveBeenCalledWith(
          200
        )

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message:
            'Course updated successfully',
          data: updatedCourse,
        })
      }
    )

    it(
      'keeps dates unchanged when dates are not provided',
      async () => {

        const updatedCourse = {
          id: 1,
          name: 'Python',
        }

        mockQuery
          .mockResolvedValueOnce([
            [{ id: 1 }],
          ])
          .mockResolvedValueOnce([
            {
              affectedRows: 1,
            },
          ])
          .mockResolvedValueOnce([
            [updatedCourse],
          ])

        const req = createMockReq({
          params: {
            id: '1',
          },

          body: {
            name: 'Python',
          },
        })

        const res = createMockRes()

        await updateCourse(
          req,
          res,
          vi.fn()
        )

        const updateCall =
          mockQuery.mock.calls[1]

        expect(
          updateCall[1]
        ).toEqual([
          'Python',
          undefined,
          null,
          null,
          '1',
        ])
      }
    )

    it(
      'normalizes provided update dates',
      async () => {

        mockQuery
          .mockResolvedValueOnce([
            [{ id: 1 }],
          ])
          .mockResolvedValueOnce([
            {
              affectedRows: 1,
            },
          ])
          .mockResolvedValueOnce([
            [
              {
                id: 1,
              },
            ],
          ])

        const req = createMockReq({
          params: {
            id: '1',
          },

          body: {
            start_date:
              '05/03/2026',

            end_date:
              '2026/30/04',
          },
        })

        const res = createMockRes()

        await updateCourse(
          req,
          res,
          vi.fn()
        )

        const updateCall =
          mockQuery.mock.calls[1]

        expect(
          updateCall[1]
        ).toEqual([
          undefined,
          undefined,
          '2026-03-05',
          '2026-04-30',
          '1',
        ])
      }
    )

    it(
      'throws 404 when updating a non-existing course',
      async () => {

        mockQuery.mockResolvedValueOnce([
          [],
        ])

        const req = createMockReq({
          params: {
            id: '999',
          },

          body: {
            name:
              'Does Not Exist',
          },
        })

        const res = createMockRes()
        const next = vi.fn()

        await updateCourse(
          req,
          res,
          next
        )

        expect(next).toHaveBeenCalledTimes(
          1
        )

        const error =
          next.mock.calls[0][0]

        expect(error.statusCode).toBe(404)

        expect(error.message).toBe(
          'Course not found'
        )

        expect(mockQuery).toHaveBeenCalledTimes(
          1
        )
      }
    )
  })

  // ==========================================================
  // 6. DELETE COURSE
  // ==========================================================

  describe('deleteCourse', () => {

    it(
      'deletes an existing course successfully',
      async () => {

        mockQuery
          // Existing check
          .mockResolvedValueOnce([
            [{ id: 1 }],
          ])

          // DELETE
          .mockResolvedValueOnce([
            {
              affectedRows: 1,
            },
          ])

        const req = createMockReq({
          params: {
            id: '1',
          },
        })

        const res = createMockRes()

        await deleteCourse(
          req,
          res,
          vi.fn()
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          1,
          'SELECT id FROM courses WHERE id = ?',
          ['1']
        )

        expect(mockQuery).toHaveBeenNthCalledWith(
          2,
          'DELETE FROM courses WHERE id = ?',
          ['1']
        )

        expect(res.status).toHaveBeenCalledWith(
          200
        )

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message:
            'Course deleted successfully',
        })
      }
    )

    it(
      'throws 404 when deleting a non-existing course',
      async () => {

        mockQuery.mockResolvedValueOnce([
          [],
        ])

        const req = createMockReq({
          params: {
            id: '999',
          },
        })

        const res = createMockRes()
        const next = vi.fn()

        await deleteCourse(
          req,
          res,
          next
        )

        expect(next).toHaveBeenCalledTimes(
          1
        )

        const error =
          next.mock.calls[0][0]

        expect(error.statusCode).toBe(404)

        expect(error.message).toBe(
          'Course not found'
        )

        expect(mockQuery).toHaveBeenCalledTimes(
          1
        )

        expect(res.status).not.toHaveBeenCalled()
      }
    )
  })

  // ==========================================================
  // 7. DATABASE ERROR HANDLING
  // ==========================================================

  describe('database errors', () => {

    it(
      'passes database errors to next',
      async () => {

        const databaseError =
          new Error(
            'Database connection failed'
          )

        mockQuery.mockRejectedValueOnce(
          databaseError
        )

        const req = createMockReq()
        const res = createMockRes()
        const next = vi.fn()

        await getAllCourses(
          req,
          res,
          next
        )

        expect(next).toHaveBeenCalledWith(
          databaseError
        )
      }
    )
  })
})