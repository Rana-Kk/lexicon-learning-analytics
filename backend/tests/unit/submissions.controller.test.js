import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
}));

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: mockPoolQuery,
    getConnection: mockGetConnection,
  },
}));

vi.mock('../../src/services/ai.service.js', () => ({
  analyzeSubmissionWithGemini: mockAnalyzeSubmissionWithGemini,
}));

vi.mock('../../src/utils/scope.js', () => ({
  teacherOwnsGroup: mockTeacherOwnsGroup,
}));

const {
  getAllSubmissions,
  getSubmissionById,
  createSubmission,
  reviewSubmission,
  requestResubmission,
} = await import('../../src/controllers/submissions.controller.js');

function createReq({
  user = { sub: 5, role: 'student' },
  params = {},
  query = {},
  body = {},
} = {}) {
  return { user, params, query, body };
}

function createRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createConnection() {
  return {
    query: mockConnQuery,
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
  };
}

describe('submissions.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPoolQuery.mockResolvedValue([[]]);
    mockConnQuery.mockResolvedValue([{}]);
    mockGetConnection.mockResolvedValue(createConnection());
    mockTeacherOwnsGroup.mockResolvedValue(true);
    mockAnalyzeSubmissionWithGemini.mockResolvedValue(undefined);

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ default_branch: 'main' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'abc123commit' }),
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================
  // GET ALL SUBMISSIONS
  // =========================================================

  describe('getAllSubmissions', () => {
    it('returns submissions for student including team submissions', async () => {
      const req = createReq({
        user: { sub: 5, role: 'student' },
      });
      const res = createRes();

      await getAllSubmissions(req, res);

      const [sql, params] = mockPoolQuery.mock.calls[0];

      expect(sql).toContain('assessment_submissions');
      expect(sql).toContain('s.student_id = ?');
      expect(sql).toContain('team_members');
      expect(params).toEqual([5, 5]);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });

    it('does not apply student_id filter for admin', async () => {
      const req = createReq({
        user: { sub: 1, role: 'admin' },
        query: { student_id: '25' },
      });
      const res = createRes();

      await getAllSubmissions(req, res);

      const [sql, params] = mockPoolQuery.mock.calls[0];

      expect(sql).not.toContain('s.student_id = ?');
      expect(params).not.toContain('25');

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });

    it('filters submissions by student_id for teacher', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        query: { student_id: '25' },
      });
      const res = createRes();

      await getAllSubmissions(req, res);

      const [sql, params] = mockPoolQuery.mock.calls[0];

      expect(sql).toContain('group_teachers');
      expect(sql).toContain('team_members');
      expect(params).toEqual([10, '25', '25']);
    });

    it('returns submissions for teacher', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
      });
      const res = createRes();

      await getAllSubmissions(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });

    it('returns submissions for admin', async () => {
      const req = createReq({
        user: { sub: 1, role: 'admin' },
      });
      const res = createRes();

      await getAllSubmissions(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });

    it('handles database errors', async () => {
      const req = createReq();
      const res = createRes();

      mockPoolQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(getAllSubmissions(req, res))
        .rejects.toThrow('Database error');

      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // =========================================================
  // GET SUBMISSION BY ID
  // =========================================================

  describe('getSubmissionById', () => {
    it('returns a student submission', async () => {
      const req = createReq({
        user: { sub: 5, role: 'student' },
        params: { id: '100' },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([
        [{
          id: 100,
          assessment_id: 10,
          student_id: 5,
          team_id: null,
          assessment_group_id: 20,
          status: 'submitted',
          team_members_json: null,
        }],
      ]);

      await getSubmissionById(req, res);

      const response = res.json.mock.calls[0][0];

      expect(response.success).toBe(true);
      expect(response.data.id).toBe(100);
      expect(response.data.team_members).toEqual([]);
    });

    it('allows a team member to access a shared team submission', async () => {
      const req = createReq({
        user: { sub: 6, role: 'student' },
        params: { id: '100' },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([
        [{
          id: 100,
          assessment_id: 10,
          student_id: null,
          team_id: 500,
          assessment_group_id: 20,
          status: 'submitted',
          team_members_json: JSON.stringify([
            { id: 5, name: 'Student One' },
            { id: 6, name: 'Student Two' },
          ]),
        }],
      ]);

      await getSubmissionById(req, res);

      const response = res.json.mock.calls[0][0];

      expect(response.success).toBe(true);
      expect(response.data.id).toBe(100);
      expect(response.data.team_members).toHaveLength(2);
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('returns 404 when submission does not exist', async () => {
      const req = createReq({
        params: { id: '999' },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[]]);

      await expect(getSubmissionById(req, res))
        .rejects.toThrow('Submission not found');
    });

    it('denies access to another student submission', async () => {
      const req = createReq({
        user: { sub: 6, role: 'student' },
        params: { id: '100' },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([
        [{
          id: 100,
          assessment_id: 10,
          student_id: 5,
          team_id: null,
          assessment_group_id: 20,
          status: 'submitted',
          team_members_json: null,
        }],
      ]);

      await expect(getSubmissionById(req, res))
        .rejects.toThrow('You do not have access to this submission');
    });

    it('allows teacher to access a submission owned by their group', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([
        [{
          id: 100,
          assessment_id: 10,
          student_id: 5,
          team_id: null,
          assessment_group_id: 20,
          status: 'submitted',
          team_members_json: null,
        }],
      ]);

      await getSubmissionById(req, res);

      expect(mockTeacherOwnsGroup).toHaveBeenCalledWith(10, 20);
      expect(res.json).toHaveBeenCalled();
    });

    it('allows admin to access a submission', async () => {
      const req = createReq({
        user: { sub: 1, role: 'admin' },
        params: { id: '100' },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([
        [{
          id: 100,
          assessment_id: 10,
          student_id: 5,
          team_id: null,
          assessment_group_id: 20,
          status: 'submitted',
          team_members_json: null,
        }],
      ]);

      await getSubmissionById(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      const req = createReq({
        params: { id: '100' },
      });
      const res = createRes();

      mockPoolQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(getSubmissionById(req, res))
        .rejects.toThrow('Database error');
    });
  });

  // =========================================================
  // CREATE / UPDATE SUBMISSION
  // =========================================================

  describe('createSubmission', () => {
    it('creates an individual submission', async () => {
      const req = createReq({
        user: { sub: 5, role: 'student' },
        body: {
          assessment_id: 10,
          github_repo_url: 'https://github.com/test/project',
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          { id: 10, group_id: 20, submission_mode: 'individual' },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 100 }]);

      await createSubmission(req, res);

      expect(mockAnalyzeSubmissionWithGemini).toHaveBeenCalledWith(
        100,
        'test',
        'project',
        'abc123commit',
        undefined,
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Submission received and AI analysis started',
        data: {
          id: 100,
          status: 'analyzing',
          commit_sha: 'abc123commit',
        },
      });
    });

    it('updates an existing individual submission', async () => {
      const req = createReq({
        user: { sub: 5, role: 'student' },
        body: {
          assessment_id: 10,
          github_repo_url: 'https://github.com/test/project',
        },
      });
      const res = createRes();

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ default_branch: 'main' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'newcommit123' }),
        });

      mockPoolQuery
        .mockResolvedValueOnce([[
          { id: 10, group_id: 20, submission_mode: 'individual' },
        ]])
        .mockResolvedValueOnce([[
          { id: 100 },
        ]])
        .mockResolvedValueOnce([{}]);

      await createSubmission(req, res);

      const updateCalls = mockPoolQuery.mock.calls.filter(
        ([sql]) => sql.includes('UPDATE assessment_submissions'),
      );

      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0][1]).toEqual([
        'https://github.com/test/project',
        'newcommit123',
        100,
      ]);

      expect(mockAnalyzeSubmissionWithGemini).toHaveBeenCalledWith(
        100,
        'test',
        'project',
        'newcommit123',
        undefined,
      );
    });

    it('creates one shared submission for the whole team', async () => {
      const req = createReq({
        user: { sub: 5, role: 'student' },
        body: {
          assessment_id: 10,
          github_repo_url: 'https://github.com/test/team-project',
        },
      });
      const res = createRes();

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ default_branch: 'main' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'abc123commit' }),
        });

      mockPoolQuery
        .mockResolvedValueOnce([[
          { id: 10, group_id: 500, submission_mode: 'team' },
        ]])
        .mockResolvedValueOnce([[
          { id: 500 },
        ]])
        .mockResolvedValueOnce([[
          { student_id: 5 },
          { student_id: 6 },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 100 }]);

      await createSubmission(req, res);

      const insertCalls = mockPoolQuery.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO assessment_submissions'),
      );

      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0][1]).toEqual([
        10,
        500,
        5,
        'https://github.com/test/team-project',
        'abc123commit',
      ]);

      expect(mockAnalyzeSubmissionWithGemini).toHaveBeenCalledWith(
        100,
        'test',
        'team-project',
        'abc123commit',
        [100],
      );
    });

    it('updates the existing shared team submission', async () => {
      const req = createReq({
        user: { sub: 5, role: 'student' },
        body: {
          assessment_id: 10,
          github_repo_url: 'https://github.com/test/team-project',
        },
      });
      const res = createRes();

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ default_branch: 'main' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'newcommit123' }),
        });

      mockPoolQuery
        .mockResolvedValueOnce([[
          { id: 10, group_id: 500, submission_mode: 'team' },
        ]])
        .mockResolvedValueOnce([[
          { id: 500 },
        ]])
        .mockResolvedValueOnce([[
          { student_id: 5 },
          { student_id: 6 },
        ]])
        .mockResolvedValueOnce([[
          { id: 100 },
        ]])
        .mockResolvedValueOnce([{}]);

      await createSubmission(req, res);

      const updateCalls = mockPoolQuery.mock.calls.filter(
        ([sql]) => sql.includes('UPDATE assessment_submissions'),
      );

      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0][1]).toEqual([
        500,
        'https://github.com/test/team-project',
        'newcommit123',
        5,
        100,
      ]);

      expect(mockAnalyzeSubmissionWithGemini).toHaveBeenCalledWith(
        100,
        'test',
        'team-project',
        'newcommit123',
        [100],
      );
    });

    it('returns an error when assessment does not exist', async () => {
      const req = createReq({
        body: {
          assessment_id: 999,
          github_repo_url: 'https://github.com/test/project',
        },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[]]);

      await expect(createSubmission(req, res))
        .rejects.toThrow('Assessment not found');
    });

    it('handles database errors', async () => {
      const req = createReq({
        body: {
          assessment_id: 10,
          github_repo_url: 'https://github.com/test/project',
        },
      });
      const res = createRes();

      mockPoolQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(createSubmission(req, res))
        .rejects.toThrow('Database error');
    });
  });

  // =========================================================
  // REVIEW SUBMISSION
  // =========================================================

  describe('reviewSubmission', () => {
    it('reviews and approves an individual submission', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          action: 'approved',
          final_score: 90,
          teacher_feedback: 'Good work.',
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          {
            id: 100,
            assessment_id: 10,
            student_id: 5,
            team_id: null,
            group_id: 20,
            submission_mode: 'individual',
          },
        ]])
        .mockResolvedValueOnce([[]]);

      mockConnQuery.mockResolvedValue([{}]);

      await reviewSubmission(req, res);

      expect(mockTeacherOwnsGroup).toHaveBeenCalledWith(10, 20);
      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('updates an existing AI evaluation', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          action: 'approved',
          final_score: 85,
          teacher_feedback: 'Needs some improvements.',
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          {
            id: 100,
            assessment_id: 10,
            student_id: 5,
            team_id: null,
            group_id: 20,
            submission_mode: 'individual',
          },
        ]])
        .mockResolvedValueOnce([[
          {
            id: 50,
            strengths: null,
            areas_for_improvement: null,
            recommendations: null,
            suggested_next_steps: null,
          },
        ]]);

      await reviewSubmission(req, res);

      const updateEvalCalls = mockConnQuery.mock.calls.filter(
        ([sql]) => sql.includes('UPDATE ai_evaluations'),
      );

      expect(updateEvalCalls).toHaveLength(1);
      expect(mockCommit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('creates assessment scores for all team members when a team submission is approved', async () => {
      const req = createReq({
        user: { sub: 99, role: 'teacher' },
        params: { id: '100' },
        body: {
          action: 'approved',
          final_score: 90,
          teacher_feedback: 'Great teamwork.',
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          {
            id: 100,
            assessment_id: 10,
            student_id: null,
            team_id: 500,
            group_id: 20,
            submission_mode: 'team',
          },
        ]])
        .mockResolvedValueOnce([[]]);

mockConnQuery.mockImplementation(async (sql) => {
  if (sql.includes('FROM team_members')) {
    return [[
      { student_id: 30 },
      { student_id: 31 },
    ]];
  }

  if (sql.includes('INSERT INTO ai_evaluations')) {
    return [{ insertId: 50 }];
  }

  return [{}];
});
      await reviewSubmission(req, res);

      const scoreInsertCalls = mockConnQuery.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO assessment_scores'),
      );

      expect(scoreInsertCalls).toHaveLength(2);

      expect(scoreInsertCalls[0][1]).toEqual([
      10,
      30,
      '100',
      90,
      'Great teamwork.',
      ]);

      expect(scoreInsertCalls[1][1]).toEqual([
  10,
  31,
  '100',
  90,
  'Great teamwork.',
]);

      const feedbackInsertCalls = mockConnQuery.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO teacher_feedback'),
      );

      expect(feedbackInsertCalls).toHaveLength(2);
      expect(mockCommit).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('saves a draft review without approving the submission', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          action: 'save',
          final_score: null,
          teacher_feedback: 'Draft feedback.',
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          {
            id: 100,
            assessment_id: 10,
            student_id: 5,
            team_id: null,
            group_id: 20,
            status: 'submitted',
            submission_mode: 'individual',
          },
        ]])
        .mockResolvedValueOnce([[
          { id: 50 },
        ]]);

      await reviewSubmission(req, res);

      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('rolls back transaction when review fails', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          action: 'approved',
          final_score: 90,
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          {
            id: 100,
            assessment_id: 10,
            student_id: 5,
            team_id: null,
            group_id: 20,
            submission_mode: 'individual',
          },
        ]])
        .mockResolvedValueOnce([[]]);

      mockConnQuery.mockRejectedValueOnce(
        new Error('Transaction error'),
      );

      await expect(reviewSubmission(req, res))
        .rejects.toThrow('Transaction error');

      expect(mockRollback).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('returns 404 when submission does not exist', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '999' },
        body: { action: 'approved', final_score: 90 },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[]]);

      await expect(reviewSubmission(req, res))
        .rejects.toThrow('Submission not found');
    });
  });

  // =========================================================
  // REQUEST RESUBMISSION
  // =========================================================

  describe('requestResubmission', () => {
    it('requests resubmission for an individual submission', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          teacher_feedback: 'Please fix the issues.',
        },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[
        {
          id: 100,
          student_id: 5,
          team_id: null,
          assessment_id: 10,
          group_id: 20,
          submission_mode: 'individual',
        },
      ]]);

      mockConnQuery
        .mockResolvedValueOnce([[{ id: 50 }]])
        .mockResolvedValue([{}]);

      await requestResubmission(req, res);

      expect(mockTeacherOwnsGroup).toHaveBeenCalledWith(10, 20);
      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resubmission requested',
        data: {
          id: '100',
          status: 'rejected',
          resubmission_requested: true,
        },
      });
    });

    it('requests resubmission for the shared team submission', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          teacher_feedback: 'Please improve the project.',
        },
      });
      const res = createRes();

      mockPoolQuery
        .mockResolvedValueOnce([[
          {
            id: 100,
            student_id: null,
            team_id: 500,
            assessment_id: 10,
            group_id: 20,
            submission_mode: 'team',
          },
        ]])
        .mockResolvedValueOnce([[
          { id: 100 },
        ]]);

      mockConnQuery
        .mockResolvedValueOnce([[{ id: 50 }]])
        .mockResolvedValue([{}]);

      await requestResubmission(req, res);

      const updateSubmissionCalls = mockConnQuery.mock.calls.filter(
        ([sql]) => sql.includes('UPDATE assessment_submissions'),
      );

      expect(updateSubmissionCalls).toHaveLength(1);
      expect(updateSubmissionCalls[0][1]).toEqual([100]);
      expect(mockCommit).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('creates an AI evaluation when one does not exist', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          teacher_feedback: 'Please resubmit.',
        },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[
        {
          id: 100,
          student_id: 5,
          team_id: null,
          assessment_id: 10,
          group_id: 20,
          submission_mode: 'individual',
        },
      ]]);

      mockConnQuery
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

      await requestResubmission(req, res);

      const insertEvalCalls = mockConnQuery.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO ai_evaluations'),
      );

      expect(insertEvalCalls).toHaveLength(1);

      expect(insertEvalCalls[0][1]).toEqual([
        100,
        10,
        '[RESUBMISSION_REQUESTED] Please resubmit.',
      ]);

      expect(mockCommit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('uses default message when no message is provided', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {},
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[
        {
          id: 100,
          student_id: 5,
          team_id: null,
          assessment_id: 10,
          group_id: 20,
          submission_mode: 'individual',
        },
      ]]);

      mockConnQuery
        .mockResolvedValueOnce([[{ id: 50 }]])
        .mockResolvedValue([{}]);

      await requestResubmission(req, res);

      const updateEvalCalls = mockConnQuery.mock.calls.filter(
        ([sql]) => sql.includes('UPDATE ai_evaluations'),
      );

      expect(updateEvalCalls).toHaveLength(1);

      expect(updateEvalCalls[0][1][0]).toBe(
         '[RESUBMISSION_REQUESTED] Your teacher has requested that you resubmit this assignment.',);
      expect(mockCommit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('rolls back when resubmission request fails', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '100' },
        body: {
          teacher_feedback: 'Please fix.',
        },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[
        {
          id: 100,
          student_id: 5,
          team_id: null,
          assessment_id: 10,
          group_id: 20,
          submission_mode: 'individual',
        },
      ]]);

      mockConnQuery.mockRejectedValueOnce(
        new Error('Transaction error'),
      );

      await expect(requestResubmission(req, res))
        .rejects.toThrow('Transaction error');

      expect(mockRollback).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('returns 404 when submission does not exist', async () => {
      const req = createReq({
        user: { sub: 10, role: 'teacher' },
        params: { id: '999' },
        body: {
          teacher_feedback: 'Please fix.',
        },
      });
      const res = createRes();

      mockPoolQuery.mockResolvedValueOnce([[]]);

      await expect(requestResubmission(req, res))
        .rejects.toThrow('Submission not found');
    });
  });
});