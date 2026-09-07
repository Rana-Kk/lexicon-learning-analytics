import { useEffect, useState, useMemo } from 'react'
import { apiFetch, ApiError, getCriteriaTemplates, getCriteriaTemplateById } from '../../lib/api'
import type { SubmissionMode, SubmissionStatus } from '../../types'
import type { TeacherPage } from '../../layouts/TeacherLayout'
/* ────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type CriterionType = 'yes_no' | 'score' | 'text'

interface Criterion {
  id?: number | string
  assessment_id?: number
  name: string
  description: string | null
  criterion_type?: CriterionType
  max_score: number
  sort_order?: number
}

interface ChecklistCriterion {
  id: number | string
  source_template_item_id?: number | string | null
  name: string
  description?: string | null
  criterion_type: CriterionType
  max_score?: number | null
  sort_order: number
  is_default: boolean
}

interface ChecklistTemplate {
  id: number | string
  name: string
  criteria: ChecklistCriterion[]
}

interface Assessment {
  id: number
  group_id: number
  group_name?: string
  course_name?: string
  title: string
  description: string | null
  type: string
  submission_mode: SubmissionMode
  repo_slug: string | null
  due_date: string | null
  assessment_date: string | null
  max_score: number
  assignment_evaluation_criteria?: Criterion[]
  criteria_template_id?: number | string | null
  checklist_criteria?: ChecklistCriterion[]
}

interface Group {
  id: number
  name: string
  course_id: number
  course_name?: string
  studentCount?: number
}

interface Submission {
  id: number
  assessment_id: number
  student_id?: number
  student_name?: string
  team_id?: number
  team_name?: string
  github_repo_url?: string
  submitted_at: string | null
  status: SubmissionStatus
  ai_score?: number
  ai_feedback?: string
  final_score?: number
  criteria_scores?: any[]
}


interface AssessmentResultCriterion {
  criterion_id: number
  criterion_name: string
  criterion_description?: string | null
  criterion_max_score: number
  ai_score?: number | null
  ai_rationale?: string | null
  teacher_final_score?: number | null
}

interface AssessmentResultChecklist {
  id: number
  name: string
  description?: string | null
  criterion_type: 'yes_no' | 'score' | 'text' | string
  max_score?: number | string | null
  ai_yes_no_value?: number | boolean | null
  ai_score_value?: number | string | null
  ai_text_value?: string | null
  ai_feedback?: string | null
  teacher_yes_no_value?: number | boolean | null
  teacher_score_value?: number | string | null
  teacher_text_value?: string | null
  teacher_feedback?: string | null
}

interface AssessmentResultDetail extends Submission {
  student_email?: string
  assessment_title?: string
  assessment_description?: string | null
  assessment_max_score?: number
  ai_evaluation_status?: string | null
  teacher_feedback?: string | null
  strengths?: string | null
  areas_for_improvement?: string | null
  recommendations?: string | null
  suggested_next_steps?: string | null
  criteria_scores?: AssessmentResultCriterion[]
  checklist_criteria?: AssessmentResultChecklist[]
}

interface AssessmentReport {
  assessment: {
    id: number
    title: string
    max_score: number
  }
  overview: {
    total_students: number
    submitted_students: number
    pending_students: number
    average_score: number
    highest_score: number
    lowest_score: number
    passed_students: number
    pass_rate: number
  }
  ai_vs_teacher: {
    average_ai_score: number
    average_teacher_score: number
    difference: number
  }
  score_distribution: Record<'0-25' | '26-50' | '51-75' | '76-100', number>
}

interface Props {
  onNavigate: (page: TeacherPage, id?: number) => void
}

/* ────────────────────────────────────────────────────────────────────
   Shared helpers & Colors
───────────────────────────────────────────────────────────────────── */

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Project:        { bg: '#DBEAFE', color: '#1E40AF' },
  Assignment:     { bg: '#F3E8FF', color: '#6D28D9' },
  Presentation:   { bg: '#CFFAFE', color: '#0E7490' },
  Practical:      { bg: '#FEF3C7', color: '#92400E' },
  'Final Project':{ bg: '#FCE7F3', color: '#9D174D' },
  Other:          { bg: '#F1F5F9', color: '#475569' },
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  'Not Submitted': { bg: '#F1F5F9', color: '#64748B', label: 'Not Submitted' },
  'Submitted':     { bg: '#DBEAFE', color: '#1E40AF', label: 'Submitted' },
  'pending':       { bg: '#DBEAFE', color: '#1E40AF', label: 'Submitted' },
  'Analyzing':     { bg: '#EDE9FE', color: '#6D28D9', label: 'Analyzing' },
  'analyzing':     { bg: '#EDE9FE', color: '#6D28D9', label: 'Analyzing' },
  'AI Draft Ready':{ bg: '#FEF3C7', color: '#B45309', label: 'AI Draft Ready' },
  'ai_reviewed':   { bg: '#FEF3C7', color: '#B45309', label: 'AI Reviewed' },
  'Teacher Review':{ bg: '#FEF3C7', color: '#92400E', label: 'Review Required' },
  'Approved':      { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
  'approved':      { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
  'Rejected':      { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
}

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CFG[status] || { bg: '#F1F5F9', color: '#64748B', label: status }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function ModeTag({ mode }: { mode: SubmissionMode | string }) {
  const isTeam = mode?.toLowerCase() === 'team'
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: isTeam ? '#EDE9FE' : '#DBEAFE', color: isTeam ? '#6D28D9' : '#1E40AF' }}>
      {isTeam ? 'Team' : 'Individual'}
    </span>
  )
}

