import { useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  getCourses,
  getGroups,
  getGroupStudents,
  getStudentCompetencies,
  saveCompetency,
  getGroupCompetencies,
  getCourseCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getCompetencyGroups,
  syncCompetencyGroups,
  addGroupCompetency,
  deleteGroupCompetency,
  upsertGroupCompetencyOverride,
  removeGroupCompetencyOverride
} from '../../lib/api'

type Course = { id: number; name: string }
type Group = { id: number; name: string; course_id?: number; course_name?: string }
type Student = { id: number; name: string; email?: string }

type CourseCompetency = {
  id: number
  course_id: number
  name: string
  description?: string | null
}

type GroupCompetency = {
  id: number
  name: string
  description?: string | null
  course_default_name?: string
  course_default_description?: string | null
  is_overridden?: boolean | number
}

type GroupLink = {
  id: number
  name: string
  assigned: number | boolean
  is_overridden: number | boolean
}

const card = {
  background: 'var(--card)',
  border: '1px solid var(--border)'
}

export default function TeacherCompetency() {
  const [tab, setTab] = useState<'course' | 'group'>('course')

  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])

  const [courseId, setCourseId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [studentId, setStudentId] = useState<number | null>(null)

  const [courseCompetencies, setCourseCompetencies] = useState<CourseCompetency[]>([])
  const [groupCompetencies, setGroupCompetencies] = useState<GroupCompetency[]>([])
  const [scoreRows, setScoreRows] = useState<{ competency_id: number; score: number }[]>([])
  const [scores, setScores] = useState<Record<number, string>>({})

  // course tab: yeni competency
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAllGroups, setNewAllGroups] = useState(true)
  const [adding, setAdding] = useState(false)

  // course tab: master edit
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // course tab: grup atama paneli
  const [linkPanelId, setLinkPanelId] = useState<number | null>(null)
  const [links, setLinks] = useState<GroupLink[]>([])
  const [linkSelection, setLinkSelection] = useState<number[]>([])

  // group tab
  const [overrideId, setOverrideId] = useState<number | null>(null)
  const [ovName, setOvName] = useState('')
  const [ovDescription, setOvDescription] = useState('')
  const [addFromCourseId, setAddFromCourseId] = useState<string>('')

  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { bootstrap() }, [])

  useEffect(() => {
    if (!courseId) return
    loadCourseCompetencies(courseId)
    setLinkPanelId(null)
    setEditingId(null)
  }, [courseId])

  useEffect(() => {
    if (!groupId) return
    loadGroupCompetencies(groupId)
    loadStudents(groupId)
    setOverrideId(null)
    setAddFromCourseId('')
  }, [groupId])

  useEffect(() => {
    if (!studentId) return
    loadScores(studentId)
  }, [studentId])

  async function bootstrap() {
    try {
      setLoading(true)
      const [courseRes, groupRes] = await Promise.all([getCourses(), getGroups()])
      const cs: Course[] = courseRes?.data || []
      const gs: Group[] = groupRes?.data || []
      setCourses(cs)
      setGroups(gs)
      if (cs.length) setCourseId(cs[0].id)
      if (gs.length) setGroupId(gs[0].id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load data')
    } finally {
      setLoading(false)
    }
  }

  const groupsOfCourse = useMemo(
    () => groups.filter(g => g.course_id === courseId),
    [groups, courseId]
  )

  const selectedGroup = groups.find(g => g.id === groupId)

  async function loadCourseCompetencies(id: number) {
    try {
      const res = await getCourseCompetencies(id)
      setCourseCompetencies(res?.data || [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load course competencies')
    }
  }

  async function loadGroupCompetencies(id: number) {
    try {
      const res = await getGroupCompetencies(id)
      setGroupCompetencies(res?.data || [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load group competencies')
    }
  }

  async function loadStudents(id: number) {
    try {
      const res = await getGroupStudents(id)
      const data: Student[] = res?.data || []
      setStudents(data)
      setStudentId(data.length ? data[0].id : null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load students')
    }
  }

  async function loadScores(id: number) {
    try {
      const res = await getStudentCompetencies(id)
      const data = res?.data || []
      setScoreRows(data)
      setScores(
        Object.fromEntries(
          data.map((c: any) => [c.competency_id, String(c.score ?? 0)])
        )
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load scores')
    }
  }

  function reset(msg = '') {
    setError('')
    setSuccess(msg)
  }

  /* ---------- COURSE TAB ---------- */

  async function handleCreate() {
    if (!courseId || !newName.trim()) return
    try {
      setAdding(true); reset()
      await createCompetency({
        course_id: courseId,
        name: newName.trim(),
        description: newDescription.trim(),
        group_ids: newAllGroups ? 'all' : []
      })
      setNewName(''); setNewDescription('')
      await loadCourseCompetencies(courseId)
      if (groupId) await loadGroupCompetencies(groupId)
      reset(
        newAllGroups
          ? 'Added to the course and assigned to every group.'
          : 'Added to the course. Assign it to groups with “Groups”.'
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create competency')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveMaster(id: number) {
    if (!editName.trim()) { setError('Name is required'); return }
    try {
      setBusy(true); reset()
      await updateCompetency(id, {
        name: editName.trim(),
        description: editDescription.trim()
      })
      setEditingId(null)
      await loadCourseCompetencies(courseId!)
      if (groupId) await loadGroupCompetencies(groupId)
      reset('Saved — applies to every group without its own override.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMaster(id: number) {
    if (!window.confirm('Delete this competency from the course? It will be removed from every group.')) return
    try {
      setBusy(true); reset()
      await deleteCompetency(id)
      await loadCourseCompetencies(courseId!)
      if (groupId) await loadGroupCompetencies(groupId)
      reset('Competency deleted from the course.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  async function openLinkPanel(id: number) {
    try {
      reset()
      const res = await getCompetencyGroups(id)
      const data: GroupLink[] = res?.data || []
      setLinks(data)
      setLinkSelection(data.filter(l => Number(l.assigned) === 1).map(l => l.id))
      setLinkPanelId(id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load groups')
    }
  }

  async function saveLinks(id: number) {
    try {
      setBusy(true); reset()
      await syncCompetencyGroups(id, linkSelection)
      setLinkPanelId(null)
      if (groupId) await loadGroupCompetencies(groupId)
      reset('Group assignments updated.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update assignments')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- GROUP TAB ---------- */

  const rows = useMemo(
    () =>
      groupCompetencies.map(gc => {
        const s = scoreRows.find(r => r.competency_id === gc.id)
        return {
          competency_id: gc.id,
          name: gc.name,
          description: gc.description || '',
          is_overridden: Boolean(Number(gc.is_overridden)),
          course_default_name: gc.course_default_name || gc.name,
          score: s?.score ?? 0
        }
      }),
    [groupCompetencies, scoreRows]
  )

  const assignableForGroup = useMemo(() => {
    if (!selectedGroup) return []
    const assigned = new Set(groupCompetencies.map(g => g.id))
    return courseCompetencies.filter(
      c => c.course_id === selectedGroup.course_id && !assigned.has(c.id)
    )
  }, [courseCompetencies, groupCompetencies, selectedGroup])

  // grup sekmesine geçilince o grubun kursunun listesi lazım
  useEffect(() => {
    if (tab === 'group' && selectedGroup?.course_id) {
      loadCourseCompetencies(selectedGroup.course_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedGroup?.course_id])

  async function handleAssignToGroup() {
    if (!groupId || !addFromCourseId) return
    try {
      setBusy(true); reset()
      await addGroupCompetency({
        group_id: groupId,
        competency_id: Number(addFromCourseId)
      })
      setAddFromCourseId('')
      await loadGroupCompetencies(groupId)
      if (studentId) await loadScores(studentId)
      reset('Competency added to this group.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add competency')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveOverride(id: number) {
    if (!groupId || !ovName.trim()) { setError('Name is required'); return }
    try {
      setBusy(true); reset()
      await upsertGroupCompetencyOverride(groupId, id, {
        name: ovName.trim(),
        description: ovDescription.trim()
      })
      setOverrideId(null)
      await loadGroupCompetencies(groupId)
      reset('Saved — this change only applies to this group.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save override')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevert(id: number) {
    if (!groupId) return
    if (!window.confirm('Revert to the course default for this group?')) return
    try {
      setBusy(true); reset()
      await removeGroupCompetencyOverride(groupId, id)
      await loadGroupCompetencies(groupId)
      reset('Reverted to the course default.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not revert')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveFromGroup(id: number) {
    if (!groupId) return
    if (!window.confirm('Remove this competency from this group only?')) return
    try {
      setBusy(true); reset()
      await deleteGroupCompetency(groupId, id)
      await loadGroupCompetencies(groupId)
      if (studentId) await loadScores(studentId)
      reset('Removed from this group. It still exists in the course.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove')
    } finally {
      setBusy(false)
    }
  }

  async function saveAllScores() {
    if (!studentId) return
    try {
      setSaving(true); reset()
      await Promise.all(
        rows.map(r =>
          saveCompetency({
            student_id: studentId,
            competency_id: r.competency_id,
            score: Number(scores[r.competency_id] ?? r.score)
          })
        )
      )
      reset('All competency scores saved successfully.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save scores')
    } finally {
      setSaving(false)
    }
  }

  /* ---------- RENDER ---------- */

  const th = 'px-4 py-3 text-left text-xs uppercase tracking-wider'
  const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Competency
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Competencies are defined once per course. Choose which groups use them,
          then customise the wording per group if needed.
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        {(['course', 'group'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); reset() }}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={
              tab === t
                ? { background: 'var(--primary)', color: 'white', border: 'none' }
                : { ...card }
            }
          >
            {t === 'course' ? 'Course competencies' : 'Group & scores'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#DCFCE7', color: '#15803D' }}>
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm">Loading...</p>
      ) : tab === 'course' ? (
        <>
          <div className="mb-5">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Course
            </label>
            <select
              value={courseId ?? ''}
              onChange={e => setCourseId(Number(e.target.value))}
              className="w-full md:w-1/2 px-3 py-2.5 rounded-lg text-sm"
              style={card}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl p-5 mb-5" style={card}>
            <h2 className="text-sm font-semibold mb-1">Add a course competency</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Existing names are reused. Uncheck the box to add it to the course
              without assigning it to any group yet.
            </p>

            <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Competency name"
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              />
              <input
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={adding || !newName.trim()}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)', color: 'white', border: 'none',
                  opacity: adding || !newName.trim() ? 0.5 : 1
                }}
              >
                {adding ? 'Adding…' : '+ Add Competency'}
              </button>
            </div>

            <label className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <input
                type="checkbox"
                checked={newAllGroups}
                onChange={e => setNewAllGroups(e.target.checked)}
              />
              Assign to all {groupsOfCourse.length} group(s) in this course
            </label>
          </div>

          <div className="rounded-xl overflow-hidden" style={card}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Competency</th>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Description</th>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {courseCompetencies.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      This course has no competencies yet.
                    </td>
                  </tr>
                ) : (
                  courseCompetencies.map((c, i) => {
                    const isEditing = editingId === c.id
                    return (
                      <>
                        <tr key={c.id} style={{ borderBottom: i < courseCompetencies.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-4 py-4 align-top">
                            {isEditing ? (
                              <input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg text-sm"
                                style={{ border: '1px solid var(--border)', outline: 'none' }}
                              />
                            ) : (
                              <p className="text-sm font-semibold">{c.name}</p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs align-top" style={{ color: 'var(--muted-foreground)' }}>
                            {isEditing ? (
                              <input
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg text-sm"
                                style={{ border: '1px solid var(--border)', outline: 'none' }}
                              />
                            ) : (c.description || '—')}
                          </td>
                          <td className="px-4 py-4 align-top">
                            {isEditing ? (
                              <div className="flex gap-1.5">
                                <button
                                  type="button" disabled={busy}
                                  onClick={() => handleSaveMaster(c.id)}
                                  className={btn}
                                  style={{ background: 'var(--primary)', color: 'white', border: 'none' }}
                                >
                                  Save for all groups
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className={btn}
                                  style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(c.id)
                                    setEditName(c.name)
                                    setEditDescription(c.description || '')
                                    setLinkPanelId(null)
                                  }}
                                  className={btn}
                                  style={{ background: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openLinkPanel(c.id)}
                                  className={btn}
                                  style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                                >
                                  Groups
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMaster(c.id)}
                                  className={btn}
                                  style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {linkPanelId === c.id && (
                          <tr key={`${c.id}-links`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={3} className="px-4 py-4" style={{ background: 'var(--muted)' }}>
                              <p className="text-xs font-semibold mb-2">
                                Which groups use “{c.name}”?
                              </p>
                              <div className="flex flex-col gap-1.5 mb-3">
                                {links.map(l => (
                                  <label key={l.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={linkSelection.includes(l.id)}
                                      onChange={e =>
                                        setLinkSelection(prev =>
                                          e.target.checked
                                            ? [...prev, l.id]
                                            : prev.filter(x => x !== l.id)
                                        )
                                      }
                                    />
                                    {l.name}
                                    {Number(l.is_overridden) === 1 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                                            style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                        customised
                                      </span>
                                    )}
                                  </label>
                                ))}
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  type="button" disabled={busy}
                                  onClick={() => saveLinks(c.id)}
                                  className={btn}
                                  style={{ background: 'var(--primary)', color: 'white', border: 'none' }}
                                >
                                  Save assignments
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLinkPanelId(null)}
                                  className={btn}
                                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                                >
                                  Cancel
                                </button>
                              </div>
                              <p className="text-[10px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
                                Unchecking a group removes the competency and its
                                customisation from that group only.
                              </p>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Group
              </label>
              <select
                value={groupId ?? ''}
                onChange={e => setGroupId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={card}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.course_name ? ` · ${g.course_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Student
              </label>
              <select
                value={studentId ?? ''}
                onChange={e => setStudentId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={card}
              >
                {students.length === 0 ? (
                  <option value="">No students available</option>
                ) : students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.email ? ` · ${s.email}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl p-5 mb-5" style={card}>
            <h2 className="text-sm font-semibold mb-1">Add from the course list</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Competencies are created in the Course tab. Here you only pick which
              of them this group uses.
            </p>
            <div className="grid md:grid-cols-[1fr_auto] gap-3">
              <select
                value={addFromCourseId}
                onChange={e => setAddFromCourseId(e.target.value)}
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}
              >
                <option value="">
                  {assignableForGroup.length
                    ? 'Select a competency…'
                    : 'All course competencies are already in this group'}
                </option>
                {assignableForGroup.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssignToGroup}
                disabled={busy || !addFromCourseId}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)', color: 'white', border: 'none',
                  opacity: busy || !addFromCourseId ? 0.5 : 1
                }}
              >
                Add to group
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={card}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Competency</th>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Description</th>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Score</th>
                  <th className={th} style={{ color: 'var(--muted-foreground)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      No competencies assigned to this group yet.
                    </td>
                  </tr>
                ) : rows.map((c, i) => {
                  const isEditing = overrideId === c.competency_id
                  return (
                    <tr key={c.competency_id}
                        style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-4 align-top">
                        {isEditing ? (
                          <input
                            value={ovName}
                            onChange={e => setOvName(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg text-sm"
                            style={{ border: '1px solid var(--border)', outline: 'none' }}
                          />
                        ) : (
                          <>
                            <p className="text-sm font-semibold">{c.name}</p>
                            {c.is_overridden && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block"
                                    style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                Custom for this group
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs align-top" style={{ color: 'var(--muted-foreground)' }}>
                        {isEditing ? (
                          <input
                            value={ovDescription}
                            onChange={e => setOvDescription(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg text-sm"
                            style={{ border: '1px solid var(--border)', outline: 'none' }}
                          />
                        ) : (c.description || '—')}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0" max="100" step="1"
                            value={scores[c.competency_id] ?? String(c.score)}
                            onChange={e =>
                              setScores(prev => ({ ...prev, [c.competency_id]: e.target.value }))
                            }
                            className="w-20 px-2 py-1.5 rounded-lg text-sm"
                            style={{ border: '1px solid var(--border)', outline: 'none' }}
                          />
                          <span className="text-xs">/ 100</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        {isEditing ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            <div className="flex gap-1.5">
                              <button
                                type="button" disabled={busy}
                                onClick={() => handleSaveOverride(c.competency_id)}
                                className={btn}
                                style={{ background: 'var(--primary)', color: 'white', border: 'none' }}
                              >
                                Save for this group
                              </button>
                              <button
                                type="button"
                                onClick={() => setOverrideId(null)}
                                className={btn}
                                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                              >
                                Cancel
                              </button>
                            </div>
                            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                              Only applies to this group. Course-wide edits live in the Course tab.
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideId(c.competency_id)
                                setOvName(c.name)
                                setOvDescription(c.description)
                                reset()
                              }}
                              className={btn}
                              style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                            >
                              Customise for this group
                            </button>

                            {c.is_overridden && (
                              <button
                                type="button"
                                onClick={() => handleRevert(c.competency_id)}
                                className={btn}
                                style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                              >
                                Revert to default
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveFromGroup(c.competency_id)}
                              className={btn}
                              style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}
                            >
                              Remove from group
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-6 mb-4">
            <button
              type="button"
              onClick={saveAllScores}
              disabled={saving || rows.length === 0 || !studentId}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background: 'var(--primary)', color: 'white', border: 'none',
                opacity: saving || rows.length === 0 || !studentId ? 0.5 : 1,
                cursor: saving || rows.length === 0 || !studentId ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving all changes…' : 'Save All Changes'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}