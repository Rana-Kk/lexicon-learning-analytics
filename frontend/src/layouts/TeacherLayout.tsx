import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { User } from '../types'

export type TeacherPage =
  | 'dashboard'
  | 'groups'
  | 'attendance'
  | 'assessments'
  | 'submissions'
  | 'aievaluations'
  | 'quizresults'
  | 'analytics'
  | 'reports'
  | 'certificates'
  | 'competency'
  | 'feedback'

const BASE_NAV_ITEMS: { id: TeacherPage; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'groups', label: 'Groups & Teams', icon: '🗂' },
  { id: 'attendance', label: 'Attendance', icon: '✓' },
  { id: 'assessments', label: 'Assessments', icon: '📝' },
  { id: 'submissions', label: 'Submissions', icon: '⬆' },
  { id: 'aievaluations', label: 'AI Evaluations', icon: '✦' },
  { id: 'quizresults', label: 'Quiz Results', icon: '❓' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'reports', label: 'PDF Reports', icon: '📄' },
  { id: 'certificates', label: 'Certificates', icon: '🏆' },
  { id: 'competency', label: 'Competency', icon: '◎' },
  { id: 'feedback', label: 'Feedback', icon: '💬' },
]

interface Props {
  user: User
  currentPage: TeacherPage
  onNavigate: (page: TeacherPage, submissionId?: number) => void
  onLogout: () => void
  onProfile: () => void
  children: React.ReactNode
}

export default function TeacherLayout({ user, currentPage, onNavigate, onLogout, onProfile, children }: Props) {
  const [submissionBadge, setSubmissionBadge] = useState(0)
  const [evalBadge, setEvalBadge] = useState(0)

useEffect(() => {
  const fetchBadges = async () => {
    try {
      const res = await apiFetch('/submissions')

      const subs = res.data || []

      // Öğretmenin incelemesi gereken submission'lar
      const pendingSubs = subs.filter((s: any) =>
        ['submitted', 'analyzing'].includes(
          String(s.status).toLowerCase()
        )
      ).length

      // AI değerlendirmesi hazır ve teacher review bekliyor
      const pendingEvals = subs.filter((s: any) =>
        ['ai_reviewed', 'teacher_review'].includes(
          String(s.status).toLowerCase()
        )
      ).length

      setSubmissionBadge(pendingSubs)
      setEvalBadge(pendingEvals)
    } catch (error) {
      console.error('Badge load error:', error)

      setSubmissionBadge(0)
      setEvalBadge(0)
    }
  }

  fetchBadges()
}, [currentPage])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <aside className="flex flex-col w-60 flex-shrink-0 h-full" style={{ background: '#0F172A', borderRight: '1px solid #1E293B' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1E293B' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--primary)' }}>L</div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Lexicon</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Teacher Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="px-2 mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: '#475569' }}>My Groups</p>
          {BASE_NAV_ITEMS.map((item) => {
            const active = currentPage === item.id
            let badgeValue = 0
            if (item.id === 'submissions') badgeValue = submissionBadge
            if (item.id === 'aievaluations') badgeValue = evalBadge

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 text-left"
                style={{ background: active ? 'rgba(29,78,216,0.25)' : 'transparent', color: active ? '#93C5FD' : '#94A3B8', borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badgeValue > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: 'white', fontSize: '10px', minWidth: '18px', textAlign: 'center' }}>
                    {badgeValue}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: '#1E293B' }}>
          <button onClick={onProfile} className="flex items-center gap-3 px-2 py-2 w-full rounded-lg text-left" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#0891B2' }}>{user.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Teacher · Edit Profile</p>
            </div>
          </button>
          <button onClick={onLogout} className="w-full mt-2 text-xs py-2 rounded-lg" style={{ color: '#64748B', cursor: 'pointer', background: 'transparent', border: 'none' }}>Sign out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}