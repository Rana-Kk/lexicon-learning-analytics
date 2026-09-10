import { useEffect, useMemo, useState } from 'react'
import { getTasks, getTaskById, createTask, updateTaskNote, closeTask, getTeams, ApiError } from '../../lib/api'

interface TeamOption {
  id: number
  name: string
  course_id: number
  course_name?: string
  group_name?: string
}

interface TaskListItem {
  id: number
  title: string
  description: string
  status: 'active' | 'inactive'
  course_id: number
  team_ids?: string | null
  created_at: string
}

interface PeerSummaryRow {
  evaluated_id: number
  student_name: string
  team_id: number
  team_name: string
  avg_score: number | string
  vote_count: number
}

interface PeerDetailRow {
  evaluator_id: number
  evaluated_id: number
  score: number
  comment: string | null
}

interface TaskDetail extends TaskListItem {
  teams: { id: number; name: string; group_id: number }[]
  teacher_note: string | null
  peer_evaluation_summary: PeerSummaryRow[]
  peer_evaluation_details: PeerDetailRow[]
}

export default function TeacherTasks() {
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)

  const [loadingList, setLoadingList] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newCourseId, setNewCourseId] = useState<number | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTeamIds, setNewTeamIds] = useState<number[]>([])
  const [creating, setCreating] = useState(false)

  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  async function loadList() {
    setLoadingList(true)
    setError('')
    try {
      const [taskRes, teamRes] = await Promise.all([getTasks(), getTeams()])
      const list: TaskListItem[] = taskRes.data ?? []
      setTasks(list)
      setTeams(teamRes.data ?? [])
      setSelectedId((prev) => prev ?? (list.length ? list[0].id : null))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tasks.')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { loadList() }, [])

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return }
    let cancelled = false
    async function loadDetail() {
      setDetailLoading(true)
      setNotice('')
      try {
        const res = await getTaskById(selectedId as number)
        if (cancelled) return
        setDetail(res.data)
        setNoteDraft(res.data.teacher_note || '')
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load task details.')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    loadDetail()
    return () => { cancelled = true }
  }, [selectedId])

  const teamsForNewCourse = useMemo(
    () => teams.filter((t) => t.course_id === newCourseId),
    [teams, newCourseId]
  )

  const availableCourses = useMemo(() => {
    const map = new Map<number, string>()
    for (const t of teams) {
      if (!map.has(t.course_id)) map.set(t.course_id, t.course_name || `Course #${t.course_id}`)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [teams])

  function resetCreateForm() {
    setNewCourseId(null)
    setNewTitle('')
    setNewDescription('')
    setNewTeamIds([])
  }

  function toggleTeam(id: number) {
    setNewTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCreate() {
    setError('')
    if (!newCourseId || !newTitle.trim() || !newDescription.trim() || newTeamIds.length === 0) {
      setError('Course, title, description, and at least one team are required.')
      return
    }
    setCreating(true)
    try {
      const res = await createTask({
        course_id: newCourseId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        team_ids: newTeamIds,
      })
      setShowCreate(false)
      resetCreateForm()
      await loadList()
      setSelectedId(res.data.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create task.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveNote() {
    if (!detail) return
    setSavingNote(true)
    setNotice('')
    try {
      const res = await updateTaskNote(detail.id, noteDraft.trim())
      setDetail((prev) => (prev ? { ...prev, teacher_note: res.data.teacher_note } : prev))
      setNotice('Note saved.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save note.')
    } finally {
      setSavingNote(false)
    }
  }

  async function handleClose() {
    if (!detail) return
    setClosing(true)
    setError('')
    try {
      await closeTask(detail.id, noteDraft.trim() || undefined)
      setShowCloseConfirm(false)
      setNotice('Task closed.')
      await loadList()
      const res = await getTaskById(detail.id)
      setDetail(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not close task.')
    } finally {
      setClosing(false)
    }
  }

  const detailsByStudent = useMemo(() => {
    if (!detail) return new Map<number, PeerDetailRow[]>()
    const m = new Map<number, PeerDetailRow[]>()
    for (const row of detail.peer_evaluation_details || []) {
      if (!m.has(row.evaluated_id)) m.set(row.evaluated_id, [])
      m.get(row.evaluated_id)!.push(row)
    }
    return m
  }, [detail])
interface TeamSummary {
  teamId: number
  teamName: string
  members: PeerSummaryRow[]
  totalScore: number
  totalMembers: number
}

const teamSummary = useMemo(() => {
  if (!detail) return []

  const grouped = new Map<number, TeamSummary>()

  detail.peer_evaluation_summary.forEach((row) => {
    if (!grouped.has(row.team_id)) {
      grouped.set(row.team_id, {
        teamId: row.team_id,
        teamName: row.team_name,
        members: [],
        totalScore: 0,
        totalMembers: 0,
      })
    }

    const team = grouped.get(row.team_id)!

    team.members.push(row)
    team.totalScore += Number(row.avg_score)
    team.totalMembers += 1
  })

  return Array.from(grouped.values())
}, [detail])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Weekly Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Create team discussion / in-class presentation tasks and review team contribution.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError('') }}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer' }}
        >
          + New Task
        </button>
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2.5 mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{error}</p>
      )}
      {notice && (
        <p className="text-xs rounded-lg px-3 py-2.5 mb-4" style={{ background: '#F0FDF4', color: '#15803D' }}>{notice}</p>
      )}

      {showCreate && (
        <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Create New Task</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Course</label>
              <select
                value={newCourseId ?? ''}
                onChange={(e) => { setNewCourseId(Number(e.target.value) || null); setNewTeamIds([]) }}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                <option value="">Select a course…</option>
                {availableCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                placeholder="e.g. Week 5 — REST vs GraphQL discussion"
              />
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Description</label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm mb-3"
            style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
            placeholder="Task content — teams will discuss this and give a short in-class presentation."
          />

          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Teams</label>
          {!newCourseId ? (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Select a course first.</p>
          ) : teamsForNewCourse.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No teams found for this course.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-1">
              {teamsForNewCourse.map((t) => {
                const active = newTeamIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTeam(t.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{
                      background: active ? 'var(--primary)' : 'var(--muted)',
                      color: active ? 'white' : 'var(--foreground)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    {t.group_name ? `${t.group_name} · ` : ''}{t.name}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setShowCreate(false); resetCreateForm() }}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--primary)', border: 'none', cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1 }}
            >
              {creating ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </div>
      )}

      {loadingList ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>You haven't created any tasks yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 rounded-xl overflow-hidden flex flex-col max-h-[80vh]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Tasks</p>
            </div>
            <div className="divide-y overflow-y-auto flex-1" style={{ borderColor: 'var(--border)' }}>
              {tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="p-4 cursor-pointer transition-colors"
                  style={{ background: selectedId === t.id ? 'rgba(79, 70, 229, 0.08)' : 'transparent' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{t.title}</p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: t.status === 'active' ? '#DCFCE7' : '#F1F5F9', color: t.status === 'active' ? '#15803D' : '#64748B' }}
                    >
                      {t.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(t.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-5">
            {detailLoading || !detail ? (
              <div className="rounded-xl py-20 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading task details…</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-lg font-bold">{detail.title}</h2>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        Teams: {detail.teams.map((t) => t.name).join(', ')}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: detail.status === 'active' ? '#DCFCE7' : '#F1F5F9', color: detail.status === 'active' ? '#15803D' : '#64748B' }}
                    >
                      {detail.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </div>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{detail.description}</p>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Team Contribution (Peer Evaluation)</p>
                  </div>
                  {(detail.peer_evaluation_summary || []).length === 0 ? (
                    <p className="p-5 text-sm" style={{ color: 'var(--muted-foreground)' }}>No one has evaluated their teammates yet.</p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
  {teamSummary.map((team) => (
    <div key={team.teamId} className="p-5">

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base">
          {team.teamName}
        </h3>

        <span
          className="text-sm font-bold mono"
          style={{ color: 'var(--primary)' }}
        >
          Team Avg:{' '}
          {(team.totalScore / team.totalMembers).toFixed(2)}
          /5
        </span>
      </div>

      <div className="space-y-3">
        {team.members.map((member) => {
          const rowDetails =
            detailsByStudent.get(member.evaluated_id) || []

          const selfEval = rowDetails.find(
            (d) =>
              d.evaluator_id === member.evaluated_id
          )

          return (
            <div
              key={member.evaluated_id}
              className="rounded-lg p-3"
              style={{
                background: 'var(--muted)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {member.student_name}
                </span>

                <div className="flex items-center gap-2">
                  {selfEval && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: '#EDE9FE',
                        color: '#6D28D9',
                      }}
                    >
                      Self: {selfEval.score}/5
                    </span>
                  )}

                  <span className="font-bold mono">
                    {Number(member.avg_score).toFixed(1)}
                    /5
                  </span>
                </div>
              </div>

              {rowDetails
                .filter((d) => d.comment)
                .map((d, i) => (
                  <p
                    key={i}
                    className="text-xs mt-1"
                    style={{
                      color:
                        'var(--muted-foreground)',
                    }}
                  >
                    {d.comment}
                  </p>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  ))}
</div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    Teacher Note (about the presentation)
                  </label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    disabled={detail.status !== 'active'}
                    className="w-full px-3 py-2.5 rounded-lg text-sm"
                    style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
                    placeholder="Leave yourself a note about the presentation…"
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    {detail.status === 'active' && (
                      <>
                        <button
                          onClick={handleSaveNote}
                          disabled={savingNote}
                          className="px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ border: '1px solid var(--border)', background: 'transparent', cursor: savingNote ? 'default' : 'pointer' }}
                        >
                          {savingNote ? 'Saving…' : 'Save Note'}
                        </button>
                        <button
                          onClick={() => setShowCloseConfirm(true)}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                          style={{ background: '#B91C1C', border: 'none', cursor: 'pointer' }}
                        >
                          Close Task
                        </button>
                      </>
                    )}
                  </div>

                  {showCloseConfirm && (
                    <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
                      Once you close the task, students will no longer be able to evaluate their teammates. The note above will be saved and the task will be closed. Are you sure?
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleClose}
                          disabled={closing}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
                          style={{ background: '#B91C1C', border: 'none', cursor: closing ? 'default' : 'pointer' }}
                        >
                          {closing ? 'Closing…' : 'Yes, close it'}
                        </button>
                        <button
                          onClick={() => setShowCloseConfirm(false)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium"
                          style={{ border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}