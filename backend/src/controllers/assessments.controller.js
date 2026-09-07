import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { teacherOwnsGroup } from '../utils/scope.js';

function normalizeDate(dateStr) {
if (!dateStr || typeof dateStr !== 'string') return null;

const trimmed = dateStr.trim();

if (!trimmed) return null;

const ymdMatch = trimmed.match(
/^(\d{4})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/
);

if (ymdMatch) {
const year = ymdMatch[1];
const month = ymdMatch[2].padStart(2, '0');
const day = ymdMatch[3].padStart(2, '0');

return `${year}-${month}-${day}`;

}

const dmyMatch = trimmed.match(
/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{4})/
);

if (dmyMatch) {
const day = dmyMatch[1].padStart(2, '0');
const month = dmyMatch[2].padStart(2, '0');
const year = dmyMatch[3];

return `${year}-${month}-${day}`;

}

const date = new Date(trimmed);

if (!Number.isNaN(date.getTime())) {
return date.toISOString().split('T')[0];
}

return null;
}

function validateAssignmentCriteria(criteria) {
if (!Array.isArray(criteria)) {
return;
}

for (const criterion of criteria) {
if (!criterion.name || !String(criterion.name).trim()) {
throw new ApiError(
400,
'Each assignment evaluation criterion must have a name'
);
}

if (
  !['yes_no', 'score', 'text'].includes(
    criterion.criterion_type
  )
) {
  throw new ApiError(
    400,
    'Criterion type must be yes_no, score, or text'
  );
}

if (
  criterion.criterion_type === 'score' &&
  (
    criterion.max_score === undefined ||
    criterion.max_score === null ||
    Number(criterion.max_score) <= 0
  )
) {
  throw new ApiError(
    400,
    'Score criteria must have a max_score greater than 0'
  );
}

}
}

function validateChecklistCriteria(criteria) {
if (!Array.isArray(criteria)) {
return;
}

for (const criterion of criteria) {
if (!criterion.name || !String(criterion.name).trim()) {
throw new ApiError(
400,
'Each checklist criterion must have a name'
);
}

if (
  !['yes_no', 'score', 'text'].includes(
    criterion.criterion_type
  )
) {
  throw new ApiError(
    400,
    'Checklist criterion type must be yes_no, score, or text'
  );
}

if (
  criterion.criterion_type === 'score' &&
  (
    criterion.max_score === undefined ||
    criterion.max_score === null ||
    Number(criterion.max_score) <= 0
  )
) {
  throw new ApiError(
    400,
    'Score checklist criteria must have a max_score greater than 0'
  );
}

}
}

// ============================================================
// GET /api/assessments
// Optional: ?group_id=...
// ============================================================

export const getAllAssessments = asyncHandler(async (req, res) => {
const { group_id } = req.query;

let query = `     SELECT
      a.*,
      sg.name AS group_name,
      c.name AS course_name
    FROM assessments a
    LEFT JOIN student_groups sg
      ON a.group_id = sg.id
    LEFT JOIN courses c
      ON sg.course_id = c.id
    WHERE 1 = 1
  `;

const params = [];

if (req.user.role === 'teacher') {
query += `       AND EXISTS (
        SELECT 1
        FROM group_teachers gt
        WHERE gt.group_id = a.group_id
          AND gt.teacher_id = ?
      )
    `;

params.push(req.user.sub);

}

if (req.user.role === 'student') {
query += `       AND EXISTS (
        SELECT 1
        FROM group_students gs
        WHERE gs.group_id = a.group_id
          AND gs.student_id = ?
      )
    `;

params.push(req.user.sub);

}

if (group_id) {
query += `       AND a.group_id = ?
    `;

params.push(group_id);

}

query += `     ORDER BY a.id DESC
  `;

const [assessments] = await pool.query(query, params);

res.status(200).json({
success: true,
count: assessments.length,
data: assessments
});
});

// ============================================================
// GET /api/assessments/student
// Student'ın kendi assessment'ları
// ============================================================

