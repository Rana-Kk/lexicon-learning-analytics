import { useEffect, useState } from 'react'
import StatCard from '../../components/StatCard'
import { apiFetch } from '../../lib/api'
import type { TeacherPage } from '../../layouts/TeacherLayout'

interface Props {
  onNavigate: (page: TeacherPage, submissionId?: number) => void
}

const SUBMISSION_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Not Submitted': { bg: '#F1F5F9', color: '#64748B' },
  'Submitted':     { bg: '#DBEAFE', color: '#1E40AF' },
  'Analyzing':     { bg: '#EDE9FE', color: '#6D28D9' },
  'AI Draft Ready':{ bg: '#FEF3C7', color: '#B45309' },
  'Teacher Review':{ bg: '#FEF3C7', color: '#B45309' },
  'Approved':      { bg: '#DCFCE7', color: '#15803D' },
  'Rejected':      { bg: '#FEE2E2', color: '#B91C1C' },
}

export default function TeacherDashboard({ onNavigate }: Props) {
  const [groups, setGroups] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [grpRes, subRes, assRes] = await Promise.all([
          apiFetch('/groups').catch(() => ({ data: [] })),
          apiFetch('/submissions').catch(() => ({ data: [] })),
          apiFetch('/assessments').catch(() => ({ data: [] }))
        ])

        const myGroups = grpRes.data || []
        const myAssessments = assRes.data || []
        const myAssessmentIds = new Set(myAssessments.map((a: any) => a.id))

        const mySubmissions = (subRes.data || []).filter((s: any) => myAssessmentIds.has(s.assessment_id))

        setGroups(myGroups)
        setAssessments(myAssessments)
        setSubmissions(mySubmissions)
      } catch (error) {
        console.error("Dashboard veri çekme hatası:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  const pendingReview = submissions.filter((s) => s.status === 'Teacher Review' || s.status === 'AI Draft Ready' || s.status === 'ai_reviewed').length
  const pendingEvals = submissions.filter((e) => e.ai_evaluation_status === 'draft' || e.status === 'AI Draft Ready' || e.status === 'ai_reviewed').length
  const totalStudents = groups.reduce((acc, g) => acc + (g.student_count || 0), 0)

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading dashboard...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Teacher Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Overview of your assigned classes and tasks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="My Groups" value={groups.length} icon={<span>🗂</span>} />
        <StatCard label="Students" value={totalStudents || '-'} icon={<span>🎓</span>} />
        <StatCard label="Pending Review" value={pendingReview} sub="Submissions awaiting you" icon={<span>⏳</span>} accent />
        <StatCard label="AI Evaluations" value={`${pendingEvals} draft`} sub="Ready for approval" icon={<span>✦</span>} />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 320px' }}>
        <div className="space-y-4">
          {/* AI evaluations needing review */}
          {pendingEvals > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #FCD34D', background: '#FFFBEB' }}>
              <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: '#FCD34D' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#B45309' }}>✦</span>
                  <p className="text-sm font-semibold" style={{ color: '#92400E', fontFamily: 'Outfit, sans-serif' }}>
                    {pendingEvals} AI evaluation{pendingEvals > 1 ? 's' : ''} waiting for your review
                  </p>
                </div>
                <button onClick={() => onNavigate('aievaluations')} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#B45309', color: 'white', border: 'none', cursor: 'pointer' }}>
                  Review Now →
                </button>
              </div>
              {submissions.filter((e) => e.status === 'AI Draft Ready' || e.status === 'ai_reviewed').slice(0, 3).map((ev) => (
                <div key={ev.id} onClick={() => onNavigate('aievaluations', ev.id)} className="px-5 py-3 flex items-center justify-between border-b last:border-0 cursor-pointer hover:bg-white/40" style={{ borderColor: '#FEF3C7' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#92400E' }}>{ev.team_name ?? ev.student_name}</p>
                    <p className="text-xs" style={{ color: '#B45309' }}>{ev.assessment_title || 'Assessment'}</p>
                  </div>
                  <div className="text-xs mono" style={{ color: '#B45309' }}>
                    AI Score: {ev.ai_score ?? '-'}/100
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent submissions */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Recent Submissions</h2>
              <button onClick={() => onNavigate('submissions')} className="text-xs" style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {submissions.slice(0, 5).map((s, i) => {
              const sc = SUBMISSION_STATUS_COLORS[s.status] ?? { bg: '#F1F5F9', color: '#64748B' }
              return (
                <div key={s.id} onClick={() => onNavigate('aievaluations', s.id)} className="px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-black/[0.02]" style={{ borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.team_name ?? s.student_name}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {s.github_repo_url ? `⎇ ${s.github_repo_url}` : 'No submission yet'}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>
                    {s.status}
                  </span>
                </div>
              )
            })}
            {submissions.length === 0 && (
              <div className="p-5 text-sm text-gray-500 text-center">No recent submissions found.</div>
            )}
          </div>

          {/* Assessments */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Active Assessments</h2>
              <button onClick={() => onNavigate('assessments')} className="text-xs" style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {assessments.slice(0, 5).map((a, i) => (
              <div key={a.id} className="px-5 py-3.5 flex items-center gap-4" style={{ borderBottom: i < assessments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {a.type} · Due {a.due_date ? a.due_date.split('T')[0] : '—'} · {a.submission_mode}
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: a.submission_mode === 'team' ? '#EDE9FE' : '#DBEAFE', color: a.submission_mode === 'team' ? '#6D28D9' : '#1E40AF' }}>
                  {a.submission_mode}
                </span>
              </div>
            ))}
            {assessments.length === 0 && (
              <div className="p-5 text-sm text-gray-500 text-center">No active assessments found.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}