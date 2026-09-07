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
}))

import { pool } from '../../src/config/db.js'

import {
  teacherHasStudent,
} from '../../src/utils/scope.js'

import {
  studentReport,
} from '../../src/controllers/reports.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('reports controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // HELPER DATA
  // ============================================================

  const student = {
    id: 10,
    name: 'John Student',
    email: 'john@example.com',
  }

  const attendance = [
    {
      id: 1,
      student_id: 10,
      status: 'present',
      attendance_date: '2026-08-01',
    },
  ]

  const scores = [
    {
      id: 1,
      student_id: 10,
      assessment_id: 5,
      score: 85,
      assessment_title: 'JavaScript Assignment',
      max_score: 100,
    },
  ]

  const quizzes = [
    {
      id: 1,
      student_id: 10,
      quiz_id: 3,
      score: 8,
      quiz_title: 'JavaScript Quiz',
      topic: 'Arrays',
      max_score: 10,
      quiz_date: '2026-08-05',
    },
  ]

  const competencies = [
    {
      name: 'JavaScript',
      score: 85,
    },
  ]

  const feedback = [
    {
      id: 1,
      student_id: 10,
      teacher_id: 5,
      content: 'Good work!',
      assessment_title: 'JavaScript Assignment',
      teacher_name: 'Teacher User',
    },
  ]

  const certificates = [
    {
      id: 1,
      student_id: 10,
      title: 'JavaScript Certificate',
      issue_date: '2026-08-20',
    },
  ]

  // ============================================================
  // ADMIN
  // ============================================================

  describe('studentReport - admin', () => {
    it('should return a complete student report for admin', async () => {
      const checklistRows = [
        {
          assessment_id: 5,
          assessment_title: 'JavaScript Assignment',
          assessment_date: '2026-08-10',
          due_date: '2026-08-12',
          max_score: 100,

          criterion_id: 1,
          criterion_name: 'Code Quality',
          criterion_description:
            'Code should be clean and readable',
          criterion_type: 'score',
          criterion_max_score: 10,
          sort_order: 1,

          ai_yes_no_value: null,
          ai_score_value: 8,
          ai_text_value: null,
          ai_feedback: 'Good code quality',

          teacher_yes_no_value: null,
          teacher_score_value: 9,
          teacher_text_value: null,
          teacher_feedback: 'Very clean code',

          final_score: 85,
        },
        {
          assessment_id: 5,
          assessment_title: 'JavaScript Assignment',
          assessment_date: '2026-08-10',
          due_date: '2026-08-12',
          max_score: 100,

          criterion_id: 2,
          criterion_name: 'Documentation',
          criterion_description:
            'Code should contain documentation',
          criterion_type: 'yes_no',
          criterion_max_score: 1,
          sort_order: 2,

          ai_yes_no_value: true,
          ai_score_value: null,
          ai_text_value: null,
          ai_feedback: 'Documentation exists',

          teacher_yes_no_value: true,
          teacher_score_value: null,
          teacher_text_value: null,
          teacher_feedback: 'Good documentation',

          final_score: 85,
        },
      ]

      // STUDENT
      pool.query.mockResolvedValueOnce([
        [student],
      ])

      // ATTENDANCE
      pool.query.mockResolvedValueOnce([
        attendance,
      ])

      // SCORES
      pool.query.mockResolvedValueOnce([
        scores,
      ])

      // QUIZZES
      pool.query.mockResolvedValueOnce([
        quizzes,
      ])

      // COMPETENCIES
      pool.query.mockResolvedValueOnce([
        competencies,
      ])

      // FEEDBACK
      pool.query.mockResolvedValueOnce([
        feedback,
      ])

      // CERTIFICATES
      pool.query.mockResolvedValueOnce([
        certificates,
      ])

      // CHECKLIST
      pool.query.mockResolvedValueOnce([
        checklistRows,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },

        params: {
          studentId: '10',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(8)

      expect(res.json).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,

        data: {
          student,

          attendance,

          scores,

          quizzes,

          competencies,

          feedback,

          certificates,

          assignmentChecklistEvaluations: [
            {
              assessment_id: 5,

              assessment_title:
                'JavaScript Assignment',

              delivered_on:
                '2026-08-10',

              final_score: 85,

              max_score: 100,

              criteria: [
                {
                  criterion_id: 1,

                  name: 'Code Quality',

                  description:
                    'Code should be clean and readable',

                  criterion_type: 'score',

                  max_score: 10,

                  sort_order: 1,

                  ai_yes_no_value: null,
                  ai_score_value: 8,
                  ai_text_value: null,

                  ai_feedback:
                    'Good code quality',

                  teacher_yes_no_value: null,
                  teacher_score_value: 9,
                  teacher_text_value: null,

                  teacher_feedback:
                    'Very clean code',
                },
                {
                  criterion_id: 2,

                  name: 'Documentation',

                  description:
                    'Code should contain documentation',

                  criterion_type: 'yes_no',

                  max_score: 1,

                  sort_order: 2,

                  ai_yes_no_value: true,
                  ai_score_value: null,
                  ai_text_value: null,

                  ai_feedback:
                    'Documentation exists',

                  teacher_yes_no_value: true,
                  teacher_score_value: null,
                  teacher_text_value: null,

                  teacher_feedback:
                    'Good documentation',
                },
              ],
            },
          ],
        },
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // STUDENT
  // ============================================================

  describe('studentReport - student', () => {
    it('should only return the logged-in student report', async () => {
      pool.query.mockResolvedValueOnce([
        [student],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 10,
          role: 'student',
        },

        params: {
          studentId: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(8)

      // Student kendi ID'sini kullanmalı
      expect(
        pool.query.mock.calls[0][1]
      ).toEqual([10])

      expect(
        pool.query.mock.calls[1][1]
      ).toEqual([10])

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // TEACHER ACCESS
  // ============================================================

  describe('studentReport - teacher access', () => {
    it('should allow teacher to access their own student report', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        [student],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

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
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '10'
      )

      expect(pool.query).toHaveBeenCalledTimes(8)

      expect(res.json).toHaveBeenCalledTimes(1)

      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when teacher tries to access another student', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },

        params: {
          studentId: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '999'
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 403,

        message:
          'You do not have access to this student',
      })
    })
  })

  // ============================================================
  // STUDENT NOT FOUND
  // ============================================================

  describe('studentReport - validation', () => {
    it('should return 404 when student does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },

        params: {
          studentId: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledTimes(1)

      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 404,

        message: 'Student not found',
      })

      expect(res.json).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // CHECKLIST GROUPING
  // ============================================================

  describe('studentReport - checklist grouping', () => {
    it('should group criteria under their correct assessments', async () => {
      const checklistRows = [
        {
          assessment_id: 1,
          assessment_title: 'Assignment One',
          assessment_date: null,
          due_date: '2026-08-10',
          max_score: 100,

          criterion_id: 1,
          criterion_name: 'Criterion One',
          criterion_description: 'Description One',
          criterion_type: 'score',
          criterion_max_score: 10,
          sort_order: 1,

          ai_yes_no_value: null,
          ai_score_value: 8,
          ai_text_value: null,
          ai_feedback: 'AI feedback',

          teacher_yes_no_value: null,
          teacher_score_value: 9,
          teacher_text_value: null,
          teacher_feedback: 'Teacher feedback',

          final_score: 90,
        },
        {
          assessment_id: 1,
          assessment_title: 'Assignment One',
          assessment_date: null,
          due_date: '2026-08-10',
          max_score: 100,

          criterion_id: 2,
          criterion_name: 'Criterion Two',
          criterion_description: 'Description Two',
          criterion_type: 'text',
          criterion_max_score: null,
          sort_order: 2,

          ai_yes_no_value: null,
          ai_score_value: null,
          ai_text_value: 'AI text',
          ai_feedback: null,

          teacher_yes_no_value: null,
          teacher_score_value: null,
          teacher_text_value: 'Teacher text',
          teacher_feedback: null,

          final_score: 90,
        },
        {
          assessment_id: 2,
          assessment_title: 'Assignment Two',
          assessment_date: '2026-08-15',
          due_date: '2026-08-20',
          max_score: 50,

          criterion_id: 3,
          criterion_name: 'Criterion Three',
          criterion_description: 'Description Three',
          criterion_type: 'yes_no',
          criterion_max_score: 1,
          sort_order: 1,

          ai_yes_no_value: true,
          ai_score_value: null,
          ai_text_value: null,
          ai_feedback: null,

          teacher_yes_no_value: true,
          teacher_score_value: null,
          teacher_text_value: null,
          teacher_feedback: 'Correct',

          final_score: null,
        },
      ]

      pool.query.mockResolvedValueOnce([
        [student],
      ])

      // Attendance
      pool.query.mockResolvedValueOnce([[]])

      // Scores
      pool.query.mockResolvedValueOnce([[]])

      // Quizzes
      pool.query.mockResolvedValueOnce([[]])

      // Competencies
      pool.query.mockResolvedValueOnce([[]])

      // Feedback
      pool.query.mockResolvedValueOnce([[]])

      // Certificates
      pool.query.mockResolvedValueOnce([[]])

      // Checklist
      pool.query.mockResolvedValueOnce([
        checklistRows,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },

        params: {
          studentId: '10',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      const response =
        res.json.mock.calls[0][0]

      const evaluations =
        response.data
          .assignmentChecklistEvaluations

      expect(evaluations).toHaveLength(2)

      // --------------------------------------------------------
      // ASSESSMENT 1
      // --------------------------------------------------------

      expect(evaluations[0]).toMatchObject({
        assessment_id: 1,

        assessment_title:
          'Assignment One',

        // assessment_date null olduğu için due_date
        // kullanılmalı
        delivered_on:
          '2026-08-10',

        final_score: 90,

        max_score: 100,
      })

      expect(
        evaluations[0].criteria
      ).toHaveLength(2)

      expect(
        evaluations[0].criteria[0]
      ).toMatchObject({
        criterion_id: 1,

        name: 'Criterion One',
      })

      expect(
        evaluations[0].criteria[1]
      ).toMatchObject({
        criterion_id: 2,

        name: 'Criterion Two',
      })

      // --------------------------------------------------------
      // ASSESSMENT 2
      // --------------------------------------------------------

      expect(evaluations[1]).toMatchObject({
        assessment_id: 2,

        assessment_title:
          'Assignment Two',

        // assessment_date varsa o kullanılmalı
        delivered_on:
          '2026-08-15',

        final_score: null,

        max_score: 50,
      })

      expect(
        evaluations[1].criteria
      ).toHaveLength(1)

      expect(
        evaluations[1].criteria[0]
      ).toMatchObject({
        criterion_id: 3,

        name: 'Criterion Three',
      })

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // EMPTY CHECKLIST
  // ============================================================

  describe('studentReport - empty checklist', () => {
    it('should return an empty checklist array when there are no checklist evaluations', async () => {
      pool.query.mockResolvedValueOnce([
        [student],
      ])

      // Attendance
      pool.query.mockResolvedValueOnce([[]])

      // Scores
      pool.query.mockResolvedValueOnce([[]])

      // Quizzes
      pool.query.mockResolvedValueOnce([[]])

      // Competencies
      pool.query.mockResolvedValueOnce([[]])

      // Feedback
      pool.query.mockResolvedValueOnce([[]])

      // Certificates
      pool.query.mockResolvedValueOnce([[]])

      // Checklist
      pool.query.mockResolvedValueOnce([[]])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },

        params: {
          studentId: '10',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await studentReport(req, res, next)

      const response =
        res.json.mock.calls[0][0]

      expect(
        response.data
          .assignmentChecklistEvaluations
      ).toEqual([])

      expect(next).not.toHaveBeenCalled()
    })
  })
})