import { useEffect, useMemo, useState } from 'react'
import { apiFetch, ApiError } from '../../lib/api'
import type { TeacherPage } from '../../layouts/TeacherLayout'


interface Group {
  id: number
  name: string
  course_name?: string
}

interface AssessmentOption {
  id: number
  group_id: number
  title: string
  group_name?: string
  course_name?: string
}

interface CriterionScore {
  criterion_id: number
  criterion_name: string
  criterion_description?: string
  criterion_max_score: number
  ai_score: number
  ai_rationale?: string
  teacher_final_score: number
  teacher_override: boolean
}

interface ChecklistCriterion {
  id: number
  name: string
  description?: string | null
  criterion_type: 'yes_no' | 'score' | 'text'
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

interface SubmissionDetail {
  id: number
  assessment_id: number
  assessment_title: string
  assessment_description?: string
  assessment_max_score: number
  group_id?: number
  student_id: number
  student_name: string
  student_email: string
  github_repo_url: string
  submitted_by_name?: string
  submitted_at: string | null
  status: string
  ai_evaluation_status: string | null
  ai_score: number | null
  ai_feedback: string | null
  final_score: number | null
  teacher_feedback: string | null
  criteria_scores?: CriterionScore[]
  checklist_criteria?: ChecklistCriterion[]
  strengths?: string | null
  areas_for_improvement?: string | null
  recommendations?: string | null
  suggested_next_steps?: string | null
}

const AI_STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: '#FEF3C7', color: '#B45309', label: 'AI Draft — Awaiting Review' },
  approved: { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
}

// Local editable shape for one checklist criterion row. `teacher_yes_no`
// is kept as a string ('', 'yes', 'no') so an <select> can represent the
// "not evaluated yet" state without relying on tri-state booleans.
interface ChecklistEditItem {
  id: number
  name: string
  description?: string | null
  criterion_type: 'yes_no' | 'score' | 'text'
  max_score?: number | string | null
  ai_yes_no_value?: number | boolean | null
  ai_score_value?: number | string | null
  ai_text_value?: string | null
  teacher_yes_no: string
  teacher_score: string
  teacher_text: string
  teacher_feedback: string
}

function aiChecklistDisplay(item: ChecklistEditItem): string {
  if (item.criterion_type === 'yes_no') {
    if (item.ai_yes_no_value === null || item.ai_yes_no_value === undefined) return '—'
    return Number(item.ai_yes_no_value) === 1 ? 'Yes' : 'No'
  }
  if (item.criterion_type === 'score') {
    if (item.ai_score_value === null || item.ai_score_value === undefined) return '—'
    return String(item.ai_score_value)
  }
  if (item.criterion_type === 'text') {
    return item.ai_text_value || '—'
  }
  return '—'
}

interface Props {
  onNavigate?: (page: TeacherPage, submissionId?: number) => void
  // Passed in when the teacher clicked "Review →" on a specific submission
  // from TeacherSubmissions.tsx, so this page opens directly on that record
  // instead of defaulting to the first item in the list.
  initialSubmissionId?: number | null
}