export const getStudentAssessments = asyncHandler(async (req, res) => {
const studentId = req.user.sub;

if (req.user.role !== 'student') {
throw new ApiError(
403,
'Only students can access student assessments'
);
}

const [rows] = await pool.query(
`
SELECT
a.id,
a.group_id,
a.title,
a.description,
a.type,
a.submission_mode,
a.repo_slug,
a.due_date,
a.assessment_date,
a.max_score,

    sg.name AS group_name,
    c.name AS course_name,

    s.id AS submission_id,
    s.status AS submission_status,
    s.github_url,
    s.submitted_at,
    s.ai_score,
    s.ai_feedback,

    submitter.name AS submitted_by_name,

CASE
  WHEN latest_eval.teacher_comment LIKE '[RESUBMISSION_REQUESTED]%'
  THEN TRIM(SUBSTRING(latest_eval.teacher_comment, LENGTH('[RESUBMISSION_REQUESTED]') + 1))
  ELSE NULL
END AS resubmission_comment,

CASE
  WHEN latest_eval.teacher_comment LIKE '[RESUBMISSION_REQUESTED]%'
  THEN TRUE
  ELSE FALSE
END AS resubmission_requested,

CASE
  WHEN s.status = 'rejected'
    AND (latest_eval.teacher_comment IS NULL OR latest_eval.teacher_comment NOT LIKE '[RESUBMISSION_REQUESTED]%')
  THEN latest_eval.teacher_comment
  ELSE NULL
END AS rejection_comment
  FROM assessments a

  INNER JOIN student_groups sg
    ON sg.id = a.group_id

  INNER JOIN courses c
    ON c.id = sg.course_id

  INNER JOIN group_students gs
    ON gs.group_id = a.group_id
    AND gs.student_id = ?

  LEFT JOIN assessment_submissions s
    ON s.assessment_id = a.id
    AND s.student_id = ?

  LEFT JOIN users submitter
    ON submitter.id = s.submitted_by

  LEFT JOIN ai_evaluations latest_eval
    ON latest_eval.id = (
      SELECT ae.id
      FROM ai_evaluations ae
      WHERE ae.submission_id = s.id
      ORDER BY ae.id DESC
      LIMIT 1
    )
    AND s.status = 'rejected'

  ORDER BY a.due_date ASC, a.id DESC
`,
[studentId, studentId]

);

res.json({
success: true,
count: rows.length,
data: rows
});
});

export const getAssessments = getAllAssessments;

// ============================================================
// GET /api/assessments/:id
// ============================================================

