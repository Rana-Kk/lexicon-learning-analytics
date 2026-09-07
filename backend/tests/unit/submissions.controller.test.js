import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// HOISTED MOCKS
// ============================================================

const {
  mockPoolQuery,
  mockGetConnection,
  mockConnQuery,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockTeacherOwnsGroup,
  mockAnalyzeSubmissionWithGemini,
} = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockGetConnection: vi.fn(),
  mockConnQuery: vi.fn(),
  mockBeginTransaction: vi.fn(),
  mockCommit: vi.fn(),
  mockRollback: vi.fn(),
  mockRelease: vi.fn(),
  mockTeacherOwnsGroup: vi.fn(),
  mockAnalyzeSubmissionWithGemini: vi.fn(),
}))

// ============================================================
// MOCK DATABASE
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: mockPoolQuery,
    getConnection: mockGetConnection,
  },
}))

// ============================================================
// MOCK AI SERVICE
// ============================================================

vi.mock('../../src/services/ai.service.js', () => ({
  analyzeSubmissionWithGemini: mockAnalyzeSubmissionWithGemini,
}))

// ============================================================
// MOCK SCOPE
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherOwnsGroup: mockTeacherOwnsGroup,
}))

// ============================================================
// IMPORT CONTROLLER AFTER MOCKS
// ============================================================

const {
  getAllSubmissions,
  getSubmissions,
  getSubmissionById,
  createSubmission,
  reviewSubmission,
  requestResubmission,
} = await import('../../src/controllers/submissions.controller.js')

// ============================================================
// HELPERS
// ============================================================

function createReq({
  params = {},
  query = {},
  body = {},
  user = {
    sub: 1,
    role: 'admin',
  },
} = {}) {
  return {
    params,
    query,
    body,
    user,
  }
}

function createRes() {
  const res = {}

  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)

  return res
}

function createConnection() {
  return {
    query: mockConnQuery,
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
  }
}

