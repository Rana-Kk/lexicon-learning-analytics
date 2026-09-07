import { useEffect, useMemo, useState } from 'react'
import { getQuizResults } from '../../lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/StatCard'

export default function StudentQuizResults() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getQuizResults()
      .then((res: any) => setResults(res.data || []))
      .catch((err: any) => setError(err.message || 'Failed to load quiz results'))
      .finally(() => setLoading(false))
  }, [])

  const derived = useMemo(() => {
    const trend = [...results]
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
      .map((r) => ({
        quiz: r.quiz_title,
        score: r.percentage,
      }))

    const topicScores: Record<string, number[]> = {}

    results.forEach((r) => {
      if (!topicScores[r.topic]) topicScores[r.topic] = []
      topicScores[r.topic].push(r.percentage)
    })

    const topicAvgs = Object.entries(topicScores)
      .map(([topic, scores]) => ({
        topic,
        avg: Math.round(scores.reduce((a, s) => a + s, 0) / scores.length),
      }))
      .sort((a, b) => b.avg - a.avg)

    const avg = results.length
      ? Math.round(
          results.reduce((a, r) => a + Number(r.percentage), 0) /
            results.length
        )
      : 0

    return {
      trend,
      bestTopic: topicAvgs[0]?.topic ?? '—',
      worstTopic: topicAvgs[topicAvgs.length - 1]?.topic ?? '—',
      avg,
    }
  }, [results])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Loading quiz results...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div
          className="rounded-xl p-5"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      </div>
    )
  }

  const { trend, bestTopic, worstTopic, avg } = derived

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
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
          Your quiz performance across all topics
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Average Score"
          value={`${avg}%`}
          icon={<span>📊</span>}
          accent
        />

        <StatCard
          label="Quizzes Completed"
          value={results.length}
          icon={<span>✓</span>}
        />

        <StatCard
          label="Best Topic"
          value={bestTopic}
          icon={<span>★</span>}
        />

        <StatCard
          label="Needs Improvement"
          value={worstTopic}
          icon={<span>◎</span>}
        />
      </div>

      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Quiz Performance Over Time
        </h2>

        {results.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />

              <XAxis
                dataKey="quiz"
                tick={{
                  fontSize: 11,
                  fill: '#64748B',
                  fontFamily: 'DM Mono, monospace',
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
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                }}
                formatter={(v) => [`${v}%`, 'Score']}
              />

              <Line
                type="monotone"
                dataKey="score"
                name="Score %"
                stroke="#1D4ED8"
                strokeWidth={2.5}
                dot={{
                  r: 5,
                  fill: '#1D4ED8',
                  stroke: 'white',
                  strokeWidth: 2,
                }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="py-12 text-center text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            No quiz results yet.
          </div>
        )}
      </div>

      <div
        className="rounded-xl overflow-hidden"
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
            All Quizzes
          </h2>
        </div>

        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--muted)',
              }}
            >
              {['Course', 'Group', 'Quiz', 'Topic', 'Score', 'Percentage', 'Date'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {results.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  borderBottom:
                    i < results.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <td className="px-5 py-3.5 text-sm">
  {r.course_name || '—'}
</td>

<td className="px-5 py-3.5 text-sm">
  {r.group_name || '—'}
</td>

<td className="px-5 py-3.5 text-sm font-medium">
  {r.quiz_title}
</td>

<td
  className="px-5 py-3.5 text-sm"
  style={{ color: 'var(--muted-foreground)' }}
>
  {r.topic || '—'}
</td>

                <td className="px-5 py-3.5 text-sm mono">
                  {r.score}/{r.max_score}
                </td>

                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-semibold mono"
                      style={{
                        color:
                          r.percentage >= 80
                            ? '#15803D'
                            : r.percentage >= 60
                              ? '#B45309'
                              : '#B91C1C',
                        minWidth: '40px',
                      }}
                    >
                      {r.percentage}%
                    </span>

                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{
                        height: '5px',
                        background: 'var(--secondary)',
                        maxWidth: '80px',
                      }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.percentage}%`,
                          background:
                            r.percentage >= 80
                              ? '#16A34A'
                              : r.percentage >= 60
                                ? '#D97706'
                                : '#DC2626',
                        }}
                      />
                    </div>
                  </div>
                </td>

                <td
                  className="px-5 py-3.5 text-sm mono"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {r.completed_at
                    ? new Date(r.completed_at).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}

            {results.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
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