import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  ApiError,
  getGroups,
  getGroupStudents,
  getStudentCompetencies,
  saveCompetency,
  getGroupCompetencies,
  createCompetency,
  deleteGroupCompetency
} from '../../lib/api'

type Group = {
  id: number
  name: string
  course_id?: number
  course_name?: string
}

type Student = {
  id: number
  name: string
  email?: string
}

type Competency = {
  competency_id: number
  name: string
  description?: string | null
  score: number
  trend?: string
}

type GroupCompetency = {
  id: number
  name: string
  description?: string | null
}

export default function TeacherCompetency() {
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])

  const [
    groupCompetencies,
    setGroupCompetencies
  ] = useState<GroupCompetency[]>([])

  const [
    competencies,
    setCompetencies
  ] = useState<Competency[]>([])

  const [groupId, setGroupId] =
    useState<number | null>(null)

  const [studentId, setStudentId] =
    useState<number | null>(null)

  const [scores, setScores] =
    useState<Record<number, string>>({})

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [
    addingCompetency,
    setAddingCompetency
  ] = useState(false)

  const [
    newCompetencyName,
    setNewCompetencyName
  ] = useState('')

  const [
    newCompetencyDescription,
    setNewCompetencyDescription
  ] = useState('')

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    if (!groupId) return

    loadGroupCompetencies(groupId)
    loadStudents(groupId)
  }, [groupId])

  useEffect(() => {
    if (!studentId) return

    loadCompetencies(studentId)
  }, [studentId])

  async function loadGroups() {
    try {
      setLoading(true)
      setError('')

      const response = await getGroups()

      const data: Group[] =
        response?.data || []

      setGroups(data)

      if (data.length > 0) {
        setGroupId(data[0].id)
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load groups'
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadStudents(id: number) {
    try {
      const response =
        await getGroupStudents(id)

      const data: Student[] =
        response?.data || []

      setStudents(data)

      setStudentId(
        data.length > 0
          ? data[0].id
          : null
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load students'
      )
    }
  }

  async function loadGroupCompetencies(
    id: number
  ) {
    try {
      const response =
        await getGroupCompetencies(id)

      setGroupCompetencies(
        response?.data || []
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load group competencies'
      )
    }
  }

  async function loadCompetencies(
    id: number
  ) {
    try {
      const response =
        await getStudentCompetencies(id)

      const data: Competency[] =
        response?.data || []

      setCompetencies(data)

      setScores(
        Object.fromEntries(
          data.map(c => [
            c.competency_id,
            String(c.score ?? 0)
          ])
        )
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load competencies'
      )
    }
  }

  const rows = useMemo(() => {
    return groupCompetencies.map(gc => {
      const existing =
        competencies.find(
          c =>
            c.competency_id === gc.id
        )

      return {
        competency_id: gc.id,
        name: gc.name,
        description:
          gc.description || '',
        score: existing?.score ?? 0,
        trend:
          existing?.trend ?? 'stable'
      }
    })
  }, [
    groupCompetencies,
    competencies
  ])

  async function handleAddCompetency() {
    if (!groupId) return

    const name =
      newCompetencyName.trim()

    if (!name) {
      setError(
        'Competency name is required'
      )
      return
    }

    try {
      setAddingCompetency(true)
      setError('')
      setSuccess('')

      await createCompetency({
        name,
        description:
          newCompetencyDescription.trim(),
        group_id: groupId
      })

      setNewCompetencyName('')
      setNewCompetencyDescription('')

      await loadGroupCompetencies(groupId)

      if (studentId) {
        await loadCompetencies(studentId)
      }

      setSuccess(
        'Competency added successfully.'
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not add competency'
      )
    } finally {
      setAddingCompetency(false)
    }
  }

  async function handleDeleteCompetency(
    competencyId: number
  ) {
    if (!groupId) return

    const confirmed =
      window.confirm(
        'Remove this competency from this group?'
      )

    if (!confirmed) return

    try {
      setError('')
      setSuccess('')

      await deleteGroupCompetency(
        groupId,
        competencyId
      )

      await loadGroupCompetencies(groupId)

      if (studentId) {
        await loadCompetencies(studentId)
      }

      setSuccess(
        'Competency removed from this group.'
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not remove competency'
      )
    }
  }

  async function saveAll() {
    if (!studentId) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      await Promise.all(
        rows.map(competency => {
          const rawScore =
            scores[competency.competency_id] ??
            String(competency.score)

          const score = Number(rawScore)

          return saveCompetency({
            student_id: studentId,
            competency_id:
              competency.competency_id,
            score
          })
        })
      )

      setSuccess(
        'All competency scores saved successfully.'
      )

      /*
        Burada loadCompetencies(studentId)
        ÇAĞIRMIYORUZ.

        Böylece kullanıcı henüz başka bir işlem
        yaparken input değerleri sıfırlanmaz.
      */

    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not save competency scores'
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedGroup =
    groups.find(
      g => g.id === groupId
    )

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{
            fontFamily:
              'Outfit, sans-serif'
          }}
        >
          Competency
        </h1>

        <p
          className="text-sm mt-1"
          style={{
            color:
              'var(--muted-foreground)'
          }}
        >
          Define and assess competencies
          for each assigned group.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C'
          }}
        >
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            background: '#DCFCE7',
            color: '#15803D'
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm">
          Loading...
        </p>
      ) : groups.length === 0 ? (

        <div
          className="rounded-xl p-8 text-center"
          style={{
            background:
              'var(--card)',
            border:
              '1px solid var(--border)'
          }}
        >
          No groups assigned.
        </div>

      ) : (

        <>
          {/* Group / Student */}
          <div className="grid md:grid-cols-2 gap-3 mb-5">

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{
                  color:
                    'var(--muted-foreground)'
                }}
              >
                Group
              </label>

              <select
                value={groupId ?? ''}
                onChange={e =>
                  setGroupId(
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border:
                    '1px solid var(--border)',
                  background:
                    'var(--card)'
                }}
              >
                {groups.map(group => (
                  <option
                    key={group.id}
                    value={group.id}
                  >
                    {group.name}
                    {group.course_name
                      ? ` · ${group.course_name}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{
                  color:
                    'var(--muted-foreground)'
                }}
              >
                Student
              </label>

              <select
                value={studentId ?? ''}
                onChange={e =>
                  setStudentId(
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border:
                    '1px solid var(--border)',
                  background:
                    'var(--card)'
                }}
              >
                {students.length === 0 ? (
                  <option value="">
                    No students available
                  </option>
                ) : (
                  students.map(student => (
                    <option
                      key={student.id}
                      value={student.id}
                    >
                      {student.name}
                      {student.email
                        ? ` · ${student.email}`
                        : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

          </div>

          {/* Add competency */}
          <div
            className="rounded-xl p-5 mb-5"
            style={{
              background:
                'var(--card)',
              border:
                '1px solid var(--border)'
            }}
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Competencies for{' '}
                {selectedGroup?.name || 'this group'}
              </h2>

              <p
                className="text-xs mt-1"
                style={{
                  color:
                    'var(--muted-foreground)'
                }}
              >
                Add competencies specifically
                for this group. You are not
                limited to predefined competencies.
              </p>
            </div>

            <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">

              <input
                value={newCompetencyName}
                onChange={e =>
                  setNewCompetencyName(
                    e.target.value
                  )
                }
                placeholder="Competency name"
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border:
                    '1px solid var(--border)',
                  background:
                    'var(--muted)',
                  outline: 'none'
                }}
              />

              <input
                value={
                  newCompetencyDescription
                }
                onChange={e =>
                  setNewCompetencyDescription(
                    e.target.value
                  )
                }
                placeholder="Description (optional)"
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border:
                    '1px solid var(--border)',
                  background:
                    'var(--muted)',
                  outline: 'none'
                }}
              />

              <button
                type="button"
                onClick={
                  handleAddCompetency
                }
                disabled={
                  addingCompetency ||
                  !newCompetencyName.trim()
                }
                className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background:
                    'var(--primary)',
                  color: 'white',
                  border: 'none',
                  opacity:
                    addingCompetency ||
                    !newCompetencyName.trim()
                      ? 0.5
                      : 1
                }}
              >
                {addingCompetency
                  ? 'Adding…'
                  : '+ Add Competency'}
              </button>

            </div>
          </div>

          {/* Competency list */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background:
                'var(--card)',
              border:
                '1px solid var(--border)'
            }}
          >

            <table className="w-full">

              <thead>
                <tr
                  style={{
                    background:
                      'var(--muted)',
                    borderBottom:
                      '1px solid var(--border)'
                  }}
                >
                  <th
                    className="px-4 py-3 text-left text-xs uppercase tracking-wider"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    Competency
                  </th>

                  <th
                    className="px-4 py-3 text-left text-xs uppercase tracking-wider"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    Description
                  </th>

                  <th
                    className="px-4 py-3 text-left text-xs uppercase tracking-wider"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    Score
                  </th>

                  <th
                    className="px-4 py-3 text-left text-xs uppercase tracking-wider"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>

                {rows.length === 0 ? (

                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm"
                      style={{
                        color:
                          'var(--muted-foreground)'
                      }}
                    >
                      No competencies have been
                      added to this group yet.
                    </td>
                  </tr>

                ) : (

                  rows.map((c, i) => (

                    <tr
                      key={c.competency_id}
                      style={{
                        borderBottom:
                          i < rows.length - 1
                            ? '1px solid var(--border)'
                            : 'none'
                      }}
                    >
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold">
                          {c.name}
                        </p>
                      </td>

                      <td
                        className="px-4 py-4 text-xs"
                        style={{
                          color:
                            'var(--muted-foreground)'
                        }}
                      >
                        {c.description || '—'}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">

                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={
                              scores[c.competency_id] ??
                              String(c.score)
                            }
                            onChange={e =>
                              setScores(prev => ({
                                ...prev,
                                [c.competency_id]:
                                  e.target.value
                              }))
                            }
                            className="w-20 px-2 py-1.5 rounded-lg text-sm"
                            style={{
                              border:
                                '1px solid var(--border)',
                              outline: 'none'
                            }}
                          />

                          <span className="text-xs">
                            / 100
                          </span>

                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCompetency(
                              c.competency_id
                            )
                          }
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{
                            background:
                              '#FEE2E2',
                            color:
                              '#B91C1C',
                            border:
                              '1px solid #FECACA'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

          {/* Save All Changes */}
          <div className="flex justify-end mt-6 mb-4">

            <button
              type="button"
              onClick={saveAll}
              disabled={
                saving ||
                rows.length === 0 ||
                !studentId
              }
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background:
                  'var(--primary)',
                color: 'white',
                border: 'none',
                opacity:
                  saving ||
                  rows.length === 0 ||
                  !studentId
                    ? 0.5
                    : 1,
                cursor:
                  saving ||
                  rows.length === 0 ||
                  !studentId
                    ? 'not-allowed'
                    : 'pointer'
              }}
            >
              {saving
                ? 'Saving all changes…'
                : 'Save All Changes'}
            </button>

          </div>

        </>
      )}
    </div>
  )
}
