import { useEffect, useState } from 'react'
import TeacherStudentDetail from './TeacherStudentDetail'
import {
  getMyGroups,
  createGroup,
  getCourses,
  getUsers,
  getGroupStudents,
  addStudentToGroup,
  removeStudentFromGroup,
  getTeams,
  createTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeam,
  getAssessments,
  ApiError,
  apiFetch,
} from '../../lib/api'

/* ────────────────────────────────────────────────────────────────────
   Types (backend field adları — snake_case)
───────────────────────────────────────────────────────────────────── */

interface Course {
  id: number
  name: string
}

interface Group {
  id: number
  name: string
  course_id: number
  course_name?: string
  start_date?: string | null
  end_date?: string | null
  student_count?: number
}

interface StudentUser {
  id: number
  name: string
  email: string
  github_username?: string
}

interface GroupStudent extends StudentUser {
  joined_at?: string
}

interface Team {
  id: number
  name: string
  group_id: number
  // Backend'in tam döndürdüğü alan adı teams.controller.js'e göre değişebilir;
  // hem "members" hem alternatif olası alan adlarını destekliyoruz.
  members?: { id: number; name: string; email?: string }[]
  member_count?: number
}

interface GroupAssessment {
  id: number
  title: string
  due_date: string | null
  max_score: number
  submission_mode: string
  type: string
}

