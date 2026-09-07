import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from './api'

function mockFetchOnce(body: any, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('token helpers', () => {
  beforeEach(() => localStorage.clear())

  it('getToken reads from localStorage', () => {
    localStorage.setItem('lexicon_token', 'abc123')
    expect(api.getToken()).toBe('abc123')
  })

  it('getToken returns null when unset', () => {
    expect(api.getToken()).toBeNull()
  })

  it('clearToken removes the stored token', () => {
    localStorage.setItem('lexicon_token', 'abc123')
    api.clearToken()
    expect(localStorage.getItem('lexicon_token')).toBeNull()
  })
})

describe('ApiError', () => {
  it('carries status and message', () => {
    const err = new api.ApiError(404, 'Not found')
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('apiFetch', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('builds the url from the base API url and path', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.apiFetch('/foo')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/foo',
      expect.any(Object)
    )
  })

  it('prefixes a path with a leading slash when missing', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.apiFetch('foo')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/foo',
      expect.any(Object)
    )
  })

  it('sends Content-Type but no Authorization header when no token is stored', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.apiFetch('/foo')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('attaches a bearer token when one is stored', async () => {
    localStorage.setItem('lexicon_token', 'my-token')
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.apiFetch('/foo')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer my-token')
  })

  it('lets caller-supplied headers override the defaults', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.apiFetch('/foo', { headers: { 'Content-Type': 'text/plain' } })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('text/plain')
  })

  it('passes through method and body options', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.apiFetch('/foo', { method: 'POST', body: JSON.stringify({ a: 1 }) })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ a: 1 }))
  })

  it('returns the parsed JSON body on success', async () => {
    global.fetch = mockFetchOnce({ data: [1, 2, 3] }) as any

    const result = await api.apiFetch('/foo')

    expect(result).toEqual({ data: [1, 2, 3] })
  })

  it('falls back to an empty object when the response body is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('bad json')),
    }) as any

    const result = await api.apiFetch('/foo')

    expect(result).toEqual({})
  })

  it('throws an ApiError with the server error message on failure', async () => {
    global.fetch = mockFetchOnce({ error: 'Invalid credentials' }, false, 401) as any

    await expect(api.apiFetch('/foo')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    })
  })

  it('falls back to the message field when error is absent', async () => {
    global.fetch = mockFetchOnce({ message: 'Something broke' }, false, 500) as any

    await expect(api.apiFetch('/foo')).rejects.toMatchObject({
      status: 500,
      message: 'Something broke',
    })
  })

  it('falls back to a generic message when neither error nor message is present', async () => {
    global.fetch = mockFetchOnce({}, false, 500) as any

    await expect(api.apiFetch('/foo')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed',
    })
  })
})

describe('auth', () => {
  const originalFetch = global.fetch

  beforeEach(() => localStorage.clear())
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('login stores the token and maps the returned user', async () => {
    global.fetch = mockFetchOnce({
      token: 'new-token',
      user: {
        id: 7,
        name: 'Ada',
        email: 'ada@example.com',
        role: 'teacher',
        is_active: 1,
        must_change_password: 0,
        bio: 'hi',
        avatar: 'a.png',
        github_username: 'ada',
      },
    }) as any

    const user = await api.login('ada@example.com', 'pw')

    expect(localStorage.getItem('lexicon_token')).toBe('new-token')
    expect(user).toEqual({
      id: '7',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'teacher',
      active: true,
      bio: 'hi',
      avatar: 'a.png',
      githubUsername: 'ada',
      must_change_password: false,
    })
  })

  it('login posts credentials to /auth/login', async () => {
    const fetchMock = mockFetchOnce({ token: 't', user: { id: 1, name: 'A', email: 'a@b.c', role: 'student' } })
    global.fetch = fetchMock as any

    await api.login('a@b.c', 'secret')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/auth/login')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.c', password: 'secret' })
  })

  it('maps undefined is_active/must_change_password to undefined, not false', async () => {
    global.fetch = mockFetchOnce({
      token: 't',
      user: { id: 2, name: 'B', email: 'b@c.d', role: 'admin' },
    }) as any

    const user = await api.login('b@c.d', 'pw')

    expect(user.active).toBeUndefined()
    expect(user.must_change_password).toBeUndefined()
  })

  it('logout clears the stored token', () => {
    localStorage.setItem('lexicon_token', 'x')
    api.logout()
    expect(localStorage.getItem('lexicon_token')).toBeNull()
  })

  it('me fetches /auth/me', async () => {
    const fetchMock = mockFetchOnce({ id: 1 })
    global.fetch = fetchMock as any
    await api.me()
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/auth/me')
  })

  it('changePassword posts current and new password', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    global.fetch = fetchMock as any

    await api.changePassword('old', 'new')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/auth/change-password')
    expect(JSON.parse(options.body)).toEqual({ current_password: 'old', new_password: 'new' })
  })
})

