interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: { value: string; positive: boolean }
  icon: React.ReactNode
  accent?: boolean
}

export default function StatCard({ label, value, sub, trend, icon, accent }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: accent ? 'var(--primary)' : 'var(--card)',
        color: accent ? 'var(--primary-foreground)' : 'var(--card-foreground)',
        border: accent ? 'none' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ opacity: accent ? 0.7 : undefined, color: accent ? undefined : 'var(--muted-foreground)' }}
          >
            {label}
          </p>
          <p className="text-3xl font-semibold leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {value}
          </p>
          {sub && (
            <p className="text-sm mt-1.5" style={{ opacity: accent ? 0.65 : undefined, color: accent ? undefined : 'var(--muted-foreground)' }}>
              {sub}
            </p>
          )}
          {trend && (
            <p
              className="text-xs font-medium mt-2"
              style={{
                color: accent
                  ? 'rgba(255,255,255,0.8)'
                  : trend.positive
                  ? 'var(--status-present)'
                  : 'var(--status-absent)',
              }}
            >
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: accent ? 'rgba(255,255,255,0.15)' : 'var(--secondary)',
            color: accent ? 'white' : 'var(--primary)',
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
