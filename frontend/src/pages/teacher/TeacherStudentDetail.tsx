import { useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  getStudentAcademicOverview,
  saveFinalGrade
} from '../../lib/api'

type Props = {
  studentId: number
  groupId: number
  onBack: () => void
}

type ChecklistValueSet = {
  yes_no_value?: number | boolean | null
  score_value?: number | string | null
  text_value?: string | null
  feedback?: string | null
}

type ChecklistCriterion = {
  id: number
  name: string
  description?: string | null
  criterion_type?: string | null
  max_score?: number | string | null

  // The backend already resolves the teacher-overrides-AI
  // priority into `final`, and also exposes the raw `ai`
  // and `teacher` values separately.
  ai?: ChecklistValueSet | null
  teacher?: ChecklistValueSet | null
  final?: ChecklistValueSet | null
}

type Assessment = {
  id: number
  title: string
  description?: string | null
  type?: string | null
  submission_mode?: string | null
  assessment_date?: string | null
  due_date?: string | null
  max_score?: number | string | null
  score?: number | string | null
  feedback?: string | null
  evaluated_at?: string | null
  github_url?: string | null
  checklist?: ChecklistCriterion[]
}

const pct = (score: unknown, max: unknown) => {
  if (score == null || !Number(max)) return '—'

  return `${Math.round(
    (Number(score) / Number(max)) * 1000
  ) / 10}%`
}

const date = (value?: string | null) => {
  return value ? value.split('T')[0] : '—'
}

/**
 * Displays the checklist result value.
 *
 * The backend already resolves the priority
 * (teacher value if present, otherwise AI value)
 * into `criterion.final`, so we just format it
 * for display here.
 */
function getChecklistValue(
  criterion: ChecklistCriterion
): string {
  const type = criterion.criterion_type
  const final = criterion.final

  if (!final) return '—'

  // YES / NO
  if (type === 'yes_no' || type === 'boolean') {
    if (
      final.yes_no_value === null ||
      final.yes_no_value === undefined
    ) {
      return '—'
    }

    return final.yes_no_value === true ||
      Number(final.yes_no_value) === 1
      ? 'Yes'
      : 'No'
  }

  // SCORE
  if (type === 'score') {
    if (
      final.score_value === null ||
      final.score_value === undefined
    ) {
      return '—'
    }

    return String(final.score_value)
  }

  // TEXT
  if (type === 'text') {
    return final.text_value || '—'
  }

  // Fallback:
  // If the criterion type isn't what we expect,
  // check the available values directly.
  if (
    final.score_value !== null &&
    final.score_value !== undefined
  ) {
    return String(final.score_value)
  }

  if (
    final.yes_no_value !== null &&
    final.yes_no_value !== undefined
  ) {
    return final.yes_no_value === true ||
      Number(final.yes_no_value) === 1
      ? 'Yes'
      : 'No'
  }

  if (final.text_value) {
    return final.text_value
  }

  return '—'
}

