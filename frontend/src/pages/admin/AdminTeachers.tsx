import { useEffect, useState } from 'react'
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  ApiError,
} from '../../lib/api'

type Teacher = {
  id: number | string
  name: string
  email: string
  role: string
  is_active?: boolean
  group_names?: string
}

type ModalState =
  | {
      mode: 'add'
    }
  | {
      mode: 'edit'
      teacher: Teacher
    }
  | null

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [modal, setModal] = useState<ModalState>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })

  const [error, setError] = useState('')

  const load = async () => {
    try {
      const r = await getUsers('teacher')
      setTeachers(r.data ?? [])
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load teachers.'
      )
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openAdd = () => {
    setError('')

    setForm({
      name: '',
      email: '',
      password: 'Temp1234',
    })

    setModal({
      mode: 'add',
    })
  }

  const openEdit = (teacher: Teacher) => {
    setError('')

    setForm({
      name: teacher.name,
      email: teacher.email,
      password: '',
    })

    setModal({
      mode: 'edit',
      teacher,
    })
  }

  const save = async () => {
    try {
      if (!form.name.trim() || !form.email.trim()) {
        setError('Name and email are required')
        return
      }

      if (!modal) return

      if (modal.mode === 'add') {
        await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password || 'Temp1234',
          role: 'teacher',
        })
      }

      if (modal.mode === 'edit') {
        await updateUser(modal.teacher.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          ...(form.password
            ? { password: form.password }
            : {}),
        })
      }

      setModal(null)
      setForm({
        name: '',
        email: '',
        password: '',
      })

      await load()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not save teacher.'
      )
    }
  }

  const remove = async (teacher: Teacher) => {
    if (!confirm(`Remove ${teacher.name}?`)) return

    try {
      await deleteUser(teacher.id)
      await load()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not remove teacher.'
      )
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Teachers
          </h1>

          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {teachers.length} instructors registered
          </p>
        </div>

        <button
          onClick={openAdd}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
          }}
        >
          + Add Teacher
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <p
          className="mb-4 text-sm rounded-lg px-3 py-2"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </p>
      )}

      {/* TEACHERS TABLE */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
              }}
            >
              {['Name', 'Email', 'Group', 'Actions'].map(
                (header) => (
                  <th
                    key={header}
                    className="px-5 py-3 text-left text-xs uppercase"
                    style={{
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {teachers.map((teacher, index) => (
              <tr
                key={teacher.id}
                style={{
                  borderBottom:
                    index < teachers.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <td className="px-5 py-4 text-sm font-medium">
                  {teacher.name}
                </td>

                <td className="px-5 py-4 text-sm">
                  {teacher.email}
                </td>

                <td className="px-5 py-4 text-sm">
                  {teacher.group_names ?? 'Unassigned'}
                </td>

                <td className="px-5 py-4">
                  <button
                    onClick={() => openEdit(teacher)}
                    className="text-xs px-3 py-1.5 rounded-lg mr-2"
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => remove(teacher)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      background: '#FEE2E2',
                      color: '#B91C1C',
                      border: 'none',
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            background: 'rgba(0,0,0,.4)',
          }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-sm"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 className="text-lg font-semibold mb-5">
              {modal.mode === 'add'
                ? 'Add Teacher'
                : 'Edit Teacher'}
            </h2>

            <div className="space-y-3">
              {/* NAME */}
              <input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                placeholder="Full name"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                }}
              />

              {/* EMAIL */}
              <input
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                placeholder="Email"
                type="email"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                }}
              />

              {/* PASSWORD */}
              <input
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                placeholder={
                  modal.mode === 'add'
                    ? 'Temporary password'
                    : 'New password (optional)'
                }
                type="text"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                }}
              />
            </div>

            {/* BUTTONS */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-lg"
                style={{
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>

              <button
                onClick={save}
                className="flex-1 py-2.5 rounded-lg font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}