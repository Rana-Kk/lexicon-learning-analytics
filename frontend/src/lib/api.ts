import type { User, Certificate } from '../types'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const TOKEN_KEY = 'lexicon_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface BackendUser {
  id: number
  name: string
  email: string
  role: 'admin' | 'teacher' | 'student'
  is_active?: number | boolean
  must_change_password?: number | boolean
  bio?: string
  avatar?: string
  github_username?: string
}
function toUser(u: BackendUser): User {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    active:
      u.is_active === undefined
        ? undefined
        : Boolean(u.is_active),
    bio: u.bio,
    avatar: u.avatar,
    githubUsername: u.github_username,
    must_change_password: u.must_change_password === undefined ? undefined : Boolean(u.must_change_password)
  }
}

interface BackendCertificate {
  id: number
  student_id: number
  student_name?: string
  name: string
  issuing_organization?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  certificate_code?: string | null
  file_url?: string | null
}

function toCertificate(c: BackendCertificate): Certificate {
  return {
    id: String(c.id),
    studentId: c.student_id !== undefined ? String(c.student_id) : undefined,
    studentName: c.student_name,
    name: c.name,
    issuingOrganization: c.issuing_organization || '',
    issueDate: c.issue_date || '',
    expiryDate: c.expiry_date || undefined,
    certificateCode: c.certificate_code || undefined,
    fileUrl: c.file_url || undefined,
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = getToken()

  const baseUrl = API_URL.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/')
    ? path
    : `/${path}`

  const url = `${baseUrl}${cleanPath}`

  console.log('[API REQUEST]', url)

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),

      ...options.headers,
    },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error ||
        data.message ||
        'Request failed'
    )
  }

  return data
}/* =========================
   AUTH
========================= */

export async function login(
  email: string,
  password: string
) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password
    })
  })

  setToken(data.token)

  const user = toUser(data.user)

  return user
}

export function logout() {
  clearToken()
}

export const me = () =>
  apiFetch('/auth/me')

export const changePassword = (
  current_password: string,
  new_password: string
) =>
  apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password,
      new_password,
    }),
  })
/* =========================
   USERS
========================= */

export const getUsers = (
  role?: string
) =>
  apiFetch(
    `/users${
      role
        ? `?role=${encodeURIComponent(role)}`
        : ''
    }`
  )

export const createUser = (
  data: any
) =>
  apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const updateUser = (
  id: number | string,
  data: any
) =>
  apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })

export const deleteUser = (
  id: number | string
) =>
  apiFetch(`/users/${id}`, {
    method: 'DELETE'
  })

export const importStudents = (
  students: any[]
) =>
  apiFetch('/users/import-students', {
    method: 'POST',
    body: JSON.stringify({
      students
    })
  })

export const importStudentsExcel = (
  file_base64: string,
  filename: string
) =>
  apiFetch('/users/import-students/excel', {
    method: 'POST',
    body: JSON.stringify({
      file_base64,
      filename
    })
  })

/* =========================
   GROUPS
========================= */

export const getGroups = (
  courseId?: number | string
) =>
  apiFetch(
    `/groups${
      courseId
        ? `?course_id=${encodeURIComponent(courseId)}`
        : ''
    }`
  )
export const getMyGroups = () =>
  apiFetch('/groups/my')

export const createGroup = (
  data: any
) =>
  apiFetch('/groups', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const updateGroup = (
  id: number | string,
  data: any
) =>
  apiFetch(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })

export const deleteGroup = (
  id: number | string
) =>
  apiFetch(`/groups/${id}`, {
    method: 'DELETE'
  })

export const getGroupStudents = (
  id: number | string
) =>
  apiFetch(`/groups/${id}/students`)

export const addStudentToGroup = (
  id: number | string,
  studentId: number | string
) =>
  apiFetch(`/groups/${id}/students`, {
    method: 'POST',
    body: JSON.stringify({
      studentId
    })
  })

export const getMyTeam = () => apiFetch('/teams/my')
export const getTeams = (groupId?: number | string) =>
  apiFetch(
    `/teams${groupId ? `?group_id=${encodeURIComponent(String(groupId))}` : ''}`
  )