/* ────────────────────────────────────────────────────────────────────
   Create Group Modal
───────────────────────────────────────────────────────────────────── */

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (g: Group) => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getCourses()
      .then((res) => {
        const list: Course[] = res.data || []
        setCourses(list)
        if (list.length > 0) setCourseId(String(list[0].id))
      })
      .catch(() => setLoadError('Failed to load courses'))
  }, [])

  async function submit() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Group name is required'
    if (!courseId) e.courseId = 'Please select a course'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSaving(true)
    try {
      const res = await createGroup({
        course_id: Number(courseId),
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
      })
      onCreate(res.data)
    } catch (err) {
      setErrors({ submit: err instanceof ApiError ? err.message : 'Failed to create group' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>Create New Group</h2>

        {loadError && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>{loadError}</p>}
        {errors.submit && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>{errors.submit}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Group / Class Name <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FSWD-2026-C" className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: `1px solid ${errors.name ? '#EF4444' : 'var(--border)'}`, background: 'var(--muted)', outline: 'none' }} />
            {errors.name && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Course <span style={{ color: '#EF4444' }}>*</span></label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: `1px solid ${errors.courseId ? '#EF4444' : 'var(--border)'}`, background: 'var(--muted)', outline: 'none' }}>
              <option value="">Select a course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.courseId && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.courseId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Add Student Modal
───────────────────────────────────────────────────────────────────── */

type AddStudentState = 'idle' | 'found' | 'not_found' | 'already_in' | 'invalid' | 'saving'

function AddStudentModal({ group, existingStudents, onClose, onAdd }: { group: Group; existingStudents: GroupStudent[]; onClose: () => void; onAdd: (s: StudentUser) => void }) {
  const [allStudents, setAllStudents] = useState<StudentUser[]>([])
  const [email, setEmail] = useState('')
  const [state, setState] = useState<AddStudentState>('idle')
  const [foundStudent, setFoundStudent] = useState<StudentUser | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getUsers('student')
      .then((res) => setAllStudents(res.data || []))
      .catch(() => setError('Failed to load students'))
  }, [])

  function lookup() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) { setState('invalid'); return }
    const student = allStudents.find((s) => s.email.toLowerCase() === trimmed)
    if (!student) { setState('not_found'); setFoundStudent(null); return }
    if (existingStudents.some((s) => s.id === student.id)) { setState('already_in'); setFoundStudent(null); return }
    setState('found')
    setFoundStudent(student)
  }

  async function handleAdd() {
    if (!foundStudent) return
    setState('saving')
    try {
      await addStudentToGroup(group.id, foundStudent.id)
      onAdd(foundStudent)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add student')
      setState('found')
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Add Student</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>Add a student to <strong>{group.name}</strong> by email address.</p>

        {error && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>{error}</p>}

        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Student Email</label>
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setState('idle') }}
            placeholder="student@lexicon.edu"
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm"
            style={{ border: `1px solid ${state === 'invalid' || state === 'not_found' ? '#EF4444' : state === 'already_in' ? '#F59E0B' : 'var(--border)'}`, background: 'var(--muted)', outline: 'none' }}
          />
          <button onClick={lookup} className="px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>Find</button>
        </div>

        {state === 'invalid' && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>Please enter a valid email address.</p>}
        {state === 'not_found' && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>No student found with this email address.</p>}
        {state === 'already_in' && <p className="text-xs mb-3" style={{ color: '#B45309' }}>This student is already in {group.name}.</p>}
        {(state === 'found' || state === 'saving') && foundStudent && (
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg mb-3" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#0891B2' }}>{foundStudent.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{foundStudent.name}</p>
              <p className="text-xs" style={{ color: '#166534' }}>{foundStudent.email}</p>
            </div>
            <span className="text-xs font-medium" style={{ color: '#15803D' }}>✓ Found</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAdd} disabled={state !== 'found' && state !== 'saving'} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: state === 'found' ? 'var(--primary)' : 'var(--secondary)', color: state === 'found' ? 'white' : 'var(--muted-foreground)', border: 'none', cursor: state === 'found' ? 'pointer' : 'not-allowed' }}>
            {state === 'saving' ? 'Adding…' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Group Detail Page
───────────────────────────────────────────────────────────────────── */

type DetailTab = 'students' | 'teams' | 'assessments'

function GroupDetail({ group, onBack, onStudentCountChange, onOpenStudent }: { group: Group; onBack: () => void; onStudentCountChange: (delta: number) => void; onOpenStudent: (studentId: number) => void }) {
  const [tab, setTab] = useState<DetailTab>('students')

  const [students, setStudents] = useState<GroupStudent[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [showAddStudent, setShowAddStudent] = useState(false)

const [teams, setTeams] = useState<Team[]>([])
const [loadingTeams, setLoadingTeams] = useState(false)

const [showCreateTeam, setShowCreateTeam] = useState(false)
const [newTeamName, setNewTeamName] = useState('')
const [newTeamStudentIds, setNewTeamStudentIds] = useState<number[]>([])
const [creatingTeam, setCreatingTeam] = useState(false)

const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
const [editingTeamName, setEditingTeamName] = useState('')

const [addingMemberTeamId, setAddingMemberTeamId] = useState<number | null>(null)
const [addingMemberId, setAddingMemberId] = useState<number | null>(null)
const [savingMember, setSavingMember] = useState(false)

  const [assessments, setAssessments] = useState<GroupAssessment[]>([])
  const [loadingAssessments, setLoadingAssessments] = useState(false)

  const loadStudents = () => {
    setLoadingStudents(true)
    getGroupStudents(group.id)
      .then((res) => setStudents(res.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false))
  }

  useEffect(() => {
    loadStudents()
  }, [group.id])

  useEffect(() => {
    if (tab === 'students' && students.length === 0) {
  setLoadingStudents(true)
  getGroupStudents(group.id)
    .then((res) => setStudents(res.data || []))
    .catch(() => setStudents([]))
    .finally(() => setLoadingStudents(false))
}
    if (tab === 'teams' && teams.length === 0) {
      setLoadingTeams(true)
      getTeams(group.id)
        .then((res) => setTeams(res.data || []))
        .catch(() => setTeams([]))
        .finally(() => setLoadingTeams(false))
    }
    if (tab === 'assessments' && assessments.length === 0) {
      setLoadingAssessments(true)
      getAssessments(group.id)
        .then((res) => setAssessments(res.data || []))
        .catch(() => setAssessments([]))
        .finally(() => setLoadingAssessments(false))
    }
  }, [tab, group.id])

  async function handleRemoveStudent(studentId: number) {
    try {
      await removeStudentFromGroup(group.id, studentId)
      setStudents((prev) => prev.filter((s) => s.id !== studentId))
      onStudentCountChange(-1)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to remove student')
    }
  }

  function handleStudentAdded(student: StudentUser) {
    setStudents((prev) => [...prev, student])
    onStudentCountChange(1)
  }

  async function handleCreateTeam() {
  if (!newTeamName.trim()) return

  setCreatingTeam(true)

  try {
    const res = await createTeam({
      group_id: group.id,
      name: newTeamName.trim(),
      student_ids: newTeamStudentIds,
    })

    setTeams((prev) => [...prev, res.data])

    setNewTeamName('')
    setNewTeamStudentIds([])
    setShowCreateTeam(false)
  } catch (err) {
    alert(
      err instanceof ApiError
        ? err.message
        : 'Failed to create team'
    )
  } finally {
    setCreatingTeam(false)
  }
}
async function handleRenameTeam(teamId: number) {
  if (!editingTeamName.trim()) return

  try {
    const res = await updateTeam(teamId, {
      name: editingTeamName.trim(),
    })

    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId
          ? {
              ...team,
              name: res.data?.name || editingTeamName.trim(),
            }
          : team
      )
    )

    setEditingTeamId(null)
    setEditingTeamName('')
  } catch (err) {
    alert(
      err instanceof ApiError
        ? err.message
        : 'Failed to rename team'
    )
  }
}

async function handleAddTeamMember(
  teamId: number,
  studentId: number
) {
  setSavingMember(true)

  try {
    await addTeamMember(teamId, studentId)

    const res = await getTeams(group.id)

    setTeams(res.data || [])

    setAddingMemberTeamId(null)
    setAddingMemberId(null)
  } catch (err) {
    alert(
      err instanceof ApiError
        ? err.message
        : 'Failed to add student to team'
    )
  } finally {
    setSavingMember(false)
  }
}
  async function handleDeleteTeam(teamId: number) {
    try {
      await deleteTeam(teamId)
      setTeams((prev) => prev.filter((t) => t.id !== teamId))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete team')
    }
  }

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'students', label: `Students (${students.length})` },
    { id: 'teams', label: `Teams${teams.length ? ` (${teams.length})` : ''}` },
    { id: 'assessments', label: `Assessments${assessments.length ? ` (${assessments.length})` : ''}` },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, fontSize: '14px' }}>← Groups</button>
        <span>/</span>
        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{group.name}</span>
      </div>

      {/* Group header */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{group.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{group.course_name}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {group.start_date && <span>Start: {group.start_date.split('T')[0]}</span>}
              {group.end_date && <span>End: {group.end_date.split('T')[0]}</span>}
            </div>
          </div>
          <div className="flex gap-5 text-center">
            <div>
              <p className="text-2xl font-bold mono" style={{ color: 'var(--primary)' }}>{students.length}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Students</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="px-4 py-2.5 text-sm font-medium whitespace-nowrap" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tab === t.id ? 'var(--primary)' : 'var(--muted-foreground)', borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Students tab */}
      {tab === 'students' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{students.length} students enrolled</p>
            <button onClick={() => setShowAddStudent(true)} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>+ Add Student</button>
          </div>
          {loadingStudents ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : students.length === 0 ? (
            <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>No students yet.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Use "+ Add Student" to add students by email.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                    {['Student', 'Email', 'GitHub', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: `hsl(${i * 47}, 55%, 50%)` }}>{s.name.charAt(0)}</div>
                          <button onClick={() => onOpenStudent(s.id)} className="text-sm font-medium text-left" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)' }}>{s.name}</button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs mono" style={{ color: 'var(--muted-foreground)' }}>{s.email}</td>
                      <td className="px-4 py-3.5 text-xs mono" style={{ color: 'var(--muted-foreground)' }}>{s.github_username || '—'}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => handleRemoveStudent(s.id)} className="text-xs px-2 py-1 rounded" style={{ color: '#B91C1C', background: 'transparent', border: 'none', cursor: 'pointer' }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Teams tab */}
      {tab === 'teams' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowCreateTeam(true)} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>+ Create Team</button>
          </div>
          {showCreateTeam && (
  <div
    className="rounded-xl p-4 mb-3"
    style={{
      background: '#EFF6FF',
      border: '1px solid #BFDBFE',
    }}
  >
    <p className="text-sm font-semibold mb-3">
      Create New Team
    </p>

    <input
      autoFocus
      value={newTeamName}
      onChange={(e) => setNewTeamName(e.target.value)}
      placeholder="Team name e.g. Team Delta"
      className="w-full px-3 py-2.5 rounded-lg text-sm mb-3"
      style={{
        border: '1px solid #93C5FD',
        outline: 'none',
        background: 'white',
      }}
    />

    <p
      className="text-xs font-medium mb-2"
      style={{ color: 'var(--muted-foreground)' }}
    >
      Add students to this team
    </p>

    <div
      className="max-h-48 overflow-y-auto rounded-lg mb-3"
      style={{
        background: 'white',
        border: '1px solid var(--border)',
      }}
    >
      {students.length === 0 ? (
        <p
          className="text-xs p-3"
          style={{ color: 'var(--muted-foreground)' }}
        >
          No students in this group.
        </p>
      ) : (
        students.map((student) => {
          const selected = newTeamStudentIds.includes(student.id)

          return (
            <label
              key={student.id}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
              style={{
                borderBottom: '1px solid var(--border)',
              }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => {
                  setNewTeamStudentIds((prev) =>
                    selected
                      ? prev.filter((id) => id !== student.id)
                      : [...prev, student.id]
                  )
                }}
              />

              <div>
                <p className="text-sm font-medium">
                  {student.name}
                </p>
                <p
                  className="text-xs"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {student.email}
                </p>
              </div>
            </label>
          )
        })
      )}
    </div>

    <div className="flex gap-2">
      <button
        onClick={handleCreateTeam}
        disabled={creatingTeam || !newTeamName.trim()}
        className="px-4 py-2 rounded-lg text-sm font-semibold"
        style={{
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          cursor:
            creatingTeam || !newTeamName.trim()
              ? 'not-allowed'
              : 'pointer',
          opacity:
            creatingTeam || !newTeamName.trim()
              ? 0.6
              : 1,
        }}
      >
        {creatingTeam ? 'Creating…' : 'Create Team'}
      </button>

      <button
        onClick={() => {
          setShowCreateTeam(false)
          setNewTeamName('')
          setNewTeamStudentIds([])
        }}
        className="px-4 py-2 rounded-lg text-sm"
        style={{
          border: '1px solid var(--border)',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
          {loadingTeams ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : teams.length === 0 && !showCreateTeam ? (
            <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No teams yet. Create teams to organise students.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => {
  const members = team.members || []

  const availableStudents = students.filter(
    (student) =>
      !members.some((member) => member.id === student.id)
  )

  return (
    <div
      key={team.id}
      className="rounded-xl p-5"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {editingTeamId === team.id ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={editingTeamName}
                onChange={(e) =>
                  setEditingTeamName(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameTeam(team.id)
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                  outline: 'none',
                }}
              />

              <button
                onClick={() => handleRenameTeam(team.id)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>

              <button
                onClick={() => {
                  setEditingTeamId(null)
                  setEditingTeamName('')
                }}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {team.name}
              </p>

              <p
                className="text-xs mt-1"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                {members.length} member
                {members.length !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </div>

        {editingTeamId !== team.id && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingTeamId(team.id)
                setEditingTeamName(team.name)
              }}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>

            <button
              onClick={() => handleDeleteTeam(team.id)}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{
                background: '#FEE2E2',
                color: '#B91C1C',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* MEMBERS */}
      <div
        className="mt-4 pt-4"
        style={{
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--muted-foreground)',
            }}
          >
            Team Members
          </p>

          {availableStudents.length > 0 && (
            <select
              value={
                addingMemberTeamId === team.id
                  ? String(addingMemberId ?? '')
                  : ''
              }
              onChange={(e) => {
                const studentId = Number(e.target.value)

                if (!studentId) return

                setAddingMemberTeamId(team.id)
                setAddingMemberId(studentId)

                handleAddTeamMember(
                  team.id,
                  studentId
                )
              }}
              disabled={savingMember}
              className="text-xs px-2 py-1.5 rounded-lg"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--muted)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">
                + Add Student
              </option>

              {availableStudents.map((student) => (
                <option
                  key={student.id}
                  value={student.id}
                >
                  {student.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {members.length === 0 ? (
          <p
            className="text-xs"
            style={{
              color: 'var(--muted-foreground)',
            }}
          >
            No members in this team.
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: `hsl(${member.id * 47}, 55%, 50%)`,
                    }}
                  >
                    {member.name.charAt(0)}
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      {member.name}
                    </p>

                    {member.email && (
                      <p
                        className="text-xs"
                        style={{
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        {member.email}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      await removeTeamMember(
                        team.id,
                        member.id
                      )

                      const res = await getTeams(group.id)
                      setTeams(res.data || [])
                    } catch (err) {
                      alert(
                        err instanceof ApiError
                          ? err.message
                          : 'Failed to remove team member'
                      )
                    }
                  }}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    color: '#B91C1C',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})}
            </div>
          )}
        </div>
      )}

      {/* Assessments tab */}
      {tab === 'assessments' && (
        <div>
          {loadingAssessments ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : assessments.length === 0 ? (
            <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No assessments assigned to this group yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assessments.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      Due {a.due_date ? a.due_date.split('T')[0] : '—'} · {a.max_score} pts
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: a.submission_mode === 'team' ? '#EDE9FE' : '#DBEAFE', color: a.submission_mode === 'team' ? '#6D28D9' : '#1E40AF' }}>{a.submission_mode}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3E8FF', color: '#6D28D9' }}>{a.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddStudent && (
        <AddStudentModal
          group={group}
          existingStudents={students}
          onClose={() => setShowAddStudent(false)}
          onAdd={handleStudentAdded}
        />
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Main Groups List
───────────────────────────────────────────────────────────────────── */

export default function TeacherGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)

const loadGroups = async () => {
  setLoading(true)
  setError('')

  try {
    const res = await apiFetch('/groups/my')
    setGroups(res.data || [])
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Failed to load groups')
  } finally {
    setLoading(false)
  }
}
  useEffect(() => {
    loadGroups()
  }, [])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null

  function handleCreateGroup(g: Group) {
    setGroups((prev) => [g, ...prev])
    setShowCreateGroup(false)
    setSelectedGroupId(g.id)
  }

  function handleStudentCountChange(delta: number) {
    setGroups((prev) => prev.map((g) =>
      g.id === selectedGroupId ? { ...g, student_count: Math.max(0, (g.student_count || 0) + delta) } : g
    ))
  }

  if (selectedGroup && selectedStudentId) {
    return <TeacherStudentDetail studentId={selectedStudentId} groupId={selectedGroup.id} onBack={() => setSelectedStudentId(null)} />
  }

  if (selectedGroup) {
    return (
      <GroupDetail
        group={selectedGroup}
        onBack={() => setSelectedGroupId(null)}
        onStudentCountChange={handleStudentCountChange}
        onOpenStudent={(studentId) => setSelectedStudentId(studentId)}
      />
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Groups & Teams</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{groups.length} group{groups.length !== 1 ? 's' : ''} within your scope</p>
        </div>
        <button onClick={() => setShowCreateGroup(true)} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
          + Create Group
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm text-gray-500">No groups assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className="w-full text-left rounded-xl p-5 transition-shadow hover:shadow-md"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'var(--primary)' }}>
                    {g.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{g.name}</p>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{g.course_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {g.start_date && g.end_date ? `${g.start_date.split('T')[0]} → ${g.end_date.split('T')[0]}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-center flex-shrink-0">
                  <p className="text-lg font-bold mono" style={{ color: 'var(--primary)' }}>{g.student_count ?? 0}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Students</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreate={handleCreateGroup} />
      )}
    </div>
  )
}