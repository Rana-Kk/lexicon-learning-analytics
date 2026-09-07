import { useEffect, useMemo, useState } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

import { getMyCompetencies } from '../../lib/api'

type Competency = {
  competency_id: number
  name: string
  description: string | null
  score: number
  previous_score: number | null
  trend: 'improving' | 'declining' | 'stable'
}

export default function StudentCompetency() {
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const res = await getMyCompetencies()

        setCompetencies(
          Array.isArray(res?.data) ? res.data : []
        )
      } catch (err: any) {
        setError(err?.message || 'Failed to load competencies')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const averageLevel = useMemo(() => {
    if (!competencies.length) return 0

    return Math.round(
      competencies.reduce((sum, item) => sum + Number(item.score), 0) /
        competencies.length
    )
  }, [competencies])

  const strongestCompetency = useMemo(() => {
    if (!competencies.length) return null

    return [...competencies].sort(
      (a, b) => Number(b.score) - Number(a.score)
    )[0]
  }, [competencies])

  const developmentArea = useMemo(() => {
    if (!competencies.length) return null

    return [...competencies].sort(
      (a, b) => Number(a.score) - Number(b.score)
    )[0]
  }, [competencies])

  if (loading) {
    return (
      <div className="p-6">
        Loading competencies...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Competency Matrix
        </h1>

        <p
          className="text-sm mt-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Track your development across technical competencies.
        </p>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl text-sm"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      {!competencies.length ? (
        <div
          className="p-10 rounded-xl text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="font-medium">
            No competency data available yet.
          </p>

          <p
            className="text-sm mt-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Your competency levels will appear here after they are
            evaluated.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div
              className="rounded-xl p-5"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Overall Competency
              </p>

              <p
                className="text-3xl font-bold mt-2"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                {averageLevel}%
              </p>
            </div>

            <div
              className="rounded-xl p-5"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Strongest Area
              </p>

              <p className="text-lg font-semibold mt-2">
                {strongestCompetency?.name}
              </p>

              <p className="text-sm mt-1">
                {strongestCompetency?.score}%
              </p>
            </div>

            <div
              className="rounded-xl p-5"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Development Focus
              </p>

              <p className="text-lg font-semibold mt-2">
                {developmentArea?.name}
              </p>

              <p className="text-sm mt-1">
                {developmentArea?.score}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Radar */}
            <div
              className="rounded-xl p-5"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <h2 className="font-semibold mb-4">
                Competency Overview
              </h2>

              <ResponsiveContainer width="100%" height={360}>
                <RadarChart data={competencies}>
                  <PolarGrid />

                  <PolarAngleAxis dataKey="name" />

                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tickCount={6}
                  />

                  <Tooltip />

                  <Radar
                    dataKey="score"
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={0.25}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Bar */}
            <div
              className="rounded-xl p-5"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <h2 className="font-semibold mb-4">
                Competency Levels
              </h2>

              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={competencies}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 20,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    type="number"
                    domain={[0, 100]}
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="score"
                    fill="#2563EB"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Progress Matrix */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="mb-5">
              <h2 className="font-semibold">
                Competency Progress
              </h2>

              <p
                className="text-sm mt-1"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Current proficiency and development direction.
              </p>
            </div>

            <div className="space-y-5">
              {competencies.map((competency) => (
                <div key={competency.competency_id}>

                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">
                      {competency.name}
                    </span>

                    <span className="text-sm font-semibold">
                      {competency.score}%
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${competency.score}%`,
                      }}
                    />
                  </div>

                  <div
                    className="text-xs mt-1"
                    style={{
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {competency.trend === 'improving' &&
                      '📈 Improving'}

                    {competency.trend === 'declining' &&
                      '📉 Needs attention'}

                    {competency.trend === 'stable' &&
                      '➡ Stable'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}