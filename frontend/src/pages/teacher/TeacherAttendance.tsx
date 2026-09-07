import { useEffect, useMemo, useState } from 'react'
import type { AttendanceStatus } from '../../types'
import AttendanceStatusSelect from '../../components/AttendanceStatusSelect'
import {
  getAttendance,
  saveAttendance,
  getMyGroups,
  getGroupStudents,
  getGroupAttendanceSummary,
  getPendingAttendanceAppeals,
  reviewAttendanceAppeal,
} from '../../lib/api'

type SessionType = 'Morning' | 'Afternoon'

type Group = {
  id: number
  name: string
  course_name?: string
  student_count?: number
}

type Student = {
  id: number
  name: string
  email?: string
}

type AttendanceRecord = {
  id?: number
  student_id: number
  student_name?: string
  group_id: number
  attendance_date: string
  session: 'morning' | 'afternoon'
  status: 'present' | 'late' | 'absent' | 'excused'
  note?: string | null
}

type StudentSummary = {
  student_id: number
  student_name: string
  counts: {
    present: number
    late: number
    absent: number
    excused: number
  }
  total_sessions: number
  attendance_percentage: number | null
}

type StudentRecord = {
  studentId: number
  studentName: string
  status: AttendanceStatus
}

const STATUS_MAP: Record<AttendanceStatus, string> = {
  Present: 'present',
  Late: 'late',
  Absent: 'absent',
  Excused: 'excused',
}

const REVERSE_STATUS_MAP: Record<
  string,
  AttendanceStatus
> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
}

const statusLabel: Record<
  AttendanceStatus,
  string
> = {
  Present: 'Present',
  Late: 'Late',
  Absent: 'Absent',
  Excused: 'Excused',
}

// =====================================================
// PENDING APPEALS
// =====================================================

type PendingAppeal = {
  id: number
  attendance_id: number
  student_id: number
  student_name: string
  attendance_date: string
  session: 'morning' | 'afternoon'
  group_id: number
  group_name?: string
  course_name?: string
  status: 'pending'
}

