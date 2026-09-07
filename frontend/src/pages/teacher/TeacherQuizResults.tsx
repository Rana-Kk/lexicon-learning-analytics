import { useEffect, useState } from 'react'
import { getQuizResults } from '../../lib/api'
import StatCard from '../../components/StatCard'
import TeacherQuizImport from './TeacherQuizImport'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export default function TeacherQuizResults() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)

  const [filterStudent, setFilterStudent] = useState('all')
  const [filterTopic, setFilterTopic] = useState('all')

  const loadResults = async () => {
    try {
      setLoading(true)
      setError('')

      const res = await getQuizResults()
      setResults(res.data ?? [])
    } catch (err: any) {
      setError(err?.message || 'Could not load quiz results.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadResults()
  }, [])

  if (showImport) {
    return (
      <TeacherQuizImport
        onDone={() => {
          setShowImport(false)
          loadResults()
        }}
      />
    )
  }

  const filtered = results.filter((r) => {
    if (
      filterStudent !== 'all' &&
      String(r.student_id) !== filterStudent
    ) return false

    if (
      filterTopic !== 'all' &&
      r.topic !== filterTopic
    ) return false

    return true
  })

  const percentages = filtered.map((r) => Number(r.percentage) || 0)

  const avg = percentages.length
    ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
    : 0

  const highest = percentages.length ? Math.max(...percentages) : 0
  const lowest = percentages.length ? Math.min(...percentages) : 0

  const topics = [
    ...new Set(results.map((r) => r.topic).filter(Boolean)),
  ]

  const students = [
    ...new Map(
      results.map((r) => [
        r.student_id,
        {
          id: r.student_id,
          name: r.student_name,
        },
      ])
    ).values(),
  ]

  const studentAvgs = students.map((student) => {
    const studentResults = results.filter(
      (r) => r.student_id === student.id
    )

    const avg = studentResults.length
      ? Math.round(
          studentResults.reduce(
            (sum, r) => sum + Number(r.percentage || 0),
            0
          ) / studentResults.length
        )
      : 0

    return {
      name: student.name,
      avg,
    }
  })

  const quizTitles = [
    ...new Set(results.map((r) => r.quiz_title)),
  ]

  const quizTrend = quizTitles.map((title) => {
    const quizResults = results.filter(
      (r) => r.quiz_title === title
    )

    const avg = quizResults.length
      ? Math.round(
          quizResults.reduce(
            (sum, r) => sum + Number(r.percentage || 0),
            0
          ) / quizResults.length
        )
      : 0

    return {
      quiz: title,
      avg,
    }
  })

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-sm">
          Loading quiz results...
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Quiz Results
          </h1>

          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Imported quiz results
          </p>
        </div>

        <button
          onClick={() => setShowImport(true)}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ↑ Import Results
        </button>
      </div>

      {error && (
        <div
          className="mb-5 rounded-lg p-4 text-sm"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Average Score"
          value={`${avg}%`}
          icon={<span>📊</span>}
          accent
        />

        <StatCard
          label="Highest Score"
          value={`${highest}%`}
          icon={<span>★</span>}
        />

        <StatCard
          label="Lowest Score"
          value={`${lowest}%`}
          icon={<span>↓</span>}
        />

        <StatCard
          label="Results Imported"
          value={results.length}
          icon={<span>❓</span>}
        />
      </div>

      <div
        className="grid gap-6 mb-6"
        style={{ gridTemplateColumns: '1fr 1fr' }}
      >

        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Group Average per Quiz
          </h2>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quizTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />

              <XAxis
                dataKey="quiz"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="avg"
                name="Group Avg %"
                stroke="#1D4ED8"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Student Comparison
          </h2>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={studentAvgs}
              barCategoryGap="35%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />

              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />

              <Tooltip />

              <Bar
                dataKey="avg"
                name="Avg Score %"
                fill="#0891B2"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >

        <div
          className="px-5 py-4 border-b flex flex-wrap items-center gap-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            All Results
          </h2>

          <div className="flex gap-2 ml-auto">

            <select
              value={filterStudent}
              onChange={(e) =>
                setFilterStudent(e.target.value)
              }
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--muted)',
              }}
            >
              <option value="all">All students</option>

              {students.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={filterTopic}
              onChange={(e) =>
                setFilterTopic(e.target.value)
              }
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--muted)',
              }}
            >
              <option value="all">All topics</option>

              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>

          </div>
        </div>

        <table className="w-full">

          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--muted)',
              }}
            >
              {[
                'Student',
                'Quiz',
                'Topic',
                'Score',
                'Percentage',
                'Date',
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>

            {filtered.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  borderBottom:
                    i < filtered.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <td className="px-5 py-3.5 text-sm font-medium">
                  {r.student_name}
                </td>

                <td className="px-5 py-3.5 text-sm">
                  {r.quiz_title}
                </td>

                <td
                  className="px-5 py-3.5 text-sm"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {r.topic || '-'}
                </td>

                <td className="px-5 py-3.5 text-sm mono">
                  {r.score}/{r.max_score}
                </td>

                <td className="px-5 py-3.5">
                  <span
                    className="text-sm font-semibold mono px-2.5 py-1 rounded-full"
                    style={{
                      background:
                        r.percentage >= 80
                          ? '#DCFCE7'
                          : r.percentage >= 60
                          ? '#FEF3C7'
                          : '#FEE2E2',

                      color:
                        r.percentage >= 80
                          ? '#15803D'
                          : r.percentage >= 60
                          ? '#B45309'
                          : '#B91C1C',
                    }}
                  >
                    {r.percentage}%
                  </span>
                </td>

                <td
                  className="px-5 py-3.5 text-sm mono"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {r.completed_at
                    ? new Date(
                        r.completed_at
                      ).toLocaleDateString('en-GB')
                    : '-'}
                </td>
              </tr>
            ))}

            {!filtered.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-sm"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  No quiz results found.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  )
}