import { useEffect, useState } from 'react'
import { getFeedback } from '../../lib/api'

type FeedbackItem = {
  id: string | number
  student_id: number
  teacher_id: number
  teacher_name: string
  assessment_id: number | null
  assessment_title: string | null
  template_id: number | null
  template_category: string | null
  content: string
  created_at: string
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  Excellent: { bg: '#DCFCE7', color: '#15803D' },
  'Needs Improvement': { bg: '#FEF3C7', color: '#B45309' },
  Teamwork: { bg: '#EFF6FF', color: '#1E40AF' },
}

const DEFAULT_STYLE = { bg: '#F1F5F9', color: '#475569' }

export default function StudentFeedback() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const res = await getFeedback()

        setFeedback(Array.isArray(res?.data) ? res.data : [])
      } catch (err: any) {
        setError(err?.message || 'Failed to load feedback')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm">Loading feedback...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Teacher Feedback
        </h1>

        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Comments and guidance shared by your instructors.
        </p>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl text-sm mb-6"
          style={{ background: '#FEE2E2', color: '#B91C1C' }}
        >
          {error}
        </div>
      )}

      {!error && feedback.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
        >
          <div className="text-4xl mb-4">💬</div>

          <p className="font-medium">No feedback yet.</p>

          <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Feedback from your instructors will appear here once it's shared.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => {
            const style = item.template_category
              ? CATEGORY_STYLES[item.template_category] || DEFAULT_STYLE
              : DEFAULT_STYLE

            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
              >
                <div
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      {item.teacher_name}
                    </p>

                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      {item.assessment_title ? `Re: ${item.assessment_title} · ` : ''}
                      {new Date(item.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {item.template_category && (
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {item.template_category}
                    </span>
                  )}
                </div>

                <div className="px-5 py-4">
                  <p className="text-sm leading-relaxed whitespace-pre-line">{item.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
