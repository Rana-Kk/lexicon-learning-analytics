import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzeSubmissionWithGemini } from '../services/ai.service.js';
import { teacherOwnsGroup } from '../utils/scope.js';


// =========================================================
// GET ALL SUBMISSIONS
// =========================================================

export const getAllSubmissions = asyncHandler(async (req, res) => {
  const { assessment_id, student_id } = req.query;

  let q = `
    SELECT
      s.*,
      s.github_url AS github_repo_url,

      u.name AS student_name,
      u.email AS student_email,
      u.github_username,

      su.name AS submitted_by_name,

      a.title AS assessment_title,
      a.max_score AS assessment_max_score,
      a.group_id,

      latest_eval.total_ai_score AS ai_score,
      latest_eval.total_teacher_score AS final_score,
      latest_eval.status AS ai_evaluation_status

    FROM assessment_submissions s

    LEFT JOIN users u
      ON u.id = s.student_id

    LEFT JOIN users su
      ON su.id = s.submitted_by

    JOIN assessments a
      ON a.id = s.assessment_id

    LEFT JOIN ai_evaluations latest_eval
      ON latest_eval.id = (
        SELECT ae.id
        FROM ai_evaluations ae
        WHERE ae.submission_id = s.id
        ORDER BY ae.id DESC
        LIMIT 1
      )

    WHERE 1=1
  `;

  const p = [];

  // =====================================================
  // STUDENT
  // =====================================================

  if (req.user.role === 'student') {
    q += `
      AND (
        s.student_id = ?
        OR EXISTS (
          SELECT 1
          FROM team_members tm
          WHERE tm.team_id = s.team_id
            AND tm.student_id = ?
        )
      )
    `;

    p.push(req.user.sub, req.user.sub);
  }

  // =====================================================
  // TEACHER
  // =====================================================

  else if (req.user.role === 'teacher') {
    q += `
      AND EXISTS (
        SELECT 1
        FROM group_teachers gt
        WHERE gt.group_id = a.group_id
          AND gt.teacher_id = ?
      )
    `;

    p.push(req.user.sub);

    // ---------------------------------------------------
    // Optional student filter
    // ---------------------------------------------------

    if (student_id) {
      q += `
        AND (
          s.student_id = ?
          OR EXISTS (
            SELECT 1
            FROM team_members tm
            WHERE tm.team_id = s.team_id
              AND tm.student_id = ?
          )
        )
      `;

      p.push(student_id, student_id);
    }
  }

  // =====================================================
  // ASSESSMENT FILTER
  // =====================================================

  if (assessment_id) {
    q += `
      AND s.assessment_id = ?
    `;

    p.push(assessment_id);
  }

  q += `
    ORDER BY s.id DESC
  `;

  const [rows] = await pool.query(q, p);

  // =====================================================
  // ADMIN
  // =====================================================

  if (req.user.role === 'admin') {
    // Admin için ekstra filtre yok.
    // rows olduğu gibi kullanılacak.
  }

  // =====================================================
  // TEACHER:
  // EXPAND TEAM SUBMISSIONS INTO TEAM MEMBERS
  // =====================================================

  if (req.user.role === 'teacher') {
    const expandedRows = [];

    for (const submission of rows) {
      // -------------------------------------------------
      // INDIVIDUAL SUBMISSION
      // -------------------------------------------------

      if (!submission.team_id) {
        expandedRows.push(submission);
        continue;
      }

      // -------------------------------------------------
      // TEAM MEMBERS
      // -------------------------------------------------

      const [teamMembers] = await pool.query(
        `
          SELECT
            tm.student_id,
            u.name AS student_name,
            u.email AS student_email,
            u.github_username

          FROM team_members tm

          JOIN users u
            ON u.id = tm.student_id

          WHERE tm.team_id = ?

          ORDER BY u.name
        `,
        [submission.team_id]
      );

      // -------------------------------------------------
      // NO TEAM MEMBERS
      // -------------------------------------------------

      if (!teamMembers.length) {
        expandedRows.push({
          ...submission,
          student_id: null,
          student_name: 'Team Submission',
        });

        continue;
      }

      // -------------------------------------------------
      // CREATE ONE ROW FOR EACH TEAM MEMBER
      // -------------------------------------------------

      for (const member of teamMembers) {
        const [scoreRows] = await pool.query(
          `
            SELECT
              score,
              feedback

            FROM assessment_scores

            WHERE assessment_id = ?
              AND student_id = ?
              AND submission_id = ?

            ORDER BY id DESC

            LIMIT 1
          `,
          [
            submission.assessment_id,
            member.student_id,
            submission.id,
          ]
        );

        const memberScore =
          scoreRows.length
            ? scoreRows[0]
            : null;

        expandedRows.push({
          ...submission,

          // ---------------------------------------------
          // IMPORTANT:
          // Each team member gets their own student data.
          // ---------------------------------------------

          student_id:
            member.student_id,

          student_name:
            member.student_name,

          student_email:
            member.student_email,

          github_username:
            member.github_username,

          // ---------------------------------------------
          // Each member's own final score
          // ---------------------------------------------

          final_score:
            memberScore?.score ??
            submission.final_score ??
            null,

          teacher_feedback:
            memberScore?.feedback ??
            submission.teacher_feedback ??
            null,

          // ---------------------------------------------
          // Keep the original team information
          // ---------------------------------------------

          team_id:
            submission.team_id,

          submitted_by:
            submission.submitted_by,

          submitted_by_name:
            submission.submitted_by_name,

          is_team_submission: true,
        });
      }
    }

    return res.json({
      success: true,
      count: expandedRows.length,
      data: expandedRows,
    });
  }

  // =====================================================
  // STUDENT / ADMIN RESPONSE
  // =====================================================

  res.json({
    success: true,
    count: rows.length,
    data: rows,
  });
});

