import { useEffect, useState } from 'react'
import {
  getStudentAssessments,
  getSubmissions,
  getSubmissionById,
  createSubmission,
  getAssessmentById,
} from '../../lib/api'

// Student-facing steps — AI analysis is completely hidden
const STUDENT_STEPS = ['Submitted', 'Teacher Review', 'Approved']

// Map backend submission status (lowercase, from schema_v2.sql ENUM) to the
// student-visible step index (0-based)
function studentStep(status: string): number {
  switch (status) {
    case 'submitted':
    case 'analyzing':
    case 'ai_reviewed':
      return 0
    case 'teacher_reviewed':
      return 1
    case 'approved':
    case 'rejected':
      return 2
    default:
      return -1
  }
}

interface Assessment {
  id: number
  title: string
  description?: string
  group_name?: string
  due_date?: string
  max_score?: number
  submission_mode?: string
  submission_id?: number
  submission_status?: string
  github_url?: string
  submitted_at?: string
}

interface CriterionScore {
  id: number
  criterion_id: number
  criterion_name: string
  criterion_max_score: number
  ai_recommended_score: number
  teacher_final_score: number | null
}

interface AiEvaluation {
  id: number
  status: 'draft' | 'approved' | 'rejected'
  total_teacher_score: number | null
  strengths?: string
  areas_for_improvement?: string
  recommendations?: string
  suggested_next_steps?: string
  teacher_comment?: string
  reviewed_by_name?: string
  reviewed_at?: string
}

interface SubmissionDetail {
  id: number
  status: string
  github_url: string
  submitted_at: string
  submitted_by_name?: string
  assessment_max_score: number
  ai_evaluations: AiEvaluation[]
  criteria_scores: CriterionScore[]
  checklist_results: ChecklistResult[]
}

// Rubric criteria definitions only (name/description) — no points shown
// to the student. Fetched separately via getAssessmentById, which is
// safe for students to call.
interface EvaluationCriterion {
  id: number
  name: string
  description?: string | null
  criterion_type?: string | null
  max_score?: number | string | null
}

// Checklist analysis result for a single criterion — only the resolved
// final value (teacher override if present, else AI). Only ever present
// once the teacher has approved/sent the evaluation to the student.
interface ChecklistResult {
  id: number
  name: string
  description?: string | null
  criterion_type?: string | null
  max_score?: number | null
  final_yes_no_value?: boolean | null
  final_score_value?: number | null
  final_text_value?: string | null
}

function formatChecklistResult(item: ChecklistResult): string {
  if (item.criterion_type === 'yes_no' || item.criterion_type === 'boolean') {
    if (item.final_yes_no_value === null || item.final_yes_no_value === undefined) return '—'
    return item.final_yes_no_value ? 'Yes' : 'No'
  }
  if (item.criterion_type === 'score') {
    if (item.final_score_value === null || item.final_score_value === undefined) return '—'
    return item.max_score != null ? `${item.final_score_value} / ${item.max_score}` : String(item.final_score_value)
  }
  if (item.criterion_type === 'text') {
    return item.final_text_value || '—'
  }
  return item.final_text_value || '—'
}