export default function TeacherStudentDetail({
  studentId,
  groupId,
  onBack
}: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grade, setGrade] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadOverview = () => {
    setLoading(true)
    setError('')

    return getStudentAcademicOverview(studentId, groupId)
      .then((res) => {
        const overview = res.data

        setData(overview)

        if (overview.final_grade) {
          setGrade(
            String(
              overview.final_grade.score ?? ''
            )
          )

          setComment(
            overview.final_grade.comment || ''
          )
        }

        return overview
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Failed to load student overview'
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    let active = true

    loadOverview().then(() => {
      if (!active) return
    })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, groupId])

  const average = useMemo(() => {
    if (!data) return null

    if (
      data.summary?.academic_average !== null &&
      data.summary?.academic_average !== undefined
    ) {
      return Number(data.summary.academic_average)
    }

    const items = [
      ...(data.assessments || []),
      ...(data.quizzes || [])
    ].filter(
      (item: any) =>
        item.score !== null &&
        item.score !== undefined &&
        Number(item.max_score) > 0
    )

    if (!items.length) return null

    const value =
      items.reduce(
        (sum: number, item: any) =>
          sum +
          (Number(item.score) /
            Number(item.max_score)) *
            100,
        0
      ) / items.length

    return Math.round(value * 10) / 10
  }, [data])

  /**
   * Collect the checklist criteria across all assessments.
   *
   * This lets us build a table shaped like:
   *
   * Assignment | Criterion 1 | Criterion 2 | Criterion 3
   */
  const checklistColumns = useMemo(() => {
    const assessments: Assessment[] =
      data?.assessments || []

    const map = new Map<number, ChecklistCriterion>()

    for (const assessment of assessments) {
      const checklist = assessment.checklist || []

      for (const criterion of checklist) {
        if (!map.has(Number(criterion.id))) {
          map.set(
            Number(criterion.id),
            criterion
          )
        }
      }
    }

    return Array.from(map.values())
  }, [data])

  async function save() {
    setError('')
    setSaved(false)

    const numericGrade = Number(grade)

    if (
      !Number.isFinite(numericGrade) ||
      numericGrade < 0 ||
      numericGrade > 100
    ) {
      setError(
        'Final grade must be a number between 0 and 100.'
      )
      return
    }

    setSaving(true)

    try {
      const res = await saveFinalGrade(studentId, {
        group_id: groupId,
        score: numericGrade,
        comment
      })

      setData((prev: any) => ({
        ...prev,
        final_grade: res.data
      }))

      setSaved(true)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Failed to save final grade'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        Loading student overview…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button onClick={onBack}>
          ← Back to group
        </button>

        <p
          className="mt-4"
          style={{ color: '#B91C1C' }}
        >
          {error}
        </p>
      </div>
    )
  }

  const student = data?.student

  const assessments: Assessment[] =
    data?.assessments || []

  const quizzes = data?.quizzes || []

  const attendance = data?.attendance || {}

  const githubProfileUrl =
    student?.github_username
      ? `https://github.com/${student.github_username}`
      : null

  const results = [
    ...assessments,
    ...quizzes
  ].filter(
    (item: any) =>
      item.score !== null &&
      item.score !== undefined
  ).length

  return (
    <div className="p-6 max-w-[1600px] mx-auto">

      {/* BACK */}
      <button
        onClick={onBack}
        className="text-sm mb-4"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          cursor: 'pointer',
          padding: 0
        }}
      >
        ← Back to group
      </button>

      {/* STUDENT HEADER */}
      <div
        className="rounded-xl p-6 mb-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">

          <div>
            <p
              className="text-xs uppercase tracking-wider"
              style={{
                color: 'var(--muted-foreground)'
              }}
            >
              {student?.course_name}
              {' · '}
              {student?.group_name}
            </p>

            <h1 className="text-2xl font-semibold mt-1">
              {student?.name}
            </h1>

            <p
              className="text-sm"
              style={{
                color: 'var(--muted-foreground)'
              }}
            >
              {student?.email}
            </p>
          </div>

          <div>
            {githubProfileUrl ? (
              <a
                href={githubProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  border:
                    '1px solid var(--border)',
                  color: 'var(--primary)'
                }}
              >
                GitHub Profile ↗
              </a>
            ) : (
              <span
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--muted)',
                  color:
                    'var(--muted-foreground)'
                }}
              >
                No GitHub connected
              </span>
            )}
          </div>

        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid md:grid-cols-3 gap-4 mb-5">

        <Card
          label="Academic Average"
          value={
            average == null
              ? '—'
              : `${average}%`
          }
        />

        <Card
          label="Attendance"
          value={
            attendance.percentage == null
              ? '—'
              : `${attendance.percentage}%`
          }
        />

        <Card
          label="Recorded Results"
          value={results}
        />

      </div>

      {/* =====================================================
          ASSIGNMENT CHECKLIST EVALUATIONS
      ====================================================== */}

      <section
        className="rounded-xl overflow-hidden mb-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >

        <div
          className="p-4 border-b"
          style={{
            borderColor: 'var(--border)'
          }}
        >
          <h2 className="font-semibold">
            Assignment Checklist Evaluations
          </h2>

          <p
            className="text-sm mt-1"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            AI evaluation results and teacher-reviewed
            checklist scores.
          </p>
        </div>

        {assessments.length === 0 ? (

          <div
            className="p-8 text-center"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            No assignments found.
          </div>

        ) : checklistColumns.length === 0 ? (

          <div
            className="p-8 text-center"
            style={{
              color: 'var(--muted-foreground)'
            }}
          >
            No checklist criteria found for this
            student's assignments.
          </div>

        ) : (

          <div>

            <table className="w-full text-sm table-fixed">

              <thead
                style={{
                  background: 'var(--muted)'
                }}
              >
                <tr>

                  {/* ASSIGNMENT NAME */}
                  <th
                    className="text-left px-4 py-3 text-xs uppercase"
                    style={{
                      color:
                        'var(--muted-foreground)',
                      width: '18%'
                    }}
                  >
                    Assignment Name
                  </th>

                  {/* CHECKLIST COLUMNS */}
                  {checklistColumns.map(
                    (criterion) => (
                      <th
                        key={criterion.id}
                        className="text-left px-4 py-3 text-xs uppercase"
                        style={{
                          color:
                            'var(--muted-foreground)',
                          whiteSpace: 'normal'
                        }}
                      >
                        <div>
                          {criterion.name}
                        </div>

                        {criterion.max_score != null &&
                          criterion.criterion_type ===
                            'score' && (
                            <div
                              className="normal-case font-normal mt-1"
                              style={{
                                color:
                                  'var(--muted-foreground)'
                              }}
                            >
                              Max: {criterion.max_score}
                            </div>
                          )}
                      </th>
                    )
                  )}

                  {/* FINAL */}
                  <th
                    className="text-left px-4 py-3 text-xs uppercase"
                    style={{
                      color:
                        'var(--muted-foreground)',
                      width: '10%'
                    }}
                  >
                    Final
                  </th>

                </tr>
              </thead>

              <tbody>

                {assessments.map(
                  (assessment) => {

                    const checklist =
                      assessment.checklist || []

                    return (
                      <tr
                        key={assessment.id}
                        style={{
                          borderTop:
                            '1px solid var(--border)'
                        }}
                      >

                        {/* ASSIGNMENT TITLE */}
                        <td
                          className="px-4 py-4 font-medium align-top"
                        >
                          <div>
                            {assessment.title}
                          </div>

                          <div
                            className="text-xs mt-1"
                            style={{
                              color:
                                'var(--muted-foreground)'
                            }}
                          >
                            {date(
                              assessment.assessment_date ||
                              assessment.due_date
                            )}
                          </div>
                        </td>

                        {/* CHECKLIST VALUES */}
                        {checklistColumns.map(
                          (column) => {

                            const criterion =
                              checklist.find(
                                (item) =>
                                  Number(item.id) ===
                                  Number(column.id)
                              )

                            return (
                              <td
                                key={column.id}
                                className="px-4 py-4 align-top"
                                style={{
                                  whiteSpace:
                                    'normal',
                                  overflowWrap:
                                    'break-word'
                                }}
                              >
                                {criterion
                                  ? getChecklistValue(
                                      criterion
                                    )
                                  : '—'}
                              </td>
                            )
                          }
                        )}

                        {/* FINAL SCORE */}
                        <td className="px-4 py-4 font-semibold align-top">
                          {assessment.score != null
                            ? `${assessment.score} / ${assessment.max_score}`
                            : '—'}
                        </td>

                      </tr>
                    )
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* =====================================================
          NORMAL ASSESSMENT HISTORY
      ====================================================== */}

      <section
        className="rounded-xl overflow-hidden mb-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >

        <div
          className="p-4 border-b"
          style={{
            borderColor: 'var(--border)'
          }}
        >
          <h2 className="font-semibold">
            Assessment History
          </h2>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead
              style={{
                background: 'var(--muted)'
              }}
            >
              <tr>

                {[
                  'Assessment',
                  'Date',
                  'Score',
                  'Percentage',
                  'Feedback',
                  'Repository'
                ].map((header) => (
                  <th
                    key={header}
                    className="text-left px-4 py-3 text-xs uppercase"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    {header}
                  </th>
                ))}

              </tr>
            </thead>

            <tbody>

              {assessments.length ? (

                assessments.map(
                  (assessment) => (

                    <tr
                      key={assessment.id}
                      style={{
                        borderTop:
                          '1px solid var(--border)'
                      }}
                    >

                      <td className="px-4 py-3 font-medium">
                        {assessment.title}
                      </td>

                      <td className="px-4 py-3">
                        {date(
                          assessment.assessment_date ||
                          assessment.due_date
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {assessment.score == null
                          ? 'Not graded'
                          : `${assessment.score} / ${assessment.max_score}`}
                      </td>

                      <td className="px-4 py-3">
                        {pct(
                          assessment.score,
                          assessment.max_score
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs truncate">
                        {assessment.feedback || '—'}
                      </td>

                      <td className="px-4 py-3">

                        {assessment.github_url ? (

                          <a
                            href={
                              assessment.github_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color:
                                'var(--primary)'
                            }}
                          >
                            Open ↗
                          </a>

                        ) : (
                          '—'
                        )}

                      </td>

                    </tr>
                  )
                )

              ) : (

                <Empty
                  colSpan={6}
                  text="No assessments found."
                />

              )}

            </tbody>

          </table>

        </div>

      </section>

      {/* QUIZ HISTORY */}

      <section
        className="rounded-xl overflow-hidden mb-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >

        <div
          className="p-4 border-b"
          style={{
            borderColor: 'var(--border)'
          }}
        >
          <h2 className="font-semibold">
            Quiz History
          </h2>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead
              style={{
                background: 'var(--muted)'
              }}
            >
              <tr>

                {[
                  'Quiz',
                  'Topic',
                  'Date',
                  'Score',
                  'Percentage'
                ].map((header) => (

                  <th
                    key={header}
                    className="text-left px-4 py-3 text-xs uppercase"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    {header}
                  </th>

                ))}

              </tr>
            </thead>

            <tbody>

              {quizzes.length ? (

                quizzes.map((quiz: any) => (

                  <tr
                    key={quiz.id}
                    style={{
                      borderTop:
                        '1px solid var(--border)'
                    }}
                  >

                    <td className="px-4 py-3 font-medium">
                      {quiz.title}
                    </td>

                    <td className="px-4 py-3">
                      {quiz.topic || '—'}
                    </td>

                    <td className="px-4 py-3">
                      {date(
                        quiz.quiz_date ||
                        quiz.completed_at
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {quiz.score == null
                        ? 'Not completed'
                        : `${quiz.score} / ${quiz.max_score}`}
                    </td>

                    <td className="px-4 py-3">
                      {pct(
                        quiz.score,
                        quiz.max_score
                      )}
                    </td>

                  </tr>

                ))

              ) : (

                <Empty
                  colSpan={5}
                  text="No quizzes found."
                />

              )}

            </tbody>

          </table>

        </div>

      </section>

      {/* FINAL GRADE */}

      <section
        className="rounded-xl p-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)'
        }}
      >

        <h2 className="text-lg font-semibold">
          End-of-Term Final Grade
        </h2>

        <p
          className="text-sm mt-1 mb-4"
          style={{
            color: 'var(--muted-foreground)'
          }}
        >
          Review the student's complete history and
          record the final grade for this group.
        </p>

        {error && (
          <p
            className="text-sm mb-3"
            style={{
              color: '#B91C1C'
            }}
          >
            {error}
          </p>
        )}

        {saved && (
          <p
            className="text-sm mb-3"
            style={{
              color: '#15803D'
            }}
          >
            Final grade saved successfully.
          </p>
        )}

        <div className="grid md:grid-cols-[180px_1fr] gap-4">

          <div>

            <label className="block text-xs font-medium mb-1">
              Final Grade (0–100)
            </label>

            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={grade}
              onChange={(e) =>
                setGrade(e.target.value)
              }
              className="w-full px-3 py-2.5 rounded-lg"
              style={{
                border:
                  '1px solid var(--border)',
                background: 'var(--muted)'
              }}
            />

          </div>

          <div>

            <label className="block text-xs font-medium mb-1">
              Final Comment
            </label>

            <textarea
              value={comment}
              onChange={(e) =>
                setComment(e.target.value)
              }
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg"
              style={{
                border:
                  '1px solid var(--border)',
                background: 'var(--muted)'
              }}
              placeholder="Optional end-of-term feedback…"
            />

          </div>

        </div>

        <button
          onClick={save}
          disabled={
            saving ||
            grade === ''
          }
          className="mt-4 px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            opacity:
              saving || grade === ''
                ? 0.6
                : 1
          }}
        >
          {saving
            ? 'Saving…'
            : 'Save Final Grade'}
        </button>

      </section>

    </div>
  )
}

function Card({
  label,
  value
}: {
  label: string
  value: string | number
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)'
      }}
    >

      <p
        className="text-xs"
        style={{
          color:
            'var(--muted-foreground)'
        }}
      >
        {label}
      </p>

      <p className="text-2xl font-bold mt-1">
        {value}
      </p>

    </div>
  )
}

function Empty({
  colSpan,
  text
}: {
  colSpan: number
  text: string
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-8 text-center"
        style={{
          color:
            'var(--muted-foreground)'
        }}
      >
        {text}
      </td>
    </tr>
  )
}