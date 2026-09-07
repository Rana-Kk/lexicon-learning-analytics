import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

// ============================================================
// MOCK FUNCTIONS
// ============================================================

const mockGenerateContent = vi.fn()

const mockQuery = vi.fn()
const mockPoolQuery = vi.fn()
const mockGetConnection = vi.fn()

const mockBeginTransaction = vi.fn()
const mockCommit = vi.fn()
const mockRollback = vi.fn()
const mockRelease = vi.fn()

// ============================================================
// GEMINI MOCK
// ============================================================

vi.mock('@google/genai', () => ({
  GoogleGenAI: class GoogleGenAI {
    constructor() {
      this.models = {
        generateContent: mockGenerateContent,
      }
    }
  },
}))

// ============================================================
// DATABASE MOCK
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    getConnection: mockGetConnection,
    query: mockPoolQuery,
  },
}))

// ============================================================
// MOCK CONNECTION
// ============================================================

const mockConnection = {
  query: mockQuery,
  beginTransaction: mockBeginTransaction,
  commit: mockCommit,
  rollback: mockRollback,
  release: mockRelease,
}

// ============================================================
// IMPORT SERVICE
// ============================================================

const {
  analyzeSubmissionWithGemini,
} = await import('../../src/services/ai.service.js')

// ============================================================
// HELPERS
// ============================================================

function createSuccessfulAiResponse() {
  return {
    total_score: 15,

    meets_description:
      'The student completed the assignment requirements.',

    strengths:
      'Good implementation.',

    areas_for_improvement:
      'More tests could be added.',

    recommendations:
      'Improve edge case handling.',

    suggested_next_steps:
      'Add more automated tests.',

    competency_suggestions: [
      {
        competency_id: 1,
        suggested_score: 80,
        reason:
          'The implementation demonstrates programming skills.',
      },
    ],

    criteria_scores: [
      {
        criteria_id: 1,
        score: 10,
        rationale:
          'The implementation satisfies the first criterion.',
      },
      {
        criteria_id: 2,
        score: 5,
        rationale:
          'The implementation partially satisfies the second criterion.',
      },
    ],

    checklist_results: [],
  }
}

function createChecklistAiResponse() {
  const response =
    createSuccessfulAiResponse()

  response.checklist_results = [
    {
      checklist_criterion_id: 101,
      yes_no_value: true,
      score_value: null,
      text_value: null,
      feedback:
        'The required feature is present.',
    },
    {
      checklist_criterion_id: 102,
      yes_no_value: null,
      score_value: 8,
      text_value: null,
      feedback:
        'The implementation demonstrates most requirements.',
    },
    {
      checklist_criterion_id: 103,
      yes_no_value: null,
      score_value: null,
      text_value: 'Completed',
      feedback:
        'The repository contains the required work.',
    },
  ]

  return response
}

// ============================================================
// DATABASE MOCK SETUP
// ============================================================

