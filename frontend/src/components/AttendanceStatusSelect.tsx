import type { AttendanceStatus } from '../types'

const STATUSES: AttendanceStatus[] = ['Present', 'Late', 'Absent', 'Excused']

const COLORS: Record<AttendanceStatus, { active: string; bg: string; border: string }> = {
  Present: { active: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
  Late:    { active: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
  Absent:  { active: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
  Excused: { active: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
}

interface Props {
  value: AttendanceStatus
  onChange: (status: AttendanceStatus) => void
}

export default function AttendanceStatusSelect({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {STATUSES.map((s) => {
        const cfg = COLORS[s]
        const selected = value === s
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className="text-xs font-medium rounded-full transition-all"
            style={{
              padding: '4px 10px',
              background: selected ? cfg.bg : 'transparent',
              color: selected ? cfg.active : 'var(--muted-foreground)',
              border: selected ? `1px solid ${cfg.border}` : '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}