describe('certificates transform', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('maps backend certificate fields to the frontend shape', async () => {
    global.fetch = mockFetchOnce({
      data: [
        {
          id: 3,
          student_id: 9,
          student_name: 'Sam',
          name: 'React Cert',
          issuing_organization: 'Meta',
          issue_date: '2024-01-01',
          expiry_date: '2026-01-01',
          certificate_code: 'ABC',
          file_url: 'http://x/y.pdf',
        },
      ],
    }) as any

    const res = await api.getCertificates()

    expect(res.data).toEqual([
      {
        id: '3',
        studentId: '9',
        studentName: 'Sam',
        name: 'React Cert',
        issuingOrganization: 'Meta',
        issueDate: '2024-01-01',
        expiryDate: '2026-01-01',
        certificateCode: 'ABC',
        fileUrl: 'http://x/y.pdf',
      },
    ])
  })

  it('defaults data to an empty array when the response has no array', async () => {
    global.fetch = mockFetchOnce({}) as any

    const res = await api.getCertificates()

    expect(res.data).toEqual([])
  })

  it('appends student_id as a query param when provided', async () => {
    const fetchMock = mockFetchOnce({ data: [] })
    global.fetch = fetchMock as any

    await api.getCertificates(42)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/certificates?student_id=42'
    )
  })

  it('fills in missing optional fields with sensible defaults', async () => {
    global.fetch = mockFetchOnce({
      data: [{ id: 1, student_id: 1, name: 'Cert' }],
    }) as any

    const res = await api.getCertificates()

    expect(res.data[0]).toMatchObject({
      issuingOrganization: '',
      issueDate: '',
      expiryDate: undefined,
      certificateCode: undefined,
      fileUrl: undefined,
    })
  })

  it('createCertificate transforms the created record', async () => {
    global.fetch = mockFetchOnce({
      data: { id: 5, student_id: 2, name: 'New Cert' },
    }) as any

    const res = await api.createCertificate({ name: 'New Cert' })

    expect(res.data).toMatchObject({ id: '5', studentId: '2', name: 'New Cert' })
  })

  it('createCertificate passes through a falsy data field untouched', async () => {
    global.fetch = mockFetchOnce({ data: null }) as any

    const res = await api.createCertificate({ name: 'x' })

    expect(res.data).toBeNull()
  })

  it('updateCertificate transforms the updated record', async () => {
    global.fetch = mockFetchOnce({
      data: { id: 5, student_id: 2, name: 'Updated' },
    }) as any

    const res = await api.updateCertificate(5, { name: 'Updated' })

    expect(res.data).toMatchObject({ id: '5', name: 'Updated' })
  })
})

