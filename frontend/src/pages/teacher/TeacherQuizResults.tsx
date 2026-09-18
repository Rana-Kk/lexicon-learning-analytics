import { useEffect, useState } from 'react'
import { getQuizResults, getMyGroups, saveQuizResult } from '../../lib/api'
import StatCard from '../../components/StatCard'
import TeacherQuizImport from './TeacherQuizImport'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export default function TeacherQuizResults() {
  const [groups, setGroups] = useState<any[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)

  const [filterStudent, setFilterStudent] = useState('all')
  const [filterTopic, setFilterTopic] = useState('all')

  const [editingRowId, setEditingRowId] = useState<number | string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Load the groups assigned to this teacher
  const loadGroups = async () => {
    try {
      setGroupsLoading(true)
      const res = await getMyGroups()
      setGroups(res.data ?? [])
    } catch (err: any) {
      setError(err?.message || 'Could not load groups.')
    } finally {
      setGroupsLoading(false)
    }
  }

  // Load results — an empty groupId means "all groups"
  const loadResults = async (groupId: string) => {
    try {
      setLoading(true)
      setError('')

      const res = groupId
        ? await getQuizResults({ group_id: groupId })
        : await getQuizResults()

      setResults(res.data ?? [])
    } catch (err: any) {
      setError(err?.message || 'Could not load quiz results.')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (r: any) => {
    setEditingRowId(r.id)
    setEditScore(String(r.score))
  }

  const cancelEdit = () => {
    setEditingRowId(null)
    setEditScore('')
  }

  const saveEdit = async (r: any) => {
    const parsed = Number(editScore)

    if (Number.isNaN(parsed) || parsed < 0 || parsed > r.max_score) {
      setError(`Score must be a number between 0 and ${r.max_score}.`)
      return
    }

    try {
      setSavingEdit(true)
      setError('')

      await saveQuizResult({
        quiz_id: r.quiz_id,
        student_id: r.student_id,
        score: parsed,
        completed_at: r.completed_at,
      })

      setEditingRowId(null)
      setEditScore('')
      await loadResults(selectedGroupId)
    } catch (err: any) {
      setError(err?.message || 'Could not update the result.')
    } finally {
      setSavingEdit(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    setFilterStudent('all')
    setFilterTopic('all')
    loadResults(selectedGroupId)
  }, [selectedGroupId])

  if (showImport) {
    return (
      <TeacherQuizImport
        onDone={() => {
          setShowImport(false)
          loadResults(selectedGroupId)
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

  // Highest to lowest, used for both the comparison chart and the ranking list
  const rankedStudentAvgs = [...studentAvgs].sort((a, b) => b.avg - a.avg)

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

      {/* Group selector — teacher must pick one of their own assigned groups first */}
      <div
        className="mb-6 rounded-xl p-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Group
        </label>

        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          disabled={groupsLoading}
          className="px-3 py-2 rounded-lg text-sm w-full max-w-xs"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--muted)',
          }}
        >
          <option value="">
            {groupsLoading ? 'Loading groups...' : 'All groups'}
          </option>

          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm">Loading quiz results...</p>
      ) : (
        <>
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
            style={{ gridTemplateColumns: '1fr' }}
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

              <div
                style={{
                  maxHeight: 240,
                  overflowY: rankedStudentAvgs.length > 8 ? 'auto' : 'visible',
                }}
              >
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(200, rankedStudentAvgs.length * 26)}
                >
                  <BarChart
                    data={rankedStudentAvgs}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />

                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="avg"
                      name="Avg Score %"
                      fill="#0891B2"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
                    'Actions',
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
                      {editingRowId === r.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={r.max_score}
                            value={editScore}
                            onChange={(e) => setEditScore(e.target.value)}
                            className="w-16 px-2 py-1 rounded-md text-sm"
                            style={{
                              border: '1px solid var(--border)',
                            }}
                            autoFocus
                          />
                          <span>/{r.max_score}</span>
                        </div>
                      ) : (
                        <>{r.score}/{r.max_score}</>
                      )}
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

                    <td className="px-5 py-3.5 text-sm">
                      {editingRowId === r.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(r)}
                            disabled={savingEdit}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md"
                            style={{
                              background: 'var(--primary)',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              opacity: savingEdit ? 0.6 : 1,
                            }}
                          >
                            {savingEdit ? 'Saving...' : 'Save'}
                          </button>

                          <button
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md"
                            style={{
                              background: 'var(--muted)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(r)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md"
                          style={{
                            background: 'var(--muted)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={7}
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

          <div
            className="rounded-xl overflow-hidden mt-6"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="px-5 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2
                className="text-base font-semibold"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Student Ranking
              </h2>

              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Highest to lowest average score
              </p>
            </div>

            <table className="w-full">
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--muted)',
                  }}
                >
                  {['#', 'Student', 'Average Score'].map((h) => (
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
                {rankedStudentAvgs.map((s, i) => (
                  <tr
                    key={s.name}
                    style={{
                      borderBottom:
                        i < rankedStudentAvgs.length - 1
                          ? '1px solid var(--border)'
                          : 'none',
                    }}
                  >
                    <td
                      className="px-5 py-3.5 text-sm font-semibold"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {i + 1}
                    </td>

                    <td className="px-5 py-3.5 text-sm font-medium">
                      {s.name}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className="text-sm font-semibold mono px-2.5 py-1 rounded-full"
                        style={{
                          background:
                            s.avg >= 80
                              ? '#DCFCE7'
                              : s.avg >= 60
                              ? '#FEF3C7'
                              : '#FEE2E2',

                          color:
                            s.avg >= 80
                              ? '#15803D'
                              : s.avg >= 60
                              ? '#B45309'
                              : '#B91C1C',
                        }}
                      >
                        {s.avg}%
                      </span>
                    </td>
                  </tr>
                ))}

                {!rankedStudentAvgs.length && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-sm"
                      style={{
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      No students to rank yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}