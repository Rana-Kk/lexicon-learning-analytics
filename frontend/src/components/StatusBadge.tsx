import type { AttendanceStatus, FeedbackStatus } from '../types'

type StatusType = AttendanceStatus | FeedbackStatus

const CONFIG: Record<StatusType, { bg: string; color: string; icon: string }> = {
  Present:  { bg: '#DCFCE7', color: '#15803D', icon: '●' },
  Late:     { bg: '#FEF3C7', color: '#B45309', icon: '◑' },
  Absent:   { bg: '#FEE2E2', color: '#B91C1C', icon: '○' },
  Excused:  { bg: '#F1F5F9', color: '#64748B', icon: '◇' },
  Approved: { bg: '#DCFCE7', color: '#15803D', icon: '✓' },
  Draft:    { bg: '#FEF3C7', color: '#B45309', icon: '✎' },
  Rejected: { bg: '#FEE2E2', color: '#B91C1C', icon: '✕' },
}

interface StatusBadgeProps {
  status: StatusType
  size?: 'sm' | 'md' | 'lg'
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = CONFIG[status]
  const padding = size === 'lg' ? '6px 14px' : size === 'md' ? '4px 10px' : '3px 8px'
  const fontSize = size === 'lg' ? '14px' : size === 'md' ? '13px' : '12px'

  return (
    <span
      className="inline-flex items-center gap-1 font-medium rounded-full select-none"
      style={{ background: cfg.bg, color: cfg.color, padding, fontSize }}
    >
      <span style={{ fontSize: '8px', lineHeight: 1 }}>{cfg.icon}</span>
      {status}
    </span>
  )
}
