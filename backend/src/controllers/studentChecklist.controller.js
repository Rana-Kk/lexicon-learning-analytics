import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherOwnsGroup } from '../utils/scope.js';

// ============================================================
// ACCESS CONTROL
// ============================================================

async function assertAccess(req, groupId) {
  if (req.user.role === 'teacher') {
    const hasAccess = await teacherOwnsGroup(
      req.user.sub,
      groupId
    );

    if (!hasAccess) {
      throw new ApiError(
        403,
        'You do not have access to this group'
      );
    }
  }
}


// ============================================================
// GET STUDENT CHECKLIST EVALUATIONS
//
// GET /api/student-checklists/:studentId?group_id=3
// ============================================================

export const getStudentChecklist = asyncHandler(
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const groupId = Number(req.query.group_id);

    if (!studentId || !groupId) {
      throw new ApiError(
        400,
        'studentId and group_id are required'
      );
    }

    // --------------------------------------------------------
    // ACCESS CHECK
    // --------------------------------------------------------

    await assertAccess(req, groupId);


    // --------------------------------------------------------
    // CHECK STUDENT MEMBERSHIP
    // --------------------------------------------------------

    const [membership] = await pool.query(
      `
        SELECT 1
        FROM group_students
        WHERE group_id = ?
          AND student_id = ?
      `,
      [groupId, studentId]
    );

    if (!membership.length) {
      throw new ApiError(
        404,
        'Student is not a member of this group'
      );
    }


    // --------------------------------------------------------
    // GET ASSESSMENTS FOR THIS GROUP
    // --------------------------------------------------------

    const [assessments] = await pool.query(
      `
        SELECT
          a.id,
          a.title,
          a.type,
          a.due_date,
          a.assessment_date,
          a.max_score

        FROM assessments a

        WHERE a.group_id = ?

        ORDER BY
          COALESCE(
            a.assessment_date,
            a.due_date
          ) DESC,
          a.id DESC
      `,
      [groupId]
    );

    if (!assessments.length) {
      return res.json({
        success: true,
        data: []
      });
    }


    const assessmentIds = assessments.map(
      assessment => assessment.id
    );


    // --------------------------------------------------------
    // GET CHECKLIST CRITERIA
    //
    // IMPORTANT:
    //
    // assessment_checklist_results does NOT have student_id.
    //
    // Student relationship:
    //
    // assessment_checklist_results
    //        ↓ ai_evaluation_id
    // ai_evaluations
    //        ↓ submission_id
    // assessment_submissions
    //        ↓ student_id
    //
    // --------------------------------------------------------

    const [criteria] = await pool.query(
      `
        SELECT
          acc.id,
          acc.assessment_id,
          acc.name,
          acc.description,
          acc.criterion_type,
          acc.max_score,
          acc.sort_order,


          -- AI RESULT

          acr.id AS result_id,

          acr.ai_yes_no_value,
          acr.ai_score_value,
          acr.ai_text_value,
          acr.ai_feedback,


          -- TEACHER RESULT

          acr.teacher_yes_no_value,
          acr.teacher_score_value,
          acr.teacher_text_value,
          acr.teacher_feedback


        FROM assessment_checklist_criteria acc


        LEFT JOIN assessment_checklist_results acr
          ON acr.checklist_criterion_id = acc.id


        LEFT JOIN ai_evaluations ae
          ON ae.id = acr.ai_evaluation_id


        LEFT JOIN assessment_submissions s
          ON s.id = ae.submission_id
          AND s.student_id = ?


        WHERE acc.assessment_id IN (?)


          AND (
            s.student_id = ?
            OR acr.id IS NULL
          )


        ORDER BY
          acc.assessment_id ASC,
          acc.sort_order ASC,
          acc.id ASC
      `,
      [
        studentId,
        assessmentIds,
        studentId
      ]
    );


    // --------------------------------------------------------
    // GROUP CRITERIA BY ASSESSMENT
    // --------------------------------------------------------

    const criteriaByAssessment = new Map();

    for (const criterion of criteria) {
      if (
        !criteriaByAssessment.has(
          criterion.assessment_id
        )
      ) {
        criteriaByAssessment.set(
          criterion.assessment_id,
          []
        );
      }

      criteriaByAssessment
        .get(criterion.assessment_id)
        .push(criterion);
    }


    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(200).json({
      success: true,

      data: assessments.map(
        assessment => ({
          ...assessment,

          criteria:
            criteriaByAssessment.get(
              assessment.id
            ) || []
        })
      )
    });
  }
);