const runHandler = async (handler, req, res) => {
  return new Promise((resolve, reject) => {
    const next = (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    Promise.resolve(handler(req, res, next))
      .then(() => {
        resolve();
      })
      .catch(reject);
  });
};

// ============================================================
// TEST SETUP
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn()

  // Controller içinde beklenmeyen/ek sorgular için
  // güvenli varsayılan database cevabı
  mockPoolQuery.mockResolvedValue([[]])

  mockGetConnection.mockResolvedValue(createConnection())

  mockTeacherOwnsGroup.mockResolvedValue(true)

  mockAnalyzeSubmissionWithGemini.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ============================================================
// getAllSubmissions
// ============================================================

describe('getAllSubmissions', () => {
  it('returns all submissions for admin', async () => {
    const req = createReq({
      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    const rows = [
      {
        id: 1,
        student_id: 2,
      },
      {
        id: 2,
        student_id: 3,
      },
    ]

    mockPoolQuery.mockResolvedValueOnce([rows])

    await runHandler(getAllSubmissions, req, res)

    expect(mockPoolQuery).toHaveBeenCalledTimes(1)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 2,
      data: rows,
    })
  })

  it('filters submissions by assessment_id', async () => {
    const req = createReq({
      query: {
        assessment_id: '10',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await runHandler(getAllSubmissions, req, res)

    const [sql, params] =
      mockPoolQuery.mock.calls[0]

    expect(sql).toContain(
      's.assessment_id=?'
    )

    expect(params).toContain('10')
  })

  it('filters submissions by student_id for admin', async () => {
    const req = createReq({
      query: {
        student_id: '25',
      },
      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await runHandler(getAllSubmissions, req, res)

    const [, params] =
      mockPoolQuery.mock.calls[0]

    expect(params).toContain('25')
  })

  it('only returns own submissions for student', async () => {
    const req = createReq({
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await runHandler(getAllSubmissions, req, res)

    const [sql, params] =
      mockPoolQuery.mock.calls[0]

    expect(sql).toContain(
      's.student_id=?'
    )

    expect(params).toEqual([5])
  })

  it('limits teacher to assigned groups', async () => {
    const req = createReq({
      user: {
        sub: 8,
        role: 'teacher',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await runHandler(getAllSubmissions, req, res)

    const [sql, params] =
      mockPoolQuery.mock.calls[0]

    expect(sql).toContain(
      'group_teachers'
    )

    expect(params).toContain(8)
  })

  it('getSubmissions is an alias for getAllSubmissions', () => {
    expect(getSubmissions).toBe(getAllSubmissions)
  })
})

// ============================================================
// getSubmissionById
// ============================================================

describe('getSubmissionById', () => {
  const submission = {
    id: 10,
    student_id: 5,
    assessment_id: 100,
    assessment_group_id: 20,
    assessment_max_score: 100,
    status: 'submitted',
  }

  it('throws 404 when submission does not exist', async () => {
    const req = createReq({
      params: { id: '999' },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await expect(
      runHandler(getSubmissionById, req, res)
    ).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('allows admin to view submission details', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([
        [
          {
            id: 50,
            status: 'pending',
          },
        ],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])

    await runHandler(
      getSubmissionById,
      req,
      res
    )

    expect(res.json).toHaveBeenCalled()

    expect(res.json.mock.calls[0][0].success)
      .toBe(true)
  })

  it('prevents student from viewing another student submission', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 99,
        role: 'student',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    await expect(
      runHandler(getSubmissionById, req, res)
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('allows student to view own submission', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    const approvedEval = {
      id: 100,
      status: 'approved',
      total_teacher_score: 90,
      strengths: 'Good architecture',
      areas_for_improvement: 'Testing',
      recommendations: 'Write more tests',
      suggested_next_steps: 'Practice',
      teacher_comment: 'Well done',
    }

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[approvedEval]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])

    await runHandler(
      getSubmissionById,
      req,
      res
    )

    expect(res.json).toHaveBeenCalled()

    const response =
      res.json.mock.calls[0][0]

    expect(
      response.data.ai_evaluations
    ).toHaveLength(1)

    expect(
      response.data.ai_evaluations[0].status
    ).toBe('approved')
  })

  it('prevents teacher without group access', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 7,
        role: 'teacher',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockTeacherOwnsGroup.mockResolvedValueOnce(false)

    await expect(
      runHandler(getSubmissionById, req, res)
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('allows teacher with group access', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 7,
        role: 'teacher',
      },
    })

    const res = createRes()

    const latestEval = {
      id: 101,
      status: 'completed',
      total_ai_score: 85,
      total_teacher_score: 90,
    }

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[latestEval]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])

    mockTeacherOwnsGroup.mockResolvedValueOnce(true)

    await runHandler(
      getSubmissionById,
      req,
      res
    )

    expect(res.json).toHaveBeenCalled()
  })

  it('returns rejected evaluation to student when no approved evaluation exists', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    const rejectedEval = {
      id: 200,
      status: 'rejected',
      teacher_comment: 'Please fix this',
    }

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[rejectedEval]])

    await runHandler(
      getSubmissionById,
      req,
      res
    )

    const response =
      res.json.mock.calls[0][0]

    expect(
      response.data.ai_evaluations[0].status
    ).toBe('rejected')
  })

it('uses teacher values over AI checklist values for student', async () => {
  const req = createReq({
    params: { id: '10' },
    user: {
      sub: 5,
      role: 'student',
    },
  })

  const res = createRes()

  const approvedEval = {
    id: 100,
    status: 'approved',
  }

  const checklist = [
    {
      id: 1,
      name: 'Code quality',
      description: 'Clean code',
      criterion_type: 'score',
      max_score: 10,

      ai_yes_no_value: false,
      ai_score_value: 4,
      ai_text_value: 'AI text',

      teacher_yes_no_value: true,
      teacher_score_value: 9,
      teacher_text_value: 'Teacher text',
    },
  ]

  mockPoolQuery
    // 1. submission
    .mockResolvedValueOnce([[submission]])

    // 2. latest evaluation
    .mockResolvedValueOnce([[approvedEval]])

    // 3. AI criterion scores / suggestions
    .mockResolvedValueOnce([[]])

    // 4. approved teacher criterion scores
    .mockResolvedValueOnce([[]])

    // 5. checklist results
    .mockResolvedValueOnce([checklist])

    // Extra queries güvenli şekilde boş dönebilir
    .mockResolvedValue([[]])

  await runHandler(
    getSubmissionById,
    req,
    res
  )

  expect(res.json).toHaveBeenCalled()

  const response = res.json.mock.calls[0][0]

  expect(response.data.checklist_results).toHaveLength(1)

  const item = response.data.checklist_results[0]

  expect(item.final_yes_no_value).toBe(true)

  expect(item.final_score_value).toBe(9)

  expect(item.final_text_value).toBe('Teacher text')
})})

// ============================================================
// createSubmission
// ============================================================

describe('createSubmission', () => {
  function mockGithubSuccess() {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          default_branch: 'main',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: 'abc123commit',
        }),
      })
  }

  it('requires assessment id and GitHub URL', async () => {
    const req = createReq({
      body: {},
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    await expect(
      runHandler(createSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 404 when assessment does not exist', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/project',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await expect(
      runHandler(createSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('creates an individual submission and starts AI analysis', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/project',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockGithubSuccess()

    mockPoolQuery
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            submission_mode: 'individual',
            group_id: 20,
          },
        ],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        {
          insertId: 100,
        },
      ])

    await runHandler(
      createSubmission,
      req,
      res
    )

    expect(mockAnalyzeSubmissionWithGemini)
      .toHaveBeenCalledWith(
        100,
        'test',
        'project',
        'abc123commit',
        undefined
      )

    expect(res.status)
      .toHaveBeenCalledWith(201)

    expect(res.json)
      .toHaveBeenCalledWith({
        success: true,
        message:
          'Submission received and AI analysis started',
        data: {
          id: 100,
          status: 'analyzing',
          commit_sha: 'abc123commit',
        },
      })
  })

  it('updates an existing individual submission', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/project',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockGithubSuccess()

    mockPoolQuery
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            submission_mode: 'individual',
            group_id: 20,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 55,
          },
        ],
      ])
      .mockResolvedValueOnce([{}])

    await runHandler(
      createSubmission,
      req,
      res
    )

    expect(mockAnalyzeSubmissionWithGemini)
      .toHaveBeenCalledWith(
        55,
        'test',
        'project',
        'abc123commit',
        undefined
      )
  })

  it('rejects invalid GitHub URL', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url: 'invalid-url',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          submission_mode: 'individual',
        },
      ],
    ])

    await expect(
      runHandler(createSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('rejects inaccessible GitHub repository', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/private',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          submission_mode: 'individual',
        },
      ],
    ])

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    await expect(
      runHandler(createSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('creates submissions for all team members', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/team-project',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockGithubSuccess()

    mockPoolQuery
      // assessment
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            submission_mode: 'team',
            group_id: 20,
          },
        ],
      ])

      // team
      .mockResolvedValueOnce([
        [
          {
            id: 500,
          },
        ],
      ])

      // members
      .mockResolvedValueOnce([
        [
          { student_id: 5 },
          { student_id: 6 },
        ],
      ])

      // existing member 5
      .mockResolvedValueOnce([[]])

      // insert member 5
      .mockResolvedValueOnce([
        {
          insertId: 100,
        },
      ])

      // existing member 6
      .mockResolvedValueOnce([[]])

      // insert member 6
      .mockResolvedValueOnce([
        {
          insertId: 101,
        },
      ])

    await runHandler(
      createSubmission,
      req,
      res
    )

    expect(mockAnalyzeSubmissionWithGemini)
      .toHaveBeenCalledWith(
        100,
        'test',
        'team-project',
        'abc123commit',
        [100, 101]
      )
  })

  it('throws when student is not part of a team', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/project',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockGithubSuccess()

    mockPoolQuery
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            submission_mode: 'team',
            group_id: 20,
          },
        ],
      ])
      .mockResolvedValueOnce([[]])

    await expect(
      runHandler(createSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('does not fail the submission when AI analysis rejects asynchronously', async () => {
    const req = createReq({
      body: {
        assessment_id: 10,
        github_url:
          'https://github.com/test/project',
      },
      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    mockGithubSuccess()

    mockAnalyzeSubmissionWithGemini.mockReturnValueOnce(
      Promise.reject(
        new Error('AI failed')
      )
    )

    mockPoolQuery
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            submission_mode: 'individual',
          },
        ],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        {
          insertId: 100,
        },
      ])

    await runHandler(
      createSubmission,
      req,
      res
    )

    expect(res.status)
      .toHaveBeenCalledWith(201)
  })
})