export const createTeam = (data: {
  group_id: number | string
  name: string
  student_ids?: (number | string)[]
}) =>
  apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const updateTeam = (
  id: number | string,
  data: { name: string }
) =>
  apiFetch(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })

export const deleteTeam = (id: number | string) =>
  apiFetch(`/teams/${id}`, {
    method: 'DELETE'
  })

export const addTeamMember = (
  teamId: number | string,
  studentId: number | string
) =>
  apiFetch(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({
      student_id: studentId
    })
  })

export const removeTeamMember = (
  teamId: number | string,
  studentId: number | string
) =>
  apiFetch(`/teams/${teamId}/members/${studentId}`, {
    method: 'DELETE'
  })
export const removeStudentFromGroup = (
  id: number | string,
  studentId: number | string
) =>
  apiFetch(
    `/groups/${id}/students/${studentId}`,
    {
      method: 'DELETE'
    }
  )

export const getGroupTeachers = (
  id: number | string
) =>
  apiFetch(`/groups/${id}/teachers`)

export const assignTeacherToGroup = (
  id: number | string,
  teacherId: number | string
) =>
  apiFetch(`/groups/${id}/teachers`, {
    method: 'POST',
    body: JSON.stringify({
      teacherId
    })
  })

export const removeTeacherFromGroup = (
  id: number | string,
  teacherId: number | string
) =>
  apiFetch(
    `/groups/${id}/teachers/${teacherId}`,
    {
      method: 'DELETE'
    }
  )

/* =========================
   COURSES
========================= */

export const getCourses = () =>
  apiFetch('/courses')

export const createCourse = (
  data: any
) =>
  apiFetch('/courses', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const updateCourse = (
  id: number | string,
  data: any
) =>
  apiFetch(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })

export const deleteCourse = (
  id: number | string
) =>
  apiFetch(`/courses/${id}`, {
    method: 'DELETE'
  })

/* =========================
   ASSESSMENTS
========================= */

export const getAssessments = (
  groupId?: number | string
) =>
  apiFetch(
    `/assessments${
      groupId
        ? `?group_id=${encodeURIComponent(groupId)}`
        : ''
    }`
  )

export const getAssessmentById = (
  id: number | string
) =>
  apiFetch(`/assessments/${id}`)

/* =========================
   CRITERIA TEMPLATES (Checklist)
========================= */

export const getCriteriaTemplates = () =>
  apiFetch('/criteria-templates')

export const getCriteriaTemplateById = (
  id: number | string
) =>
  apiFetch(`/criteria-templates/${id}`)