// ============================================================
// SAVE TEACHER CHECKLIST EVALUATION
//
// PUT
// /api/student-checklists/:studentId/assessments/:assessmentId
// ============================================================

export const saveStudentChecklist = asyncHandler(
  async (req, res) => {
    const studentId = Number(req.params.studentId);

    const assessmentId = Number(
      req.params.assessmentId
    );

    const {
      group_id,
      results
    } = req.body;


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
      !studentId ||
      !assessmentId ||
      !group_id ||
      !Array.isArray(results)
    ) {
      throw new ApiError(
        400,
        'group_id and results are required'
      );
    }


    const groupId = Number(group_id);


    // --------------------------------------------------------
    // ACCESS CHECK
    // --------------------------------------------------------

    await assertAccess(req, groupId);


    // --------------------------------------------------------
    // CHECK STUDENT MEMBERSHIP
    // --------------------------------------------------------

    const [membership] = await pool.query(
      `
        SELECT 1
        FROM group_students
        WHERE group_id = ?
          AND student_id = ?
      `,
      [groupId, studentId]
    );

    if (!membership.length) {
      throw new ApiError(
        404,
        'Student is not a member of this group'
      );
    }


    // --------------------------------------------------------
    // CHECK ASSESSMENT
    // --------------------------------------------------------

    const [assessmentRows] =
      await pool.query(
        `
          SELECT
            id,
            group_id

          FROM assessments

          WHERE id = ?
            AND group_id = ?
        `,
        [
          assessmentId,
          groupId
        ]
      );

    if (!assessmentRows.length) {
      throw new ApiError(
        404,
        'Assessment not found in this group'
      );
    }


    // --------------------------------------------------------
    // GET CHECKLIST CRITERIA
    // --------------------------------------------------------

    const [criteria] = await pool.query(
      `
        SELECT
          id,
          criterion_type,
          max_score

        FROM assessment_checklist_criteria

        WHERE assessment_id = ?
      `,
      [assessmentId]
    );


    const criteriaById = new Map(
      criteria.map(criterion => [
        Number(criterion.id),
        criterion
      ])
    );


    // --------------------------------------------------------
    // GET AI EVALUATION FOR THIS STUDENT + ASSESSMENT
    // --------------------------------------------------------

    const [evaluationRows] =
      await pool.query(
        `
          SELECT
            ae.id

          FROM ai_evaluations ae

          INNER JOIN assessment_submissions s
            ON s.id = ae.submission_id

          WHERE
            s.assessment_id = ?
            AND s.student_id = ?

          ORDER BY ae.id DESC

          LIMIT 1
        `,
        [
          assessmentId,
          studentId
        ]
      );


    if (!evaluationRows.length) {
      throw new ApiError(
        400,
        'No AI evaluation found for this student and assessment yet'
      );
    }


    const aiEvaluationId =
      evaluationRows[0].id;


    // --------------------------------------------------------
    // START TRANSACTION
    // --------------------------------------------------------

    const connection =
      await pool.getConnection();


    try {
      await connection.beginTransaction();


      // ------------------------------------------------------
      // PROCESS EACH RESULT
      // ------------------------------------------------------

      for (const item of results) {

        const criterionId = Number(
          item.checklist_criterion_id
        );


        const criterion =
          criteriaById.get(criterionId);


        if (!criterion) {
          throw new ApiError(
            400,
            'Invalid checklist criterion'
          );
        }


        let teacherYesNo = null;

        let teacherScore = null;

        let teacherText = null;


        // ----------------------------------------------------
        // YES / NO CRITERION
        // ----------------------------------------------------

        if (
          criterion.criterion_type === 'yes_no'
        ) {
          if (
            item.teacher_yes_no_value === null ||
            item.teacher_yes_no_value === undefined ||
            item.teacher_yes_no_value === ''
          ) {
            teacherYesNo = null;

          } else {

            teacherYesNo =
              Boolean(
                item.teacher_yes_no_value
              );
          }
        }


        // ----------------------------------------------------
        // SCORE CRITERION
        // ----------------------------------------------------

        if (
          criterion.criterion_type === 'score'
        ) {
          if (
            item.teacher_score_value === null ||
            item.teacher_score_value === undefined ||
            item.teacher_score_value === ''
          ) {
            teacherScore = null;

          } else {

            teacherScore =
              Number(
                item.teacher_score_value
              );


            if (
              !Number.isFinite(
                teacherScore
              )
            ) {
              throw new ApiError(
                400,
                'Teacher score must be a valid number'
              );
            }


            if (
              teacherScore < 0 ||
              teacherScore >
                Number(criterion.max_score)
            ) {
              throw new ApiError(
                400,
                `Score must be between 0 and ${criterion.max_score}`
              );
            }
          }
        }


        // ----------------------------------------------------
        // TEXT CRITERION
        // ----------------------------------------------------

        if (
          criterion.criterion_type === 'text'
        ) {
          teacherText =
            item.teacher_text_value
              ?.trim() || null;
        }


        const teacherFeedback =
          item.teacher_feedback
            ?.trim() || null;


        // ----------------------------------------------------
        // CHECK IF AI RESULT ALREADY EXISTS
        // ----------------------------------------------------

        const [existingRows] =
          await connection.query(
            `
              SELECT
                id

              FROM assessment_checklist_results

              WHERE
                ai_evaluation_id = ?
                AND checklist_criterion_id = ?

              LIMIT 1
            `,
            [
              aiEvaluationId,
              criterionId
            ]
          );


        // ----------------------------------------------------
        // UPDATE EXISTING RESULT
        // ----------------------------------------------------

        if (existingRows.length) {

          await connection.query(
            `
              UPDATE assessment_checklist_results

              SET
                teacher_yes_no_value = ?,
                teacher_score_value = ?,
                teacher_text_value = ?,
                teacher_feedback = ?

              WHERE id = ?
            `,
            [
              teacherYesNo,
              teacherScore,
              teacherText,
              teacherFeedback,
              existingRows[0].id
            ]
          );

        }


        // ----------------------------------------------------
        // AI HAS NOT CREATED THIS CRITERION RESULT
        //
        // Create a row connected to the AI evaluation.
        // AI fields remain NULL.
        // ----------------------------------------------------

        else {

          await connection.query(
            `
              INSERT INTO assessment_checklist_results
              (
                ai_evaluation_id,
                checklist_criterion_id,

                ai_yes_no_value,
                ai_score_value,
                ai_text_value,
                ai_feedback,

                teacher_yes_no_value,
                teacher_score_value,
                teacher_text_value,
                teacher_feedback
              )

              VALUES
              (
                ?, ?,

                NULL,
                NULL,
                NULL,
                NULL,

                ?,
                ?,
                ?,
                ?
              )
            `,
            [
              aiEvaluationId,
              criterionId,

              teacherYesNo,
              teacherScore,
              teacherText,
              teacherFeedback
            ]
          );
        }
      }


      // ------------------------------------------------------
      // COMMIT
      // ------------------------------------------------------

      await connection.commit();


      res.status(200).json({
        success: true,

        message:
          'Checklist evaluation saved successfully'
      });


    } catch (error) {

      await connection.rollback();

      throw error;


    } finally {

      connection.release();

    }
  }
);