// ============================================================
// reviewSubmission
// ============================================================

describe('reviewSubmission', () => {
  const submission = {
    id: 10,
    assessment_id: 20,
    student_id: 30,
    group_id: 40,
  }

  it('only allows teacher or admin', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 30,
        role: 'student',
      },
    })

    const res = createRes()

    await expect(
      runHandler(reviewSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('throws 404 when submission does not exist', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await expect(
      runHandler(reviewSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('prevents teacher without group ownership', async () => {
    const req = createReq({
      params: { id: '10' },
      user: {
        sub: 1,
        role: 'teacher',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockTeacherOwnsGroup.mockResolvedValueOnce(false)

    await expect(
      runHandler(reviewSubmission, req, res)
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('saves draft evaluation and commits transaction', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        final_score: 80,
        teacher_feedback: 'Good work',
        action: 'save',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            status: 'teacher_reviewed',
          },
        ],
      ])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    expect(mockBeginTransaction)
      .toHaveBeenCalled()

    expect(mockCommit)
      .toHaveBeenCalled()

    expect(mockRelease)
      .toHaveBeenCalled()

    expect(res.json.mock.calls[0][0].success)
      .toBe(true)
  })

  it('updates an existing AI evaluation', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        final_score: 90,
        action: 'approve',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([
        [
          {
            id: 500,
            strengths: 'old',
            areas_for_improvement: 'old',
            recommendations: 'old',
            suggested_next_steps: 'old',
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            status: 'approved',
          },
        ],
      ])

    mockConnQuery.mockResolvedValue({})

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    expect(mockConnQuery)
      .toHaveBeenCalled()

    expect(mockCommit)
      .toHaveBeenCalled()
  })

  it('normalizes approve action to approved', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'approve',
        final_score: 95,
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[submission]])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    const updateCall =
      mockConnQuery.mock.calls.find(
        ([sql]) =>
          sql.includes(
            'UPDATE assessment_submissions'
          )
      )

    expect(updateCall[1][0])
      .toBe('approved')
  })

  it('normalizes reject action to rejected', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'reject',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[submission]])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    const updateCall =
      mockConnQuery.mock.calls.find(
        ([sql]) =>
          sql.includes(
            'UPDATE assessment_submissions'
          )
      )

    expect(updateCall[1][0])
      .toBe('rejected')
  })

  it('saves criterion scores', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'save',

        criteria_scores: [
          {
            criterion_id: 1,
            ai_recommended_score: 7,
            teacher_final_score: 8,
            ai_rationale: 'Good',
          },
        ],
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[submission]])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    expect(mockConnQuery.mock.calls.some(
      ([sql]) =>
        sql.includes('criterion_scores')
    )).toBe(true)
  })

  it('saves checklist results', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'save',

        checklist_results: [
          {
            checklist_criterion_id: 1,
            teacher_yes_no_value: true,
            teacher_score_value: 8,
            teacher_text_value: 'Good',
            teacher_feedback: 'Nice',
          },
        ],
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[submission]])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    expect(mockConnQuery.mock.calls.some(
      ([sql]) =>
        sql.includes(
          'assessment_checklist_results'
        )
    )).toBe(true)
  })

  it('creates assessment score when approved', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'approved',
        final_score: 88,
        teacher_feedback: 'Excellent',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[submission]])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    expect(mockConnQuery.mock.calls.some(
      ([sql]) =>
        sql.includes('assessment_scores')
    )).toBe(true)
  })

  it('creates teacher feedback when approved with feedback', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'approved',
        final_score: 90,
        teacher_feedback: 'Very good',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[submission]])

    mockConnQuery.mockResolvedValueOnce([
      {
        insertId: 500,
      },
    ])

    await runHandler(
      reviewSubmission,
      req,
      res
    )

    expect(mockConnQuery.mock.calls.some(
      ([sql]) =>
        sql.includes('teacher_feedback')
    )).toBe(true)
  })

  it('rolls back transaction when an error occurs', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        action: 'save',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      .mockResolvedValueOnce([[submission]])
      .mockResolvedValueOnce([[]])

    mockConnQuery.mockRejectedValueOnce(
      new Error('Database error')
    )

    await expect(
      runHandler(reviewSubmission, req, res)
    ).rejects.toThrow('Database error')

    expect(mockRollback)
      .toHaveBeenCalled()

    expect(mockRelease)
      .toHaveBeenCalled()
  })
})

