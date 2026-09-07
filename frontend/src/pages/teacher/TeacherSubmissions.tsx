import { useEffect, useMemo, useState } from 'react'
import { apiFetch, ApiError } from '../../lib/api'
import type { TeacherPage } from '../../layouts/TeacherLayout'

interface Group {
  id: number
  name: string
  course_name?: string
}

interface Assessment {
  id: number
  group_id: number
  group_name?: string
  course_name?: string
  title: string
  submission_mode: 'individual' | 'team' | string
  due_date: string | null
  max_score: number
}

interface Submission {
  id: number
  assessment_id: number
  student_id?: number
  student_name?: string
  team_name?: string
  github_repo_url?: string
  submitted_by_name?: string
  submitted_at: string | null
  status: string
  ai_score?: number | null
  final_score?: number | null
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  'Not Submitted': { bg: '#F1F5F9', color: '#64748B', label: 'Not Submitted' },
  Submitted: { bg: '#DBEAFE', color: '#1E40AF', label: 'Submitted' },
  submitted: { bg: '#DBEAFE', color: '#1E40AF', label: 'Submitted' },
  Analyzing: { bg: '#EDE9FE', color: '#6D28D9', label: 'Analyzing…' },
  analyzing: { bg: '#EDE9FE', color: '#6D28D9', label: 'Analyzing…' },
  'AI Draft Ready': { bg: '#FEF3C7', color: '#B45309', label: 'Review Required' },
  ai_reviewed: { bg: '#FEF3C7', color: '#B45309', label: 'Review Required' },
  'Teacher Review': { bg: '#FEF3C7', color: '#92400E', label: 'Review Required' },
  teacher_reviewed: { bg: '#FEF3C7', color: '#92400E', label: 'Review Required' },
  Approved: { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
  approved: { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
  Rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
  error: { bg: '#FEE2E2', color: '#B91C1C', label: 'AI Analysis Failed' },
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || { bg: '#F1F5F9', color: '#64748B', label: status }
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

interface Props {
  onNavigate: (page: TeacherPage, submissionId?: number) => void
}

export default function TeacherSubmissions({ onNavigate }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError('')

      try {
        const [grpRes, assRes, subRes] = await Promise.all([
          apiFetch('/groups'),
          apiFetch('/assessments'),
          apiFetch('/submissions'),
        ])

        const myGroups: Group[] = grpRes.data || []
        const myAssessments: Assessment[] = assRes.data || []
        const myAssessmentIds = new Set(myAssessments.map((a) => a.id))
        const mySubmissions: Submission[] = (subRes.data || []).filter((s: Submission) =>
          myAssessmentIds.has(s.assessment_id)
        )

        setGroups(myGroups)
        setAssessments(myAssessments)
        setSubmissions(mySubmissions)

        const firstGroup = myGroups.find((g) => myAssessments.some((a) => a.group_id === g.id)) ?? myGroups[0]
        if (firstGroup) {
          setSelectedGroupId(firstGroup.id)
          const firstAssessment = myAssessments.find((a) => a.group_id === firstGroup.id)
          setSelectedAssessmentId(firstAssessment?.id ?? null)
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load submissions')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const groupAssessments = useMemo(
    () => assessments.filter((a) => a.group_id === selectedGroupId),
    [assessments, selectedGroupId]
  )

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null
  const selectedAssessment =
    groupAssessments.find((a) => a.id === selectedAssessmentId) ?? groupAssessments[0] ?? null

  const filteredSubmissions = useMemo(
    () => submissions.filter((s) => s.assessment_id === selectedAssessment?.id),
    [submissions, selectedAssessment?.id]
  )

  const submittedCount = filteredSubmissions.length
  const approvedCount = filteredSubmissions.filter((s) => s.status?.toLowerCase() === 'approved').length
  const reviewCount = filteredSubmissions.filter((s) =>
    ['ai_reviewed', 'teacher_reviewed', 'AI Draft Ready', 'Teacher Review'].includes(String(s.status))
  ).length

  function handleSelectGroup(groupId: number) {
    setSelectedGroupId(groupId)
    const firstAssessment = assessments.find((a) => a.group_id === groupId)
    setSelectedAssessmentId(firstAssessment?.id ?? null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Submissions
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Review submissions by course/group first, then by assignment.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No groups assigned to you yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Course / Group
              </label>
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) => handleSelectGroup(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.course_name ? `${g.course_name} — ` : ''}{g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Assignment
              </label>
              <select
                value={selectedAssessment?.id ?? ''}
                onChange={(e) => setSelectedAssessmentId(Number(e.target.value))}
                disabled={groupAssessments.length === 0}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                {groupAssessments.length === 0 ? (
                  <option value="">No assignments in this group</option>
                ) : (
                  groupAssessments.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {selectedAssessment ? (
            <>
              <div className="rounded-xl p-4 mb-4 flex items-start justify-between gap-4 flex-wrap" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                    {selectedGroup?.course_name || 'Course'} · {selectedGroup?.name}
                  </p>
                  <h2 className="text-lg font-semibold mt-1">{selectedAssessment.title}</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Due {selectedAssessment.due_date ? selectedAssessment.due_date.split('T')[0] : '—'} · {selectedAssessment.max_score} pts · {selectedAssessment.submission_mode}
                  </p>
                </div>
                <div className="flex gap-5">
                  <div className="text-center">
                    <p className="text-xl font-bold mono">{submittedCount}</p>
                    <p className="text-[10px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Submissions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold mono" style={{ color: '#15803D' }}>{approvedCount}</p>
                    <p className="text-[10px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Approved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold mono" style={{ color: '#B45309' }}>{reviewCount}</p>
                    <p className="text-[10px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Review</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                    Student Results
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                        {['Student / Team', 'Repository', 'Submitted', 'Status', 'Grade', 'Action'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            No submissions found for this assignment.
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map((sub, i) => (
                          <tr
                            key={sub.id}
                            onClick={() => onNavigate('aievaluations', sub.id)}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderBottom: i < filteredSubmissions.length - 1 ? '1px solid var(--border)' : 'none' }}
                          >
                            <td className="px-4 py-4 text-sm font-semibold text-indigo-600">
                              {sub.team_name ?? sub.student_name ?? `Student #${sub.student_id}`}
                            </td>
                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                              {sub.github_repo_url ? (
                                <a href={sub.github_repo_url} target="_blank" rel="noreferrer" className="text-xs mono text-indigo-600 hover:underline">
                                  ⎇ {sub.github_repo_url.split('/').slice(-2).join('/')}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                              {selectedAssessment.submission_mode === 'team' && sub.submitted_by_name && sub.submitted_by_name !== sub.student_name && (
                                <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                  Uploaded by {sub.submitted_by_name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-xs mono" style={{ color: 'var(--muted-foreground)' }}>
                              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="px-4 py-4"><StatusPill status={sub.status} /></td>
                            <td className="px-4 py-4 text-sm font-bold mono">
                              {sub.final_score ?? sub.ai_score ?? '—'} / {selectedAssessment.max_score}
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Review →</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl py-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No assessments found for this group.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
