import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

import {
  getGroupAnalytics,
  getCourses,
  getGroups,
  getTeams,
  getUsers,
} from '../../lib/api'

type GroupAnalyticsRow = {
  group?: string
  group_name?: string
  name?: string
  attendance?: number | string | null
  attendance_percentage?: number | string | null
  attendancePercent?: number | string | null
  quizAvg?: number | string | null
  quiz_avg?: number | string | null
  quiz_average?: number | string | null
  courseProgress?: number | string | null
  course_progress?: number | string | null
  progress?: number | string | null
  score?: number | string | null
  average_score?: number | string | null
  [key: string]: any
}

type Course = {
  id: number | string
  name: string
}

type Group = {
  id: number | string
  name: string
  course_id?: number | string
  student_count?: number | string
}

type Team = {
  id: number | string
  name: string
  group_id: number | string
  members?: any[]
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function getData(response: any): any {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (response?.data && typeof response.data === 'object') {
    return response.data
  }
  return response
}

function getGroupName(row: GroupAnalyticsRow): string {
  return (
    row.group_name ||
    row.group ||
    row.name ||
    `Group #${row.id ?? ''}`
  )
}

function getAttendance(row: GroupAnalyticsRow): number {
  return toNumber(
    row.attendance ??
    row.attendance_percentage ??
    row.attendancePercent
  )
}

function getQuizAverage(row: GroupAnalyticsRow): number {
  return toNumber(
    row.quizAvg ??
    row.quiz_avg ??
    row.quiz_average
  )
}

function getProgress(row: GroupAnalyticsRow): number {
  return toNumber(
    row.courseProgress ??
    row.course_progress ??
    row.progress ??
    row.average_score
  )
}

export default function AdminAnalytics() {
  const [groupAnalytics, setGroupAnalytics] = useState<GroupAnalyticsRow[]>([])

  // Organisation structure data
  const [courses, setCourses] = useState<Course[]>([])
  const [orgGroups, setOrgGroups] = useState<Group[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [studentCount, setStudentCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      setLoading(true)
      setError('')

      const [
        groupsResponse,
        coursesResponse,
        orgGroupsResponse,
        teamsResponse,
        studentsResponse,
      ] = await Promise.all([
        getGroupAnalytics(),
        getCourses(),
        getGroups(),
        getTeams(),
        getUsers('student'),
      ])

      /*
       * Group performance analytics (attendance / quiz chart)
       */
      const groupsData = getData(groupsResponse)

      if (Array.isArray(groupsData)) {
        setGroupAnalytics(groupsData)
      } else if (Array.isArray(groupsData?.groups)) {
        setGroupAnalytics(groupsData.groups)
      } else {
        setGroupAnalytics([])
      }

      /*
       * Organisation structure: courses -> groups -> teams
       */
      setCourses(coursesResponse?.data ?? [])
      setOrgGroups(orgGroupsResponse?.data ?? [])
      setTeams(teamsResponse?.data ?? [])
      setStudentCount((studentsResponse?.data ?? []).length)
    } catch (err: any) {
      setError(
        err?.message ||
        'Could not load analytics data.'
      )
    } finally {
      setLoading(false)
    }
  }

  const groupChartData = useMemo(() => {
    return groupAnalytics.map((row) => ({
      group: getGroupName(row),
      attendance: getAttendance(row),
      quizAvg: getQuizAverage(row),
    }))
  }, [groupAnalytics])

  /*
   * Overall statistics calculated from the real group data.
   */
  const summary = useMemo(() => {
    if (!groupAnalytics.length) {
      return {
        attendance: 0,
        quiz: 0,
        progress: 0,
      }
    }

    const average = (
      values: number[]
    ) =>
      values.length
        ? Math.round(
            values.reduce(
              (sum, value) => sum + value,
              0
            ) / values.length
          )
        : 0

    return {
      attendance: average(
        groupAnalytics.map(getAttendance)
      ),
      quiz: average(
        groupAnalytics.map(getQuizAverage)
      ),
      progress: average(
        groupAnalytics.map(getProgress)
      ),
    }
  }, [groupAnalytics])

  /*
   * Course -> Groups -> Teams breakdown
   */
  const teamsByGroup = useMemo(() => {
    const map = new Map<string, Team[]>()
    for (const team of teams) {
      const key = String(team.group_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(team)
    }
    return map
  }, [teams])

  const groupsByCourse = useMemo(() => {
    const map = new Map<string, Group[]>()
    for (const group of orgGroups) {
      const key = String(group.course_id ?? '')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(group)
    }
    return map
  }, [orgGroups])

  const structureData = useMemo(() => {
    return courses.map((course) => {
      const groupsInCourse =
        groupsByCourse.get(String(course.id)) ?? []

      const groupRows = groupsInCourse.map((group) => {
        const groupTeams =
          teamsByGroup.get(String(group.id)) ?? []

        return {
          group,
          teamCount: groupTeams.length,
          studentCount: toNumber(group.student_count),
        }
      })

      return {
        course,
        groups: groupRows,
        totalGroups: groupRows.length,
        totalTeams: groupRows.reduce(
          (sum, g) => sum + g.teamCount,
          0
        ),
      }
    })
  }, [courses, groupsByCourse, teamsByGroup])

  const totalGroupsCount = orgGroups.length
  const totalTeamsCount = teams.length
  const totalCoursesCount = courses.length

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{
            fontFamily:
              'Outfit, sans-serif',
          }}
        >
          Analytics
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{
            color:
              'var(--muted-foreground)',
          }}
        >
          Organisation-wide performance
          metrics
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-5 rounded-lg px-4 py-3 text-sm"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{
            background: 'var(--card)',
            border:
              '1px solid var(--border)',
          }}
        >
          <p
            className="text-sm"
            style={{
              color:
                'var(--muted-foreground)',
            }}
          >
            Loading analytics…
          </p>
        </div>
      ) : (
        <div className="grid gap-6">

          {/* Performance summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([['Attendance', summary.attendance], ['Avg. Quiz Score', summary.quiz], ['Course Progress', summary.progress]] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                <p className="text-2xl font-semibold mono mt-1">{value}%</p>
              </div>
            ))}
          </div>

          {/* Organisation structure summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['Students', studentCount],
              ['Courses', totalCoursesCount],
              ['Groups', totalGroupsCount],
              ['Teams', totalTeamsCount],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                <p className="text-2xl font-semibold mono mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              background: 'var(--card)',
              border:
                '1px solid var(--border)',
            }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{
                fontFamily:
                  'Outfit, sans-serif',
              }}
            >
              Group Comparison
            </h2>

            {groupChartData.length === 0 ? (
              <div className="py-16 text-center">
                <p
                  className="text-sm"
                  style={{
                    color:
                      'var(--muted-foreground)',
                  }}
                >
                  No group analytics data
                  available yet.
                </p>
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={280}
              >
                <BarChart
                  data={groupChartData}
                  barCategoryGap="30%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="group"
                    tick={{
                      fontSize: 12,
                      fill: '#64748B',
                      fontFamily:
                        'DM Mono, monospace',
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
                    width={32}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border:
                        '1px solid var(--border)',
                      fontSize: '12px',
                    }}
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize: '12px',
                      paddingTop: '12px',
                    }}
                  />

                  <Bar
                    dataKey="attendance"
                    name="Attendance %"
                    fill="#1D4ED8"
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />

                  <Bar
                    dataKey="quizAvg"
                    name="Quiz Avg %"
                    fill="#0891B2"
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />

                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Course -> Group -> Team breakdown */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'var(--card)',
              border:
                '1px solid var(--border)',
            }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{
                fontFamily:
                  'Outfit, sans-serif',
              }}
            >
              Courses, Groups &amp; Teams
            </h2>

            {structureData.length === 0 ? (
              <div className="py-16 text-center">
                <p
                  className="text-sm"
                  style={{
                    color:
                      'var(--muted-foreground)',
                  }}
                >
                  No courses available yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {structureData.map(({ course, groups, totalGroups, totalTeams }) => (
                  <div
                    key={course.id}
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ background: 'var(--muted)' }}
                    >
                      <p className="text-sm font-semibold">{course.name}</p>

                      <p
                        className="text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {totalGroups} group{totalGroups !== 1 ? 's' : ''} · {totalTeams} team{totalTeams !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {groups.length === 0 ? (
                      <p
                        className="px-4 py-3 text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        No groups linked to this course yet.
                      </p>
                    ) : (
                      <div>
                        {groups.map(({ group, teamCount, studentCount: groupStudentCount }, index) => (
                          <div
                            key={group.id}
                            className="px-4 py-2.5 flex items-center justify-between text-sm"
                            style={{
                              borderTop:
                                index === 0
                                  ? 'none'
                                  : '1px solid var(--border)',
                            }}
                          >
                            <span>{group.name}</span>

                            <span
                              className="text-xs"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              {groupStudentCount} student{groupStudentCount !== 1 ? 's' : ''} · {teamCount} team{teamCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}