// ============================================================
// requestResubmission
// ============================================================

describe('requestResubmission', () => {
  const submission = {
    id: 10,
    student_id: 5,
    assessment_id: 20,
    group_id: 30,
    submission_mode: 'individual',
  }

  it('only allows teacher or admin', async () => {
    const req = createReq({
      params: { id: '10' },

      user: {
        sub: 5,
        role: 'student',
      },
    })

    const res = createRes()

    await expect(
      runHandler(
        requestResubmission,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('throws 404 when submission does not exist', async () => {
    const req = createReq({
      params: { id: '10' },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([[]])

    await expect(
      runHandler(
        requestResubmission,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('prevents teacher without group ownership', async () => {
    const req = createReq({
      params: { id: '10' },

      user: {
        sub: 1,
        role: 'teacher',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockTeacherOwnsGroup.mockResolvedValueOnce(false)

    await expect(
      runHandler(
        requestResubmission,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('requests resubmission for individual submission with existing evaluation', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {
        teacher_feedback:
          'Please improve your tests',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockConnQuery
      .mockResolvedValueOnce([
        [
          {
            id: 500,
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])

    await runHandler(
      requestResubmission,
      req,
      res
    )

    expect(mockBeginTransaction)
      .toHaveBeenCalled()

    expect(mockCommit)
      .toHaveBeenCalled()

    expect(mockRelease)
      .toHaveBeenCalled()

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Resubmission requested',

      data: {
        id: '10',
        status: 'rejected',
        resubmission_requested: true,
      },
    })
  })

  it('creates rejected evaluation when no evaluation exists', async () => {
    const req = createReq({
      params: { id: '10' },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockConnQuery
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        {
          insertId: 500,
        },
      ])
      .mockResolvedValueOnce([{}])

    await runHandler(
      requestResubmission,
      req,
      res
    )

    expect(mockConnQuery.mock.calls.some(
      ([sql]) =>
        sql.includes(
          'INSERT INTO ai_evaluations'
        )
    )).toBe(true)
  })

  it('uses default resubmission message when feedback is empty', async () => {
    const req = createReq({
      params: { id: '10' },

      body: {},

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockConnQuery
      .mockResolvedValueOnce([
        [
          {
            id: 500,
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])

    await runHandler(
      requestResubmission,
      req,
      res
    )

    const updateCall =
      mockConnQuery.mock.calls.find(
        ([sql]) =>
          sql.includes(
            'UPDATE ai_evaluations'
          )
      )

    expect(
      updateCall[1][0]
    ).toContain(
      '[RESUBMISSION_REQUESTED]'
    )
  })

  it('requests resubmission for every team member', async () => {
    const teamSubmission = {
      ...submission,
      submission_mode: 'team',
    }

    const req = createReq({
      params: { id: '10' },

      body: {
        teacher_feedback: 'Fix project',
      },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery
      // submission
      .mockResolvedValueOnce([
        [teamSubmission],
      ])

      // team
      .mockResolvedValueOnce([
        [
          {
            id: 500,
          },
        ],
      ])

      // sibling submissions
      .mockResolvedValueOnce([
        [
          { id: 10 },
          { id: 11 },
        ],
      ])

    mockConnQuery
      // submission 10 eval
      .mockResolvedValueOnce([
        [
          {
            id: 100,
          },
        ],
      ])

      // update evaluation
      .mockResolvedValueOnce([{}])

      // update submission
      .mockResolvedValueOnce([{}])

      // submission 11 eval
      .mockResolvedValueOnce([
        [
          {
            id: 101,
          },
        ],
      ])

      // update evaluation
      .mockResolvedValueOnce([{}])

      // update submission
      .mockResolvedValueOnce([{}])

    await runHandler(
      requestResubmission,
      req,
      res
    )

    const submissionUpdates =
      mockConnQuery.mock.calls.filter(
        ([sql]) =>
          sql.includes(
            'UPDATE assessment_submissions'
          )
      )

    expect(submissionUpdates)
      .toHaveLength(2)

    expect(mockCommit)
      .toHaveBeenCalled()
  })

  it('rolls back transaction when resubmission fails', async () => {
    const req = createReq({
      params: { id: '10' },

      user: {
        sub: 1,
        role: 'admin',
      },
    })

    const res = createRes()

    mockPoolQuery.mockResolvedValueOnce([
      [submission],
    ])

    mockConnQuery.mockRejectedValueOnce(
      new Error('Transaction failed')
    )

    await expect(
      runHandler(
        requestResubmission,
        req,
        res
      )
    ).rejects.toThrow(
      'Transaction failed'
    )

    expect(mockRollback)
      .toHaveBeenCalled()

    expect(mockRelease)
      .toHaveBeenCalled()
  })
})