export const getAssessmentById = asyncHandler(async (req, res) => {
const { id } = req.params;

const [assessmentRows] = await pool.query(
`       SELECT
        a.*,
        sg.name AS group_name,
        c.name AS course_name
      FROM assessments a
      LEFT JOIN student_groups sg
        ON a.group_id = sg.id
      LEFT JOIN courses c
        ON sg.course_id = c.id
      WHERE a.id = ?
        AND (
          ? <> 'teacher'
          OR EXISTS (
            SELECT 1
            FROM group_teachers gt
            WHERE gt.group_id = a.group_id
              AND gt.teacher_id = ?
          )
        )
    `,
[id, req.user.role, req.user.sub]
);

if (assessmentRows.length === 0) {
throw new ApiError(404, 'Assessment not found');
}

// Yeni supervisor-style assignment evaluation criteria
const [assignmentCriteria] = await pool.query(
`       SELECT
        id,
        assessment_id,
        name,
        description,
        criterion_type,
        max_score,
        sort_order
      FROM assignment_evaluation_criteria
      WHERE assessment_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
[id]
);

const [checklistCriteria] = await pool.query(
`       SELECT
        id,
        assessment_id,
        source_template_item_id,
        name,
        description,
        criterion_type,
        max_score,
        sort_order
      FROM assessment_checklist_criteria
      WHERE assessment_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
[id]
);

res.status(200).json({
success: true,
data: {
...assessmentRows[0],
assignment_evaluation_criteria: assignmentCriteria,
checklist_criteria: checklistCriteria
}
});
});
export const getAssessmentReport = asyncHandler(async (req, res) => {
  const { id } = req.params

  // Assessment bilgisi + teacher yetkisi
  const [assessmentRows] = await pool.query(
    `
    SELECT
      a.id,
      a.title,
      a.max_score,
      a.group_id
    FROM assessments a
    WHERE a.id = ?
    `,
    [id]
  )

  if (!assessmentRows.length) {
    throw new ApiError(404, 'Assessment not found')
  }

  const assessment = assessmentRows[0]

  // Teacher sadece kendi grubunun assessment'ını görebilsin
  if (
    req.user.role === 'teacher' &&
    !(await teacherOwnsGroup(req.user.sub, assessment.group_id))
  ) {
    throw new ApiError(403, 'You do not have access to this assessment')
  }

  // --------------------------------------------------
  // GROUP STUDENT COUNT
  // --------------------------------------------------

const [studentCountRows] = await pool.query(
  `
  SELECT COUNT(DISTINCT gs.student_id) AS total_students
  FROM group_students gs
  WHERE gs.group_id = ?
  `,
  [assessment.group_id]
)

const totalStudents = Number(
  studentCountRows[0]?.total_students || 0
)
  // --------------------------------------------------
  // SUBMISSION + SCORE DATA
  // --------------------------------------------------

  const [rows] = await pool.query(
    `
    SELECT
      s.id,
      s.student_id,
      s.status,

      ae.total_ai_score,
      ae.total_teacher_score

    FROM assessment_submissions s

    LEFT JOIN ai_evaluations ae
      ON ae.id = (
        SELECT id
        FROM ai_evaluations
        WHERE submission_id = s.id
        ORDER BY id DESC
        LIMIT 1
      )

    WHERE s.assessment_id = ?
    `,
    [id]
  )

  const submitted = rows.filter(
    (row) => row.status !== 'not_started'
  )

  const scored = rows.filter(
    (row) =>
      row.total_teacher_score !== null &&
      row.total_teacher_score !== undefined
  )

  const scores = scored.map((row) =>
    Number(row.total_teacher_score)
  )

  const aiScores = rows
    .filter(
      (row) =>
        row.total_ai_score !== null &&
        row.total_ai_score !== undefined
    )
    .map((row) => Number(row.total_ai_score))

  // --------------------------------------------------
  // STATISTICS
  // --------------------------------------------------

  const averageScore =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0

  const highestScore =
    scores.length > 0
      ? Math.max(...scores)
      : 0

  const lowestScore =
    scores.length > 0
      ? Math.min(...scores)
      : 0

  const averageAiScore =
    aiScores.length > 0
      ? aiScores.reduce((sum, score) => sum + score, 0) / aiScores.length
      : 0

  const submittedStudents = rows.length

  const pendingStudents = Math.max(
    totalStudents - submittedStudents,
    0
  )

  // Pass threshold: %50
  const passScore = Number(assessment.max_score) * 0.5

  const passedStudents = scores.filter(
    (score) => score >= passScore
  ).length

  const passRate =
    scores.length > 0
      ? (passedStudents / scores.length) * 100
      : 0

  // --------------------------------------------------
  // SCORE DISTRIBUTION
  // --------------------------------------------------

  const distribution = {
    '0-25': 0,
    '26-50': 0,
    '51-75': 0,
    '76-100': 0,
  }

  scores.forEach((score) => {
    // score'u max_score üzerinden yüzdeye çeviriyoruz
    const percentage =
      assessment.max_score > 0
        ? (score / assessment.max_score) * 100
        : 0

    if (percentage <= 25) {
      distribution['0-25']++
    } else if (percentage <= 50) {
      distribution['26-50']++
    } else if (percentage <= 75) {
      distribution['51-75']++
    } else {
      distribution['76-100']++
    }
  })

  // --------------------------------------------------
  // RESPONSE
  // --------------------------------------------------

  res.json({
    success: true,

    data: {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        max_score: Number(assessment.max_score),
      },

      overview: {
        total_students: totalStudents,
        submitted_students: submittedStudents,
        pending_students: pendingStudents,

        average_score: Number(averageScore.toFixed(1)),
        highest_score: highestScore,
        lowest_score: lowestScore,

        passed_students: passedStudents,
        pass_rate: Number(passRate.toFixed(1)),
      },

      ai_vs_teacher: {
        average_ai_score: Number(averageAiScore.toFixed(1)),
        average_teacher_score: Number(
          averageScore.toFixed(1)
        ),
        difference: Number(
          (averageScore - averageAiScore).toFixed(1)
        ),
      },

      score_distribution: distribution,
    },
  })
})
// ============================================================
// POST /api/assessments
// ============================================================

