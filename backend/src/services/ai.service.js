import { GoogleGenAI } from '@google/genai';
import { pool } from '../config/db.js';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// GitHub API requests.
const GITHUB_HEADERS = process.env.GITHUB_TOKEN
  ? {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    }
  : {
      Accept: 'application/vnd.github+json',
    };

// Directories that should never be sent to Gemini.
const SKIP_DIR_SEGMENTS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'venv',
  '.venv',
  '__pycache__',
  'vendor',
  'coverage',
  '.idea',
  '.vscode',
];

// File types that can contain useful assignment evidence.
const SOURCE_EXTENSIONS = [
  '.py',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.java',
  '.rb',
  '.go',
  '.php',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.rs',
  '.sql',
  '.html',
  '.css',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.txt',
];

const MAX_FILES = 50;
const MAX_TOTAL_CHARS = 120000;
const MAX_FILE_CHARS = 15000;

function isRelevantPath(path) {
  const lower = path.toLowerCase();

  if (
    SKIP_DIR_SEGMENTS.some(
      (seg) =>
        lower.includes(`/${seg}/`) ||
        lower.startsWith(`${seg}/`)
    )
  ) {
    return false;
  }

  return SOURCE_EXTENSIONS.some((ext) =>
    lower.endsWith(ext)
  );
}

function filePriority(path) {
  const lower = path.toLowerCase();
  const base = lower.split('/').pop();

  if (
    base.startsWith('test_') ||
    base.endsWith('_test.py') ||
    base.endsWith('_test.js') ||
    base.endsWith('_test.ts') ||
    base.endsWith('.test.js') ||
    base.endsWith('.test.ts') ||
    base.endsWith('.test.jsx') ||
    base.endsWith('.test.tsx') ||
    base.endsWith('.spec.js') ||
    base.endsWith('.spec.ts') ||
    lower.includes('/tests/') ||
    lower.includes('/__tests__/') ||
    lower.includes('/spec/')
  ) {
    return 1000;
  }

  if (
    base === 'readme.md' ||
    base === 'readme.txt'
  ) {
    return 950;
  }

  if (
    [
      'package.json',
      'requirements.txt',
      'pyproject.toml',
      'pom.xml',
      'build.gradle',
      'composer.json',
      'cargo.toml',
    ].includes(base)
  ) {
    return 900;
  }

  if (
    [
      'main.py',
      'app.py',
      'index.py',
      'main.js',
      'app.js',
      'index.js',
      'server.js',
      'index.ts',
      'main.ts',
      'app.ts',
    ].includes(base)
  ) {
    return 850;
  }

  if (
    [
      '.py',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.java',
      '.cs',
      '.go',
      '.rb',
      '.php',
    ].some((ext) => lower.endsWith(ext))
  ) {
    return 700;
  }

  if (lower.endsWith('.sql')) return 650;
  if (lower.endsWith('.md')) return 500;
  if (lower.endsWith('.json')) return 450;

  return 300;
}

function selectRelevantPaths(tree) {
  return tree
    .map((f) => f.path)
    .filter(isRelevantPath)
    .sort((a, b) => {
      const priorityDiff =
        filePriority(b) - filePriority(a);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.localeCompare(b);
    })
    .slice(0, MAX_FILES);
}

async function resolveRef(owner, repo, requestedRef) {
  if (
    requestedRef &&
    requestedRef !== 'HEAD'
  ) {
    return requestedRef;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: GITHUB_HEADERS,
    }
  );

  if (!res.ok) {
    throw new Error(
      `Could not resolve repository (status ${res.status})`
    );
  }

  const data = await res.json();

  return data.default_branch || 'main';
}

async function fetchRepoTree(owner, repo, ref) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    {
      headers: GITHUB_HEADERS,
    }
  );

  if (!res.ok) {
    throw new Error(
      `Could not fetch repository tree (status ${res.status})`
    );
  }

  const data = await res.json();

  return (data.tree || []).filter(
    (f) => f.type === 'blob'
  );
}