function setupDatabaseMocks({
  hasChecklist = false,
  submissionExists = true,
  hasRubric = true,
  failInsertEvaluation = false,
} = {}) {
  mockGetConnection.mockResolvedValue(
    mockConnection
  )

  mockQuery.mockImplementation(
    async (sql) => {

      // ======================================================
      // SUBMISSION + ASSESSMENT
      // ======================================================

      if (
        sql.includes(
          'FROM assessment_submissions s'
        )
      ) {
        if (!submissionExists) {
          return [[]]
        }

        return [[
          {
            id: 100,
            assessment_id: 10,
            student_id: 50,

            assessment_title:
              'Python Assignment',

            assessment_desc:
              'Build a Python application.',
          },
        ]]
      }

      // ======================================================
      // RUBRIC CRITERIA
      // ======================================================

      if (
        sql.includes(
          'FROM assignment_evaluation_criteria'
        )
      ) {
        if (!hasRubric) {
          return [[]]
        }

        return [[
          {
            id: 1,
            name: 'Implementation',

            description:
              'Implement the required functionality.',

            criterion_type: 'score',

            max_score: 10,

            sort_order: 1,
          },

          {
            id: 2,
            name: 'Testing',

            description:
              'Write appropriate tests.',

            criterion_type: 'score',

            max_score: 10,

            sort_order: 2,
          },
        ]]
      }

      // ======================================================
      // CHECKLIST CRITERIA
      // ======================================================

      if (
        sql.includes(
          'FROM assessment_checklist_criteria'
        )
      ) {
        if (!hasChecklist) {
          return [[]]
        }

        return [[
          {
            id: 101,
            name: 'Feature implemented',

            description:
              'Required feature exists.',

            criterion_type: 'yes_no',

            max_score: null,

            sort_order: 1,
          },

          {
            id: 102,
            name: 'Code quality',

            description:
              'Evaluate implementation quality.',

            criterion_type: 'score',

            max_score: 10,

            sort_order: 2,
          },

          {
            id: 103,
            name: 'Progress',

            description:
              'Describe progress.',

            criterion_type: 'text',

            max_score: null,

            sort_order: 3,
          },
        ]]
      }

      // ======================================================
      // COMPETENCIES
      // ======================================================

      if (
        sql.includes(
          'FROM competencies c'
        )
      ) {
        return [[
          {
            id: 1,

            name:
              'Programming',

            description:
              'Programming skills',

            current_score: 60,
          },
        ]]
      }

      // ======================================================
      // INSERT AI EVALUATION
      // ======================================================

      if (
        sql.includes(
          'INSERT INTO ai_evaluations'
        )
      ) {
        if (failInsertEvaluation) {
          throw new Error(
            'Database insert failed'
          )
        }

        return [{
          insertId: 500,
        }]
      }

      // ======================================================
      // INSERT CRITERION SCORES
      // ======================================================

      if (
        sql.includes(
          'INSERT INTO criterion_scores'
        )
      ) {
        return [{
          affectedRows: 1,
        }]
      }

      // ======================================================
      // INSERT CHECKLIST RESULTS
      // ======================================================

      if (
        sql.includes(
          'INSERT INTO assessment_checklist_results'
        )
      ) {
        return [{
          affectedRows: 1,
        }]
      }

      // ======================================================
      // GET STUDENT ID
      // ======================================================

      if (
        sql.includes(
          'SELECT student_id'
        ) &&
        sql.includes(
          'FROM assessment_submissions'
        )
      ) {
        return [[
          {
            student_id: 50,
          },
        ]]
      }

      // ======================================================
      // CHECK COMPETENCY EXISTS
      // ======================================================

      if (
        sql.includes(
          'SELECT id'
        ) &&
        sql.includes(
          'FROM competencies'
        )
      ) {
        return [[
          {
            id: 1,
          },
        ]]
      }

      // ======================================================
      // GET CURRENT COMPETENCY SCORE
      // ======================================================

      if (
        sql.includes(
          'SELECT score'
        ) &&
        sql.includes(
          'FROM student_competencies'
        )
      ) {
        return [[
          {
            score: 60,
          },
        ]]
      }

      // ======================================================
      // INSERT COMPETENCY SUGGESTION
      // ======================================================

      if (
        sql.includes(
          'INSERT INTO ai_competency_suggestions'
        )
      ) {
        return [{
          affectedRows: 1,
        }]
      }

      // ======================================================
      // UPDATE SUBMISSION
      // ======================================================

      if (
        sql.includes(
          'UPDATE assessment_submissions'
        )
      ) {
        return [{
          affectedRows: 1,
        }]
      }

      return [[]]
    }
  )
}

// ============================================================
// GITHUB MOCK SETUP
// ============================================================

function setupGithubMocks() {
  global.fetch = vi.fn()

  global.fetch.mockImplementation(
    async (url) => {

      // ======================================================
      // REPOSITORY TREE
      // ======================================================

      if (
        url.includes(
          '/git/trees/'
        )
      ) {
        return {
          ok: true,

          json: async () => ({
            tree: [
              {
                path: 'main.py',
                type: 'blob',
              },

              {
                path: 'test_main.py',
                type: 'blob',
              },

              {
                path: 'README.md',
                type: 'blob',
              },
            ],
          }),
        }
      }

      // ======================================================
      // RAW MAIN FILE
      // ======================================================

      if (
        url.includes(
          '/main.py'
        )
      ) {
        return {
          ok: true,

          text: async () =>
            `
def add(a, b):
    return a + b
            `,
        }
      }

      // ======================================================
      // RAW TEST FILE
      // ======================================================

      if (
        url.includes(
          '/test_main.py'
        )
      ) {
        return {
          ok: true,

          text: async () =>
            `
from main import add

def test_add():
    assert add(2, 3) == 5
            `,
        }
      }

      // ======================================================
      // RAW README
      // ======================================================

      if (
        url.includes(
          '/README.md'
        )
      ) {
        return {
          ok: true,

          text: async () =>
            '# Python Assignment',
        }
      }

      return {
        ok: false,
        status: 404,
      }
    }
  )
}

