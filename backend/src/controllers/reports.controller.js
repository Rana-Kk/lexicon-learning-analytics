import { pool } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { teacherHasStudent } from '../utils/scope.js'

export const studentReport = asyncHandler(async (req, res) => {
  const sid =
    req.user.role === 'student'
      ? req.user.sub
      : req.params.studentId

  if (
    req.user.role === 'teacher' &&
    !(await teacherHasStudent(req.user.sub, sid))
  ) {
    throw new ApiError(
      403,
      'You do not have access to this student'
    )
  }

  // ============================================================
  // STUDENT
  // ============================================================

  const [users] = await pool.query(
    `
      SELECT
        id,
        name,
        email
      FROM users
      WHERE id = ?
        AND role = 'student'
    `,
    [sid]
  )

  if (!users.length) {
    throw new ApiError(404, 'Student not found')
  }

  const student = users[0]

  // ============================================================
  // ATTENDANCE
  // ============================================================

  const [attendance] = await pool.query(
    `
      SELECT *
      FROM attendance
      WHERE student_id = ?
      ORDER BY attendance_date DESC
    `,
    [sid]
  )

  // ============================================================
  // ASSESSMENT SCORES
  // ============================================================

  const [scores] = await pool.query(
    `
      SELECT
        s.*,
        a.title AS assessment_title,
        a.max_score
      FROM assessment_scores s
      JOIN assessments a
        ON a.id = s.assessment_id
      WHERE s.student_id = ?
      ORDER BY a.id DESC
    `,
    [sid]
  )

  // ============================================================
  // QUIZZES
  // ============================================================

  const [quizzes] = await pool.query(
    `
      SELECT
        qr.*,
        q.title AS quiz_title,
        q.topic,
        q.max_score,
        q.quiz_date
      FROM quiz_results qr
      JOIN quizzes q
        ON q.id = qr.quiz_id
      WHERE qr.student_id = ?
      ORDER BY qr.completed_at DESC
    `,
    [sid]
  )

  // ============================================================
  // COMPETENCIES
  // ============================================================

  const [competencies] = await pool.query(
    `
      SELECT
        c.name,
        sc.score
      FROM student_competencies sc
      JOIN competencies c
        ON c.id = sc.competency_id
      WHERE sc.student_id = ?
      ORDER BY c.name
    `,
    [sid]
  )

  // ============================================================
  // TEACHER FEEDBACK
  // ============================================================

  const [feedback] = await pool.query(
    `
      SELECT
        tf.*,
        a.title AS assessment_title,
        t.name AS teacher_name
      FROM teacher_feedback tf
      JOIN users t
        ON t.id = tf.teacher_id
      LEFT JOIN assessments a
        ON a.id = tf.assessment_id
      WHERE tf.student_id = ?
      ORDER BY tf.created_at DESC
    `,
    [sid]
  )

  // ============================================================
  // CERTIFICATES
  // ============================================================

  const [certificates] = await pool.query(
    `
      SELECT *
      FROM certificates
      WHERE student_id = ?
      ORDER BY issue_date DESC
    `,
    [sid]
  )

  // ============================================================
  // ASSIGNMENT CHECKLIST EVALUATIONS
  //
  // IMPORTANT:
  //
  // Assessment = one row in frontend/PDF
  // Criteria = dynamic columns
  // Teacher values = cells
  // ============================================================

  const [checklistRows] = await pool.query(
    `
      SELECT
        a.id AS assessment_id,
        a.title AS assessment_title,
        a.assessment_date,
        a.due_date,
        a.max_score,

        c.id AS criterion_id,
        c.name AS criterion_name,
        c.description AS criterion_description,
        c.criterion_type,
        c.max_score AS criterion_max_score,
        c.sort_order,

        r.ai_yes_no_value,
        r.ai_score_value,
        r.ai_text_value,
        r.ai_feedback,

        r.teacher_yes_no_value,
        r.teacher_score_value,
        r.teacher_text_value,
        r.teacher_feedback,

        finalScore.score AS final_score

      FROM assessments a

      INNER JOIN assessment_checklist_criteria c
        ON c.assessment_id = a.id

      LEFT JOIN (
        SELECT
          s1.assessment_id,
          s1.id AS submission_id,
          s1.submitted_at

        FROM assessment_submissions s1

        INNER JOIN (
          SELECT
            assessment_id,
            MAX(id) AS latest_submission_id

          FROM assessment_submissions

          WHERE student_id = ?

          GROUP BY assessment_id
        ) latestSubmission
          ON latestSubmission.latest_submission_id = s1.id

        WHERE s1.student_id = ?
      ) latestSubmission
        ON latestSubmission.assessment_id = a.id

      LEFT JOIN (
        SELECT
          ae1.submission_id,
          ae1.id AS evaluation_id

        FROM ai_evaluations ae1

        INNER JOIN (
          SELECT
            submission_id,
            MAX(id) AS latest_evaluation_id

          FROM ai_evaluations

          GROUP BY submission_id
        ) latestEvaluation
          ON latestEvaluation.latest_evaluation_id = ae1.id
      ) latestEvaluation
        ON latestEvaluation.submission_id =
          latestSubmission.submission_id

      LEFT JOIN assessment_checklist_results r
        ON r.ai_evaluation_id =
          latestEvaluation.evaluation_id

        AND r.checklist_criterion_id = c.id

      LEFT JOIN assessment_scores finalScore
        ON finalScore.assessment_id = a.id
        AND finalScore.student_id = ?

      WHERE
        a.group_id IN (
          SELECT group_id
          FROM group_students
          WHERE student_id = ?
        )

      ORDER BY
        COALESCE(
          a.assessment_date,
          a.due_date
        ) DESC,

        a.id DESC,

        c.sort_order ASC,

        c.id ASC
    `,
    [
      sid,
      sid,
      sid,
      sid,
    ]
  )

  // ============================================================
  // GROUP CHECKLIST DATA BY ASSIGNMENT
  // ============================================================

  const checklistMap = new Map()

  for (const row of checklistRows) {
    const assessmentId = String(row.assessment_id)

    if (!checklistMap.has(assessmentId)) {
      checklistMap.set(assessmentId, {
        assessment_id: row.assessment_id,
        assessment_title: row.assessment_title,

        delivered_on:
          row.assessment_date ||
          row.due_date ||
          null,

        final_score:
          row.final_score ?? null,

        max_score:
          row.max_score,

        criteria: [],
      })
    }

        checklistMap
      .get(assessmentId)
      .criteria
      .push({
        criterion_id: row.criterion_id,

        name: row.criterion_name,

        description:
          row.criterion_description,

        criterion_type:
          row.criterion_type,

        max_score:
          row.criterion_max_score,

        sort_order:
          row.sort_order,

        // AI VALUES
        ai_yes_no_value:
          row.ai_yes_no_value,

        ai_score_value:
          row.ai_score_value,

        ai_text_value:
          row.ai_text_value,

        ai_feedback:
          row.ai_feedback,

        // TEACHER VALUES
        teacher_yes_no_value:
          row.teacher_yes_no_value,

        teacher_score_value:
          row.teacher_score_value,

        teacher_text_value:
          row.teacher_text_value,

        teacher_feedback:
          row.teacher_feedback,
      })
  }

  const assignmentChecklistEvaluations =
    Array.from(checklistMap.values())

  // ============================================================
  // RESPONSE
  // ============================================================

  res.json({
    success: true,

    data: {
      student,

      attendance,

      scores,

      quizzes,

      competencies,

      feedback,

      certificates,

      assignmentChecklistEvaluations,
    },
  })
})