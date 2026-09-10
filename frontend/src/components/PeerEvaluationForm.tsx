import { useEffect, useState } from 'react'
import { getMyPeerEvaluations, submitPeerEvaluations, ApiError } from '../lib/api'

interface Member {
  id: number
  name: string
}

interface Props {
  contextType: 'task' | 'submission'
  contextId: number
  members: Member[]
  currentUserId: number
  /** Set to false once the task is closed / evaluations should no longer be editable. */
  editable?: boolean
  title?: string
  description?: string
}

interface Draft {
  score: number
  comment: string
}

const LOW_SCORE_THRESHOLD = 3

export default function PeerEvaluationForm({
  contextType,
  contextId,
  members,
  currentUserId,
  editable = true,
  title = 'Team Evaluation',
  description = 'Rate your teammates out of 5 for this task. Scores and comments are only visible to the teacher.',
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await getMyPeerEvaluations(contextType, contextId)
        const existing: { evaluated_id: number; score: number; comment: string | null }[] = res.data ?? []
        if (cancelled) return
        const next: Record<number, Draft> = {}
        for (const m of members) {
          const found = existing.find((e) => e.evaluated_id === m.id)
          next[m.id] = { score: found?.score ?? 0, comment: found?.comment ?? '' }
        }
        setDrafts(next)
        if (existing.length > 0) setSaved(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load evaluations.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextType, contextId, members.map((m) => m.id).join(',')])

  function setScore(memberId: number, score: number) {
    setDrafts((prev) => ({ ...prev, [memberId]: { ...prev[memberId], score } }))
  }

  function setComment(memberId: number, comment: string) {
    setDrafts((prev) => ({ ...prev, [memberId]: { ...prev[memberId], comment } }))
  }

async function handleSubmit() {
  setError('')

  const teammates = members

  if (teammates.length === 0) {
    setError('There are no other team members to evaluate.')
    return
  }

  const missing = teammates.filter((m) => !drafts[m.id]?.score)

  if (missing.length > 0) {
    setError(
      `Please select a score for everyone: ${missing.map((m) => m.name).join(', ')}`
    )
    return
  }

  setSaving(true)

  try {
    const evaluations = teammates.map((m) => ({
      evaluated_id: m.id,
      score: drafts[m.id].score,
      comment: drafts[m.id].comment?.trim() || undefined,
    }))

    await submitPeerEvaluations(
      contextType,
      contextId,
      evaluations
    )

    setSaved(true)
  } catch (err) {
    setError(
      err instanceof ApiError
        ? err.message
        : 'Could not submit, please try again.'
    )
  } finally {
    setSaving(false)
  }
}
  if (loading) {
    return (
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading evaluation form…</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{title}</h3>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
      </div>

      {error && (
        <p className="text-xs px-5 py-2.5" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{error}</p>
      )}
      {saved && !error && (
        <p className="text-xs px-5 py-2.5" style={{ background: '#F0FDF4', color: '#15803D' }}>
          Your evaluation has been saved. {editable ? 'You can update it any time until the task is closed.' : ''}
        </p>
      )}

      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {members.map((m) => {
          const draft = drafts[m.id] || { score: 0, comment: '' }
          const isSelf = m.id === currentUserId
          const showLowScoreHint = draft.score > 0 && draft.score < LOW_SCORE_THRESHOLD && !draft.comment.trim()

          return (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--primary)' }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{m.name}{isSelf ? ' (you)' : ''}</span>
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!editable}
                      onClick={() => setScore(m.id, n)}
                      className="w-8 h-8 rounded-lg text-sm font-semibold"
                      style={{
                        background: draft.score === n ? 'var(--primary)' : 'var(--muted)',
                        color: draft.score === n ? 'white' : 'var(--foreground)',
                        border: '1px solid var(--border)',
                        cursor: editable ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={draft.comment}
                onChange={(e) => setComment(m.id, e.target.value)}
                disabled={!editable}
                rows={2}
                placeholder="A short comment (optional)…"
                className="w-full mt-2.5 text-sm px-3 py-2 rounded-lg"
                style={{ border: '1px solid var(--border)', background: 'var(--background)', outline: 'none', resize: 'vertical' }}
              />
              {showLowScoreHint && (
                <p className="text-xs mt-1" style={{ color: '#B45309' }}>
                  You gave a score below 3 — it's recommended to briefly explain why.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {editable && (
        <div className="px-5 py-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--primary)', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : saved ? 'Update Evaluation' : 'Submit Evaluation'}
          </button>
        </div>
      )}
    </div>
  )
}