export const getSubmissions = getAllSubmissions;


// =========================================================
// GET SUBMISSION BY ID
// =========================================================

export const getSubmissionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query(
    `
      SELECT
        s.*,
        s.github_url AS github_repo_url,

        u.name AS student_name,
        u.email AS student_email,
        u.github_username,

        su.name AS submitted_by_name,

        a.title AS assessment_title,
        a.description AS assessment_description,
        a.max_score AS assessment_max_score,
        a.group_id AS assessment_group_id,

        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', tm_u.id,
              'name', tm_u.name
            )
          )
          FROM team_members tm
          JOIN users tm_u
            ON tm_u.id = tm.student_id
          WHERE tm.team_id = COALESCE(
            s.team_id,
            (
              SELECT t.id
              FROM teams t
              JOIN team_members tm_current
                ON tm_current.team_id = t.id
              WHERE t.group_id = a.group_id
                AND tm_current.student_id = ?
              LIMIT 1
            )
          )
        ) AS team_members_json

      FROM assessment_submissions s

      LEFT JOIN users u
        ON u.id = s.student_id

      LEFT JOIN users su
        ON su.id = s.submitted_by

      JOIN assessments a
        ON a.id = s.assessment_id

      WHERE s.id = ?
    `,
    [req.user.sub, id]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Submission not found');
  }

  const submission = rows[0];

  // -------------------------------------------------------
  // Parse team members
  // -------------------------------------------------------

  submission.team_members =
    typeof submission.team_members_json === 'string'
      ? JSON.parse(submission.team_members_json)
      : submission.team_members_json || [];

  delete submission.team_members_json;

  const isTeacherOrAdmin =
    req.user.role === 'teacher' ||
    req.user.role === 'admin';

  // -------------------------------------------------------
  // STUDENT ACCESS
  // -------------------------------------------------------

  if (
    req.user.role === 'student' &&
    submission.student_id !== req.user.sub &&
    !submission.team_members.some(
      (member) =>
        Number(member.id) === Number(req.user.sub)
    )
  ) {
    throw new ApiError(
      403,
      'You do not have access to this submission'
    );
  }

  // -------------------------------------------------------
  // TEACHER ACCESS
  // -------------------------------------------------------

  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(
      req.user.sub,
      submission.assessment_group_id
    ))
  ) {
    throw new ApiError(
      403,
      'You do not have access to this submission'
    );
  }

  // =======================================================
  // AI EVALUATIONS
  // =======================================================

  const [evals] = await pool.query(
    `
      SELECT
        ae.*,
        u.name AS reviewed_by_name
      FROM ai_evaluations ae
      LEFT JOIN users u
        ON u.id = ae.reviewed_by
      WHERE ae.submission_id = ?
      ORDER BY ae.id DESC
    `,
    [id]
  );

  const latestEval = evals[0] || null;

  // =======================================================
  // COMPETENCY SUGGESTIONS
  // =======================================================

  let competencySuggestions = [];

  if (latestEval) {
    const [suggestions] = await pool.query(
      `
        SELECT
          acs.id,
          acs.competency_id,
          c.name AS competency_name,
          acs.current_score,
          acs.suggested_score,
          acs.reason

        FROM ai_competency_suggestions acs

        JOIN competencies c
          ON c.id = acs.competency_id

        WHERE acs.ai_evaluation_id = ?

        ORDER BY c.name
      `,
      [latestEval.id]
    );

    competencySuggestions = suggestions;
  }

  // =======================================================
  // TEACHER / ADMIN RESPONSE
  // =======================================================

  if (isTeacherOrAdmin) {
    const [scores] = latestEval
      ? await pool.query(
          `
            SELECT
              cs.id,
              cs.criterion_id,
              ac.name AS criterion_name,
              ac.description AS criterion_description,
              ac.max_score AS criterion_max_score,

              cs.ai_recommended_score,
              cs.ai_recommended_score AS ai_score,
              cs.ai_rationale,

              cs.teacher_final_score,

              (
                cs.teacher_final_score IS NOT NULL
                AND cs.teacher_final_score <> cs.ai_recommended_score
              ) AS teacher_override

            FROM criterion_scores cs

            JOIN assignment_evaluation_criteria ac
              ON ac.id = cs.criterion_id

            WHERE cs.ai_evaluation_id = ?

            ORDER BY ac.sort_order, ac.id
          `,
          [latestEval.id]
        )
      : [[]];

    const [checklistCriteria] = await pool.query(
      `
        SELECT
          acc.id,
          acc.name,
          acc.description,
          acc.criterion_type,
          acc.max_score,
          acc.sort_order,

          acr.id AS result_id,

          acr.ai_yes_no_value,
          acr.ai_score_value,
          acr.ai_text_value,
          acr.ai_feedback,

          acr.teacher_yes_no_value,
          acr.teacher_score_value,
          acr.teacher_text_value,
          acr.teacher_feedback

        FROM assessment_checklist_criteria acc

        LEFT JOIN assessment_checklist_results acr
          ON acr.checklist_criterion_id = acc.id
          AND acr.ai_evaluation_id = ?

        WHERE acc.assessment_id = ?

        ORDER BY acc.sort_order ASC, acc.id ASC
      `,
      [
        latestEval?.id ?? 0,
        submission.assessment_id,
      ]
    );

    return res.json({
      success: true,

      data: {
        ...submission,

        ai_evaluation_id:
          latestEval?.id ?? null,

        ai_evaluation_status:
          latestEval?.status ?? null,

        ai_score:
          latestEval?.total_ai_score ?? null,

        final_score:
          latestEval?.total_teacher_score ?? null,

        teacher_feedback:
          latestEval?.teacher_comment ?? null,

        strengths:
          latestEval?.strengths ?? null,

        areas_for_improvement:
          latestEval?.areas_for_improvement ?? null,

        recommendations:
          latestEval?.recommendations ?? null,

        suggested_next_steps:
          latestEval?.suggested_next_steps ?? null,

        criteria_scores: scores,

        checklist_criteria:
          checklistCriteria,

        competency_suggestions:
          competencySuggestions,

        ai_evaluations: evals,
      },
    });
  }

  // =======================================================
  // STUDENT RESPONSE
  // =======================================================

  const approvedEval =
    evals.find(
      (e) => e.status === 'approved'
    ) || null;

  const rejectedEval =
    !approvedEval
      ? evals.find(
          (e) => e.status === 'rejected'
        )
      : null;

  let studentEvaluations = [];
  let studentCriteria = [];
  let studentChecklistResults = [];

  // -------------------------------------------------------
  // APPROVED
  // -------------------------------------------------------

  if (approvedEval) {
    studentEvaluations = [
      {
        id: approvedEval.id,
        status: 'approved',

        total_teacher_score:
          approvedEval.total_teacher_score,

        strengths:
          approvedEval.strengths,

        areas_for_improvement:
          approvedEval.areas_for_improvement,

        recommendations:
          approvedEval.recommendations,

        suggested_next_steps:
          approvedEval.suggested_next_steps,

        teacher_comment:
          approvedEval.teacher_comment,

        reviewed_by_name:
          approvedEval.reviewed_by_name,

        reviewed_at:
          approvedEval.reviewed_at,
      },
    ];

    const [approvedScores] =
      await pool.query(
        `
          SELECT
            cs.id,
            cs.criterion_id,
            ac.name AS criterion_name,
            ac.max_score AS criterion_max_score,
            cs.teacher_final_score

          FROM criterion_scores cs

          JOIN assignment_evaluation_criteria ac
            ON ac.id = cs.criterion_id

          WHERE cs.ai_evaluation_id = ?

          ORDER BY ac.sort_order, ac.id
        `,
        [approvedEval.id]
      );

    studentCriteria =
      approvedScores.map((s) => ({
        ...s,
        ai_recommended_score: null,
      }));

    const [checklistRows] =
      await pool.query(
        `
          SELECT
            acc.id,
            acc.name,
            acc.description,
            acc.criterion_type,
            acc.max_score,
            acc.sort_order,

            acr.ai_yes_no_value,
            acr.ai_score_value,
            acr.ai_text_value,

            acr.teacher_yes_no_value,
            acr.teacher_score_value,
            acr.teacher_text_value

          FROM assessment_checklist_criteria acc

          LEFT JOIN assessment_checklist_results acr
            ON acr.checklist_criterion_id = acc.id
            AND acr.ai_evaluation_id = ?

          WHERE acc.assessment_id = ?

          ORDER BY
            acc.sort_order ASC,
            acc.id ASC
        `,
        [
          approvedEval.id,
          submission.assessment_id,
        ]
      );

    studentChecklistResults =
      checklistRows.map((row) => {
        const finalYesNo =
          row.teacher_yes_no_value !== null &&
          row.teacher_yes_no_value !== undefined
            ? Boolean(
                row.teacher_yes_no_value
              )
            : row.ai_yes_no_value !== null &&
              row.ai_yes_no_value !== undefined
            ? Boolean(
                row.ai_yes_no_value
              )
            : null;

        const finalScore =
          row.teacher_score_value !== null &&
          row.teacher_score_value !== undefined
            ? Number(
                row.teacher_score_value
              )
            : row.ai_score_value !== null &&
              row.ai_score_value !== undefined
            ? Number(
                row.ai_score_value
              )
            : null;

        const finalText =
          row.teacher_text_value !== null &&
          row.teacher_text_value !== undefined
            ? row.teacher_text_value
            : row.ai_text_value ?? null;

        return {
          id: row.id,
          name: row.name,
          description: row.description,
          criterion_type:
            row.criterion_type,

          max_score:
            row.max_score !== null &&
            row.max_score !== undefined
              ? Number(row.max_score)
              : null,

          final_yes_no_value:
            finalYesNo,

          final_score_value:
            finalScore,

          final_text_value:
            finalText,
        };
      });
  }

  // -------------------------------------------------------
  // REJECTED
  // -------------------------------------------------------

  else if (rejectedEval) {
    studentEvaluations = [
      {
        id: rejectedEval.id,
        status: 'rejected',

        total_teacher_score: null,

        teacher_comment:
          rejectedEval.teacher_comment,

        reviewed_by_name:
          rejectedEval.reviewed_by_name,

        reviewed_at:
          rejectedEval.reviewed_at,
      },
    ];
  }

  // =======================================================
  // STUDENT RESPONSE
  // =======================================================

  res.json({
    success: true,

    data: {
      id: submission.id,

      status: submission.status,

      github_url:
        submission.github_url,

      submitted_at:
        submission.submitted_at,

      submitted_by_name:
        submission.submitted_by_name,

      assessment_max_score:
        submission.assessment_max_score,

      // IMPORTANT:
      // Team members are returned here so
      // StudentSubmissions / PeerEvaluationForm
      // can use them.
      team_members:
        submission.team_members,

      ai_evaluations:
        studentEvaluations,

      criteria_scores:
        studentCriteria,

      checklist_results:
        studentChecklistResults,
    },
  });
});


