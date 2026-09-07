import { useEffect, useState } from 'react'
import {
  ApiError,
  getGroups,
  getGroupStudents,
  getFeedback,
  createFeedback,
  getFeedbackTemplates,
  deleteFeedback,
} from '../../lib/api'

type Group = { id: number; name: string; course_name?: string }
type Student = { id: number; name: string; email?: string }
type Feedback = {
  id: number
  student_name?: string
  teacher_name?: string
  assessment_title?: string
  content: string
  created_at: string
}

export default function TeacherFeedback() {
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [groupId, setGroupId] = useState<number | null>(null)
  const [studentId, setStudentId] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (groupId) loadStudents(groupId)
    else {
      setStudents([])
      setStudentId(null)
    }
  }, [groupId])
  useEffect(() => { if (studentId) loadFeedback(studentId) }, [studentId])

  async function load() {
    try {
      const [g, feedbackRes, t] = await Promise.all([
        getGroups(),
        getFeedback(),
        getFeedbackTemplates(),
      ])
      const data: Group[] = Array.isArray(g?.data) ? g.data : []
      setGroups(data)
      setTemplates(Array.isArray(t?.data) ? t.data : [])
      setFeedback(Array.isArray(feedbackRes?.data) ? feedbackRes.data : [])
      setGroupId(data[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load feedback')
    } finally {
      setLoading(false)
    }
  }

  async function loadStudents(id: number) {
    try {
      const r = await getGroupStudents(id)
      const data: Student[] = Array.isArray(r?.data) ? r.data : []
      setStudents(data)
      setStudentId(data[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load students')
      setStudents([])
      setStudentId(null)
    }
  }

  async function loadFeedback(id: number) {
    try {
      const r = await getFeedback(id)
      setFeedback(Array.isArray(r?.data) ? r.data : [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load feedback')
    }
  }

  async function publish() {
    if (!studentId || !content.trim()) return
    try {
      setSaving(true)
      setError('')
      await createFeedback({ student_id: studentId, content: content.trim() })
      setContent('')
      await loadFeedback(studentId)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save feedback')
    } finally {
      setSaving(false)
    }
  }

  async function removeFeedback(id: number) {
    if (!window.confirm('Delete this feedback?')) return
    try {
      setDeleting(id)
      setError('')
      await deleteFeedback(id)
      if (studentId) await loadFeedback(studentId)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete feedback')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Write teacher feedback that will appear on the student's Feedback page.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm">Loading...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          No groups assigned.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3 mb-5">
            <select
              value={groupId ?? ''}
              onChange={e => setGroupId(Number(e.target.value))}
              className="px-3 py-2.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.course_name ? ` · ${g.course_name}` : ''}
                </option>
              ))}
            </select>

            <select
              value={studentId ?? ''}
              onChange={e => setStudentId(Number(e.target.value))}
              className="px-3 py-2.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
              disabled={students.length === 0}
            >
              {students.length === 0 ? (
                <option value="">No students in this group</option>
              ) : (
                students.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))
              )}
            </select>
          </div>

          <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex gap-2 mb-3 flex-wrap">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setContent(t.content)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}
                >
                  {t.category}
                </button>
              ))}
            </div>

            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder="Write feedback for this student..."
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-y"
              style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}
            />

            <div className="flex justify-end mt-3">
              <button
                onClick={publish}
                disabled={saving || !content.trim() || !studentId}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--primary)', color: 'white', border: 'none', opacity: saving || !content.trim() || !studentId ? .5 : 1 }}
              >
                {saving ? 'Publishing…' : 'Publish Feedback'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {feedback.length === 0 ? (
              <div className="rounded-xl p-8 text-center text-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                No feedback for this student yet.
              </div>
            ) : (
              feedback.map(f => (
                <div key={f.id} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold">
                      {f.assessment_title || 'General feedback'}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(f.created_at).toLocaleDateString('en-GB')}
                      </span>
                      <button
                        onClick={() => removeFeedback(f.id)}
                        disabled={deleting === f.id}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: '#B91C1C', background: '#FEE2E2', border: 'none', cursor: deleting === f.id ? 'default' : 'pointer', opacity: deleting === f.id ? .5 : 1 }}
                      >
                        {deleting === f.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{f.content}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}