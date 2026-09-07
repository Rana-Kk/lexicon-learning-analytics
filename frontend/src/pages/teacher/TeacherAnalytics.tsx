import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import StatCard from '../../components/StatCard'
import { getMyGroups, getAnalyticsOverview, getStudentAnalytics } from '../../lib/api'

type Group = {
  id: number | string
  name: string
  course_name: string
  student_count: number
}

type Overview = {
  attendance: { total: number; present: number; late: number; rate: number }
  quiz_average: number
  assessment_average: number
  quiz_count: number
  assessment_count: number
}

type StudentRow = {
  id: number | string
  name: string
  attendance: number
  quizAvg: number
  assessmentAvg: number
}

export default function TeacherAnalytics() {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState<string>('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGroup, setLoadingGroup] = useState(false)
  const [error, setError] = useState('')

  // Load the teacher's own groups once.
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const res = await getMyGroups()
        const list: Group[] = Array.isArray(res?.data) ? res.data : []

        setGroups(list)
        if (list.length) setGroupId(String(list[0].id))
      } catch (err: any) {
        setError(err?.message || 'Failed to load groups')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Load analytics for the selected group.
  useEffect(() => {
    if (!groupId) return

    const load = async () => {
      try {
        setLoadingGroup(true)
        setError('')

        const [overviewRes, studentsRes] = await Promise.all([
          getAnalyticsOverview({ group_id: groupId }),
          getStudentAnalytics(groupId),
        ])

        setOverview(overviewRes?.data || null)
        setStudents(Array.isArray(studentsRes?.data) ? studentsRes.data : [])
      } catch (err: any) {
        setError(err?.message || 'Failed to load analytics')
      } finally {
        setLoadingGroup(false)
      }
    }

    load()
  }, [groupId])

  if (loading) {
    return <div className="p-6">Loading analytics...</div>
  }

  const selectedGroup = groups.find((g) => String(g.id) === groupId)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Group Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {selectedGroup ? `${selectedGroup.name} · ${selectedGroup.course_name}` : 'Performance overview'}
          </p>
        </div>

        {groups.length > 0 && (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', cursor: 'pointer' }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} · {g.course_name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm mb-6" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {!groups.length && !error ? (
        <div className="p-10 rounded-xl text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="font-medium">You are not assigned to any group yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Analytics will appear here once you are assigned to a group.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Avg Attendance"
              value={`${overview?.attendance.rate ?? 0}%`}
              icon={<span>✓</span>}
            />
            <StatCard
              label="Avg Quiz Score"
              value={`${Math.round(overview?.quiz_average ?? 0)}%`}
              sub={`${overview?.quiz_count ?? 0} results`}
              icon={<span>❓</span>}
            />
            <StatCard
              label="Avg Assessment"
              value={`${Math.round(overview?.assessment_average ?? 0)}%`}
              sub={`${overview?.assessment_count ?? 0} scores`}
              icon={<span>📝</span>}
            />
            <StatCard
              label="Students"
              value={selectedGroup?.student_count ?? students.length}
              icon={<span>👥</span>}
              accent
            />
          </div>

          {/* Student comparison chart */}
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Student Comparison</h2>
            {loadingGroup ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading...</p>
            ) : students.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No student data yet for this group.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={students} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }} />
                  <Bar dataKey="assessmentAvg" name="Assessment Avg %" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="quizAvg" name="Quiz Avg %" fill="#0891B2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Comparison table */}
          {students.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-base font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Student Summary Table</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                    {['Student', 'Attendance', 'Assessment Avg', 'Quiz Avg'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-5 py-3.5 text-sm font-medium">{s.name}</td>
                      <td className="px-5 py-3.5 text-sm mono">{s.attendance}%</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold mono px-2 py-0.5 rounded-full" style={{ background: '#DBEAFE', color: '#1E40AF' }}>{s.assessmentAvg}%</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold mono px-2 py-0.5 rounded-full" style={{ background: '#CFFAFE', color: '#0E7490' }}>{s.quizAvg || '—'}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