// =========================================================
// CREATE / UPDATE SUBMISSION
// =========================================================

export const createSubmission = asyncHandler(
  async (req, res) => {
    const {
      assessment_id,
      github_repo_url,
      github_url,
    } = req.body;

    const student_id = req.user.sub;

    const url = (
      github_url ||
      github_repo_url ||
      ''
    ).trim();

    if (!assessment_id || !url) {
      throw new ApiError(
        400,
        'Assessment ID and GitHub repository URL are required'
      );
    }

    const [a] = await pool.query(
      'SELECT * FROM assessments WHERE id=?',
      [assessment_id]
    );

    if (!a.length) {
      throw new ApiError(
        404,
        'Assessment not found'
      );
    }

    // =====================================================
    // RESOLVE GITHUB
    // =====================================================

    let owner;
    let repo;
    let commitSha;

    try {
      const u = new URL(url);

      const parts = u.pathname
        .split('/')
        .filter(Boolean);

      if (parts.length < 2) {
        throw new ApiError(
          400,
          'Invalid GitHub repository URL'
        );
      }

      owner = parts[0];

      repo = parts[1].replace(
        /\.git$/,
        ''
      );

      const githubHeaders =
        process.env.GITHUB_TOKEN
          ? {
              Authorization:
                `Bearer ${process.env.GITHUB_TOKEN}`,

              Accept:
                'application/vnd.github+json',
            }
          : {
              Accept:
                'application/vnd.github+json',
            };

      const repoResponse =
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: githubHeaders,
          }
        );

      if (!repoResponse.ok) {
        throw new ApiError(
          400,
          `Could not access GitHub repository (status ${repoResponse.status})`
        );
      }

      const repoData =
        await repoResponse.json();

      const defaultBranch =
        repoData.default_branch;

      if (!defaultBranch) {
        throw new ApiError(
          400,
          'Could not determine GitHub default branch'
        );
      }

      const branchResponse =
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(defaultBranch)}`,
          {
            headers: githubHeaders,
          }
        );

      if (!branchResponse.ok) {
        throw new ApiError(
          400,
          `Could not determine repository commit (status ${branchResponse.status})`
        );
      }

      const branchData =
        await branchResponse.json();

      commitSha = branchData.sha;

      if (!commitSha) {
        throw new ApiError(
          400,
          'Could not determine GitHub commit SHA'
        );
      }

      console.log(
        `[Submission] GitHub snapshot resolved: ${owner}/${repo} @ ${commitSha}`
      );

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.error(
        '[Submission] GitHub repository resolution failed:',
        error.message
      );

      throw new ApiError(
        400,
        'Could not access the GitHub repository'
      );
    }

    // =====================================================
    // CREATE / UPDATE
    // =====================================================

    const assessment = a[0];

    const isTeamAssessment =
      assessment.submission_mode === 'team';

    let id;
    let siblingIds = null;

    // =====================================================
    // TEAM SUBMISSION
    // =====================================================

    if (isTeamAssessment) {
      const [team] =
        await pool.query(
          `
            SELECT t.id

            FROM teams t

            JOIN team_members tm
              ON tm.team_id = t.id

            WHERE t.group_id = ?
              AND tm.student_id = ?

            LIMIT 1
          `,
          [
            assessment.group_id,
            student_id,
          ]
        );

      if (!team.length) {
        throw new ApiError(
          400,
          'You are not part of a team for this assessment'
        );
      }

      const teamId = team[0].id;

      const [members] =
        await pool.query(
          `
            SELECT student_id
            FROM team_members
            WHERE team_id = ?
          `,
          [teamId]
        );

      siblingIds = [];

      // ---------------------------------------------------
      // There is ONE submission per team.
      // ---------------------------------------------------

      const [existingTeamSubmission] =
        await pool.query(
          `
            SELECT id

            FROM assessment_submissions

            WHERE assessment_id = ?
              AND team_id = ?

            ORDER BY id DESC

            LIMIT 1
          `,
          [
            assessment_id,
            teamId,
          ]
        );

      let teamSubmissionId;

      // ---------------------------------------------------
      // UPDATE EXISTING TEAM SUBMISSION
      // ---------------------------------------------------

      if (existingTeamSubmission.length) {
        teamSubmissionId =
          existingTeamSubmission[0].id;

        await pool.query(
          `
            UPDATE assessment_submissions

            SET
              team_id = ?,
              student_id = NULL,

              github_url = ?,
              commit_sha = ?,

              submitted_by = ?,

              status = 'analyzing',

              submitted_at = NOW(),

              analyzed_at = NULL,
              ai_score = NULL,
              ai_feedback = NULL

            WHERE id = ?
          `,
          [
            teamId,
            url,
            commitSha,
            student_id,
            teamSubmissionId,
          ]
        );

      }

      // ---------------------------------------------------
      // CREATE NEW TEAM SUBMISSION
      // ---------------------------------------------------

      else {
        const [insertResult] =
          await pool.query(
            `
              INSERT INTO assessment_submissions
              (
                assessment_id,
                student_id,
                team_id,
                submitted_by,
                github_url,
                commit_sha,
                status
              )

              VALUES
              (
                ?,
                NULL,
                ?,
                ?,
                ?,
                ?,
                'analyzing'
              )
            `,
            [
              assessment_id,
              teamId,
              student_id,
              url,
              commitSha,
            ]
          );

        teamSubmissionId =
          insertResult.insertId;
      }

      // ---------------------------------------------------
      // The same submission belongs to the whole team.
      // ---------------------------------------------------

      id = teamSubmissionId;

      siblingIds.push(
        teamSubmissionId
      );

      // Prevent unused variable issues
      // while keeping the team member query
      // available for future team logic.
      void members;
    }

    // =====================================================
    // INDIVIDUAL SUBMISSION
    // =====================================================

    else {
      const [existing] =
        await pool.query(
          `
            SELECT id

            FROM assessment_submissions

            WHERE assessment_id = ?
              AND student_id = ?
          `,
          [
            assessment_id,
            student_id,
          ]
        );

      // ---------------------------------------------------
      // UPDATE
      // ---------------------------------------------------

      if (existing.length) {
        id = existing[0].id;

        await pool.query(
          `
            UPDATE assessment_submissions

            SET
              github_url = ?,
              commit_sha = ?,

              status = 'analyzing',

              submitted_at = NOW(),

              analyzed_at = NULL,
              ai_score = NULL,
              ai_feedback = NULL

            WHERE id = ?
          `,
          [
            url,
            commitSha,
            id,
          ]
        );
      }

      // ---------------------------------------------------
      // INSERT
      // ---------------------------------------------------

      else {
        const [insertResult] =
          await pool.query(
            `
              INSERT INTO assessment_submissions
              (
                assessment_id,
                student_id,
                github_url,
                commit_sha,
                status
              )

              VALUES
              (
                ?,
                ?,
                ?,
                ?,
                'analyzing'
              )
            `,
            [
              assessment_id,
              student_id,
              url,
              commitSha,
            ]
          );

        id =
          insertResult.insertId;
      }
    }

    // =====================================================
    // START AI ANALYSIS
    // =====================================================

    try {
      if (
        owner &&
        repo &&
        commitSha
      ) {
        analyzeSubmissionWithGemini(
          id,
          owner,
          repo,
          commitSha,
          siblingIds || undefined
        ).catch((e) => {
          console.error(
            `[AI Service Error] submission ${id}:`,
            e.message
          );
        });
      }
    } catch (e) {
      console.error(
        `[AI Service Error] submission ${id}:`,
        e.message
      );
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    res.status(201).json({
      success: true,

      message:
        'Submission received and AI analysis started',

      data: {
        id,

        status: 'analyzing',

        commit_sha: commitSha,
      },
    });
  }
);


// =========================================================
// REVIEW SUBMISSION
// =========================================================

export const reviewSubmission =
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (
      req.user.role !== 'teacher' &&
      req.user.role !== 'admin'
    ) {
      throw new ApiError(
        403,
        'Only teachers can review submissions'
      );
    }

    const {
      final_score,
      teacher_feedback,

      action = 'save',

      criteria_scores = [],
      checklist_results = [],

      strengths,
      areas_for_improvement,
      recommendations,
      suggested_next_steps,
    } = req.body;

    const normalizedAction =
      action === 'approved' ||
      action === 'approve'
        ? 'approved'
        : action === 'rejected' ||
          action === 'reject'
        ? 'rejected'
        : 'save';

    // =====================================================
    // GET SUBMISSION
    // =====================================================

    const [s] =
      await pool.query(
        `
          SELECT
            s.id,
            s.assessment_id,
            s.student_id,
            s.team_id,

            a.group_id,
            a.submission_mode

          FROM assessment_submissions s

          JOIN assessments a
            ON a.id = s.assessment_id

          WHERE s.id = ?
        `,
        [id]
      );

    if (!s.length) {
      throw new ApiError(
        404,
        'Submission not found'
      );
    }

    const submission = s[0];

    // =====================================================
    // TEACHER ACCESS
    // =====================================================

    if (
      req.user.role === 'teacher' &&
      !(await teacherOwnsGroup(
        req.user.sub,
        submission.group_id
      ))
    ) {
      throw new ApiError(
        403,
        'You are not assigned to this group'
      );
    }

    // =====================================================
    // LATEST AI EVALUATION
    // =====================================================

    const [evalRows] =
      await pool.query(
        `
          SELECT
            id,
            strengths,
            areas_for_improvement,
            recommendations,
            suggested_next_steps

          FROM ai_evaluations

          WHERE submission_id = ?

          ORDER BY id DESC

          LIMIT 1
        `,
        [id]
      );

    const conn =
      await pool.getConnection();

    try {
      await conn.beginTransaction();

      const evalStatus =
        normalizedAction === 'save'
          ? 'draft'
          : normalizedAction;

      let aiEvaluationId;

      // ===================================================
      // UPDATE EXISTING AI EVALUATION
      // ===================================================

      if (evalRows.length) {
        const existingEval =
          evalRows[0];

        aiEvaluationId =
          existingEval.id;

        await conn.query(
          `
            UPDATE ai_evaluations

            SET
              reviewed_by = ?,
              total_teacher_score = ?,
              status = ?,
              teacher_comment = ?,

              strengths = ?,
              areas_for_improvement = ?,
              recommendations = ?,
              suggested_next_steps = ?,

              reviewed_at = ?

            WHERE id = ?
          `,
          [
            req.user.sub,

            final_score ?? null,

            evalStatus,

            teacher_feedback || null,

            strengths ??
              existingEval.strengths,

            areas_for_improvement ??
              existingEval.areas_for_improvement,

            recommendations ??
              existingEval.recommendations,

            suggested_next_steps ??
              existingEval.suggested_next_steps,

            normalizedAction === 'save'
              ? null
              : new Date(),

            aiEvaluationId,
          ]
        );
      }

      // ===================================================
      // CREATE AI EVALUATION
      // ===================================================

      else {
        const [inserted] =
          await conn.query(
            `
              INSERT INTO ai_evaluations
              (
                submission_id,
                reviewed_by,
                total_teacher_score,
                status,
                teacher_comment,

                strengths,
                areas_for_improvement,
                recommendations,
                suggested_next_steps,

                reviewed_at
              )

              VALUES
              (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
              )
            `,
            [
              id,

              req.user.sub,

              final_score ?? null,

              evalStatus,

              teacher_feedback || null,

              strengths || null,

              areas_for_improvement ||
                null,

              recommendations ||
                null,

              suggested_next_steps ||
                null,

              normalizedAction === 'save'
                ? null
                : new Date(),
            ]
          );

        aiEvaluationId =
          inserted.insertId;
      }

      // ===================================================
      // CRITERION SCORES
      // ===================================================

      for (const cs of criteria_scores) {
        if (!cs.criterion_id) {
          continue;
        }

        await conn.query(
          `
            INSERT INTO criterion_scores
            (
              ai_evaluation_id,
              criterion_id,
              ai_recommended_score,
              ai_rationale,
              teacher_final_score
            )

            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?
            )

            ON DUPLICATE KEY UPDATE
              teacher_final_score =
                VALUES(teacher_final_score),

              ai_rationale =
                COALESCE(
                  VALUES(ai_rationale),
                  ai_rationale
                )
          `,
          [
            aiEvaluationId,

            cs.criterion_id,

            cs.ai_recommended_score ??
              0,

            cs.ai_rationale ??
              null,

            cs.teacher_final_score ??
              null,
          ]
        );
      }

      // ===================================================
      // CHECKLIST RESULTS
      // ===================================================

      for (const cr of checklist_results) {
        if (
          !cr.checklist_criterion_id
        ) {
          continue;
        }

        await conn.query(
          `
            INSERT INTO assessment_checklist_results
            (
              ai_evaluation_id,
              checklist_criterion_id,

              teacher_yes_no_value,
              teacher_score_value,
              teacher_text_value,
              teacher_feedback
            )

            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?
            )

            ON DUPLICATE KEY UPDATE
              teacher_yes_no_value =
                VALUES(teacher_yes_no_value),

              teacher_score_value =
                VALUES(teacher_score_value),

              teacher_text_value =
                VALUES(teacher_text_value),

              teacher_feedback =
                VALUES(teacher_feedback)
          `,
          [
            aiEvaluationId,

            cr.checklist_criterion_id,

            cr.teacher_yes_no_value ===
            undefined
              ? null
              : cr.teacher_yes_no_value,

            cr.teacher_score_value ===
            undefined
              ? null
              : cr.teacher_score_value,

            cr.teacher_text_value ===
            undefined
              ? null
              : cr.teacher_text_value,

            cr.teacher_feedback ===
            undefined
              ? null
              : cr.teacher_feedback,
          ]
        );
      }

      // ===================================================
      // SUBMISSION STATUS
      // ===================================================

      const submissionStatus =
        normalizedAction === 'approved'
          ? 'approved'
          : normalizedAction === 'rejected'
          ? 'rejected'
          : 'teacher_reviewed';

      await conn.query(
        `
          UPDATE assessment_submissions

          SET status = ?

          WHERE id = ?
        `,
        [
          submissionStatus,
          id,
        ]
      );

      // ===================================================
      // APPROVED SCORE
      // ===================================================

      if (
        normalizedAction ===
          'approved' &&
        final_score !== undefined
      ) {

        // -------------------------------------------------
        // TEAM SUBMISSION
        // -------------------------------------------------

        if (submission.team_id) {
          const [teamMembers] =
            await conn.query(
              `
                SELECT student_id
                FROM team_members
                WHERE team_id = ?
              `,
              [submission.team_id]
            );

          for (const member of teamMembers) {
            await conn.query(
              `
                INSERT INTO assessment_scores
                (
                  assessment_id,
                  student_id,
                  submission_id,
                  score,
                  feedback
                )

                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?
                )

                ON DUPLICATE KEY UPDATE
                  submission_id =
                    VALUES(submission_id),

                  score =
                    VALUES(score),

                  feedback =
                    VALUES(feedback),

                  evaluated_at =
                    NOW()
              `,
              [
                submission.assessment_id,

                member.student_id,

                id,

                final_score,

                teacher_feedback ||
                  null,
              ]
            );

            if (
              teacher_feedback
            ) {
              await conn.query(
                `
                  INSERT INTO teacher_feedback
                  (
                    student_id,
                    teacher_id,
                    assessment_id,
                    content
                  )

                  VALUES
                  (
                    ?,
                    ?,
                    ?,
                    ?
                  )
                `,
                [
                  member.student_id,

                  req.user.sub,

                  submission.assessment_id,

                  teacher_feedback,
                ]
              );
            }
          }
        }

        // -------------------------------------------------
        // INDIVIDUAL SUBMISSION
        // -------------------------------------------------

        else if (
          submission.student_id
        ) {
          await conn.query(
            `
              INSERT INTO assessment_scores
              (
                assessment_id,
                student_id,
                submission_id,
                score,
                feedback
              )

              VALUES
              (
                ?,
                ?,
                ?,
                ?,
                ?
              )

              ON DUPLICATE KEY UPDATE
                submission_id =
                  VALUES(submission_id),

                score =
                  VALUES(score),

                feedback =
                  VALUES(feedback),

                evaluated_at =
                  NOW()
            `,
            [
              submission.assessment_id,

              submission.student_id,

              id,

              final_score,

              teacher_feedback ||
                null,
            ]
          );

          if (
            teacher_feedback
          ) {
            await conn.query(
              `
                INSERT INTO teacher_feedback
                (
                  student_id,
                  teacher_id,
                  assessment_id,
                  content
                )

                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?
                )
              `,
              [
                submission.student_id,

                req.user.sub,

                submission.assessment_id,

                teacher_feedback,
              ]
            );
          }
        }
      }

      // ===================================================
      // COMMIT
      // ===================================================

      await conn.commit();

      const [updated] =
        await pool.query(
          `
            SELECT *
            FROM assessment_submissions
            WHERE id = ?
          `,
          [id]
        );

      res.json({
        success: true,

        message:
          normalizedAction === 'save'
            ? 'Draft evaluation saved'
            : `Evaluation ${normalizedAction}`,

        data: updated[0],
      });

    } catch (e) {
      await conn.rollback();
      throw e;

    } finally {
      conn.release();
    }
  });


// =========================================================
// REQUEST RESUBMISSION
// =========================================================

export const requestResubmission =
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { teacher_feedback } =
      req.body;

    if (
      req.user.role !== 'teacher' &&
      req.user.role !== 'admin'
    ) {
      throw new ApiError(
        403,
        'Only teachers can request a resubmission'
      );
    }

    // =====================================================
    // GET SUBMISSION
    // =====================================================

    const [rows] =
      await pool.query(
        `
          SELECT
            s.id,
            s.student_id,
            s.team_id,
            s.assessment_id,

            a.group_id,
            a.submission_mode

          FROM assessment_submissions s

          JOIN assessments a
            ON a.id = s.assessment_id

          WHERE s.id = ?
        `,
        [id]
      );

    if (!rows.length) {
      throw new ApiError(
        404,
        'Submission not found'
      );
    }

    const submission =
      rows[0];

    // =====================================================
    // TEACHER ACCESS
    // =====================================================

    if (
      req.user.role === 'teacher' &&
      !(await teacherOwnsGroup(
        req.user.sub,
        submission.group_id
      ))
    ) {
      throw new ApiError(
        403,
        'You are not assigned to this group'
      );
    }

    // =====================================================
    // TARGET SUBMISSIONS
    // =====================================================

    let targetSubmissionIds = [
      submission.id,
    ];

    // -----------------------------------------------------
    // TEAM
    // -----------------------------------------------------

    if (
      submission.submission_mode ===
      'team'
    ) {

      if (submission.team_id) {
        const [siblingRows] =
          await pool.query(
            `
              SELECT id
              FROM assessment_submissions

              WHERE assessment_id = ?
                AND team_id = ?
            `,
            [
              submission.assessment_id,
              submission.team_id,
            ]
          );

        if (siblingRows.length) {
          targetSubmissionIds =
            siblingRows.map(
              (row) => row.id
            );
        }
      }
    }

    // =====================================================
    // RESUBMISSION COMMENT
    // =====================================================

    const comment =
      teacher_feedback?.trim()
        ? `[RESUBMISSION_REQUESTED] ${teacher_feedback.trim()}`
        : '[RESUBMISSION_REQUESTED] Your teacher has requested that you resubmit this assignment.';

    // =====================================================
    // TRANSACTION
    // =====================================================

    const conn =
      await pool.getConnection();

    try {
      await conn.beginTransaction();

      for (const targetId of targetSubmissionIds) {
        const [evalRows] =
          await conn.query(
            `
              SELECT id

              FROM ai_evaluations

              WHERE submission_id = ?

              ORDER BY id DESC

              LIMIT 1
            `,
            [targetId]
          );

        // -------------------------------------------------
        // UPDATE EXISTING EVALUATION
        // -------------------------------------------------

        if (evalRows.length) {
          await conn.query(
            `
              UPDATE ai_evaluations

              SET
                status = 'rejected',

                teacher_comment = ?,

                reviewed_by = ?,

                reviewed_at = NOW()

              WHERE id = ?
            `,
            [
              comment,

              req.user.sub,

              evalRows[0].id,
            ]
          );
        }

        // -------------------------------------------------
        // CREATE REJECTED EVALUATION
        // -------------------------------------------------

        else {
          await conn.query(
            `
              INSERT INTO ai_evaluations
              (
                submission_id,
                reviewed_by,
                status,
                teacher_comment,
                reviewed_at
              )

              VALUES
              (
                ?,
                ?,
                'rejected',
                ?,
                NOW()
              )
            `,
            [
              targetId,

              req.user.sub,

              comment,
            ]
          );
        }

        // -------------------------------------------------
        // MARK SUBMISSION REJECTED
        // -------------------------------------------------

        await conn.query(
          `
            UPDATE assessment_submissions

            SET status = 'rejected'

            WHERE id = ?
          `,
          [targetId]
        );
      }

      await conn.commit();

      res.json({
        success: true,

        message:
          'Resubmission requested',

        data: {
          id,

          status: 'rejected',

          resubmission_requested:
            true,
        },
      });

    } catch (e) {
      await conn.rollback();
      throw e;

    } finally {
      conn.release();
    }
  });