function computeAssessmentStats(a: Assessment, allSubs: Submission[]) {
  const subs = allSubs.filter(s => s.assessment_id === a.id)
  const submitted = subs.filter(s => s.status !== 'Not Submitted').length
  const approved = subs.filter(s => String(s.status) === 'approved' || String(s.status) === 'Approved').length
  const needsReview = subs.filter(s => String(s.status) === 'ai_reviewed' || String(s.status) === 'AI Draft Ready' || String(s.status) === 'Teacher Review').length
  const analyzing = subs.filter(s => String(s.status) === 'analyzing' || String(s.status) === 'Analyzing').length
  const total = Math.max(subs.length, 1)
  return { submitted, approved, needsReview, analyzing, total }
}

/* ────────────────────────────────────────────────────────────────────
   Assessment Card Component
───────────────────────────────────────────────────────────────────── */

function AssessmentCard({ a, subs, onClick }: { a: Assessment; subs: Submission[]; onClick: () => void }) {
  const tc = TYPE_COLORS[a.type] ?? TYPE_COLORS.Assignment
  const { submitted, approved, needsReview, analyzing, total } = computeAssessmentStats(a, subs)
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0
  const overdue = a.due_date ? new Date(a.due_date) < new Date() && submitted < total : false

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-shadow hover:shadow-md"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>{a.type}</span>
          <ModeTag mode={a.submission_mode} />
          {overdue && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Overdue</span>}
        </div>
        <span className="text-xs mono flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          Due {a.due_date ? a.due_date.split('T')[0] : '—'}
        </span>
      </div>

      <p className="text-sm font-semibold mb-3 leading-snug" style={{ fontFamily: 'Outfit, sans-serif' }}>{a.title}</p>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
          <span>Submissions</span>
          <span className="mono">{submitted}/{total}</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: '5px', background: 'var(--secondary)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#15803D' : 'var(--primary)' }} />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {approved > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#15803D' }}>
            <span>✓</span><span className="mono">{approved} approved</span>
          </span>
        )}
        {needsReview > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#B45309' }}>
            <span>⚑</span><span className="mono">{needsReview} review</span>
          </span>
        )}
        {analyzing > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#6D28D9' }}>
            <span>✦</span><span className="mono">{analyzing} analyzing</span>
          </span>
        )}
        {submitted === 0 && (
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No submissions yet</span>
        )}
        <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>{a.max_score} pts</span>
      </div>
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Assessment Detail View (5 Tabs)
───────────────────────────────────────────────────────────────────── */

type DetailTab = 'overview' | 'rubric' | 'submissions' | 'evaluations' | 'report'

