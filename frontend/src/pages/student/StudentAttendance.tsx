import { useEffect, useState } from 'react'
import StatusBadge from '../../components/StatusBadge'
import type { AttendanceStatus } from '../../types'
import {
  getAttendance,
  getMyAttendanceAppeals,
  createAttendanceAppeal,
} from '../../lib/api'

type AttendanceRow = {
  id: number
  attendance_date: string
  session: 'morning' | 'afternoon'
  status: 'present' | 'late' | 'absent' | 'excused'
  group_id: number
  group_name?: string
}

type Appeal = {
  attendance_id: number
  status: 'pending' | 'accepted' | 'rejected'
}
const STATUS_LABEL: Record<AttendanceRow['status'], AttendanceStatus> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
}
export default function StudentAttendance() {
  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [appealing, setAppealing] = useState<number | null>(null)
  const [error, setError] = useState('')

  const loadAttendance = async () => {
    try {
      setLoading(true)
      setError('')

      const [attendanceRes, appealsRes] = await Promise.all([
        getAttendance(),
        getMyAttendanceAppeals(),
      ])

      setRecords(attendanceRes.data || [])
      setAppeals(appealsRes.data || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttendance()
  }, [])

  const present = records.filter(
    (r) => r.status === 'present' || r.status === 'late'
  ).length

  const rate = records.length
    ? Math.round((present / records.length) * 100)
    : 0

  const groupSections = Array.from(
    records.reduce((map, record) => {
      const key = Number(record.group_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(record)
      return map
    }, new Map<number, typeof records>())
  )

  const getAppeal = (attendanceId: number) =>
    appeals.find((a) => a.attendance_id === attendanceId)

  const handleAppeal = async (attendanceId: number) => {
    try {
      setAppealing(attendanceId)
      setError('')

      await createAttendanceAppeal(attendanceId)
      await loadAttendance()
    } catch (err: any) {
      setError(err?.message || 'Failed to submit appeal')
    } finally {
      setAppealing(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm">Loading attendance...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Attendance
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Your session-by-session attendance record
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'Attendance Rate',
            value: `${rate}%`,
            color: '#1D4ED8',
          },
          {
            label: 'Sessions Attended',
            value: present,
            color: '#15803D',
          },
          {
            label: 'Total Sessions',
            value: records.length,
            color: 'var(--foreground)',
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <p
              className="text-2xl font-semibold"
              style={{
                color,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {value}
            </p>

            <p
              className="text-xs mt-1"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {groupSections.length <= 1 ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Date', 'Session', 'Status', 'Action'].map((h) => <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {records.map((r, i) => {
                const appeal = getAppeal(r.id)
                return (
                  <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-3.5 text-sm mono">{r.attendance_date}</td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>{r.session === 'morning' ? '☀ Morning' : '🌤 Afternoon'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={STATUS_LABEL[r.status]} /></td>
                    <td className="px-5 py-3.5">
                      {r.status === 'absent' && !appeal && <button onClick={() => handleAppeal(r.id)} disabled={appealing === r.id} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: appealing === r.id ? 'not-allowed' : 'pointer', opacity: appealing === r.id ? 0.6 : 1 }}>{appealing === r.id ? 'Submitting...' : 'Appeal'}</button>}
                      {appeal && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: appeal.status === 'pending' ? '#FEF3C7' : appeal.status === 'accepted' ? '#DCFCE7' : '#FEE2E2', color: appeal.status === 'pending' ? '#B45309' : appeal.status === 'accepted' ? '#15803D' : '#B91C1C' }}>{appeal.status === 'pending' ? 'Appeal Pending' : appeal.status === 'accepted' ? 'Appeal Accepted' : 'Appeal Rejected'}</span>}
                    </td>
                  </tr>
                )
              })}
              {records.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No attendance records found.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-5">
          {groupSections.map(([groupId, groupRecords]) => (
            <div key={groupId} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}><p className="text-sm font-semibold">{groupRecords[0]?.group_name || `Group #${groupId}`}</p></div>
              <table className="w-full">
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Date', 'Session', 'Status', 'Action'].map((h) => <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {groupRecords.map((r, i) => {
                    const appeal = getAppeal(r.id)
                    return <tr key={r.id} style={{ borderBottom: i < groupRecords.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-5 py-3.5 text-sm mono">{r.attendance_date}</td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>{r.session === 'morning' ? '☀ Morning' : '🌤 Afternoon'}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={STATUS_LABEL[r.status]} /></td>
                      <td className="px-5 py-3.5">
                        {r.status === 'absent' && !appeal && <button onClick={() => handleAppeal(r.id)} disabled={appealing === r.id} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>{appealing === r.id ? 'Submitting...' : 'Appeal'}</button>}
                        {appeal && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: appeal.status === 'pending' ? '#FEF3C7' : appeal.status === 'accepted' ? '#DCFCE7' : '#FEE2E2', color: appeal.status === 'pending' ? '#B45309' : appeal.status === 'accepted' ? '#15803D' : '#B91C1C' }}>{appeal.status === 'pending' ? 'Appeal Pending' : appeal.status === 'accepted' ? 'Appeal Accepted' : 'Appeal Rejected'}</span>}
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}