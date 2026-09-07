import { useEffect, useState } from 'react'
import { apiFetch, ApiError } from '../../lib/api'

interface Group {
  id: number
  course_id: number
  name: string
  start_date: string | null
  end_date: string | null
}

interface Course {
  id: number
  name: string
}

interface User {
  id: number
  name: string
  email: string
  github_username?: string
  role?: string
}

export default function AdminGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [allStudents, setAllStudents] = useState<User[]>([])
  const [allTeachers, setAllTeachers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create / Edit Group Modal State
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [form, setForm] = useState({ course_id: '', name: '', start_date: '', end_date: '' })

  // Students Management Modal State
  const [showStudentsModal, setShowStudentsModal] = useState(false)
  const [selectedGroupForStudents, setSelectedGroupForStudents] = useState<Group | null>(null)
  const [groupStudents, setGroupStudents] = useState<User[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState('')
  const [editingGithubId, setEditingGithubId] = useState<number | null>(null)
  const [githubDraft, setGithubDraft] = useState('')
  const [savingGithub, setSavingGithub] = useState(false)

  // Teachers Management Modal State
  const [showTeachersModal, setShowTeachersModal] = useState(false)
  const [selectedGroupForTeachers, setSelectedGroupForTeachers] = useState<Group | null>(null)
  const [groupTeachers, setGroupTeachers] = useState<User[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teachersError, setTeachersError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [groupsRes, coursesRes, usersRes] = await Promise.all([
        apiFetch('/groups'),
        apiFetch('/courses'),
        apiFetch('/users').catch(() => ({ data: [] })),
      ])
      setGroups(groupsRes.data || [])
      setCourses(coursesRes.data || [])
      
      const usersList = usersRes.data || []
      setAllStudents(usersList.filter((u: User) => !u.role || u.role === 'student'))
      setAllTeachers(usersList.filter((u: User) => u.role === 'teacher'))

      if (coursesRes.data?.length > 0 && !form.course_id) {
        setForm((f) => ({ ...f, course_id: String(coursesRes.data[0].id) }))
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingGroup(null)
    setForm({
      course_id: courses[0]?.id ? String(courses[0].id) : '',
      name: '',
      start_date: '',
      end_date: '',
    })
    setShowModal(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (group: Group) => {
    setEditingGroup(group)
    setForm({
      course_id: String(group.course_id),
      name: group.name || '',
      start_date: group.start_date ? group.start_date.split('T')[0] : '',
      end_date: group.end_date ? group.end_date.split('T')[0] : '',
    })
    setShowModal(true)
  }

  // Submit Create or Update Group
  const handleSaveGroup = async () => {
    if (!form.name.trim() || !form.course_id) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        course_id: Number(form.course_id),
        name: form.name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }

      if (editingGroup) {
        await apiFetch(`/groups/${editingGroup.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/groups', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      setShowModal(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  // Delete Group
  const handleDeleteGroup = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this group? All memberships will be removed.')) {
      return
    }
    try {
      await apiFetch(`/groups/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete group')
    }
  }

  // --- STUDENT HANDLERS ---
  const handleOpenStudents = async (group: Group) => {
    setSelectedGroupForStudents(group)
    setSelectedStudentId('')
    setShowStudentsModal(true)
    setStudentsLoading(true)
    setStudentsError('')
    try {
      const res = await apiFetch(`/groups/${group.id}/students`)
      setGroupStudents(res.data || [])
    } catch (err) {
      setStudentsError(err instanceof ApiError ? err.message : 'Failed to load students')
    } finally {
      setStudentsLoading(false)
    }
  }

  const handleSaveGithub = async (studentId: number) => {
    setSavingGithub(true)
    try {
      await apiFetch(`/users/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({ github_username: githubDraft.trim().replace(/^@/, '') || null }),
      })
      setGroupStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, github_username: githubDraft.trim().replace(/^@/, '') || undefined } : s))
      )
      setEditingGithubId(null)
    } catch (err) {
      setStudentsError(err instanceof ApiError ? err.message : 'Failed to update GitHub username')
    } finally {
      setSavingGithub(false)
    }
  }

  const handleAddStudent = async () => {
    if (!selectedStudentId || !selectedGroupForStudents) return
    try {
      await apiFetch(`/groups/${selectedGroupForStudents.id}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentId: Number(selectedStudentId) }),
      })
      const res = await apiFetch(`/groups/${selectedGroupForStudents.id}/students`)
      setGroupStudents(res.data || [])
      setSelectedStudentId('')
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to add student')
    }
  }

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedGroupForStudents) return
    try {
      await apiFetch(`/groups/${selectedGroupForStudents.id}/students/${studentId}`, {
        method: 'DELETE',
      })
      setGroupStudents((prev) => prev.filter((s) => s.id !== studentId))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to remove student')
    }
  }

  // --- TEACHER HANDLERS ---
  const handleOpenTeachers = async (group: Group) => {
    setSelectedGroupForTeachers(group)
    setSelectedTeacherId('')
    setShowTeachersModal(true)
    setTeachersLoading(true)
    setTeachersError('')
    try {
      const res = await apiFetch(`/groups/${group.id}/teachers`)
      setGroupTeachers(res.data || [])
    } catch (err) {
      setTeachersError(err instanceof ApiError ? err.message : 'Failed to load teachers')
    } finally {
      setTeachersLoading(false)
    }
  }

  const handleAddTeacher = async () => {
    if (!selectedTeacherId || !selectedGroupForTeachers) return
    try {
      await apiFetch(`/groups/${selectedGroupForTeachers.id}/teachers`, {
        method: 'POST',
        body: JSON.stringify({ teacherId: Number(selectedTeacherId) }),
      })
      const res = await apiFetch(`/groups/${selectedGroupForTeachers.id}/teachers`)
      setGroupTeachers(res.data || [])
      setSelectedTeacherId('')
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to assign teacher')
    }
  }

  const handleRemoveTeacher = async (teacherId: number) => {
    if (!selectedGroupForTeachers) return
    try {
      await apiFetch(`/groups/${selectedGroupForTeachers.id}/teachers/${teacherId}`, {
        method: 'DELETE',
      })
      setGroupTeachers((prev) => prev.filter((t) => t.id !== teacherId))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to remove teacher')
    }
  }

  const courseName = (courseId: number) => courses.find((c) => c.id === courseId)?.name || `Course #${courseId}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Groups</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{groups.length} groups</p>
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={courses.length === 0}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: courses.length === 0 ? 'not-allowed' : 'pointer', opacity: courses.length === 0 ? 0.6 : 1 }}
        >
          + New Group
        </button>
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2.5 mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading groups…</p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Group', 'Course', 'Start', 'End', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.id} style={{ borderBottom: i < groups.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-5 py-4 text-sm font-semibold mono">{g.name}</td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>{courseName(g.course_id)}</td>
                  <td className="px-5 py-4 text-sm mono" style={{ color: 'var(--muted-foreground)' }}>{g.start_date ? g.start_date.split('T')[0] : '—'}</td>
                  <td className="px-5 py-4 text-sm mono" style={{ color: 'var(--muted-foreground)' }}>{g.end_date ? g.end_date.split('T')[0] : '—'}</td>
                  <td className="px-5 py-4 space-x-2">
                    <button
                      onClick={() => handleOpenStudents(g)}
                      className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                    >
                      Students
                    </button>
                    <button
                      onClick={() => handleOpenTeachers(g)}
                      className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                    >
                      Teachers
                    </button>
                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(g.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ border: '1px solid #FCA5A5', color: '#B91C1C', cursor: 'pointer', background: 'transparent' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {editingGroup ? 'Edit Group' : 'Create Group'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Course</label>
                <select
                  value={form.course_id}
                  onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. FSWD-2026-C"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroup}
                disabled={saving || !form.name.trim() || !form.course_id}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : editingGroup ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE STUDENTS MODAL */}
      {showStudentsModal && selectedGroupForStudents && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowStudentsModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg flex flex-col max-h-[85vh]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Enrolled Students — {selectedGroupForStudents.name}
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Add or remove students for this cohort.
            </p>

            {studentsError && (
              <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                {studentsError}
              </p>
            )}

            <div className="flex gap-2 mb-4">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                <option value="">Select a student to enroll...</option>
                {allStudents
                  .filter((s) => !groupStudents.some((gs) => gs.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddStudent}
                disabled={!selectedStudentId}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  cursor: !selectedStudentId ? 'not-allowed' : 'pointer',
                  opacity: !selectedStudentId ? 0.6 : 1,
                }}
              >
                Add
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto rounded-lg divide-y"
              style={{ border: '1px solid var(--border)', borderColor: 'var(--border)' }}
            >
              {studentsLoading ? (
                <p className="p-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading students…</p>
              ) : groupStudents.length === 0 ? (
                <p className="p-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No students enrolled in this group.</p>
              ) : (
                groupStudents.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.email}</div>

                      {editingGithubId === s.id ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>github.com/</span>
                          <input
                            autoFocus
                            value={githubDraft}
                            onChange={(e) => setGithubDraft(e.target.value)}
                            placeholder="username"
                            className="text-xs px-2 py-1 rounded"
                            style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', width: '140px' }}
                          />
                          <button
                            onClick={() => handleSaveGithub(s.id)}
                            disabled={savingGithub}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: savingGithub ? 'default' : 'pointer' }}
                          >
                            {savingGithub ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingGithubId(null)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingGithubId(s.id); setGithubDraft(s.github_username || '') }}
                          className="flex items-center gap-1 mt-1 text-xs"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.github_username ? 'var(--primary)' : 'var(--muted-foreground)' }}
                        >
                          ⎇ {s.github_username || 'Add GitHub username'}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveStudent(s.id)}
                      className="text-xs px-2.5 py-1 rounded flex-shrink-0"
                      style={{ border: '1px solid #FCA5A5', color: '#B91C1C', background: 'transparent', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowStudentsModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE TEACHERS MODAL */}
      {showTeachersModal && selectedGroupForTeachers && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowTeachersModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg flex flex-col max-h-[85vh]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Assigned Teachers — {selectedGroupForTeachers.name}
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Assign or remove instructors for this cohort.
            </p>

            {teachersError && (
              <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                {teachersError}
              </p>
            )}

            <div className="flex gap-2 mb-4">
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                <option value="">Select a teacher to assign...</option>
                {allTeachers
                  .filter((t) => !groupTeachers.some((gt) => gt.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddTeacher}
                disabled={!selectedTeacherId}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  cursor: !selectedTeacherId ? 'not-allowed' : 'pointer',
                  opacity: !selectedTeacherId ? 0.6 : 1,
                }}
              >
                Assign
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto rounded-lg divide-y"
              style={{ border: '1px solid var(--border)', borderColor: 'var(--border)' }}
            >
              {teachersLoading ? (
                <p className="p-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading teachers…</p>
              ) : groupTeachers.length === 0 ? (
                <p className="p-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No teachers assigned to this group.</p>
              ) : (
                groupTeachers.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.email}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveTeacher(t.id)}
                      className="text-xs px-2.5 py-1 rounded"
                      style={{ border: '1px solid #FCA5A5', color: '#B91C1C', background: 'transparent', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowTeachersModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}