function usePendingAppeals(groupId?: number) {
  const [appeals, setAppeals] = useState<PendingAppeal[]>([])
  const [loading, setLoading] = useState(true)
  const [decidingId, setDecidingId] = useState<number | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await getPendingAttendanceAppeals(groupId)
      setAppeals(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to load pending appeals:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  const decide = async (id: number, status: 'accepted' | 'rejected') => {
    try {
      setDecidingId(id)
      await reviewAttendanceAppeal(id, status)
      setAppeals((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error('Failed to review appeal:', err)
    } finally {
      setDecidingId(null)
    }
  }

  return { appeals, loading, decidingId, decide }
}

function AppealsPanel({
  appeals,
  loading,
  decidingId,
  onDecide,
  showGroupInfo,
  title,
}: {
  appeals: PendingAppeal[]
  loading: boolean
  decidingId: number | null
  onDecide: (id: number, status: 'accepted' | 'rejected') => void
  showGroupInfo?: boolean
  title?: string
}) {
  if (loading || appeals.length === 0) return null

  return (
    <div
      className="mb-6 rounded-xl p-4"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      <h2
        className="text-sm font-semibold mb-3"
        style={{ fontFamily: 'Outfit, sans-serif' }}
      >
        {title ?? 'Pending Appeals'} ({appeals.length})
      </h2>

      <div className="flex flex-col gap-2">
        {appeals.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'var(--muted)' }}
          >
            <div>
              <p className="text-sm font-medium">{a.student_name}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {showGroupInfo && (a.course_name || a.group_name) && (
                  <>
                    {a.course_name ? `${a.course_name} · ` : ''}
                    {a.group_name ? `${a.group_name} · ` : ''}
                  </>
                )}
                {a.attendance_date} · {a.session === 'morning' ? 'Morning' : 'Afternoon'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onDecide(a.id, 'accepted')}
                disabled={decidingId === a.id}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#15803D', color: 'white', border: 'none', cursor: 'pointer', opacity: decidingId === a.id ? 0.6 : 1 }}
              >
                Approve
              </button>
              <button
                onClick={() => onDecide(a.id, 'rejected')}
                disabled={decidingId === a.id}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#B91C1C', color: 'white', border: 'none', cursor: 'pointer', opacity: decidingId === a.id ? 0.6 : 1 }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeacherAttendance() {
  // =====================================================
  // VIEW
  // =====================================================

  const [view, setView] = useState<
    'groups' | 'group' | 'student' | 'take'
  >('groups')

  // =====================================================
  // GROUPS
  // =====================================================

  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] =
    useState(true)

  const [selectedGroup, setSelectedGroup] =
    useState<Group | null>(null)

  // =====================================================
  // PENDING APPEALS
  // =====================================================

  const {
    appeals: pendingAppeals,
    loading: appealsLoading,
    decidingId: appealDecidingId,
    decide: decideAppeal,
  } = usePendingAppeals(selectedGroup?.id)

  const appealsByAttendanceId = useMemo(() => {
    const map: Record<number, PendingAppeal> = {}
    pendingAppeals.forEach((a) => {
      map[a.attendance_id] = a
    })
    return map
  }, [pendingAppeals])

  // =====================================================
  // GROUP ATTENDANCE
  // =====================================================

  const [groupStudents, setGroupStudents] =
    useState<Student[]>([])

  const [groupSummary, setGroupSummary] =
    useState<StudentSummary[]>([])

  const [groupAttendance, setGroupAttendance] =
    useState<AttendanceRecord[]>([])

  const [groupLoading, setGroupLoading] =
    useState(false)

  // =====================================================
  // STUDENT HISTORY
  // =====================================================

  const [selectedStudent, setSelectedStudent] =
    useState<StudentSummary | null>(null)

  const [studentHistory, setStudentHistory] =
    useState<AttendanceRecord[]>([])

  const [studentHistoryLoading, setStudentHistoryLoading] =
    useState(false)

  // =====================================================
  // TAKE ATTENDANCE
  // =====================================================

  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [session, setSession] =
    useState<SessionType>('Morning')

  const [records, setRecords] =
    useState<StudentRecord[]>([])

  const [attendanceLoading, setAttendanceLoading] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [saved, setSaved] =
    useState(false)

  // =====================================================
  // GENERAL
  // =====================================================

  const [error, setError] = useState('')

  // =====================================================
  // LOAD TEACHER GROUPS
  // =====================================================

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setGroupsLoading(true)
        setError('')

        const response = await getMyGroups()

        const data = Array.isArray(response?.data)
          ? response.data
          : []

        setGroups(data)
      } catch (err: any) {
        console.error(
          'Failed to load groups:',
          err
        )

        setError(
          err?.message ||
            'Failed to load your assigned groups'
        )
      } finally {
        setGroupsLoading(false)
      }
    }

    loadGroups()
  }, [])

  // =====================================================
  // LOAD SELECTED GROUP
  // =====================================================

  const openGroup = async (group: Group) => {
    try {
      setSelectedGroup(group)
      setView('group')
      setGroupLoading(true)
      setError('')

      const [
        studentsResponse,
        summaryResponse,
        attendanceResponse,
      ] = await Promise.all([
        getGroupStudents(group.id),
        getGroupAttendanceSummary(group.id),
        getAttendance({
          group_id: group.id,
        }),
      ])

      const students = Array.isArray(
        studentsResponse?.data
      )
        ? studentsResponse.data
        : []

      const summary = Array.isArray(
        summaryResponse?.data?.students
      )
        ? summaryResponse.data.students
        : []

      const attendance = Array.isArray(
        attendanceResponse?.data
      )
        ? attendanceResponse.data
        : []

      setGroupStudents(students)
      setGroupSummary(summary)
      setGroupAttendance(attendance)
    } catch (err: any) {
      console.error(
        'Failed to load group attendance:',
        err
      )

      setError(
        err?.message ||
          'Failed to load group attendance'
      )

      setGroupStudents([])
      setGroupSummary([])
      setGroupAttendance([])
    } finally {
      setGroupLoading(false)
    }
  }

  // =====================================================
  // OPEN STUDENT HISTORY
  // =====================================================

  const openStudent = async (
    student: StudentSummary
  ) => {
    if (!selectedGroup) return

    try {
      setSelectedStudent(student)
      setView('student')
      setStudentHistoryLoading(true)
      setError('')

      const response = await getAttendance({
        group_id: selectedGroup.id,
        student_id: student.student_id,
      })

      const data = Array.isArray(response?.data)
        ? response.data
        : []

      setStudentHistory(data)
    } catch (err: any) {
      console.error(
        'Failed to load student attendance:',
        err
      )

      setError(
        err?.message ||
          'Failed to load student attendance history'
      )

      setStudentHistory([])
    } finally {
      setStudentHistoryLoading(false)
    }
  }

  // =====================================================
  // OPEN TAKE ATTENDANCE
  // =====================================================

  const openTakeAttendance = () => {
    if (!selectedGroup) return

    setView('take')
    setSaved(false)
    setError('')
  }

  // =====================================================
  // LOAD STUDENTS + CURRENT ATTENDANCE
  // =====================================================

  useEffect(() => {
    if (
      view !== 'take' ||
      !selectedGroup
    ) {
      return
    }

    const loadAttendance = async () => {
      try {
        setAttendanceLoading(true)
        setError('')
        setSaved(false)

        const studentsResponse =
          await getGroupStudents(
            selectedGroup.id
          )

        const students = Array.isArray(
          studentsResponse?.data
        )
          ? studentsResponse.data
          : []

        const attendanceResponse =
          await getAttendance({
            group_id: selectedGroup.id,
            attendance_date: date,
            session: session.toLowerCase() as
              | 'morning'
              | 'afternoon',
          })

        const attendanceRows = Array.isArray(
          attendanceResponse?.data
        )
          ? attendanceResponse.data
          : []

        const merged: StudentRecord[] =
          students.map((student: Student) => {
            const attendance =
              attendanceRows.find(
                (row: AttendanceRecord) =>
                  Number(row.student_id) ===
                  Number(student.id)
              )

            return {
              studentId: Number(student.id),
              studentName:
                student.name ||
                student.email ||
                'Student',

              status: attendance
                ? REVERSE_STATUS_MAP[
                    attendance.status
                  ] || 'Present'
                : 'Present',
            }
          })

        setRecords(merged)
      } catch (err: any) {
        console.error(
          'Failed to load attendance:',
          err
        )

        setRecords([])

        setError(
          err?.message ||
            'Failed to load attendance'
        )
      } finally {
        setAttendanceLoading(false)
      }
    }

    loadAttendance()
  }, [
    view,
    selectedGroup,
    date,
    session,
  ])

  // =====================================================
  // UPDATE STATUS
  // =====================================================

  const updateStatus = (
    studentId: number,
    status: AttendanceStatus
  ) => {
    setSaved(false)

    setRecords((previous) =>
      previous.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              status,
            }
          : record
      )
    )
  }

  // =====================================================
  // SAVE ATTENDANCE
  // =====================================================

  const handleSave = async () => {
    if (!selectedGroup) {
      setError('Please select a group')
      return
    }

    if (records.length === 0) {
      setError(
        'There are no students in this group'
      )
      return
    }

    try {
      setSaving(true)
      setSaved(false)
      setError('')

      await saveAttendance({
        group_id: selectedGroup.id,
        attendance_date: date,
        session:
          session.toLowerCase() as
            | 'morning'
            | 'afternoon',

        records: records.map((record) => ({
          student_id: record.studentId,
          status:
            STATUS_MAP[record.status] as
              | 'present'
              | 'late'
              | 'absent'
              | 'excused',
        })),
      })

      setSaved(true)

      setTimeout(() => {
        setSaved(false)
      }, 3000)
    } catch (err: any) {
      console.error(
        'Failed to save attendance:',
        err
      )

      setError(
        err?.message ||
          'Failed to save attendance'
      )
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // TAKE ATTENDANCE COUNTS
  // =====================================================

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc[record.status] =
          (acc[record.status] || 0) + 1

        return acc
      },
      {} as Record<string, number>
    )
  }, [records])

  const presentCount =
    (counts['Present'] || 0) +
    (counts['Late'] || 0)

  const attendancePct =
    records.length > 0
      ? Math.round(
          (presentCount /
            records.length) *
            100
        )
      : 0

  // =====================================================
  // GROUP OVERALL STATS
  // =====================================================

  const groupStats = useMemo(() => {
    let present = 0
    let late = 0
    let absent = 0
    let excused = 0

    groupSummary.forEach((student) => {
      present += student.counts.present
      late += student.counts.late
      absent += student.counts.absent
      excused += student.counts.excused
    })

    const total =
      present +
      late +
      absent +
      excused

    const percentage =
      total > 0
        ? Math.round(
            ((present + late) /
              total) *
              100
          )
        : 0

    return {
      present,
      late,
      absent,
      excused,
      total,
      percentage,
    }
  }, [groupSummary])

  // =====================================================
  // GROUP DATE HISTORY
  // =====================================================

  const groupHistory = useMemo(() => {
    const dates = new Set<string>()

    groupAttendance.forEach(
      (record) => {
        dates.add(record.attendance_date)
      }
    )

    return Array.from(dates).sort(
      (a, b) =>
        new Date(b).getTime() -
        new Date(a).getTime()
    )
  }, [groupAttendance])

  // =====================================================
  // CALENDAR (per-day roster, morning + afternoon together)
  // =====================================================

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)

  const dateStats = useMemo(() => {
    const map: Record<
      string,
      { present: number; late: number; absent: number; excused: number; total: number }
    > = {}

    groupAttendance.forEach((record) => {
      const d = record.attendance_date
      if (!map[d]) {
        map[d] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 }
      }
      map[d][record.status] += 1
      map[d].total += 1
    })

    return map
  }, [groupAttendance])

  useEffect(() => {
    if (groupHistory.length === 0) {
      setSelectedCalendarDate(null)
      return
    }
    const latest = groupHistory[0]
    setSelectedCalendarDate(latest)
    const d = new Date(latest)
    if (!Number.isNaN(d.getTime())) {
      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }, [groupHistory])

  const dailyRoster = useMemo(() => {
    if (!selectedCalendarDate) return []

    const byStudent: Record<
      number,
      { studentId: number; studentName: string; morning?: AttendanceRecord; afternoon?: AttendanceRecord }
    > = {}

    groupStudents.forEach((s) => {
      byStudent[s.id] = { studentId: s.id, studentName: s.name || s.email || 'Student' }
    })

    groupAttendance
      .filter((r) => r.attendance_date === selectedCalendarDate)
      .forEach((r) => {
        if (!byStudent[r.student_id]) {
          byStudent[r.student_id] = {
            studentId: r.student_id,
            studentName: r.student_name || 'Student',
          }
        }
        if (r.session === 'morning') byStudent[r.student_id].morning = r
        else if (r.session === 'afternoon') byStudent[r.student_id].afternoon = r
      })

    return Object.values(byStudent).sort((a, b) => a.studentName.localeCompare(b.studentName))
  }, [selectedCalendarDate, groupAttendance, groupStudents])

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: { date: string | null; day: number | null }[] = []
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null })
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      cells.push({ date: `${year}-${mm}-${dd}`, day })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null })
    return cells
  }, [calendarMonth])

  const datesWithAppeals = useMemo(() => {
    const set = new Set<string>()
    pendingAppeals.forEach((a) => set.add(a.attendance_date))
    return set
  }, [pendingAppeals])

  // =====================================================
  // HELPERS
  // =====================================================

  const formatDate = (
    value: string
  ) => {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    )
  }

  const getStatusColor = (
    status: string
  ) => {
    switch (status) {
      case 'present':
        return {
          background: '#DCFCE7',
          color: '#15803D',
        }

      case 'late':
        return {
          background: '#FEF3C7',
          color: '#B45309',
        }

      case 'absent':
        return {
          background: '#FEE2E2',
          color: '#B91C1C',
        }

      case 'excused':
        return {
          background: '#E0E7FF',
          color: '#4338CA',
        }

      default:
        return {
          background:
            'var(--muted)',
          color:
            'var(--muted-foreground)',
        }
    }
  }

  const AppealInlineTag = ({ record }: { record?: AttendanceRecord }) => {
    if (!record?.id) return null
    const appeal = appealsByAttendanceId[record.id]
    if (!appeal) return null

    return (
      <span className="flex items-center gap-1 ml-1">
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: '#FEF3C7', color: '#B45309' }}
        >
          Appeal
        </span>
        <button
          type="button"
          onClick={() => decideAppeal(appeal.id, 'accepted')}
          disabled={appealDecidingId === appeal.id}
          title="Approve appeal"
          className="w-5 h-5 rounded-full text-[10px] font-bold"
          style={{
            background: '#15803D',
            color: 'white',
            border: 'none',
            cursor: appealDecidingId === appeal.id ? 'not-allowed' : 'pointer',
            opacity: appealDecidingId === appeal.id ? 0.6 : 1,
          }}
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => decideAppeal(appeal.id, 'rejected')}
          disabled={appealDecidingId === appeal.id}
          title="Reject appeal"
          className="w-5 h-5 rounded-full text-[10px] font-bold"
          style={{
            background: '#B91C1C',
            color: 'white',
            border: 'none',
            cursor: appealDecidingId === appeal.id ? 'not-allowed' : 'pointer',
            opacity: appealDecidingId === appeal.id ? 0.6 : 1,
          }}
        >
          ✕
        </button>
      </span>
    )
  }

  // =====================================================
  // LOADING GROUPS
  // =====================================================

  if (groupsLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p
          className="text-sm"
          style={{
            color:
              'var(--muted-foreground)',
          }}
        >
          Loading groups...
        </p>
      </div>
    )
  }

  // =====================================================
  // GROUPS VIEW
  // =====================================================

  if (view === 'groups') {
    return (
      <div className="p-6 max-w-6xl mx-auto">

        <div className="mb-7">
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily:
                'Outfit, sans-serif',
            }}
          >
            Attendance
          </h1>

          <p
            className="text-sm mt-1"
            style={{
              color:
                'var(--muted-foreground)',
            }}
          >
            View attendance for your assigned groups
          </p>
        </div>

        {error && (
          <div
            className="mb-5 p-3 rounded-lg text-sm"
            style={{
              background: '#FEE2E2',
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        <AppealsPanel
          appeals={pendingAppeals}
          loading={appealsLoading}
          decidingId={appealDecidingId}
          onDecide={decideAppeal}
          showGroupInfo
        />

        {groups.length === 0 ? (
          <div
            className="rounded-xl p-10 text-center"
            style={{
              background:
                'var(--card)',
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
              No groups assigned to you.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() =>
                  openGroup(group)
                }
              />
            ))}

          </div>
        )}
      </div>
    )
  }

  // =====================================================
  // GROUP VIEW
  // =====================================================

  if (
    view === 'group' &&
    selectedGroup
  ) {
    return (
      <div className="p-6 max-w-6xl mx-auto">

        <button
          type="button"
          onClick={() => {
            setView('groups')
            setError('')
          }}
          className="text-sm mb-5"
          style={{
            color:
              'var(--muted-foreground)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}

        >
          ← Back to Groups
        </button>

        <div className="flex items-start justify-between mb-7 gap-4">

          <div>
            <h1
              className="text-2xl font-semibold"
              style={{
                fontFamily:
                  'Outfit, sans-serif',
              }}
            >
              {selectedGroup.name}
            </h1>

            <p
              className="text-sm mt-1"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              {selectedGroup.course_name ||
                'Attendance overview'}
            </p>
          </div>

          <button
            type="button"
            onClick={
              openTakeAttendance
            }
            className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{
              background:
                'var(--primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Take Attendance
          </button>

        </div>

        {error && (
          <div
            className="mb-5 p-3 rounded-lg text-sm"
            style={{
              background: '#FEE2E2',
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        {/* Appeals scoped to this group only */}
        <AppealsPanel
          appeals={pendingAppeals}
          loading={appealsLoading}
          decidingId={appealDecidingId}
          onDecide={decideAppeal}
          title="Pending Appeals in this Group"
        />

        {groupLoading ? (
          <div
            className="rounded-xl p-10 text-center"
            style={{
              background:
                'var(--card)',
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
              Loading attendance...
            </p>
          </div>
        ) : (
          <>
            {/* SUMMARY */}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">

              <SummaryCard
                label="Students"
                value={
                  groupStudents.length
                }
              />

              <SummaryCard
                label="Present"
                value={
                  groupStats.present
                }
                color="#15803D"
              />

              <SummaryCard
                label="Late"
                value={
                  groupStats.late
                }
                color="#B45309"
              />

              <SummaryCard
                label="Absent"
                value={
                  groupStats.absent
                }
                color="#B91C1C"
              />

              <SummaryCard
                label="Attendance"
                value={`${groupStats.percentage}%`}
                color="#1D4ED8"
              />

            </div>

            {/* CALENDAR */}

            <div
              className="rounded-xl overflow-hidden mb-6"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="px-5 py-3.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Attendance Calendar
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)
                      )
                    }
                    className="w-7 h-7 rounded-md text-sm"
                    style={{ border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer' }}
                  >
                    ‹
                  </button>
                  <span className="text-xs font-medium min-w-[110px] text-center">
                    {calendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)
                      )
                    }
                    className="w-7 h-7 rounded-md text-sm"
                    style={{ border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer' }}
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-medium uppercase tracking-wider py-1" style={{ color: 'var(--muted-foreground)' }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, i) => {
                    if (!cell.date) return <div key={i} />
                    const stat = dateStats[cell.date]
                    const pct = stat && stat.total > 0 ? Math.round(((stat.present + stat.late) / stat.total) * 100) : null
                    const isSelected = cell.date === selectedCalendarDate
                    const isToday = cell.date === new Date().toISOString().split('T')[0]
                    const hasAppeal = datesWithAppeals.has(cell.date)

                    let bg = 'transparent'
                    let fg = 'var(--foreground)'
                    if (pct !== null) {
                      if (pct >= 80) { bg = '#DCFCE7'; fg = '#15803D' }
                      else if (pct >= 50) { bg = '#FEF3C7'; fg = '#B45309' }
                      else { bg = '#FEE2E2'; fg = '#B91C1C' }
                    }

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => setSelectedCalendarDate(cell.date)}
                        title={
                          [
                            pct !== null ? `${pct}% attendance` : 'No attendance recorded',
                            hasAppeal ? 'Has a pending appeal' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        }
                        className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative"
                        style={{
                          background: bg,
                          color: fg,
                          border: isSelected ? '2px solid var(--primary)' : isToday ? '1px solid var(--primary)' : '1px solid transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {hasAppeal && (
                          <span
                            className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                            style={{ background: '#B45309' }}
                          />
                        )}
                        <span style={{ fontWeight: isSelected ? 700 : 500 }}>{cell.day}</span>
                        {pct !== null && <span className="text-[9px] mono">{pct}%</span>}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[11px] flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#DCFCE7' }} />≥80%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#FEF3C7' }} />50–79%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#FEE2E2' }} />&lt;50%</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ border: '1px solid var(--border)' }} />No session taken</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#B45309' }} />Pending appeal</span>
                </div>
              </div>

              {/* Daily roster for the selected date: morning + afternoon together */}
              {selectedCalendarDate && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                    <p className="text-xs font-semibold">{formatDate(selectedCalendarDate)}</p>
                    {!dateStats[selectedCalendarDate] && (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No attendance was recorded on this date</span>
                    )}
                  </div>
                  {dailyRoster.length === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No students in this group.</div>
                  ) : (
                    dailyRoster.map((row, idx) => (
                      <div
                        key={row.studentId}
                        className="px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                        style={{ borderBottom: idx < dailyRoster.length - 1 ? '1px solid var(--border)' : 'none' }}
                      >
                        <span className="text-sm font-medium truncate">{row.studentName}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>AM</span>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={row.morning ? getStatusColor(row.morning.status) : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                          >
                            {row.morning ? row.morning.status : 'not recorded'}
                          </span>
                          <AppealInlineTag record={row.morning} />

                          <span className="text-[10px] uppercase tracking-wider ml-2" style={{ color: 'var(--muted-foreground)' }}>PM</span>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={row.afternoon ? getStatusColor(row.afternoon.status) : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                          >
                            {row.afternoon ? row.afternoon.status : 'not recorded'}
                          </span>
                          <AppealInlineTag record={row.afternoon} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* STUDENTS */}

            <div
              className="rounded-xl overflow-hidden"
              style={{
                background:
                  'var(--card)',
                border:
                  '1px solid var(--border)',
              }}
            >

              <div
                className="px-5 py-3.5"
                style={{
                  borderBottom:
                    '1px solid var(--border)',
                }}
              >
                <div
                  className="grid text-xs font-medium uppercase tracking-wider"
                  style={{
                    gridTemplateColumns:
                      '2fr repeat(5, 1fr)',
                    color:
                      'var(--muted-foreground)',
                  }}
                >
                  <span>Student</span>
                  <span className="text-center">
                    Present
                  </span>
                  <span className="text-center">
                    Late
                  </span>
                  <span className="text-center">
                    Absent
                  </span>
                  <span className="text-center">
                    Excused
                  </span>
                  <span className="text-center">
                    Attendance
                  </span>
                </div>
              </div>

              {groupSummary.length === 0 ? (
                <div className="p-10 text-center">
                  <p
                    className="text-sm"
                    style={{
                      color:
                        'var(--muted-foreground)',
                    }}
                  >
                    No attendance records yet.
                  </p>
                </div>
              ) : (
                groupSummary.map(
                  (student, index) => (
                    <button
                      key={
                        student.student_id
                      }
                      type="button"
                      onClick={() =>
                        openStudent(
                          student
                        )
                      }
                      className="w-full px-5 py-4 grid items-center text-left"
                      style={{
                        gridTemplateColumns:
                          '2fr repeat(5, 1fr)',
                        border: 'none',
                        borderBottom:
                          index <
                          groupSummary.length -
                            1
                            ? '1px solid var(--border)'
                            : 'none',
                        background:
                          'transparent',
                        cursor: 'pointer',
                      }}
                    >

                      <div className="flex items-center gap-3">

                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{
                            background:
                              `hsl(${index * 47}, 55%, 50%)`,
                          }}
                        >
                          {student.student_name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <p className="text-sm font-medium">
                            {
                              student.student_name
                            }
                          </p>

                          <p
                            className="text-xs mt-0.5"
                            style={{
                              color:
                                'var(--muted-foreground)',
                            }}
                          >
                            View history →
                          </p>
                        </div>

                      </div>

                      <span
                        className="text-sm text-center font-medium"
                        style={{
                          color:
                            '#15803D',
                        }}
                      >
                        {
                          student.counts
                            .present
                        }
                      </span>

                      <span
                        className="text-sm text-center font-medium"
                        style={{
                          color:
                            '#B45309',
                        }}
                      >
                        {
                          student.counts
                            .late
                        }
                      </span>

                      <span
                        className="text-sm text-center font-medium"
                        style={{
                          color:
                            '#B91C1C',
                        }}
                      >
                        {
                          student.counts
                            .absent
                        }
                      </span>

                      <span
                        className="text-sm text-center font-medium"
                        style={{
                          color:
                            '#4338CA',
                        }}
                      >
                        {
                          student.counts
                            .excused
                        }
                      </span>

                      <span
                        className="text-sm text-center font-semibold"
                        style={{
                          color:
                            '#1D4ED8',
                        }}
                      >
                        {student.attendance_percentage !==
                        null
                          ? `${student.attendance_percentage}%`
                          : '—'}
                      </span>

                    </button>
                  )
                )
              )}

            </div>

            {/* HISTORY DATES */}

            {groupHistory.length > 0 && (
              <div className="mt-6">
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{
                    fontFamily:
                      'Outfit, sans-serif',
                  }}
                >
                  Recorded Attendance
                </h2>

                <div className="flex flex-wrap gap-2">
                  {groupHistory.map(
                    (historyDate) => (
                      <span
                        key={historyDate}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{
                          background:
                            'var(--muted)',
                          color:
                            'var(--muted-foreground)',
                          border:
                            '1px solid var(--border)',
                        }}
                      >
                        {formatDate(
                          historyDate
                        )}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    )
  }

  // =====================================================
  // STUDENT HISTORY VIEW
  // =====================================================

  if (
    view === 'student' &&
    selectedGroup &&
    selectedStudent
  ) {
    return (
      <div className="p-6 max-w-5xl mx-auto">

        <button
          type="button"
          onClick={() => {
            setView('group')
            setError('')
          }}
          className="text-sm mb-5"
          style={{
            color:
              'var(--muted-foreground)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ← Back to {selectedGroup.name}
        </button>

        <div className="mb-7">
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily:
                'Outfit, sans-serif',
            }}
          >
            {selectedStudent.student_name}
          </h1>

          <p
            className="text-sm mt-1"
            style={{
              color:
                'var(--muted-foreground)',
            }}
          >
            Attendance history
          </p>
        </div>

        {/* STUDENT SUMMARY */}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">

          <SummaryCard
            label="Total"
            value={
              selectedStudent.total_sessions
            }
          />

          <SummaryCard
            label="Present"
            value={
              selectedStudent.counts.present
            }
            color="#15803D"
          />

          <SummaryCard
            label="Late"
            value={
              selectedStudent.counts.late
            }
            color="#B45309"
          />

          <SummaryCard
            label="Absent"
            value={
              selectedStudent.counts.absent
            }
            color="#B91C1C"
          />

          <SummaryCard
            label="Attendance"
            value={
              selectedStudent.attendance_percentage !==
              null
                ? `${selectedStudent.attendance_percentage}%`
                : '—'
            }
            color="#1D4ED8"
          />

        </div>

        {error && (
          <div
            className="mb-5 p-3 rounded-lg text-sm"
            style={{
              background: '#FEE2E2',
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        {/* HISTORY */}

        <div
          className="rounded-xl overflow-hidden"
          style={{
            background:
              'var(--card)',
            border:
              '1px solid var(--border)',
          }}
        >

          <div
            className="px-5 py-4"
            style={{
              borderBottom:
                '1px solid var(--border)',
            }}
          >
            <h2
              className="text-sm font-semibold"
              style={{
                fontFamily:
                  'Outfit, sans-serif',
              }}
            >
              Attendance History
            </h2>
          </div>

          {studentHistoryLoading ? (
            <div className="p-10 text-center">
              <p
                className="text-sm"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                Loading history...
              </p>
            </div>
          ) : studentHistory.length ===
            0 ? (
            <div className="p-10 text-center">
              <p
                className="text-sm"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                No attendance records found.
              </p>
            </div>
          ) : (
            studentHistory.map(
              (record, index) => {
                const colors =
                  getStatusColor(
                    record.status
                  )

                return (
                  <div
                    key={
                      record.id ||
                      `${record.attendance_date}-${record.session}-${index}`
                    }
                    className="px-5 py-4 flex items-center justify-between"
                    style={{
                      borderBottom:
                        index <
                        studentHistory.length -
                          1
                          ? '1px solid var(--border)'
                          : 'none',
                    }}
                  >

                    <div>
                      <p className="text-sm font-medium">
                        {formatDate(
                          record.attendance_date
                        )}
                      </p>

                      <p
                        className="text-xs mt-1"
                        style={{
                          color:
                            'var(--muted-foreground)',
                        }}
                      >
                        {record.session ===
                        'morning'
                          ? '☀ Morning · 09:00–12:00'
                          : '🌤 Afternoon · 13:00–16:00'}
                      </p>
                    </div>

                    <span
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background:
                          colors.background,
                        color:
                          colors.color,
                      }}
                    >
                      {statusLabel[
                        REVERSE_STATUS_MAP[
                          record.status
                        ]
                      ] ||
                        record.status}
                    </span>

                  </div>
                )
              }
            )
          )}

        </div>

      </div>
    )
  }

  // =====================================================
  // TAKE ATTENDANCE VIEW
  // =====================================================

  if (
    view === 'take' &&
    selectedGroup
  ) {
    return (
      <div className="p-6 max-w-5xl mx-auto">

        <button
          type="button"
          onClick={() => {
            setView('group')
            setError('')
          }}
          className="text-sm mb-5"
          style={{
            color:
              'var(--muted-foreground)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ← Back to {selectedGroup.name}
        </button>

        <div className="mb-6">
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily:
                'Outfit, sans-serif',
            }}
          >
            Take Attendance
          </h1>

          <p
            className="text-sm mt-1"
            style={{
              color:
                'var(--muted-foreground)',
            }}
          >
            {selectedGroup.name}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              background: '#FEE2E2',
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        {/* CONTROLS */}

        <div
          className="rounded-xl p-5 mb-6 flex flex-wrap items-end gap-5"
          style={{
            background:
              'var(--card)',
            border:
              '1px solid var(--border)',
          }}
        >

          {/* DATE */}

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              Date
            </label>

            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setSaved(false)
                setError('')
              }}
              className="px-3 py-2 rounded-lg text-sm mono"
              style={{
                border:
                  '1px solid var(--border)',
                background:
                  'var(--muted)',
                outline: 'none',
              }}
            />
          </div>

          {/* SESSION */}

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              Session
            </label>

            <div
              className="flex rounded-lg overflow-hidden"
              style={{
                border:
                  '1px solid var(--border)',
              }}
            >
              {(
                [
                  'Morning',
                  'Afternoon',
                ] as SessionType[]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSession(s)
                    setSaved(false)
                    setError('')
                  }}
                  className="px-4 py-2 text-sm font-medium"
                  style={{
                    background:
                      session === s
                        ? 'var(--primary)'
                        : 'var(--muted)',

                    color:
                      session === s
                        ? 'white'
                        : 'var(--muted-foreground)',

                    border: 'none',
                    cursor:
                      'pointer',
                  }}
                >
                  {s === 'Morning'
                    ? '☀ Morning 09:00–12:00'
                    : '🌤 Afternoon 13:00–16:00'}
                </button>
              ))}
            </div>
          </div>

          {/* SAVE */}

          <div className="ml-auto flex items-center gap-3">

            {saved && (
              <span
                className="text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{
                  background:
                    '#DCFCE7',
                  color:
                    '#15803D',
                }}
              >
                ✓ Attendance saved
              </span>
            )}

            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                saving ||
                attendanceLoading ||
                records.length === 0
              }
              className="px-5 py-2 rounded-lg text-sm font-semibold"
              style={{
                background:
                  'var(--primary)',
                color: 'white',
                border: 'none',
                cursor:
                  saving ||
                  attendanceLoading ||
                  records.length === 0
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  saving ||
                  attendanceLoading ||
                  records.length === 0
                    ? 0.6
                    : 1,
              }}
            >
              {saving
                ? 'Saving...'
                : 'Save Attendance'}
            </button>

          </div>

        </div>

        {/* SUMMARY */}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">

          <SummaryCard
            label="Total"
            value={
              records.length
            }
          />

          <SummaryCard
            label="Present"
            value={
              counts['Present'] || 0
            }
            color="#15803D"
          />

          <SummaryCard
            label="Late"
            value={
              counts['Late'] || 0
            }
            color="#B45309"
          />

          <SummaryCard
            label="Absent"
            value={
              counts['Absent'] || 0
            }
            color="#B91C1C"
          />

          <SummaryCard
            label="Attendance"
            value={`${attendancePct}%`}
            color="#1D4ED8"
          />

        </div>

        {/* ROSTER */}

        <div
          className="rounded-xl overflow-hidden"
          style={{
            background:
              'var(--card)',
            border:
              '1px solid var(--border)',
          }}
        >

          <div
            className="px-5 py-3.5"
            style={{
              borderBottom:
                '1px solid var(--border)',
            }}
          >
            <div
              className="grid text-xs font-medium uppercase tracking-wider"
              style={{
                gridTemplateColumns:
                  '1fr 2fr',
                color:
                  'var(--muted-foreground)',
              }}
            >
              <span>Student</span>
              <span>Status</span>
            </div>
          </div>

          {attendanceLoading ? (
            <div className="px-5 py-10 text-center">
              <p
                className="text-sm"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                Loading attendance...
              </p>
            </div>
          ) : records.length ===
            0 ? (
            <div className="px-5 py-10 text-center">
              <p
                className="text-sm"
                style={{
                  color:
                    'var(--muted-foreground)',
                }}
              >
                No students found in this group.
              </p>
            </div>
          ) : (
            records.map(
              (record, index) => (
                <div
                  key={
                    record.studentId
                  }
                  className="px-5 py-4 grid items-center"
                  style={{
                    gridTemplateColumns:
                      '1fr 2fr',
                    borderBottom:
                      index <
                      records.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                  }}
                >

                  <div className="flex items-center gap-3">

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{
                        background:
                          `hsl(${index * 47}, 55%, 50%)`,
                      }}
                    >
                      {record.studentName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <span className="text-sm font-medium">
                      {
                        record.studentName
                      }
                    </span>

                  </div>

                  <AttendanceStatusSelect
                    value={
                      record.status
                    }
                    onChange={(
                      status
                    ) =>
                      updateStatus(
                        record.studentId,
                        status
                      )
                    }
                  />

                </div>
              )
            )
          )}

        </div>

      </div>
    )
  }

  return null
}

// =====================================================
// GROUP CARD
// =====================================================

function GroupCard({
  group,
  onClick,
}: {
  group: Group
  onClick: () => void
}) {
  const [stats, setStats] =
    useState<{
      percentage: number
      present: number
      late: number
      absent: number
    } | null>(null)

  const [loading, setLoading] =
    useState(true)

useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await getGroupAttendanceSummary(group.id)
        const students =
          Array.isArray(
            result?.data?.students
          )
            ? result.data.students
            : []

        let present = 0
        let late = 0
        let absent = 0
        let total = 0

        students.forEach(
          (student: StudentSummary) => {
            present +=
              student.counts.present

            late +=
              student.counts.late

            absent +=
              student.counts.absent

            total +=
              student.total_sessions
          }
        )

        const percentage =
          total > 0
            ? Math.round(
                ((present + late) /
                  total) *
                  100
              )
            : 0

        setStats({
          percentage,
          present,
          late,
          absent,
        })
      } catch (error) {
        console.error(
          'Failed to load group stats:',
          error
        )
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [group.id])

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl p-5 transition"
      style={{
        background:
          'var(--card)',
        border:
          '1px solid var(--border)',
        cursor: 'pointer',
        width: '100%',
      }}
    >

      <div className="flex items-start justify-between gap-4">

        <div>
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily:
                'Outfit, sans-serif',
            }}
          >
            {group.name}
          </h2>

          <p
            className="text-xs mt-1"
            style={{
              color:
                'var(--muted-foreground)',
            }}
          >
            {group.course_name ||
              'Course'}
          </p>
        </div>

        <span
          className="text-sm"
          style={{
            color:
              'var(--muted-foreground)',
          }}
        >
          View →
        </span>

      </div>

      <div
        className="mt-5 pt-4"
        style={{
          borderTop:
            '1px solid var(--border)',
        }}
      >

        <div className="flex items-center justify-between mb-3">

          <div>
            <p
              className="text-xs"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              Students
            </p>

            <p className="text-sm font-semibold mt-0.5">
              {group.student_count ??
                '—'}
            </p>
          </div>

          <div className="text-right">

            <p
              className="text-xs"
              style={{
                color:
                  'var(--muted-foreground)',
              }}
            >
              Attendance
            </p>

            <p
              className="text-xl font-semibold mt-0.5"
              style={{
                color:
                  '#1D4ED8',
                fontFamily:
                  'Outfit, sans-serif',
              }}
            >
              {loading
                ? '...'
                : `${stats?.percentage ?? 0}%`}
            </p>

          </div>

        </div>

        <div className="grid grid-cols-3 gap-2">

          <MiniStat
            label="Present"
            value={
              loading
                ? '—'
                : stats?.present ?? 0
            }
            color="#15803D"
          />

          <MiniStat
            label="Late"
            value={
              loading
                ? '—'
                : stats?.late ?? 0
            }
            color="#B45309"
          />

          <MiniStat
            label="Absent"
            value={
              loading
                ? '—'
                : stats?.absent ?? 0
            }
            color="#B91C1C"
          />

        </div>

      </div>

    </button>
  )
}

// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-center"
      style={{
        background:
          'var(--card)',
        border:
          '1px solid var(--border)',
      }}
    >
      <p
        className="text-xl font-semibold"
        style={{
          color:
            color ||
            'var(--muted-foreground)',
          fontFamily:
            'Outfit, sans-serif',
        }}
      >
        {value}
      </p>

      <p
        className="text-xs mt-0.5"
        style={{
          color:
            'var(--muted-foreground)',
        }}
      >
        {label}
      </p>
    </div>
  )
}

// =====================================================
// MINI STAT
// =====================================================

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background:
          'var(--muted)',
      }}
    >
      <p
        className="text-sm font-semibold"
        style={{
          color,
        }}
      >
        {value}
      </p>

      <p
        className="text-xs mt-0.5"
        style={{
          color:
            'var(--muted-foreground)',
        }}
      >
        {label}
      </p>
    </div>
  )
}