export default function TeacherAIEvaluation({ onNavigate, initialSubmissionId }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [assessments, setAssessments] = useState<AssessmentOption[]>([])
  const [submissions, setSubmissions] = useState<SubmissionDetail[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null)
  const [selectedSubId, setSelectedSubId] = useState<number | null>(initialSubmissionId ?? null)
  const [activeSub, setActiveSub] = useState<SubmissionDetail | null>(null)

  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingAction, setSavingAction] = useState<'save' | 'approved' | 'rejected' | 'resubmission' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Edit / Override States
  const [finalScore, setFinalScore] = useState<number>(0)
  const [teacherFeedback, setTeacherFeedback] = useState<string>('')
  const [strengths, setStrengths] = useState('')
  const [areasForImprovement, setAreasForImprovement] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [suggestedNextSteps, setSuggestedNextSteps] = useState('')
  const [criteriaEdits, setCriteriaEdits] = useState<CriterionScore[]>([])
  const [checklistEdits, setChecklistEdits] = useState<ChecklistEditItem[]>([])

  // 1. Fetch teacher-scoped groups, assessments and submissions.
  const loadSubmissions = async () => {
    setLoadingList(true)
    setError('')

    try {
      const [groupRes, assessmentRes, submissionRes] = await Promise.all([
        apiFetch('/groups'),
        apiFetch('/assessments'),
        apiFetch('/submissions'),
      ])

      const groupList: Group[] = groupRes.data || []
      const assessmentList: AssessmentOption[] = assessmentRes.data || []
      const assessmentIds = new Set(assessmentList.map((a) => a.id))
      const list: SubmissionDetail[] = (submissionRes.data || []).filter((sub: SubmissionDetail) =>
        assessmentIds.has(sub.assessment_id)
      )

      setGroups(groupList)
      setAssessments(assessmentList)
      setSubmissions(list)

      const requestedSubmission =
        initialSubmissionId != null
          ? list.find((sub) => sub.id === initialSubmissionId)
          : undefined

      const initialSubmission = requestedSubmission || list[0]

      if (initialSubmission) {
        const initialAssessment = assessmentList.find((a) => a.id === initialSubmission.assessment_id)
        const groupId = initialAssessment?.group_id ?? initialSubmission.group_id ?? null

        setSelectedGroupId(groupId)
        setSelectedAssessmentId(initialSubmission.assessment_id)
        setSelectedSubId(initialSubmission.id)
      } else {
        const firstAssessment = assessmentList[0]
        setSelectedGroupId(firstAssessment?.group_id ?? groupList[0]?.id ?? null)
        setSelectedAssessmentId(firstAssessment?.id ?? null)
        setSelectedSubId(null)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load submissions')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groupAssessments = useMemo(
    () => assessments.filter((assessment) => assessment.group_id === selectedGroupId),
    [assessments, selectedGroupId]
  )

  const filteredSubmissions = useMemo(
    () => submissions.filter((submission) => submission.assessment_id === selectedAssessmentId),
    [submissions, selectedAssessmentId]
  )

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null
  const selectedAssessment =
    assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? null

  const handleGroupChange = (groupId: number) => {
    setSelectedGroupId(groupId)

    const firstAssessment = assessments.find((assessment) => assessment.group_id === groupId)
    setSelectedAssessmentId(firstAssessment?.id ?? null)

    const firstSubmission = firstAssessment
      ? submissions.find((submission) => submission.assessment_id === firstAssessment.id)
      : undefined

    setSelectedSubId(firstSubmission?.id ?? null)
  }

  const handleAssessmentChange = (assessmentId: number) => {
    setSelectedAssessmentId(assessmentId)
    const firstSubmission = submissions.find((submission) => submission.assessment_id === assessmentId)
    setSelectedSubId(firstSubmission?.id ?? null)
  }

  // If the teacher navigated here from a specific submission's "Review →"
  // button, honor that id even after the list has already loaded once.
  useEffect(() => {
    if (initialSubmissionId == null) return

    const submission = submissions.find((sub) => sub.id === initialSubmissionId)
    if (!submission) return

    const assessment = assessments.find((item) => item.id === submission.assessment_id)

    setSelectedGroupId(assessment?.group_id ?? submission.group_id ?? null)
    setSelectedAssessmentId(submission.assessment_id)
    setSelectedSubId(initialSubmissionId)
  }, [initialSubmissionId, submissions, assessments])

  // 2. Fetch Selected Submission Details
  useEffect(() => {
    if (!selectedSubId) {
      setActiveSub(null)
      return
    }

    const fetchDetail = async () => {
      setLoadingDetail(true)
      setNotice('')
      try {
        const res = await apiFetch(`/submissions/${selectedSubId}`)
        const data: SubmissionDetail = res.data
        setActiveSub(data)

        // Initialize review form values
        setFinalScore(data.final_score ?? data.ai_score ?? 0)
        setTeacherFeedback(data.teacher_feedback || '')
        setStrengths(data.strengths || '')
        setAreasForImprovement(data.areas_for_improvement || '')
        setRecommendations(data.recommendations || '')
        setSuggestedNextSteps(data.suggested_next_steps || '')
        setCriteriaEdits(
          (data.criteria_scores || []).map((cs: any) => ({
            criterion_id: cs.criterion_id,
            criterion_name: cs.criterion_name,
            criterion_description: cs.criterion_description,
            criterion_max_score: cs.criterion_max_score,
            ai_score: Number(cs.ai_score) || 0,
            ai_rationale: cs.ai_rationale || '',
            teacher_final_score: Number(cs.teacher_final_score ?? cs.ai_score ?? 0),
            teacher_override: cs.teacher_override === 1 || Boolean(cs.teacher_override),
          }))
        )
        setChecklistEdits(
          (data.checklist_criteria || []).map((cc: any) => ({
            id: cc.id,
            name: cc.name,
            description: cc.description,
            criterion_type: cc.criterion_type,
            max_score: cc.max_score,
            ai_yes_no_value: cc.ai_yes_no_value,
            ai_score_value: cc.ai_score_value,
            ai_text_value: cc.ai_text_value,
            teacher_yes_no:
              cc.teacher_yes_no_value === null || cc.teacher_yes_no_value === undefined
                ? ''
                : Number(cc.teacher_yes_no_value) === 1
                ? 'yes'
                : 'no',
            teacher_score:
              cc.teacher_score_value === null || cc.teacher_score_value === undefined
                ? ''
                : String(cc.teacher_score_value),
            teacher_text: cc.teacher_text_value || '',
            teacher_feedback: cc.teacher_feedback || '',
          }))
        )
      } catch (err) {
        setError('Failed to load submission evaluation details')
      } finally {
        setLoadingDetail(false)
      }
    }

    fetchDetail()
  }, [selectedSubId])

  // Update criterion score and auto-recalculate total score
  const handleCriterionScoreChange = (idx: number, newScore: number) => {
    const next = [...criteriaEdits]
    const currentMax = next[idx].criterion_max_score
    const clampedScore = Math.min(Math.max(0, newScore), currentMax)

    next[idx] = {
      ...next[idx],
      teacher_final_score: clampedScore,
      teacher_override: clampedScore !== next[idx].ai_score,
    }
    setCriteriaEdits(next)

    // Re-sum total score
    const total = next.reduce((sum, item) => sum + Number(item.teacher_final_score || 0), 0)
    setFinalScore(total)
  }

  const handleRationaleChange = (idx: number, value: string) => {
    const next = [...criteriaEdits]
    next[idx] = { ...next[idx], ai_rationale: value }
    setCriteriaEdits(next)
  }

  const updateChecklistEdit = (idx: number, patch: Partial<ChecklistEditItem>) => {
    const next = [...checklistEdits]
    next[idx] = { ...next[idx], ...patch }
    setChecklistEdits(next)
  }

  // Ask the student to resubmit the assignment.
  const requestResubmission = async () => {
    if (!activeSub) return
    setSavingAction('resubmission')
    setError('')
    setNotice('')

    try {
      await apiFetch(`/submissions/${activeSub.id}/request-resubmission`, {
        method: 'PUT',
        body: JSON.stringify({
          teacher_feedback: teacherFeedback.trim() || null,
        }),
      })

      setNotice('Resubmission requested — the student has been notified.')
      await loadSubmissions()
      const res = await apiFetch(`/submissions/${activeSub.id}`)
      setActiveSub(res.data)
    } catch (err: any) {
      setError(err.message || 'Failed to request resubmission')
    } finally {
      setSavingAction(null)
    }
  }

  // Shared submit for Save / Approve / Reject — only the action differs.
  const submitReview = async (action: 'save' | 'approved' | 'rejected') => {
    if (!activeSub) return
    setSavingAction(action)
    setNotice('')
    try {
      await apiFetch(`/submissions/${activeSub.id}/review`, {
        method: 'PUT',
        body: JSON.stringify({
          final_score: Number(finalScore),
          teacher_feedback: teacherFeedback.trim() || null,
          action,
          strengths: strengths.trim() || null,
          areas_for_improvement: areasForImprovement.trim() || null,
          recommendations: recommendations.trim() || null,
          suggested_next_steps: suggestedNextSteps.trim() || null,
          criteria_scores: criteriaEdits.map((c) => ({
            criterion_id: c.criterion_id,
            ai_recommended_score: c.ai_score,
            ai_rationale: c.ai_rationale?.trim() || null,
            teacher_final_score: Number(c.teacher_final_score),
          })),
          checklist_results: checklistEdits.map((c) => ({
            checklist_criterion_id: c.id,
            teacher_yes_no_value:
              c.teacher_yes_no === '' ? null : c.teacher_yes_no === 'yes',
            teacher_score_value:
              c.teacher_score === '' ? null : Number(c.teacher_score),
            teacher_text_value: c.teacher_text.trim() || null,
            teacher_feedback: c.teacher_feedback.trim() || null,
          })),
        }),
      })

      const messages = {
        save: 'Draft changes saved.',
        approved: 'Evaluation approved — the student can now see their final result.',
        rejected: 'Evaluation marked as not approved.',
      }
      setNotice(messages[action])
      await loadSubmissions()
      // Refresh the detail view to reflect the new status/values from the server.
      const res = await apiFetch(`/submissions/${activeSub.id}`)
      setActiveSub(res.data)
    } catch (err: any) {
      setError(err.message || 'Failed to submit review')
    } finally {
      setSavingAction(null)
    }
  }

  const aiStatusCfg = activeSub?.ai_evaluation_status ? AI_STATUS_CFG[activeSub.ai_evaluation_status] : null

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            AI Evaluations & Review
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Inspect Gemini AI feedback, adjust rubric weights, and approve grades.
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('submissions')}
            className="text-xs px-3 py-2 rounded-lg font-medium"
            style={{ border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer' }}
          >
            ← Back to Submissions
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2.5 mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </p>
      )}
      {notice && (
        <p className="text-xs rounded-lg px-3 py-2.5 mb-4" style={{ background: '#F0FDF4', color: '#15803D' }}>
          {notice}
        </p>
      )}

      {loadingList ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-2xl mb-2">✦</p>
          <p className="font-medium text-sm" style={{ color: 'var(--muted-foreground)' }}>No submissions available for review.</p>
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 p-4 rounded-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Course / Group
              </label>
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) => handleGroupChange(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.course_name ? `${group.course_name} — ` : ''}{group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Assignment
              </label>
              <select
                value={selectedAssessmentId ?? ''}
                onChange={(e) => handleAssessmentChange(Number(e.target.value))}
                disabled={groupAssessments.length === 0}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
              >
                {groupAssessments.length === 0 ? (
                  <option value="">No assignments in this group</option>
                ) : (
                  groupAssessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>{assessment.title}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LEFT: only submissions for the selected assignment */}
            <div className="md:col-span-1 rounded-xl overflow-hidden flex flex-col max-h-[82vh]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  {selectedGroup?.course_name ? `${selectedGroup.course_name} · ` : ''}{selectedGroup?.name || 'Group'}
                </p>
                <p className="text-sm font-semibold mt-1">{selectedAssessment?.title || 'Assignment'}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {filteredSubmissions.length} submission{filteredSubmissions.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="divide-y overflow-y-auto flex-1" style={{ borderColor: 'var(--border)' }}>
                {filteredSubmissions.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No submissions for this assignment.
                  </div>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const active = sub.id === selectedSubId
                    const status = sub.status?.toLowerCase()
                    const isApproved = status === 'approved'
                    const isRejected = status === 'rejected'

                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubId(sub.id)}
                        className="p-4 cursor-pointer transition-colors"
                        style={{
                          background: active ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                          borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                        }}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <p className="text-sm font-semibold truncate">{sub.student_name || `Student #${sub.student_id}`}</p>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: isApproved ? '#DCFCE7' : isRejected ? '#FEE2E2' : '#FEF3C7',
                              color: isApproved ? '#15803D' : isRejected ? '#B91C1C' : '#B45309',
                            }}
                          >
                            {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Needs Review'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2 text-xs gap-2">
                          <span className="mono text-indigo-600 truncate">⎇ {sub.github_repo_url?.split('/').slice(-2).join('/') || 'No repository'}</span>
                          <span className="mono font-bold flex-shrink-0">
                            {sub.final_score ?? sub.ai_score ?? '—'}/{sub.assessment_max_score}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          {/* RIGHT: Selected Evaluation & Rubric Details */}
          <div className="md:col-span-2 space-y-5">
            {loadingDetail || !activeSub ? (
              <div className="rounded-xl py-20 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading evaluation details…</p>
              </div>
            ) : (
              <>
                {/* Header card: student, assessment, repo, submission date, AI status, AI total */}
                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold">{activeSub.student_name}</h2>
                        <span className="text-xs mono" style={{ color: 'var(--muted-foreground)' }}>({activeSub.student_email})</span>
                      </div>
                      <p className="text-xs text-indigo-600 font-mono mb-1">
                        <a href={activeSub.github_repo_url} target="_blank" rel="noreferrer" className="hover:underline">
                          ⎇ {activeSub.github_repo_url}
                        </a>
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Submitted {activeSub.submitted_at ? new Date(activeSub.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        {/* Team assignment: the repo was uploaded once for the
                            whole team — show who actually did it, since it
                            may not be this row's own student. */}
                        {activeSub.submitted_by_name && activeSub.submitted_by_name !== activeSub.student_name && (
                          <> · Uploaded by {activeSub.submitted_by_name}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>Assessment</p>
                      <p className="text-sm font-semibold mb-2">{activeSub.assessment_title}</p>
                      {aiStatusCfg && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: aiStatusCfg.bg, color: aiStatusCfg.color }}>
                          {aiStatusCfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {activeSub.assessment_description && (
                    <p className="text-xs mt-3 pt-3 border-t leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                      {activeSub.assessment_description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>AI Recommended Total:</span>
                    <span className="text-sm font-bold mono">{activeSub.ai_score ?? '—'} / {activeSub.assessment_max_score} pts</span>
                  </div>
                </div>

                {/* AI-generated overall feedback, teacher-editable */}
                <div className="space-y-3">
                  {[
                    { label: 'Strengths', value: strengths, setValue: setStrengths, icon: '★', bg: '#F0FDF4', color: '#15803D' },
                    { label: 'Areas for Improvement', value: areasForImprovement, setValue: setAreasForImprovement, icon: '◎', bg: '#FFFBEB', color: '#92400E' },
                    { label: 'Recommendations', value: recommendations, setValue: setRecommendations, icon: '→', bg: '#EFF6FF', color: '#1E40AF' },
                    { label: 'Suggested Next Steps', value: suggestedNextSteps, setValue: setSuggestedNextSteps, icon: '⬆', bg: '#FAF5FF', color: '#6D28D9' },
                  ].map(({ label, value, setValue, icon, bg, color }) => (
                    <div key={label} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: bg }}>
                        <span style={{ color, fontSize: '12px' }}>{icon}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'white', color }}>AI Generated</span>
                      </div>
                      <div className="px-4 py-3" style={{ background: 'var(--card)' }}>
                        <textarea
                          rows={2}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className="w-full text-sm leading-relaxed px-2 py-1.5 rounded"
                          style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rubric Criteria Breakdown & Override Table */}
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Rubric Criteria Breakdown
                    </p>
                    <span className="text-xs text-gray-400">Edit scores or rationale directly to override the AI recommendation</span>
                  </div>

                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {criteriaEdits.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">No individual criteria configured for this assessment.</div>
                    ) : (
                      criteriaEdits.map((c, idx) => (
                        <div key={c.criterion_id} className="p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-[240px]">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{c.criterion_name}</p>
                                {c.teacher_override && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                    Overridden
                                  </span>
                                )}
                              </div>
                              {c.criterion_description && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                  {c.criterion_description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Maximum</p>
                                <p className="text-sm font-mono font-semibold">{c.criterion_max_score}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>AI Score</p>
                                <p className="text-sm font-mono font-semibold">{c.ai_score}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Teacher Final</p>
                                <input
                                  type="number"
                                  min={0}
                                  max={c.criterion_max_score}
                                  value={c.teacher_final_score}
                                  onChange={(e) => handleCriterionScoreChange(idx, Number(e.target.value))}
                                  className="w-16 px-2 py-1.5 text-sm rounded font-bold text-center"
                                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5">
                            <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>AI Rationale</p>
                            <textarea
                              rows={2}
                              value={c.ai_rationale}
                              onChange={(e) => handleRationaleChange(idx, e.target.value)}
                              placeholder="AI rationale for this criterion — edit if the teacher wants to adjust the explanation."
                              className="w-full text-xs leading-relaxed px-2.5 py-2 rounded"
                              style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Checklist Criteria (Chk-1, Chk-2, ... template-based criteria) */}
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Checklist Criteria
                    </p>
                    <span className="text-xs text-gray-400">Review the AI's checklist results and enter the teacher-reviewed values</span>
                  </div>

                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {checklistEdits.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">No checklist criteria configured for this assessment.</div>
                    ) : (
                      checklistEdits.map((c, idx) => (
                        <div key={c.id} className="p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap mb-2.5">
                            <div className="flex-1 min-w-[240px]">
                              <p className="text-sm font-semibold">{c.name}</p>
                              {c.description && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                  {c.description}
                                </p>
                              )}
                            </div>

                            <div className="text-center flex-shrink-0">
                              <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>AI Result</p>
                              <p className="text-sm font-mono font-semibold">{aiChecklistDisplay(c)}</p>
                            </div>
                          </div>

                          {/* TEACHER VALUE INPUT — shape depends on criterion_type */}
                          {c.criterion_type === 'yes_no' && (
                            <select
                              value={c.teacher_yes_no}
                              onChange={(e) => updateChecklistEdit(idx, { teacher_yes_no: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm"
                              style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                            >
                              <option value="">Not evaluated</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          )}

                          {c.criterion_type === 'score' && (
                            <input
                              type="number"
                              min={0}
                              max={c.max_score != null ? Number(c.max_score) : undefined}
                              step="0.01"
                              value={c.teacher_score}
                              onChange={(e) => updateChecklistEdit(idx, { teacher_score: e.target.value })}
                              placeholder={c.max_score != null ? `Score out of ${c.max_score}` : 'Score'}
                              className="w-full px-3 py-2 rounded-lg text-sm"
                              style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                            />
                          )}

                          {c.criterion_type === 'text' && (
                            <textarea
                              rows={2}
                              value={c.teacher_text}
                              onChange={(e) => updateChecklistEdit(idx, { teacher_text: e.target.value })}
                              placeholder="Enter a value…"
                              className="w-full text-sm leading-relaxed px-2.5 py-2 rounded"
                              style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
                            />
                          )}

                          <textarea
                            rows={1}
                            value={c.teacher_feedback}
                            onChange={(e) => updateChecklistEdit(idx, { teacher_feedback: e.target.value })}
                            placeholder="Optional note for this criterion…"
                            className="w-full text-xs leading-relaxed px-2.5 py-2 rounded mt-2"
                            style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical', color: 'var(--muted-foreground)' }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Teacher Final Notes & Score Confirmation */}
                <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                      Teacher Comment
                    </label>
                    <textarea
                      rows={3}
                      value={teacherFeedback}
                      onChange={(e) => setTeacherFeedback(e.target.value)}
                      placeholder="Add personalized feedback or remarks on the submission..."
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Total Final Score</p>
                      <p className="text-xs text-emerald-700">This score is recorded to the student's official gradebook once approved.</p>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-900 text-lg">
                      <input
                        type="number"
                        min={0}
                        max={activeSub.assessment_max_score}
                        value={finalScore}
                        onChange={(e) => setFinalScore(Number(e.target.value))}
                        className="w-20 px-2 py-1 text-base font-bold text-center bg-white border border-emerald-300 rounded-lg outline-none"
                      />
                      <span>/ {activeSub.assessment_max_score} pts</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={requestResubmission}
                      disabled={savingAction !== null}
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                      style={{
                        background: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #FCD34D',
                        cursor: savingAction ? 'not-allowed' : 'pointer',
                        opacity: savingAction && savingAction !== 'resubmission' ? 0.6 : 1,
                      }}
                    >
                      {savingAction === 'resubmission' ? 'Requesting…' : '↻ Request Resubmission'}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReview('rejected')}
                      disabled={savingAction !== null}
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                      style={{
                        background: '#FEE2E2',
                        color: '#B91C1C',
                        border: '1px solid #FCA5A5',
                        cursor: savingAction ? 'not-allowed' : 'pointer',
                        opacity: savingAction && savingAction !== 'rejected' ? 0.6 : 1,
                      }}
                    >
                      {savingAction === 'rejected' ? 'Rejecting…' : '✕ Reject Evaluation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReview('save')}
                      disabled={savingAction !== null}
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        cursor: savingAction ? 'not-allowed' : 'pointer',
                        opacity: savingAction && savingAction !== 'save' ? 0.6 : 1,
                      }}
                    >
                      {savingAction === 'save' ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReview('approved')}
                      disabled={savingAction !== null}
                      className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                      style={{
                        background: '#15803D',
                        color: 'white',
                        border: 'none',
                        cursor: savingAction ? 'not-allowed' : 'pointer',
                        opacity: savingAction && savingAction !== 'approved' ? 0.6 : 1,
                      }}
                    >
                      {savingAction === 'approved' ? 'Publishing Grade…' : '✓ Approve Evaluation'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}