export default function StudentSubmissions({ assessmentId }: { assessmentId?: number }) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rubric, setRubric] = useState<EvaluationCriterion[]>([])

  useEffect(() => {
    loadAssessments()
  }, [])

  useEffect(() => {
    if (assessmentId != null) setSelectedId(assessmentId)
  }, [assessmentId])

  useEffect(() => {
    if (selectedId != null) {
      loadSubmission(selectedId)
      loadRubric(selectedId)
    }
  }, [selectedId])

  async function loadAssessments() {
    try {
      setLoading(true)
      setLoadError('')
      const res = await getStudentAssessments()
      const list: Assessment[] = res.data ?? []
      setAssessments(list)
      setSelectedId((prev) => assessmentId ?? prev ?? (list.length ? list[0].id : null))
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load assignments.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch the full submission (with ai_evaluations + criteria_scores) for
  // the selected assessment. getStudentAssessments already tells us whether
  // a submission exists (submission_status), but the teacher's review
  // comments only come back from /submissions/:id.
  async function loadSubmission(assessmentId: number) {
    setSubmission(null)
    setDetailLoading(true)
    try {
      const res = await getSubmissions({ assessment_id: assessmentId })
      const list = res.data ?? []
      if (list.length) {
        const full = await getSubmissionById(list[0].id)
        setSubmission(full.data)
      }
    } catch (err: any) {
      console.error('Submission detail loading error:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Fetch the rubric criteria *definitions* for this assignment (name and
  // description only — no points, no results), so the student knows what
  // they're being evaluated on before/while submitting. Checklist criteria
  // are intentionally NOT fetched here — they only appear as results,
  // once the teacher has approved the evaluation (see submission.checklist_results).
  async function loadRubric(assessmentId: number) {
    setRubric([])
    try {
      const res = await getAssessmentById(assessmentId)
      setRubric(res.data?.assignment_evaluation_criteria ?? [])
    } catch (err: any) {
      console.error('Rubric loading error:', err)
    }
  }

  const assessment = assessments.find((a) => a.id === selectedId)

  const validateAndSubmit = async () => {
    setUrlError('')
    if (!githubUrl.trim()) {
      setUrlError('Please enter a GitHub repository URL.')
      return
    }
    if (!githubUrl.includes('github.com')) {
      setUrlError('URL must be a valid GitHub repository (e.g. https://github.com/username/repo).')
      return
    }
    if (selectedId == null) return
    try {
      setSubmitting(true)
      await createSubmission({ assessment_id: selectedId, github_url: githubUrl })
      setGithubUrl('')
      await loadAssessments()
      await loadSubmission(selectedId)
    } catch (err: any) {
      setUrlError(err?.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Backend status is lowercase (schema_v2.sql ENUM); fall back to the
  // assignment-list status if the submission detail hasn't loaded yet.
  const status = submission?.status ?? assessment?.submission_status ?? 'Not Submitted'
  const stepIndex = studentStep(status)
  const isRejected = status === 'rejected'
  const isApproved = status === 'approved'

  // ai_evaluations is ordered by id DESC on the backend, so [0] is always
  // the latest review (the one the teacher approved/rejected).
  const latestEvaluation = submission?.ai_evaluations?.[0]
  const checklistResults = submission?.checklist_results ?? []
  const resubmissionRequested = Boolean(latestEvaluation?.teacher_comment?.startsWith('[RESUBMISSION_REQUESTED]'))
  const teacherComment = latestEvaluation?.teacher_comment?.replace(/^\[RESUBMISSION_REQUESTED\]\s*/, '')

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading your submissions...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid #FECACA' }}>
          <p className="text-sm" style={{ color: '#B91C1C' }}>{loadError}</p>
          <button
            onClick={loadAssessments}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>My Submissions</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Submit your GitHub repository and track review status</p>
      </div>

      {/* Assessment tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {assessments.map((a) => (
          <button key={a.id} onClick={() => setSelectedId(a.id)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: selectedId === a.id ? 'var(--primary)' : 'var(--card)', color: selectedId === a.id ? 'white' : 'var(--foreground)', border: `1px solid ${selectedId === a.id ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer' }}>
            {a.title}
          </button>
        ))}
      </div>

      {!assessment ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No assignments have been assigned to you yet.</p>
        </div>
      ) : (
        <>
          {/* Assignment info */}
          <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold mb-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>{assessment.title}</h2>
                {assessment.description && (
                  <div className="mt-2 space-y-1.5 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    {assessment.description.split(/\r?\n/).map((line, index) => {
                      const trimmed = line.trim()
                      if (!trimmed) return <div key={index} className="h-1" />
                      const bullet = trimmed.match(/^[-*•]\s+(.*)$/)
                      const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/)
                      return (
                        <div key={index} className={bullet || numbered ? 'flex gap-2' : ''}>
                          {bullet ? <span>•</span> : numbered ? <span>{numbered[1]}.</span> : null}
                          <span>{bullet ? bullet[1] : numbered ? numbered[2] : trimmed}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <div><p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Group</p><p className="font-medium mono text-xs">{assessment.group_name}</p></div>
              <div><p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Due Date</p><p className="font-medium mono text-xs">{assessment.due_date}</p></div>
              <div><p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Submission Mode</p><p className="font-medium text-xs">{assessment.submission_mode}</p></div>
            </div>

            {/* Rubric — criteria names/descriptions only, no points.
                Checklist criteria are NOT shown here; they only appear
                as results after the teacher approves the evaluation. */}
            {rubric.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Evaluation Criteria ({rubric.length} criteria)
                </p>
                <div className="space-y-1.5">
                  {rubric.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="font-medium">{c.name}</span>
                      {c.description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{c.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {detailLoading && (
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>Loading submission details...</p>
          )}

          {/* Status tracker — 3 student-visible steps only */}
          {stepIndex >= 0 && (
            <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Submission Status</p>
              <div className="flex items-center">
                {STUDENT_STEPS.map((step, i) => {
                  const done = i < stepIndex || (stepIndex === 2 && !isRejected)
                  const current = i === stepIndex && !(stepIndex === 2 && isRejected)
                  const rejected = isRejected && i === 2
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: rejected ? '#FEE2E2' : done ? '#15803D' : current ? 'var(--primary)' : 'var(--secondary)',
                            color: rejected ? '#B91C1C' : (done || current) ? 'white' : 'var(--muted-foreground)',
                          }}
                        >
                          {rejected ? '✕' : done && !current ? '✓' : i + 1}
                        </div>
                        <span className="text-xs whitespace-nowrap" style={{ color: rejected ? '#B91C1C' : current ? 'var(--primary)' : done ? '#15803D' : 'var(--muted-foreground)', fontWeight: current ? 600 : 400 }}>
                          {rejected && step === 'Approved' ? 'Not Approved' : step}
                        </span>
                      </div>
                      {i < STUDENT_STEPS.length - 1 && (
                        <div className="flex-1 h-px mx-2 mb-4" style={{ background: i < stepIndex ? '#15803D' : 'var(--border)' }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Submitted repo URL */}
              {submission?.github_url && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#94A3B8' }}>⎇</span>
                    <span className="text-sm mono" style={{ color: 'var(--primary)' }}>{submission.github_url}</span>
                    <span className="text-xs ml-auto mono" style={{ color: 'var(--muted-foreground)' }}>
                      Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString('en-GB') : ''}
                    </span>
                  </div>
                  {/* Team assignment: whoever on the team actually uploaded
                      the repo — visible even to teammates who didn't. */}
                  {assessment?.submission_mode === 'team' && submission.submitted_by_name && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      Uploaded by <strong>{submission.submitted_by_name}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit form */}
          {(status === 'Not Submitted' || resubmissionRequested) && (
            <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {resubmissionRequested ? 'Resubmit Your Repository' : (assessment.submission_mode === 'team' ? 'Submit Team Repository' : 'Submit Your Repository')}
              </p>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>GitHub Repository URL</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#94A3B8' }}>⎇</span>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => { setGithubUrl(e.target.value); setUrlError('') }}
                    placeholder="https://github.com/username/project-name"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm mono"
                    style={{ border: `1px solid ${urlError ? '#FCA5A5' : 'var(--border)'}`, background: 'var(--muted)', outline: 'none' }}
                  />
                </div>
                <button
                  onClick={validateAndSubmit}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0"
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Submitting...' : (resubmissionRequested ? 'Resubmit Repository' : 'Submit Repository')}
                </button>
              </div>
              {urlError && <p className="text-xs mt-1.5" style={{ color: '#B91C1C' }}>{urlError}</p>}
              <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                Submit your GitHub repository URL. Do not upload files directly.
              </p>
            </div>
          )}

          {/* Pending — any non-approved, non-rejected submitted state */}
          {submission && !['approved', 'rejected'].includes(status) && (
            <div className="rounded-xl p-5 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-1">Your submission is currently being reviewed by your teacher.</p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Your result will be available once the review is complete.</p>
            </div>
          )}

          {resubmissionRequested && (
            <div className="rounded-xl p-5" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <p className="font-semibold mb-1" style={{ color: '#C2410C', fontFamily: 'Outfit, sans-serif' }}>Resubmission requested</p>
              <p className="text-sm" style={{ color: '#9A3412' }}>
                Your teacher has asked you to resubmit this assignment.
                {teacherComment ? ` ${teacherComment}` : ''}
              </p>
            </div>
          )}

          {/* Rejected */}
          {isRejected && !resubmissionRequested && (
            <div className="rounded-xl p-5" style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
              <p className="font-semibold mb-1" style={{ color: '#B91C1C', fontFamily: 'Outfit, sans-serif' }}>Submission not approved</p>
              <p className="text-sm" style={{ color: '#9F1239' }}>
                {latestEvaluation?.teacher_comment || 'Your teacher has not approved this submission. Please check with your teacher for further guidance.'}
              </p>
            </div>
          )}

          {/* Approved result — feedback + checklist analysis results, no
              overall score shown to the student (that stays teacher-only). */}
          {isApproved && latestEvaluation && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #86EFAC' }}>
              <div className="px-5 py-4" style={{ background: '#F0FDF4', borderBottom: '1px solid #86EFAC' }}>
                <p className="font-semibold" style={{ color: '#15803D', fontFamily: 'Outfit, sans-serif' }}>✓ Your result is now available</p>
              </div>
              <div className="p-5 space-y-4" style={{ background: 'var(--card)' }}>
                {/* Checklist analysis results — shown now that the teacher
                    has approved/sent the evaluation, as a results table. */}
                {checklistResults.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3">Checklist Analysis Results</p>
                    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                      <table className="w-full text-sm">
                        <thead style={{ background: 'var(--muted)' }}>
                          <tr>
                            <th className="text-left px-4 py-2 text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>Criterion</th>
                            <th className="text-left px-4 py-2 text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checklistResults.map((item) => (
                            <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="px-4 py-3 align-top">
                                <div className="font-medium">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top">{formatChecklistResult(item)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Feedback sections — teacher-approved content, no AI attribution shown to student */}
                {([
                  { key: 'strengths', label: 'Strengths', bg: '#F0FDF4', color: '#15803D' },
                  { key: 'areas_for_improvement', label: 'Areas for Improvement', bg: '#FFFBEB', color: '#92400E' },
                  { key: 'recommendations', label: 'Recommendations', bg: '#EFF6FF', color: '#1E40AF' },
                  { key: 'suggested_next_steps', label: 'Next Steps', bg: '#FAF5FF', color: '#6D28D9' },
                ] as const).map(({ key, label, bg, color }) =>
                  latestEvaluation[key] ? (
                    <div key={key} className="rounded-lg p-4" style={{ background: bg }}>
                      <p className="text-xs font-semibold mb-1.5" style={{ color }}>{label}</p>
                      <p className="text-sm leading-relaxed" style={{ color }}>{latestEvaluation[key]}</p>
                    </div>
                  ) : null
                )}

                {latestEvaluation.teacher_comment && (
                  <div className="rounded-lg p-4" style={{ background: 'var(--muted)' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                      Teacher's Comment{latestEvaluation.reviewed_by_name ? ` — ${latestEvaluation.reviewed_by_name}` : ''}
                    </p>
                    <p className="text-sm leading-relaxed">{latestEvaluation.teacher_comment}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}