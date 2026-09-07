import type { User } from '../types'

export type AdminPage = 'dashboard' | 'teachers' | 'courses' | 'groups' | 'students' | 'teams' | 'analytics'

const NAV_ITEMS: { id: AdminPage; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'teachers', label: 'Teachers', icon: '👤' },
  { id: 'courses', label: 'Courses', icon: '📚' },
  { id: 'groups', label: 'Groups', icon: '🗂' },
  { id: 'students', label: 'Students', icon: '🎓' },
  { id: 'teams', label: 'Teams', icon: '⬡' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
]

interface Props {
  user: User
  currentPage: AdminPage
  onNavigate: (page: AdminPage) => void
  onLogout: () => void
  onProfile: () => void
  children: React.ReactNode
}

export default function AdminLayout({ user, currentPage, onNavigate, onLogout, onProfile, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <aside className="flex flex-col w-60 flex-shrink-0 h-full" style={{ background: '#0F172A', borderRight: '1px solid #1E293B' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1E293B' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--primary)' }}>L</div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Lexicon</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Admin Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="px-2 mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: '#475569' }}>Management</p>
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.id
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 text-left" style={{ background: active ? 'rgba(29,78,216,0.25)' : 'transparent', color: active ? '#93C5FD' : '#94A3B8', borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent', cursor: 'pointer' }}>
                <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: '#1E293B' }}>
          <button onClick={onProfile} className="flex items-center gap-3 px-2 py-2 w-full rounded-lg text-left" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
<div
  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
  style={{
    background: user.avatar || 'var(--primary)',
  }}
>
  {user.name.charAt(0).toUpperCase()}
</div>            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Administrator · Edit Profile</p>
            </div>
          </button>
          <button onClick={onLogout} className="w-full mt-2 text-xs py-2 rounded-lg" style={{ color: '#64748B', cursor: 'pointer', background: 'transparent', border: 'none' }}>Sign out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
