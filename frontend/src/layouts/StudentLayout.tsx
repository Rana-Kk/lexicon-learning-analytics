import type { User } from '../types'

export type StudentPage =
  | 'dashboard'
  | 'team'
  | 'assignments'
  | 'submissions'
  | 'quizresults'
  | 'attendance'
  | 'competency'
  | 'feedback'
  | 'certificates'

const NAV_ITEMS: { id: StudentPage; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'team', label: 'Team' },
  { id: 'assignments', label: 'My Assignments' },
  { id: 'submissions', label: 'My Submissions' },
  { id: 'quizresults', label: 'Quiz Results' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'competency', label: 'Competency' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'certificates', label: 'Certificates' },
]

interface Props {
  user: User
  currentPage: StudentPage
  onNavigate: (page: StudentPage) => void
  onLogout: () => void
  onProfile: () => void
  children: React.ReactNode
}

export default function StudentLayout({
  user,
  currentPage,
  onNavigate,
  onLogout,
  onProfile,
  children,
}: Props) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)' }}
    >
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6"
        style={{
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          height: '56px',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="lexicon-visual-content">
            <img 
      src="/lexicon-logo.png" 
      alt="Lexicon" 
      className="object-contain"
      style={{ 
        height: '32px',      
        width: 'auto',        
        maxWidth: '100%',    
        minWidth: '50px'     
      }}
    />
          </div>
          </div>

          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = currentPage === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: active
                      ? 'var(--secondary)'
                      : 'transparent',
                    color: active
                      ? 'var(--foreground)'
                      : 'var(--muted-foreground)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-tight">
              {user.name}
            </p>

            <p
              className="text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              FSWD-2026-A
            </p>
          </div>

          {/* User Avatar */}
          <button
            onClick={onProfile}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{
              background: user.avatar || 'var(--primary)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Edit Profile"
          >
            {user.name.charAt(0).toUpperCase()}
          </button>

          <button
            onClick={onLogout}
            className="text-xs py-1.5 px-3 rounded-md"
            style={{
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}