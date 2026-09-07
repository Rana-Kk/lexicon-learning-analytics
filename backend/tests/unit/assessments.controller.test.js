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
// MOCK SCOPE
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherOwnsGroup: vi.fn(),
}))

// ============================================================
// IMPORTS
// ============================================================

import { pool } from '../../src/config/db.js'

import {
  teacherOwnsGroup,
} from '../../src/utils/scope.js'

import {
  getAllAssessments,
  getStudentAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from '../../src/controllers/assessments.controller.js'

// ============================================================
// HELPERS
// ============================================================

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
})

const createConnection = () => ({
  query: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
})

// ============================================================
// TESTS
// ============================================================

describe('assessments controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // GET ALL ASSESSMENTS
  // ============================================================

  describe('getAllAssessments', () => {
    it('should return all assessments for admin', async () => {
      const assessments = [
        {
          id: 1,
          title: 'React Assignment',
          group_id: 1,
          group_name: 'React Group',
          course_name: 'Frontend',
        },
      ]

      pool.query.mockResolvedValueOnce([
        assessments,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        query: {},
      }

      const res = createResponse()

      await getAllAssessments(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: assessments,
      })
    })

    it('should return only teacher assessments', async () => {
      const assessments = [
        {
          id: 1,
          title: 'Teacher Assignment',
          group_id: 10,
        },
      ]

      pool.query.mockResolvedValueOnce([
        assessments,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {},
      }

      const res = createResponse()

      await getAllAssessments(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      const [, params] =
        pool.query.mock.calls[0]

      expect(params).toContain(5)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: assessments,
      })
    })

    it('should return only assessments belonging to student groups', async () => {
      const assessments = [
        {
          id: 1,
          title: 'Student Assignment',
          group_id: 2,
        },
      ]

      pool.query.mockResolvedValueOnce([
        assessments,
      ])

      const req = {
        user: {
          sub: 10,
          role: 'student',
        },
        query: {},
      }

      const res = createResponse()

      await getAllAssessments(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      const [, params] =
        pool.query.mock.calls[0]

      expect(params).toContain(10)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: assessments,
      })
    })

    it('should filter assessments by group_id', async () => {
      const assessments = [
        {
          id: 1,
          group_id: 3,
          title: 'Group Assignment',
        },
      ]

      pool.query.mockResolvedValueOnce([
        assessments,
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

      const res = createResponse()

      await getAllAssessments(req, res)

      const [, params] =
        pool.query.mock.calls[0]

      expect(params).toContain('3')

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: assessments,
      })
    })

    it('should return empty array when no assessments exist', async () => {
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

      const res = createResponse()

      await getAllAssessments(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })
    })
  })

  // ============================================================
  // GET STUDENT ASSESSMENTS
  // ============================================================

  describe('getStudentAssessments', () => {
    it('should return assessments for logged-in student', async () => {
      const assessments = [
        {
          id: 1,
          title: 'React Project',
          group_id: 2,
          submission_status: 'submitted',
        },
      ]

      pool.query.mockResolvedValueOnce([
        assessments,
      ])

      const req = {
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await getStudentAssessments(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      const [, params] =
        pool.query.mock.calls[0]

      expect(params).toEqual([
        10,
        10,
      ])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: assessments,
      })
    })

    it('should return empty array when student has no assessments', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 10,
          role: 'student',
        },
      }

      const res = createResponse()

      await getStudentAssessments(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      })
    })
  })

  // ============================================================
  // GET ASSESSMENT BY ID
  // ============================================================

  describe('getAssessmentById', () => {
    it('should return assessment with assignment and checklist criteria', async () => {
      const assessment = {
        id: 1,
        title: 'React Assignment',
        group_id: 2,
        group_name: 'Frontend Group',
        course_name: 'Frontend',
      }

      const assignmentCriteria = [
        {
          id: 1,
          assessment_id: 1,
          name: 'Code Quality',
          criterion_type: 'score',
          max_score: 10,
        },
      ]

      const checklistCriteria = [
        {
          id: 1,
          assessment_id: 1,
          name: 'Repository exists',
          criterion_type: 'yes_no',
        },
      ]

      pool.query
        .mockResolvedValueOnce([
          [assessment],
        ])
        .mockResolvedValueOnce([
          assignmentCriteria,
        ])
        .mockResolvedValueOnce([
          checklistCriteria,
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

      const res = createResponse()

      await getAssessmentById(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...assessment,
          assignment_evaluation_criteria:
            assignmentCriteria,
          checklist_criteria:
            checklistCriteria,
        },
      })
    })

    it('should query assessment with teacher scope', async () => {
      const assessment = {
        id: 1,
        title: 'Teacher Assessment',
        group_id: 2,
      }

      pool.query
        .mockResolvedValueOnce([
          [assessment],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          [],
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

      const res = createResponse()

      await getAssessmentById(req, res)

      const [, params] =
        pool.query.mock.calls[0]

      expect(params).toEqual([
        '1',
        'teacher',
        5,
      ])

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...assessment,
          assignment_evaluation_criteria: [],
          checklist_criteria: [],
        },
      })
    })
  })

  // ============================================================
  // CREATE ASSESSMENT
  // ============================================================

  describe('createAssessment', () => {
    it('should create assessment successfully', async () => {
      const connection =
        createConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      // Group exists
      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      // Insert assessment
      connection.query.mockResolvedValueOnce([
        {
          insertId: 100,
        },
      ])

      // Get created assessment
      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 100,
              title: 'React Assignment',
              group_id: 1,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 1,
          title: 'React Assignment',
          description: 'Build a React app',
          type: 'assignment',
          submission_mode: 'individual',
          max_score: 100,
        },
      }

      const res = createResponse()

      await createAssessment(req, res)

      expect(pool.getConnection)
        .toHaveBeenCalledTimes(1)

      expect(connection.beginTransaction)
        .toHaveBeenCalledTimes(1)

      expect(connection.commit)
        .toHaveBeenCalledTimes(1)

      expect(connection.rollback)
        .not.toHaveBeenCalled()

      expect(connection.release)
        .toHaveBeenCalledTimes(1)

      expect(res.status)
        .toHaveBeenCalledWith(201)

      expect(res.json)
        .toHaveBeenCalledWith({
          success: true,
          message:
            'Assessment created successfully',
          data: {
            id: 100,
            title: 'React Assignment',
            group_id: 1,
            assignment_evaluation_criteria: [],
            checklist_criteria: [],
          },
        })
    })

    it('should allow teacher to create assessment for owned group', async () => {
      const connection =
        createConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(
        true
      )

      connection.query.mockResolvedValueOnce([
        {
          insertId: 10,
        },
      ])

      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 10,
              title: 'Teacher Assignment',
              group_id: 1,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          group_id: 1,
          title: 'Teacher Assignment',
        },
      }

      const res = createResponse()

      await createAssessment(req, res)

      expect(teacherOwnsGroup)
        .toHaveBeenCalledWith(
          5,
          1
        )

      expect(connection.commit)
        .toHaveBeenCalled()

      expect(res.status)
        .toHaveBeenCalledWith(201)
    })

    it('should create assignment evaluation criteria', async () => {
      const connection =
        createConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      connection.query
        .mockResolvedValueOnce([
          {
            insertId: 20,
          },
        ])
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])
        .mockResolvedValueOnce([
          { insertId: 2 },
        ])

      const criteria = [
        {
          name: 'Code Quality',
          criterion_type: 'score',
          max_score: 10,
        },
        {
          name: 'Documentation',
          criterion_type: 'yes_no',
        },
      ]

      pool.query
        .mockResolvedValueOnce([
          [{ id: 20 }],
        ])
        .mockResolvedValueOnce([
          criteria,
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 1,
          title: 'Assignment With Criteria',
          assignment_evaluation_criteria:
            criteria,
        },
      }

      const res = createResponse()

      await createAssessment(req, res)

      expect(connection.query)
        .toHaveBeenCalledTimes(3)

      expect(res.status)
        .toHaveBeenCalledWith(201)
    })

    it('should create checklist criteria from provided checklist', async () => {
      const connection =
        createConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      connection.query
        .mockResolvedValueOnce([
          {
            insertId: 30,
          },
        ])
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])

      const checklist = [
        {
          name: 'Repository exists',
          criterion_type: 'yes_no',
        },
      ]

      pool.query
        .mockResolvedValueOnce([
          [{ id: 30 }],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          checklist,
        ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 1,
          title: 'Checklist Assessment',
          checklist_criteria: checklist,
        },
      }

      const res = createResponse()

      await createAssessment(req, res)

      expect(connection.query)
        .toHaveBeenCalledTimes(2)

      expect(connection.commit)
        .toHaveBeenCalled()
    })

    it('should copy checklist criteria from template', async () => {
      const connection =
        createConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      const templateItems = [
        {
          id: 5,
          name: 'GitHub Repository',
          description: 'Repository must exist',
          criterion_type: 'yes_no',
          max_score: null,
          sort_order: 1,
        },
      ]

      connection.query
        // Assessment insert
        .mockResolvedValueOnce([
          {
            insertId: 40,
          },
        ])
        // Template items
        .mockResolvedValueOnce([
          templateItems,
        ])
        // Checklist insert
        .mockResolvedValueOnce([
          {
            insertId: 1,
          },
        ])

      pool.query
        .mockResolvedValueOnce([
          [{ id: 40 }],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          templateItems,
        ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 1,
          title: 'Template Assessment',
          criteria_template_id: 2,
        },
      }

      const res = createResponse()

      await createAssessment(req, res)

      expect(connection.query)
        .toHaveBeenCalledTimes(3)

      expect(connection.commit)
        .toHaveBeenCalled()
    })

    it('should normalize due_date', async () => {
      const connection =
        createConnection()

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      pool.query.mockResolvedValueOnce([
        [{ id: 1 }],
      ])

      connection.query.mockResolvedValueOnce([
        {
          insertId: 50,
        },
      ])

      pool.query
        .mockResolvedValueOnce([
          [{ id: 50 }],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          [],
        ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          group_id: 1,
          title: 'Date Assessment',
          due_date: '01/09/2026',
        },
      }

      const res = createResponse()

      await createAssessment(req, res)

      const [, insertParams] =
        connection.query.mock.calls[0]

      expect(insertParams).toContain(
        '2026-09-01'
      )
    })
  })

  // ============================================================
  // UPDATE ASSESSMENT
  // ============================================================

  describe('updateAssessment', () => {
    it('should update assessment successfully', async () => {
      const connection =
        createConnection()

      // Existing assessment authorization check
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 1,
          },
        ],
      ])

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      // Current assessment
      connection.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              group_id: 1,
              title: 'Old Title',
              description: 'Old Description',
              type: 'assignment',
              submission_mode: 'individual',
              repo_slug: null,
              due_date: null,
              assessment_date: null,
              max_score: 100,
              criteria_template_id: null,
            },
          ],
        ])
        // Update
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      const updatedAssessment = {
        id: 1,
        title: 'Updated Title',
      }

      pool.query
        .mockResolvedValueOnce([
          [updatedAssessment],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
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
          title: 'Updated Title',
        },
      }

      const res = createResponse()

      await updateAssessment(req, res)

      expect(connection.beginTransaction)
        .toHaveBeenCalled()

      expect(connection.commit)
        .toHaveBeenCalled()

      expect(connection.release)
        .toHaveBeenCalled()

      expect(res.status)
        .toHaveBeenCalledWith(200)

      expect(res.json)
        .toHaveBeenCalledWith({
          success: true,
          message:
            'Assessment updated successfully',
          data: {
            ...updatedAssessment,
            assignment_evaluation_criteria: [],
            checklist_criteria: [],
          },
        })
    })

    it('should allow teacher to update assessment in owned group', async () => {
      const connection =
        createConnection()

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 10,
          },
        ],
      ])

      teacherOwnsGroup.mockResolvedValueOnce(
        true
      )

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      connection.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              group_id: 10,
              title: 'Old Title',
              description: null,
              type: 'assignment',
              submission_mode: 'individual',
              repo_slug: null,
              due_date: null,
              assessment_date: null,
              max_score: 100,
              criteria_template_id: null,
            },
          ],
        ])
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              title: 'New Title',
            },
          ],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          [],
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
          title: 'New Title',
        },
      }

      const res = createResponse()

      await updateAssessment(req, res)

      expect(teacherOwnsGroup)
        .toHaveBeenCalledWith(
          5,
          10
        )

      expect(res.status)
        .toHaveBeenCalledWith(200)
    })

    it('should replace assignment evaluation criteria when provided', async () => {
      const connection =
        createConnection()

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 1,
          },
        ],
      ])

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      const criteria = [
        {
          name: 'Code Quality',
          criterion_type: 'score',
          max_score: 10,
        },
      ]

      connection.query
        // Current
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              group_id: 1,
              title: 'Assignment',
              description: null,
              type: 'assignment',
              submission_mode: 'individual',
              repo_slug: null,
              due_date: null,
              assessment_date: null,
              max_score: 100,
              criteria_template_id: null,
            },
          ],
        ])
        // Update
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])
        // Delete old criteria
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])
        // Insert new criterion
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])

      pool.query
        .mockResolvedValueOnce([
          [{ id: 1 }],
        ])
        .mockResolvedValueOnce([
          criteria,
        ])
        .mockResolvedValueOnce([
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
          assignment_evaluation_criteria:
            criteria,
        },
      }

      const res = createResponse()

      await updateAssessment(req, res)

      expect(connection.query)
        .toHaveBeenCalledTimes(4)

      expect(connection.commit)
        .toHaveBeenCalled()
    })

    it('should replace checklist criteria when provided', async () => {
      const connection =
        createConnection()

      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            group_id: 1,
          },
        ],
      ])

      pool.getConnection.mockResolvedValueOnce(
        connection
      )

      const checklist = [
        {
          name: 'Repository exists',
          criterion_type: 'yes_no',
        },
      ]

      connection.query
        // Current
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              group_id: 1,
              title: 'Assessment',
              description: null,
              type: 'assignment',
              submission_mode: 'individual',
              repo_slug: null,
              due_date: null,
              assessment_date: null,
              max_score: 100,
              criteria_template_id: null,
            },
          ],
        ])
        // Update
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])
        // Delete checklist
        .mockResolvedValueOnce([
          { affectedRows: 1 },
        ])
        // Insert checklist
        .mockResolvedValueOnce([
          { insertId: 1 },
        ])

      pool.query
        .mockResolvedValueOnce([
          [{ id: 1 }],
        ])
        .mockResolvedValueOnce([
          [],
        ])
        .mockResolvedValueOnce([
          checklist,
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
          checklist_criteria:
            checklist,
        },
      }

      const res = createResponse()

      await updateAssessment(req, res)

      expect(connection.commit)
        .toHaveBeenCalled()

      expect(res.status)
        .toHaveBeenCalledWith(200)
    })
  })

  // ============================================================
  // DELETE ASSESSMENT
  // ============================================================

  describe('deleteAssessment', () => {
    it('should delete assessment successfully as admin', async () => {
      pool.query
        // Find assessment
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              group_id: 10,
            },
          ],
        ])
        // Delete
        .mockResolvedValueOnce([
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

      const res = createResponse()

      await deleteAssessment(req, res)

      expect(pool.query)
        .toHaveBeenCalledTimes(2)

      expect(res.status)
        .toHaveBeenCalledWith(200)

      expect(res.json)
        .toHaveBeenCalledWith({
          success: true,
          message:
            'Assessment deleted successfully',
        })
    })

    it('should allow teacher to delete assessment from owned group', async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              group_id: 10,
            },
          ],
        ])
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      teacherOwnsGroup.mockResolvedValueOnce(
        true
      )

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
      }

      const res = createResponse()

      await deleteAssessment(req, res)

      expect(teacherOwnsGroup)
        .toHaveBeenCalledWith(
          5,
          10
        )

      expect(pool.query)
        .toHaveBeenCalledTimes(2)

      expect(res.json)
        .toHaveBeenCalledWith({
          success: true,
          message:
            'Assessment deleted successfully',
        })
    })
  })
})