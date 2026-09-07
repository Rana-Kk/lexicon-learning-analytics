import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'

import {
  getMyGroups,
  getGroupStudents,
  getStudentReport,
} from '../../lib/api'

type ScopedStudent = {
  id: string
  name: string
}

const SECTIONS = [
  {
    id: 'attendance',
    label: 'Attendance Records',
    icon: '✓',
    desc: 'Full session-by-session attendance history',
  },
  {
    id: 'scores',
    label: 'Assessment Scores',
    icon: '📝',
    desc: 'Rubric scores and totals for all assessments',
  },
  {
    id: 'assignmentChecklist',
    label: 'Assignment Checklist Evaluations',
    icon: '☑',
    desc: 'Assignment evaluation criteria and teacher results',
  },
  {
    id: 'quiz',
    label: 'Quiz Results',
    icon: '❓',
    desc: 'All quiz scores by topic and date',
  },
  {
    id: 'competency',
    label: 'Competency Matrix',
    icon: '⬡',
    desc: 'Skill-by-skill progress levels',
  },
  {
    id: 'feedback',
    label: 'Teacher Feedback',
    icon: '✦',
    desc: 'Written feedback shared with the student',
  },
  {
    id: 'certificates',
    label: 'Certificates',
    icon: '🏆',
    desc: 'Issued certificates and expiry dates',
  },
] as const

type SectionId =
  (typeof SECTIONS)[number]['id']

type ChecklistCriterion = {
  criterion_id: number

  name: string

  description?: string | null

  criterion_type:
    | 'yes_no'
    | 'score'
    | 'text'

  max_score?: number | null

  sort_order?: number

  // AI RESULTS
  ai_yes_no_value?:
    | number
    | boolean
    | null

  ai_score_value?:
    | number
    | null

  ai_text_value?:
    | string
    | null

  ai_feedback?:
    | string
    | null

  // TEACHER RESULTS
  teacher_yes_no_value?:
    | number
    | boolean
    | null

  teacher_score_value?:
    | number
    | null

  teacher_text_value?:
    | string
    | null

  teacher_feedback?:
    | string
    | null
}
type AssignmentChecklistEvaluation = {
  assessment_id: number
  assessment_title: string
  delivered_on?: string | null
  final_score?: number | null
  max_score?: number | null

  criteria: ChecklistCriterion[]
}

// ============================================================
// FORMAT CHECKLIST VALUE
// ============================================================

function formatCriterionValue(
  criterion?: ChecklistCriterion
) {
  if (!criterion) {
    return '—'
  }

  // ============================================================
  // YES / NO
  //
  // Teacher value varsa teacher value
  // Yoksa AI value
  // ============================================================

  if (
    criterion.criterion_type ===
    'yes_no'
  ) {
    const value =
      criterion.teacher_yes_no_value ??
      criterion.ai_yes_no_value

    if (
      value === null ||
      value === undefined
    ) {
      return '—'
    }

    return Number(value) === 1
      ? 'Yes'
      : 'No'
  }

  // ============================================================
  // SCORE
  //
  // Teacher score varsa onu göster
  // Yoksa AI score göster
  // ============================================================

  if (
    criterion.criterion_type ===
    'score'
  ) {
    const value =
      criterion.teacher_score_value ??
      criterion.ai_score_value

    if (
      value === null ||
      value === undefined
    ) {
      return '—'
    }

    return criterion.max_score
      ? `${value} / ${criterion.max_score}`
      : String(value)
  }

  // ============================================================
  // TEXT
  //
  // Teacher text varsa onu göster
  // Yoksa AI text göster
  // ============================================================

  if (
    criterion.criterion_type ===
    'text'
  ) {
    const value =
      criterion.teacher_text_value ??
      criterion.ai_text_value

    if (!value) {
      return '—'
    }

    return value
  }

  return '—'
}
// ============================================================
// PDF
// ============================================================