async function fetchFileContents(
  owner,
  repo,
  ref,
  paths
) {
  const sections = [];
  let totalChars = 0;

  for (const path of paths) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      break;
    }

    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
        {
          headers: GITHUB_HEADERS,
        }
      );

      if (!res.ok) {
        console.warn(
          `[AI Service] Could not fetch file ${path}: ${res.status}`
        );
        continue;
      }

      let content = await res.text();

      if (content.length > MAX_FILE_CHARS) {
        content =
          content.slice(0, MAX_FILE_CHARS) +
          '\n...[truncated]';
      }

      sections.push(
        `----- FILE: ${path} -----\n${content}`
      );

      totalChars += content.length;
    } catch (error) {
      console.warn(
        `[AI Service] Failed to fetch ${path}:`,
        error.message
      );
    }
  }

  return sections.join('\n\n');
}

export const analyzeSubmissionWithGemini = async (
  submissionId,
  owner,
  repo,
  commitSha,
  submissionIds
) => {
  const targetSubmissionIds =
    Array.isArray(submissionIds) &&
    submissionIds.length
      ? [...new Set(submissionIds.map(Number))]
      : [Number(submissionId)];

  const connection =
    await pool.getConnection();

  let transactionStarted = false;

  try {
    console.log(
      `[AI Service] Starting Gemini analysis for submission ${submissionId} (${owner}/${repo})...`
    );

    // ---------------------------------------------------------
    // 1. Get submission + assessment
    // ---------------------------------------------------------

    const [subRows] =
      await connection.query(
        `SELECT
           s.*,
           a.title AS assessment_title,
           a.description AS assessment_desc
         FROM assessment_submissions s
         JOIN assessments a
           ON s.assessment_id = a.id
         WHERE s.id = ?`,
        [submissionId]
      );

    if (!subRows.length) {
      throw new Error(
        `Submission ${submissionId} not found`
      );
    }

    const submission = subRows[0];

    // ---------------------------------------------------------
    // 2. Get rubric criteria
    // ---------------------------------------------------------

    const [criteria] =
  await connection.query(
    `SELECT
       id,
       name,
       description,
       criterion_type,
       max_score,
       sort_order
     FROM assignment_evaluation_criteria
     WHERE assessment_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [submission.assessment_id]
  );

if (!criteria.length) {
  throw new Error(
    `No rubric criteria found for assessment ${submission.assessment_id}`
  );
}

    // ---------------------------------------------------------
    // 2b. Get supervisor checklist criteria (Chk-1, Chk-2, ...)
    //
    // Entirely separate table chain from the rubric above
    // (assessment_checklist_criteria / assessment_checklist_results).
    // Not every assessment has checklist criteria — only ones
    // created from a criteria template — so this can be empty.
    // ---------------------------------------------------------

    const [checklistCriteria] =
      await connection.query(
        `SELECT
           id,
           name,
           description,
           criterion_type,
           max_score,
           sort_order
         FROM assessment_checklist_criteria
         WHERE assessment_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [submission.assessment_id]
      );

    const hasChecklist = checklistCriteria.length > 0;

    // ---------------------------------------------------------
    // 3. Get competencies
    // ---------------------------------------------------------

    const [competencies] =
      await connection.query(
        `SELECT
           c.id,
           c.name,
           c.description,
           COALESCE(sc.score, 0) AS current_score
         FROM competencies c
         LEFT JOIN student_competencies sc
           ON sc.competency_id = c.id
          AND sc.student_id = ?
         ORDER BY c.id`,
        [submission.student_id]
      );

    // ---------------------------------------------------------
    // 4. Fetch repository at EXACT commit
    // ---------------------------------------------------------

    const ref = await resolveRef(
      owner,
      repo,
      commitSha
    );

    let fileListSummary = 'No files found';
    let codeContext =
      '(no source files could be retrieved)';
    let relevantPaths = [];
    let repoFetchFailed = false;

    try {
      const tree =
        await fetchRepoTree(
          owner,
          repo,
          ref
        );

      fileListSummary =
        tree
          .map((f) => f.path)
          .join('\n') ||
        'No files found';

      relevantPaths =
        selectRelevantPaths(tree);

      console.log(
        `[AI DEBUG] Submission ${submissionId}`
      );

      console.log(
        `[AI DEBUG] Repository: ${owner}/${repo}`
      );

      console.log(
        `[AI DEBUG] Commit: ${ref}`
      );

      console.log(
        `[AI DEBUG] Selected files:`,
        relevantPaths
      );

      if (relevantPaths.length) {
        codeContext =
          await fetchFileContents(
            owner,
            repo,
            ref,
            relevantPaths
          );
      }

      console.log(
        `[AI DEBUG] Code context length:`,
        codeContext.length
      );

      console.log(
        `[AI DEBUG] Contains test_main.py:`,
        codeContext.includes(
          'FILE: test_main.py'
        )
      );
    } catch (treeErr) {
      console.error(
        `[AI Service] Repository fetch failed for submission ${submissionId}:`,
        treeErr.message
      );

      fileListSummary =
        'Could not fetch file tree.';

      repoFetchFailed = true;
    }

    // Never send an empty repository context to Gemini.
    if (
      repoFetchFailed ||
      (relevantPaths.length > 0 &&
        codeContext ===
          '(no source files could be retrieved)')
    ) {
      throw new Error(
        `Could not retrieve repository source for ${owner}/${repo}@${ref}. ` +
          `Aborting AI analysis instead of producing a misleading evaluation.`
      );
    }

    if (!relevantPaths.length) {
      throw new Error(
        `No relevant source files found in ${owner}/${repo}@${ref}`
      );
    }

    // ---------------------------------------------------------
    // 5. Gemini prompt
    // ---------------------------------------------------------

    const prompt = `
You are an expert software engineering professor evaluating a student's assignment.

Your evaluation MUST be based ONLY on the evidence provided in this prompt.

Do NOT invent anything.

==================================================
ASSIGNMENT
==================================================

Title:
${submission.assessment_title}

Description:
${submission.assessment_desc || 'N/A'}

==================================================
RUBRIC
==================================================

This RUBRIC is the ONLY thing the student's grade (total_score) is
based on. Nothing in the SUPERVISOR CHECKLIST section below affects
grading in any way.

${JSON.stringify(criteria, null, 2)}

${
  hasChecklist
    ? `==================================================
SUPERVISOR CHECKLIST
==================================================

This is a SEPARATE checklist from the RUBRIC above. It comes
from the course supervisor and uses three kinds of criteria:

- "yes_no"  -> answer must be true or false
- "score"   -> answer must be a number between 0 and max_score
- "text"    -> answer must be a short factual string describing
               what you found (e.g. what level was completed)

IMPORTANT — GRADING INDEPENDENCE:

This checklist has NOTHING to do with the student's grade.
total_score is computed ONLY from the RUBRIC above.

- Do NOT let a checklist result lower, raise, or otherwise
  influence any rubric criterion's score.
- Do NOT let a rubric score influence a checklist answer either.
- Evaluate the RUBRIC and the CHECKLIST as two fully independent
  tasks, each based only on its own evidence from the repository.
- The checklist exists purely so the supervisor/teacher can see
  informational pass/fail and progress data — it is never part
  of the student's grade.

${JSON.stringify(checklistCriteria, null, 2)}
`
    : ''
}

==================================================
CURRENT STUDENT COMPETENCIES
==================================================

${JSON.stringify(competencies, null, 2)}

==================================================
REPOSITORY
==================================================

Repository:
${owner}/${repo}

Commit:
${ref}

==================================================
COMPLETE REPOSITORY FILE LIST
==================================================

${fileListSummary}

==================================================
FILES PROVIDED TO YOU
==================================================

${relevantPaths.join('\n')}

==================================================
SOURCE CODE
==================================================

${codeContext}

==================================================
HARD REPOSITORY FACTS
==================================================

The repository file list above was mechanically obtained from the
GitHub repository at the exact commit being evaluated.

The repository file list is FACT.

A file EXISTS in this submission ONLY if its path appears in:

COMPLETE REPOSITORY FILE LIST

A file is ABSENT if its path does not appear there.

CRITICAL RULES:

1. NEVER claim that an absent file exists.

2. NEVER describe the contents of an absent file.

3. NEVER say that an absent file contains application code.

4. NEVER infer the contents of an absent file from the assignment description.

5. If the assignment requires a file that is absent, explicitly say:
   "The required file X is not present in the submitted repository."

6. If a file exists in the repository file list but its contents are
   not provided in SOURCE CODE, say that the file exists but its
   contents could not be inspected.

7. Only claim to have inspected a file when its actual contents are
   included in SOURCE CODE.

8. The assignment description describes EXPECTED requirements.
   It does NOT prove that the student implemented them.

9. The repository evidence describes what the student ACTUALLY submitted.

10. Never merge expected requirements with actual repository evidence.

==================================================
EVALUATION RULES
==================================================

1. Evaluate the student's ACTUAL submission.

2. Use the assignment description to understand what is required.

3. Use the rubric to determine how the work should be scored.

4. Use the repository file list to determine which files actually exist.

5. Use the source code to determine what is actually implemented.

6. Evaluate every rubric criterion independently.

7. For each criterion, identify actual repository evidence before assigning
   a score.

8. Do not give zero simply because evidence is incomplete.

9. However, if a required file or required functionality is clearly absent,
   that is valid evidence that the requirement is not satisfied.

10. If a requirement is partially satisfied, give partial credit.

11. Do not penalize the student because their implementation differs from
    an implementation you personally expected.

12. File names alone are not proof of functionality.

13. Source code is required to claim implementation behavior.

14. For testing criteria, inspect the actual test files and assertions.

15. For documentation criteria, inspect the actual README/documentation.

16. For implementation criteria, inspect actual source code.

17. Do not reuse the same generic rationale for multiple criteria.

18. Each rationale must explain the evidence relevant to that criterion.

19. Do not invent errors that are not visible in the source.

20. Do not claim tests were executed unless execution evidence is provided.

21. Do not claim functionality works unless the source evidence supports it.

==================================================
TESTING-SPECIFIC RULES
==================================================

When a criterion concerns tests:

1. First check whether the repository file list contains test files.

2. If no test file exists, say that the required test suite is absent.

3. If a test file exists, inspect its actual contents.

4. Determine whether it contains actual test cases.

5. Inspect assertions and tested behavior.

6. Do not call a source file a test file merely because its name suggests it.

7. Do not say "test_main.py contains application logic" unless:
   - test_main.py actually exists in the repository file list, AND
   - its actual contents are included in SOURCE CODE, AND
   - those contents demonstrably contain application logic.

8. If test_main.py does not exist, the correct statement is:
   "test_main.py is not present in the submitted repository."

==================================================
SCORING RULES
==================================================

For each criterion:

A. Understand the criterion.

B. Identify relevant repository evidence.

C. Determine whether the criterion is:
   - fully satisfied
   - partially satisfied
   - not satisfied

D. Assign an appropriate score.

E. Explain the decision using actual evidence.

The score MUST be between 0 and the criterion's max_score.

Never exceed max_score.

Do not give every criterion the same score unless the evidence genuinely
supports the same score.

total_score MUST equal the sum of all criteria scores.

${
  hasChecklist
    ? `==================================================
CHECKLIST RULES
==================================================

Evaluate every item in SUPERVISOR CHECKLIST independently, using
the same repository evidence rules as above (only claim what the
source code / file list actually shows).

For each checklist item, return one object in "checklist_results":

{
  "checklist_criterion_id": number,
  "yes_no_value": true | false | null,
  "score_value": number | null,
  "text_value": string | null,
  "feedback": string
}

Fill in ONLY the field matching that item's type and leave the
other two value fields null:
- "yes_no" item  -> set yes_no_value, leave score_value and text_value null
- "score" item   -> set score_value (0 to max_score), leave yes_no_value and text_value null
- "text" item    -> set text_value, leave yes_no_value and score_value null

"feedback" is always required: a short (one sentence) note citing
the evidence for your answer.

checklist_criterion_id MUST match an actual id from SUPERVISOR CHECKLIST.

The checklist_results array MUST contain exactly one item for every
checklist criterion, with no duplicates and no unknown ids.
`
    : ''
}

==================================================
COMPETENCY RULES
==================================================

Competency suggestions MUST be an array of objects.

Each object MUST have:

{
  "competency_id": number,
  "suggested_score": number,
  "reason": string
}

competency_id MUST correspond to an actual competency ID from
CURRENT STUDENT COMPETENCIES.

suggested_score must be a numeric score appropriate for that competency.

reason must explain why the competency is relevant to the student's
actual submission.

NEVER return competency names as strings.

If there are no appropriate competency suggestions, return:

[]

==================================================
FINAL RESPONSE FORMAT
==================================================

Return ONLY valid JSON.

{
  "total_score": 0,
  "meets_description": "",
  "strengths": "",
  "areas_for_improvement": "",
  "recommendations": "",
  "suggested_next_steps": "",
  "competency_suggestions": [],
  "criteria_scores": [
    {
      "criteria_id": 0,
      "score": 0,
      "rationale": ""
    }
  ]${
    hasChecklist
      ? `,
  "checklist_results": [
    {
      "checklist_criterion_id": 0,
      "yes_no_value": null,
      "score_value": null,
      "text_value": null,
      "feedback": ""
    }
  ]`
      : ''
  }
}

The criteria_scores array MUST:

- contain exactly one item for every rubric criterion
- use the actual criterion IDs
- contain no duplicate criterion IDs
- contain no unknown criterion IDs
- use scores between 0 and max_score
- contain a criterion-specific rationale

The final total_score MUST equal the sum of all criterion scores.
${
  hasChecklist
    ? `
The checklist_results array MUST:

- contain exactly one item for every checklist criterion
- use the actual checklist_criterion_id values
- contain no duplicate or unknown checklist_criterion_id values
- populate only the value field matching that item's type
`
    : ''
}
Before returning JSON, verify:

- Every rubric criterion appears exactly once.
- Every score is valid.
- total_score is correct.
- No absent file was described as existing.
- No absent file was described as containing code.
- No unsupported implementation claim was made.
- No unsupported test claim was made.
- Competency suggestions use valid competency IDs.${
  hasChecklist
    ? '\n- Every checklist criterion appears exactly once, with only the matching value field filled in.'
    : ''
}
`;

    // ---------------------------------------------------------
    // 6. Call Gemini
    // ---------------------------------------------------------

    const response =
      await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });

    const rawText =
      response.text?.trim() || '';

    if (!rawText) {
      throw new Error(
        'Gemini returned an empty response'
      );
    }

    const cleanJsonStr =
      rawText
        .replace(
          /^```json\s*/i,
          ''
        )
        .replace(
          /^```\s*/i,
          ''
        )
        .replace(
          /\s*```$/i,
          ''
        )
        .trim();

    let aiResult;

    try {
      aiResult =
        JSON.parse(cleanJsonStr);
    } catch (parseError) {
      console.error(
        '[AI Service] Invalid Gemini JSON:',
        rawText
      );

      throw new Error(
        `Gemini returned invalid JSON: ${parseError.message}`
      );
    }

    console.log(
      `[AI DEBUG] Gemini raw result for submission ${submissionId}:`,
      JSON.stringify(
        aiResult,
        null,
        2
      )
    );


    const freeTextFields = [
      'meets_description',
      'strengths',
      'areas_for_improvement',
      'recommendations',
      'suggested_next_steps',
    ];

    for (const field of freeTextFields) {
      const value = aiResult[field];

      if (
        value !== undefined &&
        value !== null &&
        typeof value !== 'string'
      ) {
        aiResult[field] = JSON.stringify(value);
      }
    }

    // ---------------------------------------------------------
    // 7. Validate AI response
    // ---------------------------------------------------------

    const criteriaById =
      new Map(
        criteria.map((c) => [
          Number(c.id),
          c,
        ])
      );

    if (
      !Array.isArray(
        aiResult.criteria_scores
      ) ||
      aiResult.criteria_scores.length !==
        criteria.length
    ) {
      throw new Error(
        `AI returned ${
          aiResult.criteria_scores?.length || 0
        } criteria for ${
          criteria.length
        } rubric criteria`
      );
    }

    const seenCriteria =
      new Set();

    for (
      const cs of
        aiResult.criteria_scores
    ) {
      const criterion =
        criteriaById.get(
          Number(cs.criteria_id)
        );

      if (
        !criterion ||
        seenCriteria.has(
          Number(cs.criteria_id)
        )
      ) {
        throw new Error(
          `AI returned an invalid or duplicate criterion id: ${cs.criteria_id}`
        );
      }

      seenCriteria.add(
        Number(cs.criteria_id)
      );

      const score =
        Number(cs.score);

      if (
        !Number.isFinite(score) ||
        score < 0 ||
        score >
          Number(criterion.max_score)
      ) {
        throw new Error(
          `AI returned an invalid score for criterion ${criterion.id}. ` +
            `AI score: ${cs.score}, max score: ${criterion.max_score}`
        );
      }

      if (
        !cs.rationale ||
        typeof cs.rationale !==
          'string' ||
        !cs.rationale.trim()
      ) {
        throw new Error(
          `AI returned no rationale for criterion ${criterion.id}`
        );
      }
    }

    if (
      seenCriteria.size !==
      criteria.length
    ) {
      throw new Error(
        'AI did not return every rubric criterion'
      );
    }

    aiResult.total_score =
      aiResult.criteria_scores.reduce(
        (sum, cs) =>
          sum + Number(cs.score),
        0
      );


    if (hasChecklist) {
      if (
        !Array.isArray(
          aiResult.checklist_results
        ) ||
        aiResult.checklist_results.length !==
          checklistCriteria.length
      ) {
        throw new Error(
          `AI returned ${
            aiResult.checklist_results?.length || 0
          } checklist results for ${
            checklistCriteria.length
          } checklist criteria`
        );
      }

      const checklistById = new Map(
        checklistCriteria.map((c) => [
          Number(c.id),
          c,
        ])
      );

      const seenChecklistIds = new Set();

      for (const cr of aiResult.checklist_results) {
        const criterion = checklistById.get(
          Number(cr.checklist_criterion_id)
        );

        if (
          !criterion ||
          seenChecklistIds.has(
            Number(cr.checklist_criterion_id)
          )
        ) {
          throw new Error(
            `AI returned an invalid or duplicate checklist criterion id: ${cr.checklist_criterion_id}`
          );
        }

        seenChecklistIds.add(
          Number(cr.checklist_criterion_id)
        );

        if (
          criterion.criterion_type === 'score' &&
          cr.score_value !== null &&
          cr.score_value !== undefined
        ) {
          const scoreValue = Number(cr.score_value);

          if (
            !Number.isFinite(scoreValue) ||
            scoreValue < 0 ||
            (criterion.max_score !== null &&
              scoreValue > Number(criterion.max_score))
          ) {
            throw new Error(
              `AI returned an invalid score for checklist criterion ${criterion.id}. ` +
                `AI score: ${cr.score_value}, max score: ${criterion.max_score}`
            );
          }
        }
      }

      if (seenChecklistIds.size !== checklistCriteria.length) {
        throw new Error(
          'AI did not return every checklist criterion'
        );
      }
    } else {
      aiResult.checklist_results = [];
    }

    // ---------------------------------------------------------
    // Validate competency suggestions
    // ---------------------------------------------------------

    if (
      aiResult.competency_suggestions ===
        undefined ||
      aiResult.competency_suggestions ===
        null
    ) {
      aiResult.competency_suggestions =
        [];
    }

    if (
      !Array.isArray(
        aiResult.competency_suggestions
      )
    ) {
      throw new Error(
        'AI returned invalid competency_suggestions format'
      );
    }

    const validCompetencyIds =
      new Set(
        competencies.map((c) =>
          Number(c.id)
        )
      );

    const normalizedCompetencySuggestions =
      [];

    for (
      const suggestion of
        aiResult.competency_suggestions
    ) {
      if (
        !suggestion ||
        typeof suggestion !==
          'object'
      ) {
        continue;
      }

      const competencyId =
        Number(
          suggestion.competency_id
        );

      if (
        !Number.isInteger(
          competencyId
        ) ||
        !validCompetencyIds.has(
          competencyId
        )
      ) {
        continue;
      }

      const suggestedScore =
        Number(
          suggestion.suggested_score
        );

      if (
        !Number.isFinite(
          suggestedScore
        )
      ) {
        continue;
      }

      const competency =
        competencies.find(
          (c) =>
            Number(c.id) ===
            competencyId
        );

      const currentScore =
        competency
          ? Number(
              competency.current_score
            )
          : 0;

      const boundedScore =
        Math.max(
          0,
          Math.min(
            100,
            suggestedScore
          )
        );

      normalizedCompetencySuggestions.push(
        {
          competency_id:
            competencyId,
          suggested_score:
            boundedScore,
          reason:
            typeof suggestion.reason ===
            'string'
              ? suggestion.reason
              : 'AI identified this competency as relevant to the student submission.',
          current_score:
            Number.isFinite(
              currentScore
            )
              ? currentScore
              : 0,
        }
      );
    }

    aiResult.competency_suggestions =
      normalizedCompetencySuggestions;

    // ---------------------------------------------------------
    // 8. Save AI evaluation
    // ---------------------------------------------------------

    await connection.beginTransaction();
    transactionStarted = true;

    for (
      const targetId of
        targetSubmissionIds
    ) {
      const [evalResult] =
        await connection.query(
          `INSERT INTO ai_evaluations
            (
              submission_id,
              total_ai_score,
              strengths,
              areas_for_improvement,
              recommendations,
              suggested_next_steps,
              raw_ai_response,
              status
            )
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [
            targetId,
            aiResult.total_score,
            aiResult.strengths ||
              null,
            aiResult.areas_for_improvement ||
              null,
            aiResult.recommendations ||
              null,
            aiResult.suggested_next_steps ||
              null,
            JSON.stringify(
              aiResult
            ),
          ]
        );

      const aiEvaluationId =
        evalResult.insertId;

      // -------------------------------------------------------
      // Save rubric criterion scores
      // -------------------------------------------------------

      for (
        const cs of
          aiResult.criteria_scores
      ) {
        await connection.query(
          `INSERT INTO criterion_scores
            (
              ai_evaluation_id,
              criterion_id,
              ai_recommended_score,
              ai_rationale
            )
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             ai_recommended_score =
               VALUES(ai_recommended_score),
             ai_rationale =
               VALUES(ai_rationale)`,
          [
            aiEvaluationId,
            cs.criteria_id,
            cs.score,
            cs.rationale,
          ]
        );
      }

      // -------------------------------------------------------
      // Save checklist results (Chk-1, Chk-2, ... — separate
      // table chain from criterion_scores above)
      // -------------------------------------------------------

      for (
        const cr of
          aiResult.checklist_results
      ) {
        await connection.query(
          `INSERT INTO assessment_checklist_results
            (
              ai_evaluation_id,
              checklist_criterion_id,
              ai_yes_no_value,
              ai_score_value,
              ai_text_value,
              ai_feedback
            )
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             ai_yes_no_value =
               VALUES(ai_yes_no_value),
             ai_score_value =
               VALUES(ai_score_value),
             ai_text_value =
               VALUES(ai_text_value),
             ai_feedback =
               VALUES(ai_feedback)`,
          [
            aiEvaluationId,
            cr.checklist_criterion_id,
            cr.yes_no_value === undefined
              ? null
              : cr.yes_no_value,
            cr.score_value === undefined
              ? null
              : cr.score_value,
            cr.text_value === undefined
              ? null
              : cr.text_value,
            cr.feedback === undefined
              ? null
              : cr.feedback,
          ]
        );
      }

      // -------------------------------------------------------
      // Save competency suggestions
      // -------------------------------------------------------

      if (
        aiResult
          .competency_suggestions
          .length > 0
      ) {
        const [
          targetStudentRows,
        ] =
          await connection.query(
            `SELECT student_id
             FROM assessment_submissions
             WHERE id = ?
             LIMIT 1`,
            [targetId]
          );

        const targetStudentId =
          targetStudentRows[0]
            ?.student_id;

        if (targetStudentId) {
          for (
            const suggestion of
              aiResult.competency_suggestions
          ) {
            const competencyId =
              Number(
                suggestion.competency_id
              );

            const [
              competencyExists,
            ] =
              await connection.query(
                `SELECT id
                 FROM competencies
                 WHERE id = ?
                 LIMIT 1`,
                [competencyId]
              );

            if (
              !competencyExists.length
            ) {
              continue;
            }

            const [
              scoreRows,
            ] =
              await connection.query(
                `SELECT score
                 FROM student_competencies
                 WHERE student_id = ?
                   AND competency_id = ?
                 LIMIT 1`,
                [
                  targetStudentId,
                  competencyId,
                ]
              );

            const currentScore =
              scoreRows.length > 0
                ? Number(
                    scoreRows[0].score
                  )
                : 0;

            const suggestedScore =
              Number(
                suggestion.suggested_score
              );

            await connection.query(
              `INSERT INTO ai_competency_suggestions
                (
                  ai_evaluation_id,
                  competency_id,
                  current_score,
                  suggested_score,
                  reason
                )
               VALUES (?, ?, ?, ?, ?)`,
              [
                aiEvaluationId,
                competencyId,
                Number.isFinite(
                  currentScore
                )
                  ? currentScore
                  : 0,
                Number.isFinite(
                  suggestedScore
                )
                  ? suggestedScore
                  : currentScore,
                suggestion.reason ||
                  null,
              ]
            );
          }
        }
      }

      // -------------------------------------------------------
      // Mark submission as AI reviewed
      // -------------------------------------------------------

      await connection.query(
        `UPDATE assessment_submissions
         SET
           status = 'ai_reviewed',
           analyzed_at = NOW(),
           ai_score = ?
         WHERE id = ?`,
        [
          aiResult.total_score,
          targetId,
        ]
      );
    }

    await connection.commit();

    console.log(
      `[AI Service] Successfully analyzed submission ${submissionId} with Gemini! ` +
        `(fanned out to ${targetSubmissionIds.length} submission row(s): ${targetSubmissionIds.join(', ')})`
    );
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    console.error(
      `[AI Service] Error analyzing submission ${submissionId}:`,
      error.message
    );

    try {
      await pool.query(
        `UPDATE assessment_submissions
         SET status = 'error'
         WHERE id IN (?)`,
        [targetSubmissionIds]
      );
    } catch (statusError) {
      console.error(
        '[AI Service] Failed to mark submission as error:',
        statusError.message
      );
    }
  } finally {
    connection.release();
  }
};