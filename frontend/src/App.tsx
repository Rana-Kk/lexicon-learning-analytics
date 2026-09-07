import { useState } from 'react'
import type { User } from './types'
import { logout as clearSession } from './lib/api'

import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'

import AdminLayout, { type AdminPage } from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTeachers from './pages/admin/AdminTeachers'
import AdminCourses from './pages/admin/AdminCourses'
import AdminGroups from './pages/admin/AdminGroups'
import AdminStudents from './pages/admin/AdminStudents'
import AdminTeams from './pages/admin/AdminTeams'
import AdminAnalytics from './pages/admin/AdminAnalytics'

import TeacherLayout, { type TeacherPage } from './layouts/TeacherLayout'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherGroups from './pages/teacher/TeacherGroups'
import TeacherAttendance from './pages/teacher/TeacherAttendance'
import TeacherAssessments from './pages/teacher/TeacherAssessments'
import TeacherSubmissions from './pages/teacher/TeacherSubmissions'
import TeacherAIEvaluations from './pages/teacher/TeacherAIEvaluations'
import TeacherQuizResults from './pages/teacher/TeacherQuizResults'
import TeacherAnalytics from './pages/teacher/TeacherAnalytics'
import TeacherReports from './pages/teacher/TeacherReports'
import TeacherCertificates from './pages/teacher/TeacherCertificates'
import TeacherCompetency from './pages/teacher/TeacherCompetency'
import TeacherFeedback from './pages/teacher/TeacherFeedback'

import StudentLayout, { type StudentPage } from './layouts/StudentLayout'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentTeam from './pages/student/StudentTeam'
import StudentAssignments from './pages/student/StudentAssignments'
import StudentSubmissions from './pages/student/StudentSubmissions'
import StudentQuizResults from './pages/student/StudentQuizResults'
import StudentAttendance from './pages/student/StudentAttendance'
import StudentCompetency from './pages/student/StudentCompetency'
import StudentFeedback from './pages/student/StudentFeedback'
import StudentCertificates from './pages/student/StudentCertificates'

function AdminShell({ user, onLogout, onUpdateUser }: { user: User; onLogout: () => void; onUpdateUser: (u: User) => void }) {
  const [page, setPage] = useState<AdminPage>('dashboard')
  const [showProfile, setShowProfile] = useState(false)

  const pages: Record<AdminPage, React.ReactNode> = {
    dashboard: <AdminDashboard />,
    teachers: <AdminTeachers />,
    courses: <AdminCourses />,
    groups: <AdminGroups />,
    students: <AdminStudents />,
    teams: <AdminTeams />,
    analytics: <AdminAnalytics />,
  }
  return (
    <AdminLayout user={user} currentPage={page} onNavigate={(p) => { setShowProfile(false); setPage(p) }} onLogout={onLogout} onProfile={() => setShowProfile(true)}>
      {showProfile
        ? <ProfilePage user={user} onSave={(u) => { onUpdateUser(u); setShowProfile(false) }} onBack={() => setShowProfile(false)} />
        : pages[page]}
    </AdminLayout>
  )
}

function TeacherShell({ user, onLogout, onUpdateUser }: { user: User; onLogout: () => void; onUpdateUser: (u: User) => void }) {
  const [page, setPage] = useState<TeacherPage>('dashboard')
  const [showProfile, setShowProfile] = useState(false)
  // Assessments / Submissions listelerinden bir öğrenci satırına tıklandığında
  // hangi submission'ın AI Evaluations sayfasında önceden seçili geleceğini tutar.
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | undefined>()

  const nav = (p: TeacherPage, submissionId?: number) => {
    setShowProfile(false)
    setPage(p)
    if (submissionId !== undefined) {
      setSelectedSubmissionId(submissionId)
    }
  }

  const pages: Record<TeacherPage, React.ReactNode> = {
    dashboard: <TeacherDashboard onNavigate={nav} />,
    groups: <TeacherGroups />,
    attendance: <TeacherAttendance />,
    assessments: <TeacherAssessments onNavigate={nav} />,
    submissions: <TeacherSubmissions onNavigate={nav} />,
    aievaluations: <TeacherAIEvaluations onNavigate={nav} initialSubmissionId={selectedSubmissionId} />,
    quizresults: <TeacherQuizResults />,
    analytics: <TeacherAnalytics />,
    reports: <TeacherReports />,
    certificates: <TeacherCertificates />,
    competency: <TeacherCompetency />,
    feedback: <TeacherFeedback />,
  }
  return (
    <TeacherLayout user={user} currentPage={page} onNavigate={nav} onLogout={onLogout} onProfile={() => setShowProfile(true)}>
      {showProfile
        ? <ProfilePage user={user} onSave={(u) => { onUpdateUser(u); setShowProfile(false) }} onBack={() => setShowProfile(false)} />
        : pages[page]}
    </TeacherLayout>
  )
}

function StudentShell({ user, onLogout, onUpdateUser }: { user: User; onLogout: () => void; onUpdateUser: (u: User) => void }) {
  const [page, setPage] = useState<StudentPage>('dashboard')
  const [showProfile, setShowProfile] = useState(false)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | undefined>()

  const nav = (p: StudentPage, assessmentId?: number) => {
    setShowProfile(false)
    setPage(p)

    if (assessmentId !== undefined) {
      setSelectedAssessmentId(assessmentId)
    }
  }
  const pages: Record<StudentPage, React.ReactNode> = {
    dashboard: <StudentDashboard onNavigate={nav} />,
    team: <StudentTeam />,
    assignments: <StudentAssignments onNavigate={nav} />,
    submissions: <StudentSubmissions assessmentId={selectedAssessmentId} />,
    quizresults: <StudentQuizResults />,
    attendance: <StudentAttendance />,
    competency: <StudentCompetency />,
    feedback: <StudentFeedback />,
    certificates: <StudentCertificates />,
  }
  return (
    <StudentLayout user={user} currentPage={page} onNavigate={nav} onLogout={onLogout} onProfile={() => setShowProfile(true)}>
      {showProfile
        ? <ProfilePage user={user} onSave={(u) => { onUpdateUser(u); setShowProfile(false) }} onBack={() => setShowProfile(false)} />
        : pages[page]}
    </StudentLayout>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  const handleLogin = async (nextUser: User) => {
  setUser(nextUser)

  setMustChangePassword(
    Boolean(
      (nextUser as User & {
        must_change_password?: boolean
      }).must_change_password
    )
  )
}
  if (!user) {
  if (showForgotPassword) {
    return (
      <ForgotPasswordPage
        onBack={() => setShowForgotPassword(false)}
      />
    )
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onForgotPassword={() => setShowForgotPassword(true)}
    />
  )
}
  if (mustChangePassword) return <ChangePasswordPage onDone={() => setMustChangePassword(false)} />
  if (loadingData) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Loading your data…</div>

  const logout = () => {
    clearSession()
    setUser(null)
  }

  if (user.role === 'admin') return <AdminShell user={user} onLogout={logout} onUpdateUser={setUser} />
  if (user.role === 'teacher') return <TeacherShell user={user} onLogout={logout} onUpdateUser={setUser} />
  return <StudentShell user={user} onLogout={logout} onUpdateUser={setUser} />
}