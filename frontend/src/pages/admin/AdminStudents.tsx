import { useEffect, useMemo, useState } from 'react'
import {
  createUser,
  deleteUser,
  getCourses,
  getGroups,
  getUsers,
  importStudentsExcel,
  updateUser
} from '../../lib/api'
import { ApiError } from '../../lib/api'

type Student = {
  id: number | string
  name: string
  email: string
  group_ids?: string
  group_names?: string
  course_ids?: string
  course_names?: string
}

type Group = { id: number | string; name: string; course_id: number | string }
type Course = { id: number | string; name: string }

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; student?: Student } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', course_id: '', group_id: '' })
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<any>(null)
  const [courseFilter, setCourseFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')

  const load = async () => {
    try {
      const [s, c, g] = await Promise.all([getUsers('student'), getCourses(), getGroups()])
      setStudents(s.data ?? [])
      setCourses(c.data ?? [])
      setGroups(g.data ?? [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load students.')
    }
  }

  useEffect(() => { load() }, [])

  const filteredStudents = useMemo(() => students.filter(student => {
    const courseMatch = !courseFilter || (student.course_ids ?? '').split(',').map(id => id.trim()).includes(courseFilter)
    const groupMatch = !groupFilter || (student.group_ids ?? '').split(',').map(id => id.trim()).includes(groupFilter)
    return courseMatch && groupMatch
  }), [students, courseFilter, groupFilter])

  const groupsForSelectedCourse = useMemo(
    () => groups.filter(g => !form.course_id || String(g.course_id) === form.course_id),
    [groups, form.course_id]
  )

  const save = async () => {
    try {
      setError('')
      if (!form.name || !form.email || !form.group_id) {
        setError('Name, email and group are required')
        return
      }
      if (modal?.mode === 'add' && !form.password) {
        setError('Please enter a password when adding a student manually')
        return
      }

      if (modal?.mode === 'add') {
        await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: 'student',
          group_ids: [Number(form.group_id)]
        })
      } else if (modal?.student) {
        await updateUser(modal.student.id, {
          name: form.name,
          email: form.email,
          ...(form.password ? { password: form.password } : {}),
          group_ids: [Number(form.group_id)]
        })
      }

      setModal(null)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save student.')
    }
  }

  const remove = async (s: Student) => {
    if (!confirm(`Delete ${s.name}?`)) return
    try { await deleteUser(s.id); await load() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not delete student.') }
  }

  const importFile = async (file: File) => {
    setError('')
    setImportResult(null)
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setError('Please upload an .xlsx Excel file.')
        return
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const result = await importStudentsExcel(btoa(binary), file.name)
      setImportResult(result)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Import failed.')
    }
  }

  const openAdd = () => {
    setError('')
    setForm({ name: '', email: '', password: '', course_id: '', group_id: '' })
    setModal({ mode: 'add' })
  }

  const openEdit = (student: Student) => {
    const firstGroupId = student.group_ids?.split(',')[0]?.trim() ?? ''
    const group = groups.find(g => String(g.id) === firstGroupId)
    setError('')
    setForm({
      name: student.name,
      email: student.email,
      password: '',
      course_id: group ? String(group.course_id) : '',
      group_id: firstGroupId
    })
    setModal({ mode: 'edit', student })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{filteredStudents.length} students shown</p>
        </div>
        <div className="flex gap-2">
          <label className="text-sm px-4 py-2 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border)' }}>
            Import Excel
            <input type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.currentTarget.value = '' }} />
          </label>
          <button onClick={openAdd} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>+ Add Student</button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm rounded-lg px-3 py-2" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{error}</p>}

      {importResult && (
        <div className="mb-4 rounded-lg p-4 text-sm" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          <p>Imported <b>{importResult.imported}</b>, skipped <b>{importResult.skipped}</b>.</p>
          <p className="mt-2" style={{ color: 'var(--muted-foreground)' }}>Excel columns: <b>name</b>, <b>surname</b> (optional), <b>email</b>, <b>group</b>, <b>password</b> (optional).</p>
          {importResult.data?.some((s: any) => s.must_change_password) && <p className="mt-2">Students without an Excel password received an automatic temporary password and must change it on first login.</p>}
          {importResult.data?.some((s: any) => s.password) && (
            <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <b>Generated temporary passwords (save these now):</b>
              {importResult.data.filter((s: any) => s.password).map((s: any) => <div key={s.id}>{s.email}: <b>{s.password}</b></div>)}
            </div>
          )}
          {importResult.skippedRows?.length > 0 && <div className="mt-3"><b>Skipped rows:</b>{importResult.skippedRows.map((r: any, i: number) => <div key={i}>{r.email || 'Unknown'} — {r.reason}</div>)}</div>}
        </div>
      )}

      <div className="rounded-xl p-4 mb-4 flex gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <select value={courseFilter} onChange={e => { setCourseFilter(e.target.value); setGroupFilter('') }} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}>
          <option value="">All Courses</option>
          {courses.map(course => <option key={course.id} value={String(course.id)}>{course.name}</option>)}
        </select>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}>
          <option value="">All Groups</option>
          {groups.filter(g => !courseFilter || String(g.course_id) === courseFilter).map(group => <option key={group.id} value={String(group.id)}>{group.name}</option>)}
        </select>
        {(courseFilter || groupFilter) && <button onClick={() => { setCourseFilter(''); setGroupFilter('') }} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)' }}>Clear Filters</button>}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <table className="w-full"><thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Student', 'Email', 'Course', 'Group', 'Actions'].map(h => <th key={h} className="px-5 py-3 text-left text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>{h}</th>)}</tr></thead>
          <tbody>{filteredStudents.map((s, i) => <tr key={s.id} style={{ borderBottom: i < filteredStudents.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <td className="px-5 py-4 text-sm font-medium">{s.name}</td><td className="px-5 py-4 text-sm">{s.email}</td><td className="px-5 py-4 text-sm">{s.course_names || '—'}</td><td className="px-5 py-4 text-sm">{s.group_names || '—'}</td>
            <td className="px-5 py-4"><button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 rounded-lg mr-2" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>View / Edit</button><button onClick={() => remove(s)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none' }}>Delete</button></td>
          </tr>)}</tbody></table>
      </div>

      {modal && <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,.4)' }}>
        <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold mb-5">{modal.mode === 'add' ? 'Add Student' : 'Edit Student'}</h2>
          <div className="space-y-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }} />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }} />
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={modal.mode === 'add' ? 'Password' : 'New password (leave blank to keep current)'} type="password" className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }} />
            <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value, group_id: '' })} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}>
              <option value="">Select course</option>{courses.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <select value={form.group_id} disabled={!form.course_id} onChange={e => setForm({ ...form, group_id: e.target.value })} className="w-full px-3 py-2.5 rounded-lg text-sm disabled:opacity-50" style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}>
              <option value="">{form.course_id ? 'Select group' : 'Select a course first'}</option>{groupsForSelectedCourse.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg" style={{ border: '1px solid var(--border)' }}>Cancel</button><button onClick={save} className="flex-1 py-2.5 rounded-lg font-semibold" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>Save</button></div>
        </div>
      </div>}
    </div>
  )
}