function buildPdf(
  student: {
    name: string
    email: string
  },
  data: any,
  included: Set<SectionId>
) {
  // LANDSCAPE
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const marginX = 10

  const pageHeight =
    doc.internal.pageSize.getHeight()

  const pageWidth =
    doc.internal.pageSize.getWidth()

  let y = 15

  const ensureSpace = (
    needed: number
  ) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage()
      y = 15
    }
  }

  const heading = (
    text: string
  ) => {
    ensureSpace(14)

    doc.setFontSize(13)

    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.text(
      text,
      marginX,
      y
    )

    y += 7

    doc.setDrawColor(210)

    doc.line(
      marginX,
      y,
      pageWidth - marginX,
      y
    )

    y += 6

    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(9)
  }

  const line = (
    text: string
  ) => {
    const wrapped =
      doc.splitTextToSize(
        text,
        pageWidth - marginX * 2
      )

    wrapped.forEach(
      (item: string) => {
        ensureSpace(6)

        doc.text(
          item,
          marginX,
          y
        )

        y += 5
      }
    )
  }

  // ============================================================
  // HEADER
  // ============================================================

  doc.setFontSize(16)

  doc.setFont(
    'helvetica',
    'bold'
  )

  doc.text(
    'Lexicon Institute',
    marginX,
    y
  )

  y += 7

  doc.setFontSize(11)

  doc.setFont(
    'helvetica',
    'normal'
  )

  doc.text(
    'Student Performance Report',
    marginX,
    y
  )

  y += 9

  doc.setFontSize(12)

  doc.setFont(
    'helvetica',
    'bold'
  )

  doc.text(
    student.name,
    marginX,
    y
  )

  y += 6

  doc.setFontSize(9)

  doc.setFont(
    'helvetica',
    'normal'
  )

  doc.setTextColor(100)

  doc.text(
    student.email || '',
    marginX,
    y
  )

  doc.setTextColor(0)

  y += 6

  doc.text(
    `Generated: ${new Date().toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    )}`,
    marginX,
    y
  )

  y += 10

  // ============================================================
  // ATTENDANCE
  // ============================================================

  if (included.has('attendance')) {
    heading('Attendance Records')

    const rows =
      data.attendance || []

    if (!rows.length) {
      line('No attendance records.')
    } else {
      rows.slice(0, 60).forEach(
        (r: any) => {
          line(
            `${r.attendance_date} · ${
              r.session || '—'
            } · ${r.status}`
          )
        }
      )
    }

    y += 4
  }

  // ============================================================
  // ASSESSMENT SCORES
  // ============================================================

  if (included.has('scores')) {
    heading('Assessment Scores')

    const rows =
      data.scores || []

    if (!rows.length) {
      line('No assessment scores.')
    } else {
      rows.forEach(
        (r: any) => {
          line(
            `${r.assessment_title}: ${r.score} / ${r.max_score}`
          )
        }
      )
    }

    y += 4
  }

  // ============================================================
  // ASSIGNMENT CHECKLIST EVALUATIONS
  // ============================================================

  if (
    included.has(
      'assignmentChecklist'
    )
  ) {
    heading(
      'Assignment Checklist Evaluations'
    )

    const assignments:
      AssignmentChecklistEvaluation[] =
      data.assignmentChecklistEvaluations ||
      []

    if (!assignments.length) {
      line(
        'No assignment checklist evaluations.'
      )
    } else {
      // ========================================================
      // GET ALL UNIQUE CRITERIA
      //
      // These become the table columns.
      // ========================================================

      const criteriaMap = new Map<
        number,
        ChecklistCriterion
      >()

      assignments.forEach(
        assignment => {
          assignment.criteria.forEach(
            criterion => {
              if (
                !criteriaMap.has(
                  criterion.criterion_id
                )
              ) {
                criteriaMap.set(
                  criterion.criterion_id,
                  criterion
                )
              }
            }
          )
        }
      )

      const allCriteria =
        Array.from(
          criteriaMap.values()
        ).sort(
          (a, b) =>
            (a.sort_order || 0) -
            (b.sort_order || 0)
        )

      // ========================================================
      // TABLE CONFIGURATION
      // ========================================================

      const headers = [
        'Assignment Name',
        'Delivered On',

        ...allCriteria.map(
          c => c.name
        ),

        'Final',
      ]

      const availableWidth =
        pageWidth - marginX * 2

      const firstColumnWidth = 35

      const dateColumnWidth = 20

      const finalColumnWidth = 22

      const criteriaWidth =
        (
          availableWidth -
          firstColumnWidth -
          dateColumnWidth -
          finalColumnWidth
        ) /
        Math.max(
          allCriteria.length,
          1
        )

      const columnWidths = [
        firstColumnWidth,
        dateColumnWidth,

        ...allCriteria.map(
          () => criteriaWidth
        ),

        finalColumnWidth,
      ]

      // ========================================================
      // DRAW HEADER
      // ========================================================

      const drawTableHeader = () => {
        const headerHeight = 20

        ensureSpace(headerHeight + 8)

        let x = marginX

        doc.setFillColor(
          235,
          235,
          235
        )

        doc.rect(
          marginX,
          y,
          availableWidth,
          headerHeight,
          'F'
        )

        doc.setFontSize(6.5)

        doc.setFont(
          'helvetica',
          'bold'
        )

        headers.forEach(
          (header, index) => {
            const width =
              columnWidths[index]

            const wrapped =
              doc.splitTextToSize(
                header.toUpperCase(),
                width - 3
              )

            doc.text(
              wrapped,
              x + 2,
              y + 5
            )

            x += width
          }
        )

        doc.setDrawColor(
          200
        )

        doc.rect(
          marginX,
          y,
          availableWidth,
          headerHeight
        )

        y += headerHeight

        doc.setFont(
          'helvetica',
          'normal'
        )

        doc.setFontSize(7)
      }

      drawTableHeader()

      // ========================================================
      // DRAW EACH ASSIGNMENT
      // ========================================================

      assignments.forEach(
        assignment => {
          const values =
            allCriteria.map(
              globalCriterion => {
                const criterion =
                  assignment.criteria.find(
                    item =>
                      item.criterion_id ===
                      globalCriterion.criterion_id
                  )

                return formatCriterionValue(
                  criterion
                )
              }
            )

          const rowValues = [
            assignment.assessment_title ||
              '—',

            assignment.delivered_on
              ? String(
                  assignment.delivered_on
                ).slice(0, 10)
              : '—',

            ...values,

            assignment.final_score !==
            null &&
            assignment.final_score !==
            undefined
              ? `${assignment.final_score} / ${
                  assignment.max_score || 100
                }`
              : '—',
          ]

          // Calculate row height
          let rowHeight = 16

          rowValues.forEach(
            (value, index) => {
              const lines =
                doc.splitTextToSize(
                  String(value),
                  columnWidths[index] - 3
                )

              rowHeight = Math.max(
                rowHeight,
                lines.length * 4 + 6
              )
            }
          )

          if (
            y + rowHeight >
            pageHeight - 15
          ) {
            doc.addPage()

            y = 15

            drawTableHeader()
          }

          let x = marginX

          rowValues.forEach(
            (value, index) => {
              const width =
                columnWidths[index]

              doc.setDrawColor(
                210
              )

              doc.rect(
                x,
                y,
                width,
                rowHeight
              )

              const wrapped =
                doc.splitTextToSize(
                  String(value),
                  width - 3
                )

              doc.text(
                wrapped,
                x + 2,
                y + 5
              )

              x += width
            }
          )

          y += rowHeight
        }
      )

      y += 8
    }
  }

  // ============================================================
  // QUIZZES
  // ============================================================

  if (included.has('quiz')) {
    heading('Quiz Results')

    const rows =
      data.quizzes || []

    if (!rows.length) {
      line('No quiz results.')
    } else {
      rows.forEach(
        (r: any) => {
          line(
            `${r.quiz_title} (${
              r.topic || '—'
            }): ${r.score} / ${r.max_score}`
          )
        }
      )
    }

    y += 4
  }

  // ============================================================
  // COMPETENCIES
  // ============================================================

  if (
    included.has('competency')
  ) {
    heading('Competency Matrix')

    const rows =
      data.competencies || []

    if (!rows.length) {
      line('No competency data.')
    } else {
      rows.forEach(
        (r: any) => {
          line(
            `${r.name}: ${r.score}%`
          )
        }
      )
    }

    y += 4
  }

  // ============================================================
  // FEEDBACK
  // ============================================================

  if (included.has('feedback')) {
    heading('Teacher Feedback')

    const rows =
      data.feedback || []

    if (!rows.length) {
      line('No feedback recorded.')
    } else {
      rows.forEach(
        (r: any) => {
          doc.setFont(
            'helvetica',
            'bold'
          )

          line(
            `${r.teacher_name ||
              'Teacher'} — ${
              r.created_at
                ? new Date(
                    r.created_at
                  ).toLocaleDateString(
                    'en-GB'
                  )
                : '—'
            }`
          )

          doc.setFont(
            'helvetica',
            'normal'
          )

          line(
            r.content || ''
          )

          y += 2
        }
      )
    }

    y += 3
  }

  // ============================================================
  // CERTIFICATES
  // ============================================================

  if (
    included.has('certificates')
  ) {
    heading('Certificates')

    const rows =
      data.certificates || []

    if (!rows.length) {
      line('No certificates issued.')
    } else {
      rows.forEach(
        (r: any) => {
          line(
            `${r.name} — ${
              r.issuing_organization ||
              '—'
            } (${
              r.issue_date || '—'
            }${
              r.expiry_date
                ? ` – ${r.expiry_date}`
                : ''
            })`
          )
        }
      )
    }
  }

  return doc
}