describe('simple wrapper functions call the right endpoint and method', () => {
  const originalFetch = global.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = mockFetchOnce({ data: [] })
    global.fetch = fetchMock as any
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const base = 'http://localhost:3000/api'

  const cases: Array<[string, () => Promise<any>, string, string]> = [
    ['getUsers (no role)', () => api.getUsers(), `${base}/users`, 'GET'],
    ['getUsers (role)', () => api.getUsers('teacher'), `${base}/users?role=teacher`, 'GET'],
    ['createUser', () => api.createUser({ name: 'x' }), `${base}/users`, 'POST'],
    ['updateUser', () => api.updateUser(1, { name: 'x' }), `${base}/users/1`, 'PUT'],
    ['deleteUser', () => api.deleteUser(1), `${base}/users/1`, 'DELETE'],
    ['importStudents', () => api.importStudents([]), `${base}/users/import-students`, 'POST'],
    [
      'importStudentsExcel',
      () => api.importStudentsExcel('b64', 'f.xlsx'),
      `${base}/users/import-students/excel`,
      'POST',
    ],
    ['getGroups (no course)', () => api.getGroups(), `${base}/groups`, 'GET'],
    ['getGroups (course)', () => api.getGroups(3), `${base}/groups?course_id=3`, 'GET'],
    ['getMyGroups', () => api.getMyGroups(), `${base}/groups/my`, 'GET'],
    ['createGroup', () => api.createGroup({}), `${base}/groups`, 'POST'],
    ['updateGroup', () => api.updateGroup(1, {}), `${base}/groups/1`, 'PUT'],
    ['deleteGroup', () => api.deleteGroup(1), `${base}/groups/1`, 'DELETE'],
    ['getGroupStudents', () => api.getGroupStudents(1), `${base}/groups/1/students`, 'GET'],
    [
      'addStudentToGroup',
      () => api.addStudentToGroup(1, 2),
      `${base}/groups/1/students`,
      'POST',
    ],
    [
      'removeStudentFromGroup',
      () => api.removeStudentFromGroup(1, 2),
      `${base}/groups/1/students/2`,
      'DELETE',
    ],
    ['getGroupTeachers', () => api.getGroupTeachers(1), `${base}/groups/1/teachers`, 'GET'],
    [
      'assignTeacherToGroup',
      () => api.assignTeacherToGroup(1, 2),
      `${base}/groups/1/teachers`,
      'POST',
    ],
    [
      'removeTeacherFromGroup',
      () => api.removeTeacherFromGroup(1, 2),
      `${base}/groups/1/teachers/2`,
      'DELETE',
    ],
    ['getMyTeam', () => api.getMyTeam(), `${base}/teams/my`, 'GET'],
    ['getTeams (no group)', () => api.getTeams(), `${base}/teams`, 'GET'],
    ['getTeams (group)', () => api.getTeams(4), `${base}/teams?group_id=4`, 'GET'],
    ['createTeam', () => api.createTeam({ group_id: 1, name: 'T' }), `${base}/teams`, 'POST'],
    ['updateTeam', () => api.updateTeam(1, { name: 'T' }), `${base}/teams/1`, 'PUT'],
    ['deleteTeam', () => api.deleteTeam(1), `${base}/teams/1`, 'DELETE'],
    ['addTeamMember', () => api.addTeamMember(1, 2), `${base}/teams/1/members`, 'POST'],
    [
      'removeTeamMember',
      () => api.removeTeamMember(1, 2),
      `${base}/teams/1/members/2`,
      'DELETE',
    ],
    ['getCourses', () => api.getCourses(), `${base}/courses`, 'GET'],
    ['createCourse', () => api.createCourse({}), `${base}/courses`, 'POST'],
    ['updateCourse', () => api.updateCourse(1, {}), `${base}/courses/1`, 'PUT'],
    ['deleteCourse', () => api.deleteCourse(1), `${base}/courses/1`, 'DELETE'],
    ['getAssessments (no group)', () => api.getAssessments(), `${base}/assessments`, 'GET'],
    [
      'getAssessments (group)',
      () => api.getAssessments(5),
      `${base}/assessments?group_id=5`,
      'GET',
    ],
    ['getAssessmentById', () => api.getAssessmentById(1), `${base}/assessments/1`, 'GET'],
    ['getCriteriaTemplates', () => api.getCriteriaTemplates(), `${base}/criteria-templates`, 'GET'],
    [
      'getCriteriaTemplateById',
      () => api.getCriteriaTemplateById(1),
      `${base}/criteria-templates/1`,
      'GET',
    ],
    ['createAssessment', () => api.createAssessment({}), `${base}/assessments`, 'POST'],
    ['updateAssessment', () => api.updateAssessment(1, {}), `${base}/assessments/1`, 'PUT'],
    ['deleteAssessment', () => api.deleteAssessment(1), `${base}/assessments/1`, 'DELETE'],
    ['getSubmissionById', () => api.getSubmissionById(1), `${base}/submissions/1`, 'GET'],
    ['createSubmission', () => api.createSubmission({}), `${base}/submissions`, 'POST'],
    [
      'reviewSubmission',
      () => api.reviewSubmission(1, {}),
      `${base}/submissions/1/review`,
      'PUT',
    ],
    ['saveAttendance', () => api.saveAttendance({} as any), `${base}/attendance/bulk`, 'POST'],
    [
      'getGroupAttendanceSummary',
      () => api.getGroupAttendanceSummary(1),
      `${base}/attendance/group/1/summary`,
      'GET',
    ],
    [
      'createAttendanceAppeal',
      () => api.createAttendanceAppeal(1),
      `${base}/attendance/appeals`,
      'POST',
    ],
    [
      'getMyAttendanceAppeals',
      () => api.getMyAttendanceAppeals(),
      `${base}/attendance/appeals`,
      'GET',
    ],
    [
      'getPendingAttendanceAppeals (no group)',
      () => api.getPendingAttendanceAppeals(),
      `${base}/attendance/appeals/pending`,
      'GET',
    ],
    [
      'getPendingAttendanceAppeals (group)',
      () => api.getPendingAttendanceAppeals(9),
      `${base}/attendance/appeals/pending?group_id=9`,
      'GET',
    ],
    [
      'reviewAttendanceAppeal',
      () => api.reviewAttendanceAppeal(1, 'accepted'),
      `${base}/attendance/appeals/1/review`,
      'PUT',
    ],
    ['getQuizResults (no params)', () => api.getQuizResults(), `${base}/quizzes/results`, 'GET'],
    [
      'getQuizResults (params)',
      () => api.getQuizResults({ group_id: 1, topic: null, q: undefined }),
      `${base}/quizzes/results?group_id=1`,
      'GET',
    ],
    ['getQuizzes (no group)', () => api.getQuizzes(), `${base}/quizzes`, 'GET'],
    ['getQuizzes (group)', () => api.getQuizzes(2), `${base}/quizzes?group_id=2`, 'GET'],
    [
      'bulkImportQuizResults',
      () => api.bulkImportQuizResults({ file_name: 'f', results: [] }),
      `${base}/quizzes/results/import`,
      'POST',
    ],
    ['createQuiz', () => api.createQuiz({}), `${base}/quizzes`, 'POST'],
    ['saveQuizResult', () => api.saveQuizResult({}), `${base}/quizzes/results`, 'POST'],
    [
      'importQuizResults',
      () => api.importQuizResults({ file_name: 'f', results: [] }),
      `${base}/quizzes/results/import`,
      'POST',
    ],
    ['getCompetencies', () => api.getCompetencies(), `${base}/competencies`, 'GET'],
    ['getMyCompetencies', () => api.getMyCompetencies(), `${base}/competencies/me`, 'GET'],
    [
      'getStudentCompetencies',
      () => api.getStudentCompetencies(1),
      `${base}/competencies/student/1`,
      'GET',
    ],
    ['saveCompetency', () => api.saveCompetency({}), `${base}/competencies/student`, 'PUT'],
    ['createCompetency', () => api.createCompetency({ name: 'x' }), `${base}/competencies`, 'POST'],
    [
      'getGroupCompetencies',
      () => api.getGroupCompetencies(1),
      `${base}/competencies/group/1`,
      'GET',
    ],
    [
      'addGroupCompetency',
      () => api.addGroupCompetency({ group_id: 1, competency_id: 2 }),
      `${base}/competencies/group`,
      'POST',
    ],
    [
      'deleteGroupCompetency',
      () => api.deleteGroupCompetency(1, 2),
      `${base}/competencies/group/1/2`,
      'DELETE',
    ],
    ['getFeedback (no student)', () => api.getFeedback(), `${base}/feedback`, 'GET'],
    [
      'getFeedback (student)',
      () => api.getFeedback(3),
      `${base}/feedback?student_id=3`,
      'GET',
    ],
    ['getFeedbackTemplates', () => api.getFeedbackTemplates(), `${base}/feedback/templates`, 'GET'],
    ['createFeedback', () => api.createFeedback({}), `${base}/feedback`, 'POST'],
    [
      'createFeedbackTemplate',
      () => api.createFeedbackTemplate({}),
      `${base}/feedback/templates`,
      'POST',
    ],
    ['deleteFeedback', () => api.deleteFeedback(1), `${base}/feedback/1`, 'DELETE'],
    ['deleteCertificate', () => api.deleteCertificate(1), `${base}/certificates/1`, 'DELETE'],
    [
      'getAnalyticsOverview (no params)',
      () => api.getAnalyticsOverview(),
      `${base}/analytics/overview`,
      'GET',
    ],
    [
      'getAnalyticsOverview (params)',
      () => api.getAnalyticsOverview({ group_id: 1 }),
      `${base}/analytics/overview?group_id=1`,
      'GET',
    ],
    ['getGroupAnalytics', () => api.getGroupAnalytics(), `${base}/analytics/groups`, 'GET'],
    [
      'getStudentAnalytics (no group)',
      () => api.getStudentAnalytics(),
      `${base}/analytics/students`,
      'GET',
    ],
    [
      'getStudentAnalytics (group)',
      () => api.getStudentAnalytics(1),
      `${base}/analytics/students?group_id=1`,
      'GET',
    ],
    [
      'getStudentAssessments',
      () => api.getStudentAssessments(),
      `${base}/assessments/student`,
      'GET',
    ],
    ['getStudentReport (me)', () => api.getStudentReport(), `${base}/reports/me`, 'GET'],
    [
      'getStudentReport (id)',
      () => api.getStudentReport(9),
      `${base}/reports/student/9`,
      'GET',
    ],
    [
      'getStudentAcademicOverview',
      () => api.getStudentAcademicOverview(1, 2),
      `${base}/users/1/academic-overview?group_id=2`,
      'GET',
    ],
    [
      'saveAssessmentChecklistResults',
      () => api.saveAssessmentChecklistResults(1, 2, {}),
      `${base}/student-checklists/1/assessments/2`,
      'PUT',
    ],
    [
      'saveFinalGrade',
      () => api.saveFinalGrade(1, { group_id: 1, score: 90 }),
      `${base}/users/1/final-grade`,
      'PUT',
    ],
    [
      'getStudentChecklist',
      () => api.getStudentChecklist(1, 2),
      `${base}/student-checklists/1?group_id=2`,
      'GET',
    ],
    [
      'saveStudentChecklist',
      () => api.saveStudentChecklist(1, 2, {}),
      `${base}/student-checklists/1/assessments/2`,
      'PUT',
    ],
  ]

  it.each(cases)('%s', async (_label, call, expectedUrl, expectedMethod) => {
    await call()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(expectedUrl)
    expect((options?.method ?? 'GET')).toBe(expectedMethod)
  })

  it('getSubmissions serializes provided params and omits null/undefined', async () => {
    await api.getSubmissions({ group_id: 1, status: null, q: undefined, assessment_id: 2 })
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${base}/submissions?group_id=1&assessment_id=2`
    )
  })

  it('getSubmissions with no params hits the bare endpoint', async () => {
    await api.getSubmissions()
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/submissions`)
  })

  it('getAttendance builds query params from provided fields only', async () => {
    await api.getAttendance({ group_id: 1, attendance_date: '2024-01-01', session: 'morning', student_id: 5 })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('group_id=1')
    expect(url).toContain('attendance_date=2024-01-01')
    expect(url).toContain('session=morning')
    expect(url).toContain('student_id=5')
  })

  it('getAttendance with no params returns the bare endpoint', async () => {
    await api.getAttendance()
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/attendance`)
  })

  it('getGroupAttendance always sets group_id and optionally date/session', async () => {
    await api.getGroupAttendance(1, '2024-02-02', 'afternoon')
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('group_id=1')
    expect(url).toContain('attendance_date=2024-02-02')
    expect(url).toContain('session=afternoon')
  })

  it('getGroupAttendance omits optional params when absent', async () => {
    await api.getGroupAttendance(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/attendance?group_id=1`)
  })
})