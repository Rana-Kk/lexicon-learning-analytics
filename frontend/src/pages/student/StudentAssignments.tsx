import { useEffect, useState } from 'react'
import { getStudentAssessments } from '../../lib/api'
import type { StudentPage } from '../../layouts/StudentLayout'

const STATUS_CFG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  'Not Submitted': {
    bg: '#F1F5F9',
    color: '#64748B',
    label: 'Not Submitted',
  },

  submitted: {
    bg: '#DBEAFE',
    color: '#1E40AF',
    label: 'Submitted',
  },

  analyzing: {
    bg: '#DBEAFE',
    color: '#1E40AF',
    label: 'Submitted',
  },

  ai_reviewed: {
    bg: '#FEF3C7',
    color: '#92400E',
    label: 'Teacher Review',
  },

  teacher_reviewed: {
    bg: '#FEF3C7',
    color: '#92400E',
    label: 'Teacher Review',
  },

  approved: {
    bg: '#DCFCE7',
    color: '#15803D',
    label: 'Approved',
  },

  rejected: {
    bg: '#FEE2E2',
    color: '#B91C1C',
    label: 'Rejected',
  },

  error: {
    bg: '#FEE2E2',
    color: '#B91C1C',
    label: 'Error',
  },
}

interface Props {
  onNavigate: (page: StudentPage, assessmentId?: number) => void
}
interface Assessment {
  id: number
  title: string
  description?: string
  type?: string
  due_date?: string
  dueDate?: string
  max_score?: number
  maxScore?: number
  submission_mode?: string
  submissionMode?: string
  rubric?: any[]
  status?: string
  submission_status?: string
  github_url?: string
  githubUrl?: string
  submitted_by_name?: string
  resubmission_comment?: string
  resubmission_requested?: boolean
  rejection_comment?: string
}