export const createAssessment = asyncHandler(async (req, res) => {
const {
group_id,
title,
description,
type = 'assignment',
submission_mode = 'individual',
repo_slug,
due_date,
assessment_date,
max_score = 100,

assignment_evaluation_criteria = [],

criteria_template_id = null,
checklist_criteria

} = req.body;

const created_by = req.user.sub;

if (!group_id || !title || !String(title).trim()) {
throw new ApiError(
400,
'Group ID and assessment title are required'
);
}

const [groupExists] = await pool.query(
`       SELECT id
      FROM student_groups
      WHERE id = ?
    `,
[group_id]
);

if (groupExists.length === 0) {
throw new ApiError(404, 'Student group not found');
}

if (req.user.role === 'teacher') {
const isOwned = await teacherOwnsGroup(
req.user.sub,
group_id
);

if (!isOwned) {
  throw new ApiError(
    403,
    'You are not assigned to this group'
  );
}

}

validateAssignmentCriteria(
assignment_evaluation_criteria
);

if (checklist_criteria !== undefined) {
validateChecklistCriteria(checklist_criteria);
}

const cleanDueDate = normalizeDate(due_date);

const cleanAssessmentDate =
normalizeDate(assessment_date);

const connection = await pool.getConnection();

try {
await connection.beginTransaction();

const [result] = await connection.query(
  `
    INSERT INTO assessments (
      group_id,
      title,
      description,
      type,
      submission_mode,
      repo_slug,
      due_date,
      assessment_date,
      max_score,
      created_by,
      criteria_template_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    group_id,
    String(title).trim(),
    description?.trim() || null,
    type,
    submission_mode,
    repo_slug?.trim() || null,
    cleanDueDate,
    cleanAssessmentDate,
    max_score,
    created_by,
    criteria_template_id || null
  ]
);

const assessmentId = result.insertId;


if (
  Array.isArray(assignment_evaluation_criteria)
) {
  for (
    let i = 0;
    i < assignment_evaluation_criteria.length;
    i++
  ) {
    const criterion =
      assignment_evaluation_criteria[i];

    await connection.query(
      `
        INSERT INTO assignment_evaluation_criteria (
          assessment_id,
          name,
          description,
          criterion_type,
          max_score,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        assessmentId,
        String(criterion.name).trim(),
        criterion.description?.trim() || null,
        criterion.criterion_type,
        criterion.criterion_type === 'score'
          ? Number(criterion.max_score)
          : null,
        criterion.sort_order ?? i + 1
      ]
    );
  }
}



let checklistRowsToInsert = null;

if (Array.isArray(checklist_criteria)) {
  checklistRowsToInsert = checklist_criteria.map((c, i) => ({
    source_template_item_id: c.source_template_item_id || null,
    name: String(c.name).trim(),
    description: c.description?.trim() || null,
    criterion_type: c.criterion_type,
    max_score:
      c.criterion_type === 'score'
        ? Number(c.max_score)
        : null,
    sort_order: c.sort_order ?? i + 1,
  }));
} else if (criteria_template_id) {
  const [templateItems] = await connection.query(
    `
      SELECT id, name, description, criterion_type, max_score, sort_order
      FROM criteria_template_items
      WHERE template_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    [criteria_template_id]
  );

  checklistRowsToInsert = templateItems.map((item) => ({
    source_template_item_id: item.id,
    name: item.name,
    description: item.description,
    criterion_type: item.criterion_type,
    max_score: item.max_score,
    sort_order: item.sort_order,
  }));
}

if (checklistRowsToInsert) {
  for (const row of checklistRowsToInsert) {
    await connection.query(
      `
        INSERT INTO assessment_checklist_criteria (
          assessment_id,
          source_template_item_id,
          name,
          description,
          criterion_type,
          max_score,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        assessmentId,
        row.source_template_item_id,
        row.name,
        row.description,
        row.criterion_type,
        row.max_score,
        row.sort_order,
      ]
    );
  }
}

