import type { FeedbackStatus } from '../types'

const CONFIG: Record<FeedbackStatus, { bg: string; border: string; color: string; icon: string; message: string }> = {
  Draft: {
    bg: '#FFFBEB',
    border: '#FCD34D',
    color: '#92400E',
    icon: '⚠',
    message: 'This feedback is a draft — it is not visible to the student until approved by a teacher.',
  },
  Approved: {
    bg: '#F0FDF4',
    border: '#86EFAC',
    color: '#14532D',
    icon: '✓',
    message: 'This feedback has been approved and is visible to the student.',
  },
  Rejected: {
    bg: '#FFF1F2',
    border: '#FCA5A5',
    color: '#7F1D1D',
    icon: '✕',
    message: 'This feedback was rejected and is not published. The student cannot see it.',
  },
}

export default function FeedbackStatusBanner({ status }: { status: FeedbackStatus }) {
  const cfg = CONFIG[status]
  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
      role="status"
      aria-live="polite"
    >
      <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
      <span>{cfg.message}</span>
    </div>
  )
}