// ============================================================
// DEFAULT SETUP
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()

  setupDatabaseMocks()

  setupGithubMocks()

  mockGenerateContent.mockResolvedValue({
    text: JSON.stringify(
      createSuccessfulAiResponse()
    ),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ============================================================
// TESTS
// ============================================================

describe(
  'analyzeSubmissionWithGemini',
  () => {

    // ========================================================
    // SUCCESS
    // ========================================================

    it(
      'successfully analyzes a submission',
      async () => {

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockGenerateContent
        ).toHaveBeenCalledTimes(1)

        expect(
          mockBeginTransaction
        ).toHaveBeenCalledTimes(1)

        expect(
          mockCommit
        ).toHaveBeenCalledTimes(1)

        expect(
          mockRollback
        ).not.toHaveBeenCalled()

        expect(
          mockRelease
        ).toHaveBeenCalledTimes(1)
      }
    )

    // ========================================================
    // SAVE AI EVALUATION
    // ========================================================

    it(
      'saves the AI evaluation',
      async () => {

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        const call =
          mockQuery.mock.calls.find(
            ([sql]) =>
              sql.includes(
                'INSERT INTO ai_evaluations'
              )
          )

        expect(call).toBeDefined()

        expect(call[1][1]).toBe(15)
      }
    )

    // ========================================================
    // SAVE CRITERIA
    // ========================================================

    it(
      'saves every rubric criterion score',
      async () => {

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        const calls =
          mockQuery.mock.calls.filter(
            ([sql]) =>
              sql.includes(
                'INSERT INTO criterion_scores'
              )
          )

        expect(calls).toHaveLength(2)
      }
    )

    // ========================================================
    // BACKEND CALCULATES TOTAL
    // ========================================================

    it(
      'calculates total score from criteria',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.total_score = 999

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        const call =
          mockQuery.mock.calls.find(
            ([sql]) =>
              sql.includes(
                'INSERT INTO ai_evaluations'
              )
          )

        expect(call[1][1]).toBe(15)
      }
    )

    // ========================================================
    // SUBMISSION NOT FOUND
    // ========================================================

    it(
      'marks submission as error when submission does not exist',
      async () => {

        setupDatabaseMocks({
          submissionExists: false,
        })

        await analyzeSubmissionWithGemini(
          999,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockGenerateContent
        ).not.toHaveBeenCalled()

        expect(
          mockPoolQuery
        ).toHaveBeenCalled()
      }
    )

    // ========================================================
    // NO RUBRIC
    // ========================================================

    it(
      'marks submission as error when rubric does not exist',
      async () => {

        setupDatabaseMocks({
          hasRubric: false,
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockGenerateContent
        ).not.toHaveBeenCalled()

        expect(
          mockPoolQuery
        ).toHaveBeenCalled()
      }
    )

    // ========================================================
    // WRONG NUMBER OF CRITERIA
    // ========================================================

    it(
      'rejects wrong number of criteria',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.criteria_scores = [
          response.criteria_scores[0],
        ]

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockBeginTransaction
        ).not.toHaveBeenCalled()

        expect(
          mockCommit
        ).not.toHaveBeenCalled()

        expect(
          mockPoolQuery
        ).toHaveBeenCalled()
      }
    )

    // ========================================================
    // INVALID CRITERION ID
    // ========================================================

    it(
      'rejects invalid criterion ID',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.criteria_scores[0].criteria_id =
          999

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()

        expect(
          mockPoolQuery
        ).toHaveBeenCalled()
      }
    )

    // ========================================================
    // DUPLICATE CRITERION ID
    // ========================================================

    it(
      'rejects duplicate criterion IDs',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.criteria_scores[1].criteria_id =
          1

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // SCORE ABOVE MAX
    // ========================================================

    it(
      'rejects score above rubric maximum',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.criteria_scores[0].score =
          999

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // NEGATIVE SCORE
    // ========================================================

    it(
      'rejects negative score',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.criteria_scores[0].score =
          -1

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // MISSING RATIONALE
    // ========================================================

    it(
      'rejects missing rationale',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.criteria_scores[0].rationale =
          ''

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // INVALID JSON
    // ========================================================

    it(
      'handles invalid Gemini JSON',
      async () => {

        mockGenerateContent.mockResolvedValue({
          text:
            'This is not JSON',
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockGenerateContent
        ).toHaveBeenCalled()

        expect(
          mockBeginTransaction
        ).not.toHaveBeenCalled()

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // EMPTY GEMINI RESPONSE
    // ========================================================

    it(
      'handles empty Gemini response',
      async () => {

        mockGenerateContent.mockResolvedValue({
          text: '',
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockBeginTransaction
        ).not.toHaveBeenCalled()

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // REPOSITORY FETCH FAILURE
    // ========================================================

    it(
      'does not call Gemini when repository fetch fails',
      async () => {

        global.fetch.mockResolvedValue({
          ok: false,
          status: 404,
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockGenerateContent
        ).not.toHaveBeenCalled()

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // CHECKLIST SUCCESS
    // ========================================================

    it(
      'saves checklist results when checklist exists',
      async () => {

        setupDatabaseMocks({
          hasChecklist: true,
        })

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(
            createChecklistAiResponse()
          ),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        const calls =
          mockQuery.mock.calls.filter(
            ([sql]) =>
              sql.includes(
                'INSERT INTO assessment_checklist_results'
              )
          )

        expect(calls).toHaveLength(3)

        expect(
          mockCommit
        ).toHaveBeenCalledTimes(1)
      }
    )

    // ========================================================
    // INVALID CHECKLIST COUNT
    // ========================================================

    it(
      'rejects wrong number of checklist results',
      async () => {

        setupDatabaseMocks({
          hasChecklist: true,
        })

        const response =
          createChecklistAiResponse()

        response.checklist_results.pop()

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // INVALID CHECKLIST ID
    // ========================================================

    it(
      'rejects invalid checklist criterion ID',
      async () => {

        setupDatabaseMocks({
          hasChecklist: true,
        })

        const response =
          createChecklistAiResponse()

        response.checklist_results[0]
          .checklist_criterion_id = 999

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // DUPLICATE CHECKLIST ID
    // ========================================================

    it(
      'rejects duplicate checklist IDs',
      async () => {

        setupDatabaseMocks({
          hasChecklist: true,
        })

        const response =
          createChecklistAiResponse()

        response.checklist_results[1]
          .checklist_criterion_id = 101

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // CHECKLIST SCORE ABOVE MAX
    // ========================================================

    it(
      'rejects checklist score above maximum',
      async () => {

        setupDatabaseMocks({
          hasChecklist: true,
        })

        const response =
          createChecklistAiResponse()

        response.checklist_results[1]
          .score_value = 999

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // COMPETENCY SCORE BOUNDING
    // ========================================================

    it(
      'bounds competency suggestion score to 100',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response
          .competency_suggestions[0]
          .suggested_score = 999

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        const call =
          mockQuery.mock.calls.find(
            ([sql]) =>
              sql.includes(
                'INSERT INTO ai_competency_suggestions'
              )
          )

        expect(call).toBeDefined()

        // suggested_score database parameter
        expect(call[1][3]).toBe(100)
      }
    )

    // ========================================================
    // INVALID COMPETENCY IS IGNORED
    // ========================================================

    it(
      'ignores invalid competency IDs',
      async () => {

        const response =
          createSuccessfulAiResponse()

        response.competency_suggestions = [
          {
            competency_id: 999,
            suggested_score: 80,
            reason: 'Invalid competency',
          },
        ]

        mockGenerateContent.mockResolvedValue({
          text: JSON.stringify(response),
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        const calls =
          mockQuery.mock.calls.filter(
            ([sql]) =>
              sql.includes(
                'INSERT INTO ai_competency_suggestions'
              )
          )

        expect(calls).toHaveLength(0)

        expect(
          mockCommit
        ).toHaveBeenCalledTimes(1)
      }
    )

    // ========================================================
    // ROLLBACK AFTER TRANSACTION ERROR
    // ========================================================

    it(
      'rolls back when database save fails',
      async () => {

        setupDatabaseMocks({
          failInsertEvaluation: true,
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockBeginTransaction
        ).toHaveBeenCalledTimes(1)

        expect(
          mockRollback
        ).toHaveBeenCalledTimes(1)

        expect(
          mockCommit
        ).not.toHaveBeenCalled()
      }
    )

    // ========================================================
    // CONNECTION ALWAYS RELEASED
    // ========================================================

    it(
      'always releases database connection on error',
      async () => {

        mockGenerateContent.mockResolvedValue({
          text: 'invalid json',
        })

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main'
        )

        expect(
          mockRelease
        ).toHaveBeenCalledTimes(1)
      }
    )

    // ========================================================
    // FAN OUT MULTIPLE SUBMISSIONS
    // ========================================================

    it(
      'saves evaluation for multiple submission IDs',
      async () => {

        await analyzeSubmissionWithGemini(
          100,
          'test-owner',
          'test-repo',
          'main',
          [100, 101]
        )

        const calls =
          mockQuery.mock.calls.filter(
            ([sql]) =>
              sql.includes(
                'INSERT INTO ai_evaluations'
              )
          )

        expect(calls).toHaveLength(2)
      }
    )

  }
)