await connection.commit();

const [newAssessmentRows] = await pool.query(
  `
    SELECT *
    FROM assessments
    WHERE id = ?
  `,
  [assessmentId]
);

const [savedCriteria] = await pool.query(
  `
    SELECT *
    FROM assignment_evaluation_criteria
    WHERE assessment_id = ?
    ORDER BY sort_order ASC, id ASC
  `,
  [assessmentId]
);

const [savedChecklistCriteria] = await pool.query(
  `
    SELECT *
    FROM assessment_checklist_criteria
    WHERE assessment_id = ?
    ORDER BY sort_order ASC, id ASC
  `,
  [assessmentId]
);

res.status(201).json({
  success: true,
  message: 'Assessment created successfully',
  data: {
    ...newAssessmentRows[0],
    assignment_evaluation_criteria: savedCriteria,
    checklist_criteria: savedChecklistCriteria
  }
});

} catch (error) {
await connection.rollback();
throw error;

} finally {
connection.release();
}
});

// ============================================================
// PUT /api/assessments/:id
// ============================================================

export const updateAssessment = asyncHandler(async (req, res) => {
const { id } = req.params;

const {
group_id,
title,
description,
type,
submission_mode,
repo_slug,
due_date,
assessment_date,
max_score,

assignment_evaluation_criteria,

criteria_template_id,
checklist_criteria

} = req.body;

const [existingRows] = await pool.query(
`       SELECT
        a.id,
        a.group_id
      FROM assessments a
      WHERE a.id = ?
        AND (
          ? <> 'teacher'
          OR EXISTS (
            SELECT 1
            FROM group_teachers gt
            WHERE gt.group_id = a.group_id
              AND gt.teacher_id = ?
          )
        )
    `,
[id, req.user.role, req.user.sub]
);

if (existingRows.length === 0) {
throw new ApiError(404, 'Assessment not found');
}

const existing = existingRows[0];

const targetGroupId =
group_id !== undefined
? group_id
: existing.group_id;

if (req.user.role === 'teacher') {
const isOwned = await teacherOwnsGroup(
req.user.sub,
targetGroupId
);

if (!isOwned) {
  throw new ApiError(
    403,
    'You are not assigned to this group'
  );
}

}

if (
assignment_evaluation_criteria !== undefined
) {
validateAssignmentCriteria(
assignment_evaluation_criteria
);
}

if (checklist_criteria !== undefined) {
validateChecklistCriteria(checklist_criteria);
}

const cleanDueDate =
due_date !== undefined
? normalizeDate(due_date)
: undefined;

const cleanAssessmentDate =
assessment_date !== undefined
? normalizeDate(assessment_date)
: undefined;

const connection = await pool.getConnection();

try {
await connection.beginTransaction();

const [currentRows] = await connection.query(
  `
    SELECT *
    FROM assessments
    WHERE id = ?
  `,
  [id]
);

const current = currentRows[0];

await connection.query(
  `
    UPDATE assessments
    SET
      group_id = ?,
      title = ?,
      description = ?,
      type = ?,
      submission_mode = ?,
      repo_slug = ?,
      due_date = ?,
      assessment_date = ?,
      max_score = ?,
      criteria_template_id = ?
    WHERE id = ?
  `,
  [
    group_id !== undefined
      ? group_id
      : current.group_id,

    title !== undefined
      ? String(title).trim()
      : current.title,

    description !== undefined
      ? description?.trim() || null
      : current.description,

    type !== undefined
      ? type
      : current.type,

    submission_mode !== undefined
      ? submission_mode
      : current.submission_mode,

    repo_slug !== undefined
      ? repo_slug?.trim() || null
      : current.repo_slug,

    cleanDueDate !== undefined
      ? cleanDueDate
      : current.due_date,

    cleanAssessmentDate !== undefined
      ? cleanAssessmentDate
      : current.assessment_date,

    max_score !== undefined
      ? max_score
      : current.max_score,

    criteria_template_id !== undefined
      ? criteria_template_id
      : current.criteria_template_id,

    id
  ]
);


if (
  Array.isArray(assignment_evaluation_criteria)
) {
  await connection.query(
    `
      DELETE FROM assignment_evaluation_criteria
      WHERE assessment_id = ?
    `,
    [id]
  );

  for (
    let i = 0;
    i < assignment_evaluation_criteria.length;
    i++
  ) {
    const criterion =
      assignment_evaluation_criteria[i];

    await connection.query(
      `
        INSERT INTO assignment_evaluation_criteria (
          assessment_id,
          name,
          description,
          criterion_type,
          max_score,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        String(criterion.name).trim(),
        criterion.description?.trim() || null,
        criterion.criterion_type,
        criterion.criterion_type === 'score'
          ? Number(criterion.max_score)
          : null,
        criterion.sort_order ?? i + 1
      ]
    );
  }
}


if (Array.isArray(checklist_criteria)) {
  await connection.query(
    `
      DELETE FROM assessment_checklist_criteria
      WHERE assessment_id = ?
    `,
    [id]
  );

  for (
    let i = 0;
    i < checklist_criteria.length;
    i++
  ) {
    const criterion = checklist_criteria[i];

    await connection.query(
      `
        INSERT INTO assessment_checklist_criteria (
          assessment_id,
          source_template_item_id,
          name,
          description,
          criterion_type,
          max_score,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        criterion.source_template_item_id || null,
        String(criterion.name).trim(),
        criterion.description?.trim() || null,
        criterion.criterion_type,
        criterion.criterion_type === 'score'
          ? Number(criterion.max_score)
          : null,
        criterion.sort_order ?? i + 1
      ]
    );
  }
}

await connection.commit();

const [updatedRows] = await pool.query(
  `
    SELECT *
    FROM assessments
    WHERE id = ?
  `,
  [id]
);

const [updatedCriteria] = await pool.query(
  `
    SELECT *
    FROM assignment_evaluation_criteria
    WHERE assessment_id = ?
    ORDER BY sort_order ASC, id ASC
  `,
  [id]
);

const [updatedChecklistCriteria] = await pool.query(
  `
    SELECT *
    FROM assessment_checklist_criteria
    WHERE assessment_id = ?
    ORDER BY sort_order ASC, id ASC
  `,
  [id]
);

res.status(200).json({
  success: true,
  message: 'Assessment updated successfully',
  data: {
    ...updatedRows[0],
    assignment_evaluation_criteria:
      updatedCriteria,
    checklist_criteria:
      updatedChecklistCriteria
  }
});

} catch (error) {
await connection.rollback();
throw error;

} finally {
connection.release();
}
});

// ============================================================
// DELETE /api/assessments/:id
// ============================================================

export const deleteAssessment = asyncHandler(async (req, res) => {
const { id } = req.params;

const [existingRows] = await pool.query(
`       SELECT
        id,
        group_id
      FROM assessments
      WHERE id = ?
    `,
[id]
);

if (existingRows.length === 0) {
throw new ApiError(
404,
'Assessment not found'
);
}

const existing = existingRows[0];

if (req.user.role === 'teacher') {
const isOwned = await teacherOwnsGroup(
req.user.sub,
existing.group_id
);

if (!isOwned) {
  throw new ApiError(
    403,
    'You are not assigned to this group'
  );
}

}

await pool.query(
`       DELETE FROM assessments
      WHERE id = ?
    `,
[id]
);

res.status(200).json({
success: true,
message: 'Assessment deleted successfully'
});
});