export const createAssessment = (
  data: any
) =>
  apiFetch('/assessments', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const updateAssessment = (
  id: number | string,
  data: any
) =>
  apiFetch(`/assessments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })

export const deleteAssessment = (
  id: number | string
) =>
  apiFetch(`/assessments/${id}`, {
    method: 'DELETE'
  })

/* =========================
   SUBMISSIONS
========================= */

export const getSubmissions = (
  params?: Record<
    string,
    string | number | boolean | null | undefined
  >
) => {
  const q = new URLSearchParams()

  Object.entries(params || {}).forEach(
    ([key, value]) => {
      if (value != null) {
        q.append(key, String(value))
      }
    }
  )

  return apiFetch(
    `/submissions${
      q.toString()
        ? `?${q.toString()}`
        : ''
    }`
  )
}

export const getSubmissionById = (
  id: number | string
) =>
  apiFetch(`/submissions/${id}`)

export const createSubmission = (
  data: any
) =>
  apiFetch('/submissions', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const reviewSubmission = (
  id: number | string,
  data: any
) =>
  apiFetch(
    `/submissions/${id}/review`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    }
  )

/* =========================
   ATTENDANCE
========================= */

export const getAttendance = (params?: {
  group_id?: number | string
  attendance_date?: string
  session?: 'morning' | 'afternoon'
  student_id?: number | string
}) => {
  const searchParams = new URLSearchParams()

  if (params?.group_id !== undefined) {
    searchParams.set('group_id', String(params.group_id))
  }

  if (params?.attendance_date) {
    searchParams.set('attendance_date', params.attendance_date)
  }

  if (params?.session) {
    searchParams.set('session', params.session)
  }

  if (params?.student_id !== undefined) {
    searchParams.set('student_id', String(params.student_id))
  }

  const query = searchParams.toString()

  return apiFetch(
    `/attendance${query ? `?${query}` : ''}`
  )
}

export const saveAttendance = (data: {
  group_id: number | string
  attendance_date: string
  session: 'morning' | 'afternoon'
  records: {
    student_id: number | string
    status: 'present' | 'late' | 'absent' | 'excused'
    note?: string
  }[]
}) =>
  apiFetch('/attendance/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getGroupAttendance = (
  groupId: number | string,
  attendanceDate?: string,
  session?: 'morning' | 'afternoon'
) => {
  const params = new URLSearchParams()

  params.set('group_id', String(groupId))

  if (attendanceDate) {
    params.set('attendance_date', attendanceDate)
  }

  if (session) {
    params.set('session', session)
  }

  return apiFetch(
    `/attendance?${params.toString()}`
  )
}
export const getGroupAttendanceSummary = (
  groupId: number | string
) => apiFetch(`/attendance/group/${groupId}/summary`)

    export const createAttendanceAppeal = (attendanceId: number) =>
  apiFetch('/attendance/appeals', {
    method: 'POST',
    body: JSON.stringify({ attendance_id: attendanceId })
  })

export const getMyAttendanceAppeals = () =>
  apiFetch('/attendance/appeals')

export const getPendingAttendanceAppeals = (groupId?: number) =>
  apiFetch(
    groupId
      ? `/attendance/appeals/pending?group_id=${groupId}`
      : '/attendance/appeals/pending'
  )

export const reviewAttendanceAppeal = (
  id: number | string,
  status: 'accepted' | 'rejected'
) =>
  apiFetch(`/attendance/appeals/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
/* =========================
   QUIZZES
========================= */
export const getQuizResults = (
  params?: Record<
    string,
    string | number | boolean | null | undefined
  >
) => {
  const q = new URLSearchParams()

  Object.entries(params || {}).forEach(
    ([key, value]) => {
      if (value != null) {
        q.append(key, String(value))
      }
    }
  )

  return apiFetch(
    `/quizzes/results${
      q.toString()
        ? `?${q.toString()}`
        : ''
    }`
  )
}
export const getQuizzes = (
  groupId?: number | string
) =>
  apiFetch(
    `/quizzes${
      groupId
        ? `?group_id=${encodeURIComponent(groupId)}`
        : ''
    }`
  )

export const bulkImportQuizResults = (data: {
  file_name: string
  results: Array<{
    email: string
    quiz_title: string
    topic?: string
    score: number
    completed_at?: string
  }>
}) =>
  apiFetch('/quizzes/results/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })


export const createQuiz = (
  data: any
) =>
  apiFetch('/quizzes', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const saveQuizResult = (
  data: any
) =>
  apiFetch('/quizzes/results', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const importQuizResults = (data: {
  file_name: string
  results: {
    email: string
    quiz_title: string
    score: number
    completed_at?: string
  }[]
}) =>
  apiFetch('/quizzes/results/import', {
    method: 'POST',
    body: JSON.stringify(data),
  })
/* =========================
   COMPETENCIES
========================= */

export const getCompetencies = () =>
  apiFetch('/competencies')

export const getMyCompetencies = () =>
  apiFetch('/competencies/me')

export const getStudentCompetencies = (
  id: number | string
) =>
  apiFetch(`/competencies/student/${id}`)

export const saveCompetency = (
  data: any
) =>
  apiFetch('/competencies/student', {
    method: 'PUT',
    body: JSON.stringify(data)
  })
export const createCompetency = (data: {
  name: string
  description?: string
  group_id?: number
}) =>
  apiFetch('/competencies', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  
/* =========================
   GROUP COMPETENCIES
========================= */

export const getGroupCompetencies = (
  groupId: number | string
) =>
  apiFetch(`/competencies/group/${groupId}`)


export const addGroupCompetency = (data: {
  group_id: number
  competency_id: number
}) =>
  apiFetch('/competencies/group', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  
export const deleteGroupCompetency = (
  groupId: number | string,
  competencyId: number | string
) =>
  apiFetch(
    `/competencies/group/${groupId}/${competencyId}`,
    {
      method: 'DELETE'
    }
  )

/* =========================
   FEEDBACK
========================= */

export const getFeedback = (
  studentId?: number | string
) =>
  apiFetch(
    `/feedback${
      studentId
        ? `?student_id=${encodeURIComponent(studentId)}`
        : ''
    }`
  )

export const getFeedbackTemplates = () =>
  apiFetch('/feedback/templates')

export const createFeedback = (
  data: any
) =>
  apiFetch('/feedback', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const createFeedbackTemplate = (
  data: any
) =>
  apiFetch('/feedback/templates', {
    method: 'POST',
    body: JSON.stringify(data)
  })

export const deleteFeedback = (
  id: number | string
) =>
  apiFetch(`/feedback/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })

/* =========================
   CERTIFICATES
========================= */

export const getCertificates = async (
  studentId?: number | string
) => {
  const res = await apiFetch(
    `/certificates${
      studentId
        ? `?student_id=${encodeURIComponent(studentId)}`
        : ''
    }`
  )

  return {
    ...res,
    data: Array.isArray(res?.data)
      ? res.data.map(toCertificate)
      : []
  }
}

export const createCertificate = async (
  data: any
) => {
  const res = await apiFetch('/certificates', {
    method: 'POST',
    body: JSON.stringify(data)
  })

  return { ...res, data: res?.data ? toCertificate(res.data) : res?.data }
}

export const updateCertificate = async (
  id: number | string,
  data: any
) => {
  const res = await apiFetch(`/certificates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })

  return { ...res, data: res?.data ? toCertificate(res.data) : res?.data }
}

export const deleteCertificate = (
  id: number | string
) =>
  apiFetch(`/certificates/${id}`, {
    method: 'DELETE'
  })

/* =========================
   ANALYTICS
========================= */

export const getAnalyticsOverview = (
  params?: Record<
    string,
    string | number | boolean | null | undefined
  >
) => {
  const q = new URLSearchParams()

  Object.entries(params || {}).forEach(
    ([key, value]) => {
      if (value != null) {
        q.append(key, String(value))
      }
    }
  )

  return apiFetch(
    `/analytics/overview${
      q.toString()
        ? `?${q.toString()}`
        : ''
    }`
  )
}

export const getGroupAnalytics = () =>
  apiFetch('/analytics/groups')

export const getStudentAnalytics = (
  groupId?: number | string
) =>
  apiFetch(
    `/analytics/students${
      groupId
        ? `?group_id=${encodeURIComponent(groupId)}`
        : ''
    }`
  )
export const getStudentAssessments = () =>
  apiFetch('/assessments/student')

export const getStudentReport = (
  id?: number | string
) =>
  apiFetch(
    id
      ? `/reports/student/${id}`
      : '/reports/me'
  )

/* =========================
   TEACHER STUDENT OVERVIEW
========================= */

export const getStudentAcademicOverview = (
  studentId: number | string,
  groupId: number | string
) => apiFetch(`/users/${studentId}/academic-overview?group_id=${encodeURIComponent(groupId)}`)
export const saveAssessmentChecklistResults = (
  studentId: number | string,
  assessmentId: number | string,
  data: any
) =>
  apiFetch(
    `/student-checklists/${studentId}/assessments/${assessmentId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    }
  )
export const saveFinalGrade = (
  studentId: number | string,
  data: { group_id: number | string; score: string | number; comment?: string }
) => apiFetch(`/users/${studentId}/final-grade`, {
  method: 'PUT',
  body: JSON.stringify(data)
})

/* =========================
   STUDENT CHECKLIST EVALUATIONS
========================= */

export const getStudentChecklist = (studentId: number | string, groupId: number | string) =>
  apiFetch(`/student-checklists/${studentId}?group_id=${encodeURIComponent(groupId)}`)

export const saveStudentChecklist = (
  studentId: number | string,
  assessmentId: number | string,
  data: any
) => apiFetch(`/student-checklists/${studentId}/assessments/${assessmentId}`, {
  method: 'PUT',
  body: JSON.stringify(data)
})