export default function StudentAssignments({
  onNavigate,
}: Props) {
  const [assignments, setAssignments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAssignments()
  }, [])

  async function loadAssignments() {
    try {
      setLoading(true)
      setError('')

      const response = await getStudentAssessments()

      setAssignments(response.data ?? [])
    } catch (err: any) {
      console.error('Assignments loading error:', err)

      setError(
        err?.message || 'Could not load assignments.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            My Assignments
          </h1>

          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Loading your assignments...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid #FECACA',
          }}
        >
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Could not load assignments
          </h1>

          <p
            className="text-sm mt-2"
            style={{ color: '#B91C1C' }}
          >
            {error}
          </p>

          <button
            onClick={loadAssignments}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          My Assignments
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          FSWD-2026-A · All assigned assessments
        </p>
      </div>

      {assignments.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <p
            className="text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            No assignments have been assigned to you yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const status =
              a.submission_status ||
              a.status ||
              'Not Submitted'

            const isRejected = status === 'rejected'

            const needsResubmission =
              isRejected && !!a.resubmission_requested

            const isFinalRejection =
              isRejected && !a.resubmission_requested

            const cfg = isRejected
              ? needsResubmission
                ? {
                    bg: '#FEE2E2',
                    color: '#B91C1C',
                    label: '↻ Resubmission Requested',
                  }
                : {
                    bg: '#FEE2E2',
                    color: '#B91C1C',
                    label: 'Rejected',
                  }
              : STATUS_CFG[status] ||
                STATUS_CFG['Not Submitted']

            const isApproved = status === 'approved'

            const isTeam =
              (a.submission_mode ||
                a.submissionMode ||
                '').toLowerCase() === 'team'

            const description = a.description || ''

            const dueDate =
              a.due_date ||
              a.dueDate ||
              '-'

            const maxScore =
              a.max_score ??
              a.maxScore ??
              0

            const rubric =
              Array.isArray(a.rubric)
                ? a.rubric
                : []

            const githubUrl =
              a.github_url ||
              a.githubUrl

            const submittedByTeammate =
              isTeam && a.submitted_by_name ? a.submitted_by_name : null

            return (
              <div
                key={a.id}
                className="rounded-xl p-5"
                style={{
                  background: 'var(--card)',
                  border: `1px solid ${
                    isApproved
                      ? '#86EFAC'
                      : 'var(--border)'
                  }`,
                }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: '#F3E8FF',
                          color: '#6D28D9',
                        }}
                      >
                        {a.type || 'Assignment'}
                      </span>

                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: isTeam
                            ? '#EDE9FE'
                            : '#DBEAFE',
                          color: isTeam
                            ? '#6D28D9'
                            : '#1E40AF',
                        }}
                      >
                        {isTeam
                          ? '⬡ Team'
                          : '○ Individual'}
                      </span>
                    </div>

                    <h2
                      className="text-base font-semibold"
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      {a.title}
                    </h2>

                    {description && (
  <p
    className="text-sm mt-1 leading-relaxed line-clamp-2"
    style={{
      color: 'var(--muted-foreground)',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    }}
  >
    {description.length > 80
      ? `${description.substring(0, 80).trimEnd()}…`
      : description}
  </p>
)}

                    {needsResubmission && (
                      <div
                        className="mt-2 px-3 py-2 rounded-lg text-xs"
                        style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74' }}
                      >
                        <strong>Your teacher requested a resubmission.</strong>{' '}
                        {a.resubmission_comment
                          ? a.resubmission_comment
                          : 'Please review the feedback and resubmit your repository.'}
                      </div>
                    )}

                    {isFinalRejection && (
                      <div
                        className="mt-2 px-3 py-2 rounded-lg text-xs"
                        style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' }}
                      >
                        <strong>Your submission was rejected.</strong>{' '}
                        {a.rejection_comment
                          ? a.rejection_comment
                          : 'Your teacher did not approve this submission.'}
                      </div>
                    )}

                    <div
                      className="flex gap-4 mt-2 text-xs mono"
                      style={{
                        color:
                          'var(--muted-foreground)',
                      }}
                    >
                      <span>
                        Due: {dueDate}
                      </span>

                      <span>
                        Max: {maxScore} pts
                      </span>

                      {githubUrl && (
                        <span className="truncate">
                          ⎇ {githubUrl}
                        </span>
                      )}
                    </div>

                    {submittedByTeammate && (
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        Uploaded by <strong>{submittedByTeammate}</strong>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">

                    {/* STATUS */}
                    <span
                      className="text-sm font-medium px-3 py-1.5 rounded-full"
                      style={{
                        background: cfg.bg,
                        color: cfg.color,
                      }}
                    >
                      {cfg.label}
                    </span>

                    {/* BUTTON */}
                    {isApproved ? (
                      <button
                        onClick={() =>
                            onNavigate('submissions', a.id)
                        }
                        className="text-sm font-semibold px-4 py-2 rounded-lg"
                        style={{
                          background: '#16A34A',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        View Result →
                      </button>
                    ) : status === 'Not Submitted' ? (
                      <button
                        onClick={() => onNavigate('submissions', a.id)}
                        className="text-sm font-semibold px-4 py-2 rounded-lg"
                        style={{
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Submit Repository →
                      </button>
                    ) : needsResubmission ? (
                      <button
                        onClick={() => onNavigate('submissions', a.id)}
                        className="text-sm font-semibold px-4 py-2 rounded-lg"
                        style={{
                          background: '#C2410C',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        ↻ Resubmit Repository
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                            onNavigate('submissions', a.id)
                        }
                        className="text-sm px-4 py-2 rounded-lg"
                        style={{
                          border:
                            '1px solid var(--border)',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        View Status
                      </button>
                    )}
                  </div>
                </div>

                {/* RUBRIC */}
                {rubric.length > 0 && (
                  <div
                    className="mt-4 pt-4 border-t"
                    style={{
                      borderColor: 'var(--border)',
                    }}
                  >
                    <p
                      className="text-xs font-medium mb-2"
                      style={{
                        color:
                          'var(--muted-foreground)',
                      }}
                    >
                      Evaluation Criteria (
                      {rubric.length} criteria ·{' '}
                      {maxScore} pts total)
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {rubric.map(
                        (
                          criterion: any,
                          index: number
                        ) => (
                          <span
                            key={
                              criterion.id ??
                              index
                            }
                            className="text-xs px-2.5 py-1 rounded-lg"
                            style={{
                              background:
                                'var(--secondary)',
                              color:
                                'var(--muted-foreground)',
                            }}
                          >
                            {criterion.name ||
                              `Criterion ${
                                index + 1
                              }`}{' '}
                            ·{' '}
                            {criterion.maxScore ??
                              criterion.max_score ??
                              0}
                            pts
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}