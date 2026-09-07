import { useEffect, useState } from 'react'
import { apiFetch, ApiError } from '../../lib/api'

interface Course {
  id: number
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  })

  const loadCourses = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/courses')
      setCourses(res.data || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourses()
  }, [])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCourse(null)
    setForm({
      name: '',
      description: '',
      start_date: '',
      end_date: ''
    })
    setShowModal(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course)
    setForm({
      name: course.name || '',
      description: course.description || '',
      start_date: course.start_date ? course.start_date.split('T')[0] : '',
      end_date: course.end_date ? course.end_date.split('T')[0] : ''
    })
    setShowModal(true)
  }

  // Create or Update Course
  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null
      }

      if (editingCourse) {
        await apiFetch(`/courses/${editingCourse.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await apiFetch('/courses', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }

      setShowModal(false)
      await loadCourses()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save course')
    } finally {
      setSaving(false)
    }
  }

  // Delete Course
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this course? All associated groups and data will be permanently deleted.')) {
      return
    }

    try {
      await apiFetch(`/courses/${id}`, {
        method: 'DELETE'
      })
      await loadCourses()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete course')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Courses</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {courses.length} courses
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          + New Course
        </button>
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2.5 mb-4" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading courses…</p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Course Name', 'Description', 'Start Date', 'End Date', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No courses found. Click "+ New Course" to create one.
                  </td>
                </tr>
              ) : (
                courses.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: i < courses.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-5 py-4 text-sm font-semibold">{c.name}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {c.description || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm mono" style={{ color: 'var(--muted-foreground)' }}>
                      {c.start_date ? c.start_date.split('T')[0] : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm mono" style={{ color: 'var(--muted-foreground)' }}>
                      {c.end_date ? c.end_date.split('T')[0] : '—'}
                    </td>
                    <td className="px-5 py-4 space-x-2">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ border: '1px solid #FCA5A5', color: '#B91C1C', cursor: 'pointer', background: 'transparent' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT COURSE MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {editingCourse ? 'Edit Course' : 'Create Course'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Course Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Stack Web Development"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  placeholder="Course summary and objectives..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !form.name.trim() ? 0.7 : 1
                }}
              >
                {saving ? 'Saving…' : editingCourse ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}