function AssessmentDetail({ a, groups, allSubs, onBack, onDeleted, onEdit, onNavigate }: { a: Assessment; groups: Group[]; allSubs: Submission[]; onBack: () => void; onDeleted: () => void; onEdit: (a: Assessment) => void; onNavigate: (page: TeacherPage, id?: number) => void }) {
  const [tab, setTab] = useState<DetailTab>('overview')
  const [detailAssessment, setDetailAssessment] = useState<Assessment>(a)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState('')

  const group = groups.find(g => g.id === a.group_id)
  const subs = allSubs.filter(s => s.assessment_id === a.id)
  const { submitted, approved, needsReview, total } = computeAssessmentStats(a, allSubs)
  const tc = TYPE_COLORS[a.type] ?? TYPE_COLORS.Assignment

  useEffect(() => {
    const fetchDetail = async () => {
      setLoadingDetail(true)
      try {
        const res = await apiFetch(`/assessments/${a.id}`)
        if (res.data) setDetailAssessment(res.data)
      } catch (err) {
        // Fallback to prop
      } finally {
        setLoadingDetail(false)
      }
    }
    fetchDetail()
  }, [a.id])


  useEffect(() => {
    if (tab !== 'report') return

    let cancelled = false

    const fetchReport = async () => {
      setLoadingReport(true)
      setReportError('')

      try {
        const res = await apiFetch(`/assessments/${a.id}/report`)
        if (!cancelled) {
          setReport(res.data as AssessmentReport)
        }
      } catch (err) {
        if (!cancelled) {
          setReportError(err instanceof ApiError ? err.message : 'Failed to load assessment report')
          setReport(null)
        }
      } finally {
        if (!cancelled) setLoadingReport(false)
      }
    }

    fetchReport()

    return () => {
      cancelled = true
    }
  }, [tab, a.id])

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return
    try {
      await apiFetch(`/assessments/${a.id}`, { method: 'DELETE' })
      onDeleted()
    } catch (err: any) {
      alert(err.message || 'Failed to delete assessment')
    }
  }

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rubric', label: `Evaluation Criteria (${detailAssessment.assignment_evaluation_criteria?.length || 0})` },
    { id: 'submissions', label: `Submissions (${subs.length})` },
    { id: 'evaluations', label: `AI Evaluations (${subs.filter(s => s.ai_score !== null && s.ai_score !== undefined).length})` },
    { id: 'report', label: 'Report' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between text-sm mb-4">
        <div className="flex items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, fontSize: '14px' }}>
            ← Assessments
          </button>
          <span>/</span>
          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{group?.name || `Group #${a.group_id}`}</span>
          <span>/</span>
          <span className="font-medium truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{a.title}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(detailAssessment)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'transparent', cursor: 'pointer' }}
          >
            Edit Assignment
          </button>
          <button
            onClick={handleDelete}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ border: '1px solid #FCA5A5', color: '#B91C1C', background: 'transparent', cursor: 'pointer' }}
          >
            Delete Assignment
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                📌 {group?.name || `Group #${a.group_id}`}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>{a.type}</span>
              <ModeTag mode={a.submission_mode} />
              {a.repo_slug && (
                <span className="text-xs mono px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  Repo: {a.repo_slug}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>{a.title}</h1>
          </div>
          <div className="flex gap-4 flex-shrink-0">
            {[
              { label: 'Assessment Date', value: a.assessment_date ? a.assessment_date.split('T')[0] : '—' },
              { label: 'Due Date', value: a.due_date ? a.due_date.split('T')[0] : '—' },
              { label: 'Max Score', value: `${a.max_score} pts` },
            ].map(({ label, value }) => (
              <div key={label} className="text-right">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                <p className="text-sm font-semibold mono">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4 pt-4 flex gap-6 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Submissions Total', value: subs.length, color: 'var(--foreground)' },
            { label: 'Submitted', value: submitted, color: '#1D4ED8' },
            { label: 'Approved', value: approved, color: '#15803D' },
            { label: 'Needs Review', value: needsReview, color: '#B45309' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-2xl font-bold mono" style={{ color }}>{value}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
            </div>
          ))}
          <div className="flex-1 flex items-end pb-1 min-w-32">
            <div className="w-full">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                <span>Submission progress</span>
                <span className="mono">{total > 0 ? Math.round((submitted / total) * 100) : 0}%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--secondary)' }}>
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? (submitted / total) * 100 : 0}%`, background: 'var(--primary)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === t.id ? 'var(--primary)' : 'var(--muted-foreground)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {detailAssessment.description && (
             <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
               <h3 className="text-sm font-semibold mb-2">Description</h3>
               <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                 {detailAssessment.description}
               </p>
             </div>
          )}
          
          <div className="rounded-xl p-4" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#1E40AF' }}>
              Submission Mode: {detailAssessment.submission_mode || 'Individual'}
            </p>
            <p className="text-xs" style={{ color: '#1D4ED8' }}>
              Students in {group?.name || 'this group'} push their solutions to GitHub repositories matching slug <strong>{detailAssessment.repo_slug || detailAssessment.title}</strong>.
            </p>
          </div>

          {/* Student Status List */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Student Overview</p>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                  {['Student / Team', 'Status', 'Grade'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No students found.</td>
                  </tr>
                ) : (
                  subs.map((s, i) => (
                    <tr 
                      key={s.id} 
                      onClick={() => onNavigate('aievaluations', s.id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ borderBottom: i < subs.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <td className="px-4 py-3.5 text-sm font-medium text-indigo-600">{s.student_name || `Student #${s.student_id}`}</td>
                      <td className="px-4 py-3.5"><StatusPill status={s.status} /></td>
                      <td className="px-4 py-3.5 text-sm font-bold mono">
                        {s.final_score ?? s.ai_score ?? '-'} / {detailAssessment.max_score}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rubric' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="text-sm font-semibold">{detailAssessment.assignment_evaluation_criteria?.length || 0} criteria · {detailAssessment.max_score} pts total</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Evaluated automatically by Gemini AI and reviewed by instructors.</p>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                {['#', 'Criterion', 'Description', 'Max Points'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!detailAssessment.assignment_evaluation_criteria || detailAssessment.assignment_evaluation_criteria.length === 0) ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No grading criteria defined.</td>
                </tr>
              ) : (
                detailAssessment.assignment_evaluation_criteria.map((c, i) => (
                  <tr key={c.id || i} style={{ borderBottom: i < (detailAssessment.assignment_evaluation_criteria?.length || 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3.5 text-xs mono" style={{ color: 'var(--muted-foreground)' }}>{c.sort_order || i + 1}</td>
                    <td className="px-4 py-3.5 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--muted-foreground)', maxWidth: '260px' }}>{c.description || '—'}</td>
                    <td className="px-4 py-3.5 text-sm mono font-semibold">{c.max_score} pts</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'submissions' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Student Submissions</p>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                {['Student / Team', 'Repository', 'Submitted At', 'Status', 'Grade'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No submissions recorded yet.</td>
                </tr>
              ) : (
                subs.map((s, i) => (
                  <tr key={s.id} onClick={() => onNavigate('aievaluations', s.id)} className="cursor-pointer hover:bg-gray-50" style={{ borderBottom: i < subs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3.5 text-sm font-medium">{s.student_name || `Student #${s.student_id}`}</td>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      {s.github_repo_url ? (
                        <a href={s.github_repo_url} target="_blank" rel="noreferrer" className="text-xs mono text-indigo-600 hover:underline">
                          ⎇ {s.github_repo_url}
                        </a>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs mono" style={{ color: 'var(--muted-foreground)' }}>
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3.5"><StatusPill status={s.status} /></td>
                    <td className="px-4 py-3.5 text-sm font-bold mono">
                      {s.final_score ?? s.ai_score ?? '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'evaluations' && (
        <div className="space-y-3">
          {subs.filter(s => s.ai_score !== null && s.ai_score !== undefined).length === 0 ? (
            <div className="rounded-xl py-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl mb-2">✦</p>
              <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>No AI evaluations yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Evaluations will appear once GitHub submissions are polled and analyzed.</p>
            </div>
          ) : (
            subs.filter(s => s.ai_score !== null).map(s => (
              <div key={s.id} onClick={() => onNavigate('aievaluations', s.id)} className="rounded-xl p-5 cursor-pointer hover:border-indigo-300 transition-colors" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{s.student_name || `Student #${s.student_id}`}</h3>
                    <p className="text-xs mono text-gray-400">{s.github_repo_url}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold mono text-emerald-600">{s.final_score ?? s.ai_score}</span>
                    <span className="text-xs text-gray-400">/{detailAssessment.max_score} pts</span>
                  </div>
                </div>
                {s.ai_feedback && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap">
                    <strong>AI Feedback:</strong> {s.ai_feedback}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-5">
          {reportError && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
              {reportError}
            </div>
          )}

          {loadingReport ? (
            <div className="rounded-xl py-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading assessment report…</p>
            </div>
          ) : !report ? (
            <div className="rounded-xl py-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl mb-2">📊</p>
              <p className="font-medium">Report is not available yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Assessment statistics will appear here once data is available.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Class Average', value: `${report.overview.average_score} / ${report.assessment.max_score}`, color: '#1D4ED8', sub: 'Teacher-approved scores' },
                  { label: 'Highest Score', value: `${report.overview.highest_score}`, color: '#15803D', sub: `out of ${report.assessment.max_score}` },
                  { label: 'Lowest Score', value: `${report.overview.lowest_score}`, color: '#B45309', sub: `out of ${report.assessment.max_score}` },
                  { label: 'Pass Rate', value: `${report.overview.pass_rate}%`, color: '#7C3AED', sub: `${report.overview.passed_students} students passed` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{item.label}</p>
                    <p className="text-2xl font-bold mono mt-2" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{item.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-semibold">Submission Overview</h3>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Participation in this assessment</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: 'Total Students', value: report.overview.total_students, color: '#0F172A' },
                      { label: 'Submitted', value: report.overview.submitted_students, color: '#1D4ED8' },
                      { label: 'Pending', value: report.overview.pending_students, color: '#B45309' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{item.label}</span>
                        <span className="text-lg font-bold mono" style={{ color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                      <span>Submission rate</span>
                      <span className="mono">
                        {report.overview.total_students > 0
                          ? Math.round((report.overview.submitted_students / report.overview.total_students) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: '8px', background: 'var(--secondary)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${report.overview.total_students > 0 ? (report.overview.submitted_students / report.overview.total_students) * 100 : 0}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold">Score Distribution</h3>
                  <p className="text-xs mt-1 mb-5" style={{ color: 'var(--muted-foreground)' }}>Final scores grouped as percentages</p>

                  <div className="space-y-4">
                    {Object.entries(report.score_distribution).map(([range, count]) => {
                      const max = Math.max(...Object.values(report.score_distribution), 1)
                      const percentage = (Number(count) / max) * 100
                      return (
                        <div key={range}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span style={{ color: 'var(--muted-foreground)' }}>{range}%</span>
                            <span className="font-semibold mono">{count} student{Number(count) === 1 ? '' : 's'}</span>
                          </div>
                          <div className="rounded-full overflow-hidden" style={{ height: '8px', background: 'var(--secondary)' }}>
                            <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: '#6366F1' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div>
                    <h3 className="text-sm font-semibold">AI vs Teacher Evaluation</h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Comparison of average AI and final teacher scores</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F1F5F9', color: '#475569' }}>
                    Difference: {report.ai_vs_teacher.difference > 0 ? '+' : ''}{report.ai_vs_teacher.difference}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg p-4" style={{ background: '#EEF2FF' }}>
                    <p className="text-xs font-medium" style={{ color: '#4338CA' }}>Average AI Score</p>
                    <p className="text-2xl font-bold mono mt-2" style={{ color: '#3730A3' }}>{report.ai_vs_teacher.average_ai_score}</p>
                  </div>
                  <div className="rounded-lg p-4" style={{ background: '#F0FDF4' }}>
                    <p className="text-xs font-medium" style={{ color: '#15803D' }}>Average Teacher Score</p>
                    <p className="text-2xl font-bold mono mt-2" style={{ color: '#166534' }}>{report.ai_vs_teacher.average_teacher_score}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
/* ────────────────────────────────────────────────────────────────────
   Create / Edit Assessment
───────────────────────────────────────────────────────────────────── */

function CreateWizard({
  groups,
  initialData,
  onClose,
  onCreated,
}: {
  groups: Group[]
  initialData?: Assessment | null
  onClose: () => void
  onCreated: () => void
}) {
  const isEditing = !!initialData
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    groupId: initialData
      ? String(initialData.group_id)
      : groups[0]
        ? String(groups[0].id)
        : '',

    title: initialData?.title || '',
    description: initialData?.description || '',

    type: initialData?.type || 'Assignment',

    submissionMode:
      initialData?.submission_mode || 'individual',

    repoSlug: initialData?.repo_slug || '',

    assessmentDate:
      initialData?.assessment_date
        ? initialData.assessment_date.split('T')[0]
        : '',

    dueDate:
      initialData?.due_date
        ? initialData.due_date.split('T')[0]
        : '',

    maxScore:
      initialData
        ? String(initialData.max_score)
        : '100',

    criteria:
      initialData?.assignment_evaluation_criteria?.length
        ? initialData.assignment_evaluation_criteria.map(
            (criterion) => ({
              name: criterion.name || '',
              description: criterion.description || '',
              max_score: criterion.max_score || 0,
            })
          )
        : [
            {
              name: '',
              description: '',
              max_score: 100,
            },
          ],

    checklist:
      initialData?.checklist_criteria?.length
        ? initialData.checklist_criteria.map((criterion) => ({
            id: criterion.id,
            source_template_item_id:
              criterion.source_template_item_id || null,
            name: criterion.name || '',
            description: criterion.description || '',
            criterion_type: criterion.criterion_type || 'yes_no',
            max_score: criterion.max_score ?? null,
            sort_order: criterion.sort_order || 1,
          }))
        : [],
  })

  const updateForm = (key: string, value: any) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const updateCriterion = (
    index: number,
    key: 'name' | 'description' | 'max_score',
    value: string | number
  ) => {
    setForm((previous) => {
      const criteria = [...previous.criteria]

      criteria[index] = {
        ...criteria[index],
        [key]: value,
      }

      return {
        ...previous,
        criteria,
      }
    })
  }

  const addCriterion = () => {
    setForm((previous) => ({
      ...previous,
      criteria: [
        ...previous.criteria,
        {
          name: '',
          description: '',
          max_score: 0,
        },
      ],
    }))
  }

  const removeCriterion = (index: number) => {
    setForm((previous) => ({
      ...previous,
      criteria: previous.criteria.filter((_, i) => i !== index),
    }))
  }

  const addChecklistCriterion = () => {
    setForm((previous) => ({
      ...previous,
      checklist: [
        ...previous.checklist,
        {
          id: `new-${Date.now()}`,
          source_template_item_id: null,
          name: '',
          description: '',
          criterion_type: 'yes_no' as CriterionType,
          max_score: null,
          sort_order: previous.checklist.length + 1,
        },
      ],
    }))
  }

  const updateChecklistCriterion = (
    index: number,
    key: string,
    value: any
  ) => {
    setForm((previous) => {
      const checklist = [...previous.checklist]

      checklist[index] = {
        ...checklist[index],
        [key]: value,
      }

      return {
        ...previous,
        checklist,
      }
    })
  }

  const removeChecklistCriterion = (index: number) => {
    setForm((previous) => ({
      ...previous,
      checklist: previous.checklist.filter(
        (_, i) => i !== index
      ),
    }))
  }

  const handleSave = async () => {
    if (!form.groupId) {
      alert('Please select a group')
      return
    }

    if (!form.title.trim()) {
      alert('Assessment title is required')
      return
    }

    if (!form.maxScore || Number(form.maxScore) <= 0) {
      alert('Max score must be greater than 0')
      return
    }

    if (form.criteria.length === 0) {
      alert('Please add at least one evaluation criterion')
      return
    }

    const invalidCriterion = form.criteria.some(
      (criterion) =>
        !criterion.name.trim() ||
        Number(criterion.max_score) <= 0
    )

    if (invalidCriterion) {
      alert(
        'Each evaluation criterion needs a name and a valid max score'
      )
      return
    }

    setSaving(true)

    try {
      const payload = {
        group_id: Number(form.groupId),

        title: form.title.trim(),

        description:
          form.description.trim() || null,

        type: form.type.toLowerCase(),

        submission_mode:
          String(form.submissionMode).toLowerCase(),

        repo_slug:
          form.repoSlug.trim() || null,

        assessment_date:
          form.assessmentDate || null,

        due_date:
          form.dueDate || null,

        max_score:
          Number(form.maxScore),

        assignment_evaluation_criteria:
          form.criteria.map(
            (criterion, index) => ({
              name: criterion.name.trim(),

              description:
                criterion.description.trim() || null,

              criterion_type: 'score',

              max_score:
                Number(criterion.max_score),

              sort_order: index + 1,
            })
          ),

        checklist_criteria:
          form.checklist.map(
            (criterion, index) => ({
              source_template_item_id:
                criterion.source_template_item_id || null,

              name:
                criterion.name.trim(),

              description:
                criterion.description?.trim() || null,

              criterion_type:
                criterion.criterion_type,

              max_score:
                criterion.criterion_type === 'score'
                  ? Number(criterion.max_score || 0)
                  : null,

              sort_order: index + 1,
            })
          ),
      }

      if (isEditing && initialData) {
        await apiFetch(
          `/assessments/${initialData.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        )
      } else {
        await apiFetch('/assessments', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      onCreated()
      onClose()
    } catch (error: any) {
      alert(
        error?.message ||
          'Failed to save assessment'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* GROUP */}

      <div>
        <label className="block text-xs font-medium mb-2">
          Group
        </label>

        <select
          value={form.groupId}
          onChange={(event) =>
            updateForm(
              'groupId',
              event.target.value
            )
          }
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--background)',
          }}
        >
          <option value="">
            Select a group
          </option>

          {groups.map((group) => (
            <option
              key={group.id}
              value={group.id}
            >
              {group.name}
            </option>
          ))}
        </select>
      </div>


      {/* TITLE */}

      <div>
        <label className="block text-xs font-medium mb-2">
          Assessment Title
        </label>

        <input
          value={form.title}
          onChange={(event) =>
            updateForm(
              'title',
              event.target.value
            )
          }
          placeholder="e.g. React Final Project"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--background)',
          }}
        />
      </div>


      {/* DESCRIPTION */}

      <div>
        <label className="block text-xs font-medium mb-2">
          Description
        </label>

        <textarea
          value={form.description}
          onChange={(event) =>
            updateForm(
              'description',
              event.target.value
            )
          }
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--background)',
          }}
        />
      </div>


      {/* TYPE + MODE */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div>
          <label className="block text-xs font-medium mb-2">
            Type
          </label>

          <select
            value={form.type}
            onChange={(event) =>
              updateForm(
                'type',
                event.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            <option value="Assignment">
              Assignment
            </option>

            <option value="Project">
              Project
            </option>

            <option value="Presentation">
              Presentation
            </option>

            <option value="Practical">
              Practical
            </option>

            <option value="Final Project">
              Final Project
            </option>
          </select>
        </div>


        <div>
          <label className="block text-xs font-medium mb-2">
            Submission Mode
          </label>

          <select
            value={form.submissionMode}
            onChange={(event) =>
              updateForm(
                'submissionMode',
                event.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            <option value="individual">
              Individual
            </option>

            <option value="team">
              Team
            </option>
          </select>
        </div>

      </div>


      {/* REPO */}

      <div>
        <label className="block text-xs font-medium mb-2">
          Repository Slug
        </label>

        <input
          value={form.repoSlug}
          onChange={(event) =>
            updateForm(
              'repoSlug',
              event.target.value
            )
          }
          placeholder="optional-repository-slug"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--background)',
          }}
        />
      </div>


      {/* DATES + SCORE */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div>
          <label className="block text-xs font-medium mb-2">
            Assessment Date
          </label>

          <input
            type="date"
            value={form.assessmentDate}
            onChange={(event) =>
              updateForm(
                'assessmentDate',
                event.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          />
        </div>


        <div>
          <label className="block text-xs font-medium mb-2">
            Due Date
          </label>

          <input
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              updateForm(
                'dueDate',
                event.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          />
        </div>


        <div>
          <label className="block text-xs font-medium mb-2">
            Max Score
          </label>

          <input
            type="number"
            min="1"
            value={form.maxScore}
            onChange={(event) =>
              updateForm(
                'maxScore',
                event.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          />
        </div>

      </div>


      {/* RUBRIC */}

      <div
        className="rounded-xl p-4"
        style={{
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex justify-between items-center mb-4">

          <div>
            <h3 className="text-sm font-semibold">
              Evaluation Criteria
            </h3>

            <p
              className="text-xs mt-1"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              Define how this assessment will be scored.
            </p>
          </div>

          <button
            type="button"
            onClick={addCriterion}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              border:
                '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            + Add Criterion
          </button>

        </div>


        <div className="space-y-3">

          {form.criteria.map(
            (criterion, index) => (

              <div
                key={index}
                className="rounded-lg p-3"
                style={{
                  background: 'var(--muted)',
                  border:
                    '1px solid var(--border)',
                }}
              >

                <div className="flex gap-2 mb-2">

                  <input
                    value={criterion.name}
                    onChange={(event) =>
                      updateCriterion(
                        index,
                        'name',
                        event.target.value
                      )
                    }
                    placeholder="Criterion name"
                    className="flex-1 px-2.5 py-2 rounded text-sm"
                    style={{
                      border:
                        '1px solid var(--border)',
                      background:
                        'var(--card)',
                    }}
                  />

                  <input
                    type="number"
                    min="1"
                    value={criterion.max_score}
                    onChange={(event) =>
                      updateCriterion(
                        index,
                        'max_score',
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="w-24 px-2 py-2 rounded text-sm"
                    style={{
                      border:
                        '1px solid var(--border)',
                      background:
                        'var(--card)',
                    }}
                  />

                  {form.criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        removeCriterion(index)
                      }
                      className="px-2 text-sm"
                      style={{
                        color: '#DC2626',
                        background:
                          'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}

                </div>


                <textarea
                  value={criterion.description}
                  onChange={(event) =>
                    updateCriterion(
                      index,
                      'description',
                      event.target.value
                    )
                  }
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-2.5 py-2 rounded text-xs"
                  style={{
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--card)',
                  }}
                />

              </div>
            )
          )}

        </div>
      </div>


      {/* CHECKLIST */}

      <div
        className="rounded-xl p-4"
        style={{
          border: '1px solid var(--border)',
        }}
      >

        <div className="flex justify-between items-center mb-4">

          <div>
            <h3 className="text-sm font-semibold">
              Checklist Criteria
            </h3>

            <p
              className="text-xs mt-1"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              Optional additional evaluation criteria.
            </p>
          </div>

          <button
            type="button"
            onClick={addChecklistCriterion}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              border:
                '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            + Add Checklist Item
          </button>

        </div>


        <div className="space-y-3">

          {form.checklist.map(
            (criterion, index) => (

              <div
                key={criterion.id}
                className="rounded-lg p-3"
                style={{
                  background: 'var(--muted)',
                  border:
                    '1px solid var(--border)',
                }}
              >

                <div className="flex gap-2">

                  <input
                    value={criterion.name}
                    onChange={(event) =>
                      updateChecklistCriterion(
                        index,
                        'name',
                        event.target.value
                      )
                    }
                    placeholder="Criterion name"
                    className="flex-1 px-2 py-2 rounded text-sm"
                    style={{
                      border:
                        '1px solid var(--border)',
                      background:
                        'var(--card)',
                    }}
                  />


                  <select
                    value={criterion.criterion_type}
                    onChange={(event) => {
                      const type =
                        event.target
                          .value as CriterionType

                      updateChecklistCriterion(
                        index,
                        'criterion_type',
                        type
                      )

                      if (type !== 'score') {
                        updateChecklistCriterion(
                          index,
                          'max_score',
                          null
                        )
                      }
                    }}
                    className="px-2 py-2 rounded text-xs"
                    style={{
                      border:
                        '1px solid var(--border)',
                      background:
                        'var(--card)',
                    }}
                  >
                    <option value="yes_no">
                      Yes / No
                    </option>

                    <option value="text">
                      Text
                    </option>

                    <option value="score">
                      Score
                    </option>
                  </select>


                  {criterion.criterion_type ===
                    'score' && (
                    <input
                      type="number"
                      min="1"
                      value={
                        criterion.max_score ?? ''
                      }
                      onChange={(event) =>
                        updateChecklistCriterion(
                          index,
                          'max_score',
                          Number(
                            event.target.value
                          )
                        )
                      }
                      placeholder="Max"
                      className="w-20 px-2 py-2 rounded text-xs"
                      style={{
                        border:
                          '1px solid var(--border)',
                        background:
                          'var(--card)',
                      }}
                    />
                  )}


                  <button
                    type="button"
                    onClick={() =>
                      removeChecklistCriterion(
                        index
                      )
                    }
                    style={{
                      color: '#DC2626',
                      background:
                        'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>

                </div>


                <textarea
                  value={
                    criterion.description || ''
                  }
                  onChange={(event) =>
                    updateChecklistCriterion(
                      index,
                      'description',
                      event.target.value
                    )
                  }
                  placeholder="Description"
                  rows={2}
                  className="w-full mt-2 px-2 py-2 rounded text-xs"
                  style={{
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--card)',
                  }}
                />

              </div>
            )
          )}

        </div>

      </div>


      {/* ACTIONS */}

      <div
        className="flex justify-end gap-3 pt-5"
        style={{
          borderTop:
            '1px solid var(--border)',
        }}
      >

        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm"
          style={{
            border:
              '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>


        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: saving
              ? 'not-allowed'
              : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving
            ? 'Saving…'
            : isEditing
              ? 'Save Changes'
              : 'Create Assessment'}
        </button>

      </div>

    </div>
  )
}
/* ────────────────────────────────────────────────────────────────────
   Main Teacher Assessments Page
───────────────────────────────────────────────────────────────────── */

export default function TeacherAssessments({ onNavigate }: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [wizardData, setWizardData] = useState<Assessment | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [filterType, setFilterType] = useState('all')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      // The API calls should return filtered results based on the logged-in teacher's token.
      const [assRes, grpRes, subRes] = await Promise.all([
        apiFetch('/assessments').catch(() => ({ data: [] })),
        apiFetch('/groups').catch(() => ({ data: [] })),
        apiFetch('/submissions').catch(() => ({ data: [] }))
      ])
      
      setAssessments(assRes.data || (Array.isArray(assRes) ? assRes : []))
      setGroups(grpRes.data || (Array.isArray(grpRes) ? grpRes : []))
      setSubmissions(subRes.data || (Array.isArray(subRes) ? subRes : []))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assessments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => assessments.filter(a => {
    if (filterGroup !== 'all' && String(a.group_id) !== filterGroup) return false
    if (filterMode !== 'all' && a.submission_mode?.toLowerCase() !== filterMode.toLowerCase()) return false
    if (filterType !== 'all' && a.type?.toLowerCase() !== filterType.toLowerCase()) return false
    return true
  }), [assessments, filterGroup, filterMode, filterType])

  const byCourse = useMemo(() => {
    const groupMap = new Map<number, { group: Group; assessments: Assessment[] }>()

    groups.forEach((group) => {
      groupMap.set(group.id, { group, assessments: [] })
    })

    filtered.forEach((assessment) => {
      const existing = groupMap.get(assessment.group_id)

      if (existing) {
        existing.assessments.push(assessment)
      } else {
        groupMap.set(assessment.group_id, {
          group: {
            id: assessment.group_id,
            name: assessment.group_name || `Group #${assessment.group_id}`,
            course_id: 0,
            course_name: assessment.course_name || 'Other Course',
          },
          assessments: [assessment],
        })
      }
    })

    const courseMap = new Map<string, { courseName: string; groups: { group: Group; assessments: Assessment[] }[] }>()

    for (const item of groupMap.values()) {
      if (item.assessments.length === 0) continue

      const courseName = item.group.course_name || item.assessments[0]?.course_name || 'Other Course'
      const courseKey = courseName.toLowerCase()

      if (!courseMap.has(courseKey)) {
        courseMap.set(courseKey, { courseName, groups: [] })
      }

      courseMap.get(courseKey)!.groups.push(item)
    }

    return [...courseMap.values()].map((course) => ({
      ...course,
      groups: course.groups.sort((a, b) => a.group.name.localeCompare(b.group.name)),
    }))
  }, [groups, filtered])

  const openWizardForEdit = async (a: Assessment) => {
    try {
      const response = await apiFetch(`/assessments/${a.id}`)
      setWizardData(response.data || a)
      setShowCreate(true)
    } catch (err: any) {
      alert(err?.message || 'Could not load assignment for editing')
    }
  }

  const openWizardForCreate = () => {
    setWizardData(null)
    setShowCreate(true)
  }
  if (selectedAssessment) {
    return (
      <>
        <AssessmentDetail
          a={selectedAssessment}
          groups={groups}
          allSubs={submissions}
          onBack={() => setSelectedAssessment(null)}
          onDeleted={() => {
            setSelectedAssessment(null)
            loadData()
          }}
          onEdit={openWizardForEdit}
          onNavigate={onNavigate}
        />

        {/* EDIT ASSESSMENT MODAL */}
        {showCreate && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: 'rgba(0,0,0,0.4)'
            }}
            onClick={() => setShowCreate(false)}
          >
            <div
              className="rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2
                className="text-lg font-semibold mb-5"
                style={{
                  fontFamily: 'Outfit, sans-serif'
                }}
              >
                Edit Assessment
              </h2>

              <CreateWizard
                groups={groups}
                initialData={wizardData}
                onClose={() => setShowCreate(false)}
                onCreated={async () => {
                  await loadData()

                  if (selectedAssessment) {
                    try {
                      const response = await apiFetch(
                        `/assessments/${selectedAssessment.id}`
                      )

                      setSelectedAssessment(
                        response.data || selectedAssessment
                      )
                    } catch {
                      // Keep the current assessment if refresh fails
                    }
                  }

                  setShowCreate(false)
                }}
              />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* PAGE HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            Assessments
          </h1>

          <p
            className="text-sm mt-0.5"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            {assessments.length} assessments across {groups.length} groups
          </p>
        </div>

        <button
          onClick={openWizardForCreate}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          + New Assessment
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <p
          className="text-xs rounded-lg px-3 py-2.5 mb-4"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C'
          }}
        >
          {error}
        </p>
      )}

      {/* FILTER BAR */}
      <div
        className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >
        {/* GROUP FILTER */}
        <div className="flex items-center gap-2">
          <label
            className="text-xs font-medium"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            Group
          </label>

          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            className="text-sm px-2.5 py-1.5 rounded-lg"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--muted)',
              outline: 'none'
            }}
          >
            <option value="all">
              All Groups
            </option>

            {groups.map(g => (
              <option
                key={g.id}
                value={String(g.id)}
              >
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* MODE FILTER */}
        <div className="flex items-center gap-2">
          <label
            className="text-xs font-medium"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            Mode
          </label>

          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}
            className="text-sm px-2.5 py-1.5 rounded-lg"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--muted)',
              outline: 'none'
            }}
          >
            <option value="all">
              All Modes
            </option>

            <option value="individual">
              Individual
            </option>

            <option value="team">
              Team
            </option>
          </select>
        </div>

        {/* TYPE FILTER */}
        <div className="flex items-center gap-2">
          <label
            className="text-xs font-medium"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            Type
          </label>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm px-2.5 py-1.5 rounded-lg"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--muted)',
              outline: 'none'
            }}
          >
            <option value="all">
              All Types
            </option>

            <option value="assignment">
              Assignment
            </option>

            <option value="project">
              Project
            </option>

            <option value="presentation">
              Presentation
            </option>

            <option value="practical">
              Practical
            </option>
          </select>
        </div>

        {/* CLEAR FILTERS */}
        {(filterGroup !== 'all' ||
          filterMode !== 'all' ||
          filterType !== 'all') && (
          <button
            onClick={() => {
              setFilterGroup('all')
              setFilterMode('all')
              setFilterType('all')
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg ml-auto"
            style={{
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--muted-foreground)'
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ASSESSMENT LIST */}
      {loading ? (
        <p
          className="text-sm"
          style={{
            color: 'var(--muted-foreground)'
          }}
        >
          Loading assessments…
        </p>
      ) : byCourse.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)'
          }}
        >
          <p
            className="font-medium"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            No assessments found.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {byCourse.map(({ courseName, groups: courseGroups }) => (
            <section key={courseName}>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'var(--foreground)' }}
                >
                  {courseName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Course</p>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{courseName}</h2>
                </div>
              </div>

              <div className="space-y-7 pl-0 md:pl-3">
                {courseGroups.map(({ group, assessments: groupAssessments }) => (
                  <div key={group.id} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'var(--primary)' }}
                        >
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Group</p>
                          <h3 className="text-base font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{group.name}</h3>
                        </div>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {groupAssessments.length} assessment{groupAssessments.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                    >
                      {groupAssessments.map((assessment) => (
                        <AssessmentCard
                          key={assessment.id}
                          a={assessment}
                          subs={submissions}
                          onClick={() => setSelectedAssessment(assessment)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* CREATE ASSESSMENT MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{
            background: 'rgba(0,0,0,0.4)'
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2
              className="text-lg font-semibold mb-5"
              style={{
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              Create Assessment
            </h2>

            <CreateWizard
              groups={groups}
              initialData={null}
              onClose={() =>
                setShowCreate(false)
              }
              onCreated={() => {
                loadData()
                setShowCreate(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}