// ============================================================
// COMPONENT
// ============================================================

export default function TeacherReports() {
  const [
    students,
    setStudents,
  ] = useState<ScopedStudent[]>([])

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState('')

  const [
    included,
    setIncluded,
  ] = useState<Set<SectionId>>(
    new Set(
      SECTIONS.map(
        section => section.id
      )
    )
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    generating,
    setGenerating,
  ] = useState(false)

  const [
    generated,
    setGenerated,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)

        setError('')

        const groupsRes =
          await getMyGroups()

        const groups =
          Array.isArray(
            groupsRes?.data
          )
            ? groupsRes.data
            : []

        const studentLists =
          await Promise.all(
            groups.map(
              (group: any) =>
                getGroupStudents(
                  group.id
                )
            )
          )

        const byId = new Map<
          string,
          ScopedStudent
        >()

        studentLists.forEach(
          result => {
            const list =
              Array.isArray(
                result?.data
              )
                ? result.data
                : []

            list.forEach(
              (student: any) => {
                byId.set(
                  String(student.id),
                  {
                    id: String(
                      student.id
                    ),
                    name:
                      student.name,
                  }
                )
              }
            )
          }
        )

        const list =
          Array.from(
            byId.values()
          ).sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          )

        setStudents(list)

        if (list.length) {
          setSelectedStudentId(
            list[0].id
          )
        }
      } catch (err: any) {
        setError(
          err?.message ||
            'Failed to load students'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const toggleSection = (
    id: SectionId
  ) => {
    setIncluded(prev => {
      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })

    setGenerated(false)
  }

  const handleGenerate =
    async () => {
      if (!selectedStudentId) {
        return
      }

      try {
        setGenerating(true)

        setGenerated(false)

        setError('')

        const res =
          await getStudentReport(
            selectedStudentId
          )

        const data =
          res?.data

        if (!data?.student) {
          throw new Error(
            'No report data returned'
          )
        }

        const doc =
          buildPdf(
            data.student,
            data,
            included
          )

        const safeName =
          data.student.name.replace(
            /[^a-z0-9]+/gi,
            '_'
          )

        doc.save(
          `${safeName}_report.pdf`
        )

        setGenerated(true)
      } catch (err: any) {
        setError(
          err?.message ||
            'Failed to generate report'
        )
      } finally {
        setGenerating(false)
      }
    }

  const student =
    students.find(
      item =>
        item.id ===
        selectedStudentId
    )

  if (loading) {
    return (
      <div className="p-6">
        Loading...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{
            fontFamily:
              'Outfit, sans-serif',
          }}
        >
          PDF Reports
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{
            color:
              'var(--muted-foreground)',
          }}
        >
          Generate and download performance reports for your own students
        </p>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl text-sm mb-6"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      {!students.length ? (
        <div
          className="p-10 rounded-xl text-center"
          style={{
            background:
              'var(--card)',

            border:
              '1px solid var(--border)',
          }}
        >
          <p className="font-medium">
            You have no students yet.
          </p>
        </div>
      ) : (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns:
              '1fr 320px',
          }}
        >
          {/* LEFT */}

          <div className="space-y-4">
            <div
              className="rounded-xl p-5"
              style={{
                background:
                  'var(--card)',

                border:
                  '1px solid var(--border)',
              }}
            >
              <label className="block text-sm font-semibold mb-3">
                Student
              </label>

              <select
                value={
                  selectedStudentId
                }
                onChange={event => {
                  setSelectedStudentId(
                    event.target.value
                  )

                  setGenerated(false)
                }}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border:
                    '1px solid var(--border)',

                  background:
                    'var(--muted)',

                  outline: 'none',
                }}
              >
                {students.map(
                  student => (
                    <option
                      key={student.id}
                      value={
                        student.id
                      }
                    >
                      {student.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              className="rounded-xl p-5"
              style={{
                background:
                  'var(--card)',

                border:
                  '1px solid var(--border)',
              }}
            >
              <p className="text-sm font-semibold mb-3">
                Include in Report
              </p>

              <div className="space-y-2">
                {SECTIONS.map(
                  section => (
                    <label
                      key={section.id}
                      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                      style={{
                        background:
                          included.has(
                            section.id
                          )
                            ? 'var(--secondary)'
                            : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={included.has(
                          section.id
                        )}
                        onChange={() =>
                          toggleSection(
                            section.id
                          )
                        }
                        className="mt-0.5"
                      />

                      <div>
                        <p className="text-sm font-medium">
                          {section.icon}{' '}
                          {section.label}
                        </p>

                        <p
                          className="text-xs mt-0.5"
                          style={{
                            color:
                              'var(--muted-foreground)',
                          }}
                        >
                          {section.desc}
                        </p>
                      </div>
                    </label>
                  )
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}

          <div className="space-y-4">
            <div
              className="rounded-xl p-5"
              style={{
                background:
                  'var(--card)',

                border:
                  '1px solid var(--border)',
              }}
            >
              <p className="text-sm font-semibold mb-3">
                Report Preview
              </p>

              <div
                className="rounded-lg p-4 mb-4"
                style={{
                  background:
                    'var(--muted)',

                  border:
                    '1px solid var(--border)',
                }}
              >
                <p className="text-xs font-bold">
                  Lexicon Institute
                </p>

                <p className="text-xs">
                  Student Performance Report
                </p>

                <div className="mt-3 pt-2 border-t">
                  <p className="text-xs font-semibold">
                    {student?.name}
                  </p>

                  <p className="text-xs mt-3 font-medium">
                    Contents:
                  </p>

                  {SECTIONS.filter(
                    section =>
                      included.has(
                        section.id
                      )
                  ).map(section => (
                    <p
                      key={section.id}
                      className="text-xs"
                    >
                      {section.icon}{' '}
                      {section.label}
                    </p>
                  ))}
                </div>
              </div>

              <button
                onClick={
                  handleGenerate
                }
                disabled={
                  generating ||
                  included.size === 0
                }
                className="w-full py-3 rounded-lg text-sm font-semibold"
                style={{
                  background:
                    'var(--primary)',

                  color: 'white',

                  border: 'none',

                  opacity:
                    generating ||
                    included.size === 0
                      ? 0.6
                      : 1,

                  cursor:
                    generating ||
                    included.size === 0
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {generating
                  ? 'Generating PDF…'
                  : '📄 Generate & Download PDF'}
              </button>

              {generated && (
                <p
                  className="text-xs text-center mt-3 font-medium"
                  style={{
                    color: '#15803D',
                  }}
                >
                  ✓ Report ready — download started
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}