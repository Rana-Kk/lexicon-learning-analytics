import { useEffect, useState } from 'react'
import { getTasks, getTaskById, getMyTeam, ApiError } from '../../lib/api'
import PeerEvaluationForm from '../../components/PeerEvaluationForm'

interface TaskListItem {
  id: number
  title: string
  description: string
  status: 'active' | 'inactive'
  created_at: string
}

interface TaskDetail extends TaskListItem {
  teams: { id: number; name: string; group_id: number }[]
}

interface TeamMember {
  id: number
  name: string
  email: string
}

interface MyTeam {
  id: number
  name: string
  group_id: number
  group_name: string
  members: TeamMember[]
}

interface Props {
  currentUserId: number
}

export default function StudentTasks({ currentUserId }: Props) {
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [myTeams, setMyTeams] = useState<MyTeam[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [taskRes, teamRes] = await Promise.all([getTasks(), getMyTeam()])
        const list: TaskListItem[] = taskRes.data ?? []
        setTasks(list)
        setMyTeams(teamRes.data ?? [])
        setSelectedId((prev) => prev ?? (list.length ? list[0].id : null))
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load tasks.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      return
    }
    let cancelled = false
    async function loadDetail() {
      setDetailLoading(true)
      try {
        const res = await getTaskById(selectedId as number)
        if (!cancelled) setDetail(res.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load task details.')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    loadDetail()
    return () => { cancelled = true }
  }, [selectedId])

  // Whichever teams the task is assigned to, the student's own team must be one of them.
  const myTeamForTask = detail
    ? myTeams.find((t) => detail.teams.some((dt) => dt.id === t.id)) ?? null
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Weekly Tasks</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          View discussion/presentation tasks assigned by your teacher and evaluate your teammates.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{error}</div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>There's no active task right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Tasks</p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="p-4 cursor-pointer transition-colors"
                  style={{ background: selectedId === t.id ? 'rgba(79, 70, 229, 0.08)' : 'transparent' }}
                >
                  <p className="text-sm font-semibold">{t.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(t.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-5">
            {detailLoading || !detail ? (
              <div className="rounded-xl py-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading task details…</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h2 className="text-lg font-bold">{detail.title}</h2>
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: detail.status === 'active' ? '#DCFCE7' : '#F1F5F9',
                        color: detail.status === 'active' ? '#15803D' : '#64748B',
                      }}
                    >
                      {detail.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </div>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    {detail.description}
                  </p>
                </div>

                {!myTeamForTask ? (
                  <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                    No team information was found for this task.
                  </div>
                ) : (
                  <PeerEvaluationForm
                    contextType="task"
                    contextId={detail.id}
                    members={myTeamForTask.members.map((m) => ({ id: m.id, name: m.name }))}
                    currentUserId={currentUserId}
                    editable={detail.status === 'active'}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}