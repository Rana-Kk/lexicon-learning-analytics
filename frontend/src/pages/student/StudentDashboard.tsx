import { useEffect, useMemo, useState } from 'react'
import StatCard from '../../components/StatCard'

import {
  getAnalyticsOverview,
  getGroups,
  getMyCompetencies,
  getFeedback,
  getQuizResults,
  me,
} from '../../lib/api'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import type { StudentPage } from '../../layouts/StudentLayout'

interface Props {
  onNavigate: (page: StudentPage) => void
}

interface Group {
  id: number
  name: string
  course_id: number
  course_name: string
  start_date?: string
  end_date?: string
}

interface Competency {
  competency_id: number
  name: string
  description?: string
  score: number
  previous_score?: number | null
}

interface QuizResult {
  id: number
  quiz_id: number
  quiz_title: string
  topic?: string
  score: number
  max_score: number
  completed_at?: string
  quiz_date?: string
}

interface Feedback {
  id: number
  content: string
  assessment_title?: string
  teacher_name?: string
  created_at?: string
}

export default function StudentDashboard({ onNavigate }: Props) {
  const [student, setStudent] = useState<any>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [overview, setOverview] = useState<any>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      setError('')

      const [
        studentResponse,
        groupsResponse,
        overviewResponse,
        competenciesResponse,
        feedbackResponse,
        quizResponse,
      ] = await Promise.all([
        me(),
        getGroups(),
        getAnalyticsOverview(),
        getMyCompetencies(),
        getFeedback(),
        getQuizResults(),
      ])

      setStudent(studentResponse)

      setGroups(groupsResponse.data ?? [])

      setOverview(overviewResponse.data ?? null)

      setCompetencies(
        competenciesResponse.data ?? []
      )

      setFeedback(
        feedbackResponse.data ?? []
      )

      setQuizResults(
        quizResponse.data ?? []
      )
    } catch (err: any) {
      console.error('Dashboard loading error:', err)

      setError(
        err?.message ||
        'Could not load dashboard data.'
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * -----------------------------
   * Calculated values
   * -----------------------------
   */

  const quizAverage = Math.round(
    Number(overview?.quiz_average ?? 0)
  )

  const assessmentAverage = Math.round(
    Number(overview?.assessment_average ?? 0)
  )

  const attendanceRate = Math.round(
    Number(overview?.attendance?.rate ?? 0)
  )

const overallProgress = useMemo(() => {
  const values = []

  if (overview?.quiz_count > 0) {
    values.push(quizAverage)
  }

  if (overview?.assessment_count > 0) {
    values.push(assessmentAverage)
  }

  if (!values.length) {
    return 0
  }

  return Math.round(
    values.reduce((a, b) => a + b, 0) / values.length
  )
}, [
  quizAverage,
  assessmentAverage,
  overview,
])
  /*
   * Quiz score trend
   */
  const scoreTrend = useMemo(() => {
    return [...quizResults]
      .filter((quiz) => quiz.max_score)
      .sort((a, b) => {
        const dateA = new Date(
          a.completed_at ||
          a.quiz_date ||
          0
        ).getTime()

        const dateB = new Date(
          b.completed_at ||
          b.quiz_date ||
          0
        ).getTime()

        return dateA - dateB
      })
      .map((quiz, index) => ({
        week: `Quiz ${index + 1}`,
        score: Math.round(
          (Number(quiz.score) /
            Number(quiz.max_score)) *
            100
        ),
      }))
  }, [quizResults])

  /*
   * Approved / visible feedback
   *
   * The backend already restricts feedback
   * to the logged-in student.
   */
  const recentFeedback = feedback.slice(0, 2)

  /*
   * -----------------------------
   * Loading
   * -----------------------------
   */

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <p
            className="text-sm"
            style={{
              color: 'var(--muted-foreground)',
            }}
          >
            Loading your dashboard...
          </p>
        </div>
      </div>
    )
  }

  /*
   * -----------------------------
   * Error
   * -----------------------------
   */

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div
          className="rounded-xl p-5"
          style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
          }}
        >
          <p className="text-sm font-medium">
            Could not load dashboard
          </p>

          <p className="text-sm mt-1">
            {error}
          </p>

          <button
            onClick={loadDashboard}
            className="mt-3 text-sm font-medium underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  /*
   * -----------------------------
   * Main dashboard
   * -----------------------------
   */

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Good morning, {student?.name || 'Student'}
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{
            color: 'var(--muted-foreground)',
          }}
        >
          {groups.length > 0
            ? groups
                .map(
                  (group) =>
                    `${group.name} · ${group.course_name}`
                )
                .join('  |  ')
            : 'No group assigned yet'}
        </p>
      </div>

      {/* Course / Group */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-semibold"
            style={{
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            My Courses & Groups
          </h2>
        </div>

        {groups.length === 0 ? (
          <p
            className="text-sm"
            style={{
              color: 'var(--muted-foreground)',
            }}
          >
            You are not assigned to any group yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg p-4"
                style={{
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-sm font-semibold">
                  {group.course_name}
                </p>

                <p
                  className="text-xs mt-1"
                  style={{
                    color:
                      'var(--muted-foreground)',
                  }}
                >
                  Group: {group.name}
                </p>

                {(group.start_date ||
                  group.end_date) && (
                  <p
                    className="text-xs mt-2"
                    style={{
                      color:
                        'var(--muted-foreground)',
                    }}
                  >
                    {group.start_date || '—'}
                    {' → '}
                    {group.end_date || '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4 mb-6">

        <StatCard
          label="Overall Progress"
          value={`${overallProgress}%`}
          icon={<span>⬆</span>}
          accent
        />

        <StatCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          sub={`${overview?.attendance?.total ?? 0} sessions`}
          icon={<span>✓</span>}
        />

        <StatCard
  label="Assessment Avg"
  value={`${Math.round(Number(overview?.assessment_average || 0))}%`}
  sub={`${overview?.assessment_count || 0} assessments`}
  icon={<span>★</span>}
/>

        <StatCard
          label="Quiz Average"
          value={`${quizAverage}%`}
          sub={`${overview?.quiz_count ?? 0} quizzes`}
          icon={<span>❓</span>}
        />
      </div>

      {/* Score Trend + Competencies */}
      <div
        className="grid gap-6 mb-6"
        style={{
          gridTemplateColumns: '1fr 1fr',
        }}
      >

        {/* Score Trend */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Quiz Score Trend
          </h2>

          {scoreTrend.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p
                className="text-sm"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                No quiz results yet.
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer
                width="100%"
                height={200}
              >
                <LineChart data={scoreTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="week"
                    tick={{
                      fontSize: 11,
                      fill: '#64748B',
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 11,
                      fill: '#64748B',
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border:
                        '1px solid var(--border)',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [
                      `${value}%`,
                      'Score',
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#1D4ED8"
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#1D4ED8',
                      stroke: 'white',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Competencies */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Competency Progress
          </h2>

          {competencies.length === 0 ? (
            <p
              className="text-sm"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              No competency data yet.
            </p>
          ) : (
            <div className="space-y-3">
              {competencies
                .slice(0, 6)
                .map((c) => {

                  const score = Number(
                    c.score || 0
                  )

                  const previous =
                    c.previous_score != null
                      ? Number(
                          c.previous_score
                        )
                      : null

                  const trend =
                    previous === null
                      ? 'same'
                      : score > previous
                      ? 'improving'
                      : score < previous
                      ? 'declining'
                      : 'same'

                  return (
                    <div key={c.competency_id}>
                      <div className="flex items-center justify-between mb-1">

                        <span className="text-sm font-medium">
                          {c.name}
                        </span>

                        <div className="flex items-center gap-2">

                          <span
                            className="text-xs"
                            style={{
                              color:
                                trend === 'improving'
                                  ? '#15803D'
                                  : trend === 'declining'
                                  ? '#B91C1C'
                                  : '#64748B',
                            }}
                          >
                            {trend === 'improving'
                              ? '↑'
                              : trend === 'declining'
                              ? '↓'
                              : '→'}
                          </span>

                          <span className="text-sm mono font-medium">
                            {score}%
                          </span>
                        </div>
                      </div>

                      <div
                        className="w-full rounded-full overflow-hidden"
                        style={{
                          height: '5px',
                          background:
                            'var(--secondary)',
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                score
                              )
                            )}%`,
                            background:
                              score >= 80
                                ? '#16A34A'
                                : score >= 65
                                ? '#0891B2'
                                : '#D97706',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          <button
            onClick={() =>
              onNavigate('competency')
            }
            className="text-xs mt-4"
            style={{
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View full competency matrix →
          </button>
        </div>
      </div>

      {/* Feedback */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{
            borderColor: 'var(--border)',
          }}
        >
          <h2
            className="text-base font-semibold"
            style={{
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Teacher Feedback
          </h2>

          <button
            onClick={() =>
              onNavigate('feedback')
            }
            className="text-xs"
            style={{
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View all →
          </button>
        </div>

        {recentFeedback.length > 0 ? (
          recentFeedback.map((item, index) => (
            <div
              key={item.id}
              className="px-5 py-4"
              style={{
                borderBottom:
                  index <
                  recentFeedback.length - 1
                    ? '1px solid var(--border)'
                    : 'none',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium">
                  {item.assessment_title ||
                    'Teacher feedback'}
                </p>
              </div>

              <p
                className="text-sm leading-relaxed"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                {item.content}
              </p>

              <p
                className="text-xs mt-2 mono"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                {item.teacher_name
                  ? `By ${item.teacher_name}`
                  : ''}
                {item.created_at
                  ? ` · ${new Date(
                      item.created_at
                    ).toLocaleDateString(
                      'en-GB',
                      {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }
                    )}`
                  : ''}
              </p>
            </div>
          ))
        ) : (
          <div className="px-5 py-8 text-center">
            <p
              className="text-sm"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              No teacher feedback yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}