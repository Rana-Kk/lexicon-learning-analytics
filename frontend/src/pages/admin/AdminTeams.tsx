import { useEffect, useMemo, useState } from 'react'
import {
  getTeams,
  getGroups,
  getCourses,
  getUsers,
  getGroupStudents,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember
} from '../../lib/api'
import { ApiError, apiFetch } from '../../lib/api'

type Student = {
  id: number | string
  name: string
  email: string
}

type TeamMember = {
  id: number | string
  name: string
  email: string
  github_username?: string
}

type Team = {
  id: number | string
  name: string
  group_id: number | string
  group_name?: string
  course_id?: number | string
  course_name?: string
  members?: TeamMember[]
}

type Group = {
  id: number | string
  name: string
  course_id?: number | string
}

type Course = {
  id: number | string
  name: string
}

export default function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<Student[]>([])

  // Page filters
  const [courseFilter, setCourseFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')

  // Create modal group
  const [createGroupId, setCreateGroupId] = useState('')

  // Students belonging to selected create group
  const [groupStudents, setGroupStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [modal, setModal] = useState<
    'create' | 'edit' | 'members' | null
  >(null)

  const [selectedTeam, setSelectedTeam] =
    useState<Team | null>(null)

  const [teamName, setTeamName] = useState('')

  const [selectedStudents, setSelectedStudents] =
    useState<string[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingGithubId, setEditingGithubId] = useState<
    number | string | null
  >(null)
  const [githubDraft, setGithubDraft] = useState('')
  const [savingGithub, setSavingGithub] = useState(false)

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  const load = async () => {
    try {
      setLoading(true)
      setError('')

      const [
        teamRes,
        groupRes,
        courseRes,
        studentRes
      ] = await Promise.all([
        getTeams(),
        getGroups(),
        getCourses(),
        getUsers('student')
      ])

      setTeams(teamRes.data ?? [])
      setGroups(groupRes.data ?? [])
      setCourses(courseRes.data ?? [])
      setStudents(studentRes.data ?? [])
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load teams.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // --------------------------------------------------
  // FILTERS
  // --------------------------------------------------

  const filteredGroups = useMemo(() => {
    if (!courseFilter) {
      return groups
    }

    return groups.filter(
      (group) =>
        String(group.course_id) ===
        String(courseFilter)
    )
  }, [groups, courseFilter])

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const courseMatches =
        !courseFilter ||
        String(team.course_id) ===
          String(courseFilter)

      const groupMatches =
        !groupFilter ||
        String(team.group_id) ===
          String(groupFilter)

      return courseMatches && groupMatches
    })
  }, [
    teams,
    courseFilter,
    groupFilter
  ])

  // --------------------------------------------------
  // LOAD STUDENTS OF GROUP
  // --------------------------------------------------

  const loadGroupStudents = async (
    groupId: string
  ) => {
    if (!groupId) {
      setGroupStudents([])
      setSelectedStudents([])
      return
    }

    try {
      setLoadingStudents(true)
      setError('')

      const response =
        await getGroupStudents(groupId)

      setGroupStudents(
        response.data ?? []
      )

      // Reset selected students when group changes
      setSelectedStudents([])
    } catch (e) {
      setGroupStudents([])

      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not load group students.'
      )
    } finally {
      setLoadingStudents(false)
    }
  }

  // --------------------------------------------------
  // CREATE TEAM
  // --------------------------------------------------

  const openCreate = () => {
    setError('')
    setTeamName('')
    setSelectedTeam(null)
    setSelectedStudents([])

    // If a group is already selected in the page filter,
    // use it as the default group in the modal.
    setCreateGroupId(groupFilter || '')

    if (groupFilter) {
      loadGroupStudents(groupFilter)
    } else {
      setGroupStudents([])
    }

    setModal('create')
  }

  // --------------------------------------------------
  // EDIT TEAM
  // --------------------------------------------------

  const openEdit = (team: Team) => {
    setError('')
    setSelectedTeam(team)
    setTeamName(team.name)
    setModal('edit')
  }

  // --------------------------------------------------
  // MEMBERS MODAL
  // --------------------------------------------------

  const openMembers = (team: Team) => {
    setError('')
    setSelectedTeam(team)
    setModal('members')
  }

  // --------------------------------------------------
  // SAVE TEAM
  // --------------------------------------------------

  const saveTeam = async () => {
    if (!teamName.trim()) {
      setError('Team name is required')
      return
    }

    if (
      modal === 'create' &&
      !createGroupId
    ) {
      setError('Please select a group first')
      return
    }

    try {
      setSaving(true)
      setError('')

      if (modal === 'create') {
        await createTeam({
          group_id: createGroupId,
          name: teamName.trim(),
          student_ids: selectedStudents
        })
      }

      if (
        modal === 'edit' &&
        selectedTeam
      ) {
        await updateTeam(
          selectedTeam.id,
          {
            name: teamName.trim()
          }
        )
      }

      setModal(null)
      setSelectedTeam(null)
      setTeamName('')
      setSelectedStudents([])
      setCreateGroupId('')
      setGroupStudents([])

      await load()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not save team.'
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // DELETE TEAM
  // --------------------------------------------------

  const remove = async (
    team: Team
  ) => {
    if (
      !confirm(
        `Delete ${team.name}?`
      )
    ) {
      return
    }

    try {
      setError('')

      await deleteTeam(team.id)

      await load()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not delete team.'
      )
    }
  }

  // --------------------------------------------------
  // SELECT STUDENT FOR NEW TEAM
  // --------------------------------------------------

  const toggleStudent = (
    studentId: string
  ) => {
    setSelectedStudents(
      (current) =>
        current.includes(studentId)
          ? current.filter(
              (id) => id !== studentId
            )
          : [
              ...current,
              studentId
            ]
    )
  }

  // --------------------------------------------------
  // ADD MEMBER TO EXISTING TEAM
  // --------------------------------------------------

  const addMember = async (
    studentId: number | string
  ) => {
    if (!selectedTeam) {
      return
    }

    try {
      setError('')

      await addTeamMember(
        selectedTeam.id,
        studentId
      )

      const response =
        await getTeams()

      const updated =
        (response.data ?? []).find(
          (team: Team) =>
            String(team.id) ===
            String(selectedTeam.id)
        )

      if (updated) {
        setSelectedTeam(updated)
      }

      setTeams(
        response.data ?? []
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not add student.'
      )
    }
  }

  // --------------------------------------------------
  // REMOVE MEMBER
  // --------------------------------------------------

  const removeMember = async (
    studentId: number | string
  ) => {
    if (!selectedTeam) {
      return
    }

    try {
      setError('')

      await removeTeamMember(
        selectedTeam.id,
        studentId
      )

      const response =
        await getTeams()

      const updated =
        (response.data ?? []).find(
          (team: Team) =>
            String(team.id) ===
            String(selectedTeam.id)
        )

      if (updated) {
        setSelectedTeam(updated)
      }

      setTeams(
        response.data ?? []
      )
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not remove student.'
      )
    }
  }

  // --------------------------------------------------
  // UPDATE MEMBER GITHUB USERNAME
  // --------------------------------------------------

  const saveGithubUsername = async (studentId: number | string) => {
    setSavingGithub(true)
    try {
      setError('')

      await apiFetch(`/users/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          github_username: githubDraft.trim().replace(/^@/, '') || null,
        }),
      })

      const response = await getTeams()

      const updated = (response.data ?? []).find(
        (team: Team) => String(team.id) === String(selectedTeam?.id)
      )

      if (updated) {
        setSelectedTeam(updated)
      }

      setTeams(response.data ?? [])
      setEditingGithubId(null)
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Could not update GitHub username.'
      )
    } finally {
      setSavingGithub(false)
    }
  }

  // --------------------------------------------------
  // EXISTING TEAM MEMBERS
  // --------------------------------------------------

  const teamStudents =
    selectedTeam?.members ?? []

  const availableStudents =
    students.filter(
      (student) =>
        !teamStudents.some(
          (member) =>
            String(member.id) ===
            String(student.id)
        )
    )

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily:
                'Outfit, sans-serif'
            }}
          >
            Teams
          </h1>

          <p
            className="text-sm mt-0.5"
            style={{
              color:
                'var(--muted-foreground)'
            }}
          >
            {filteredTeams.length} teams
          </p>
        </div>

        <button
          onClick={openCreate}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{
            background:
              'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          + Create Team
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <p
          className="mb-4 text-sm rounded-lg px-3 py-2"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C'
          }}
        >
          {error}
        </p>
      )}

      {/* FILTERS */}
      <div
        className="rounded-xl p-4 mb-6 flex gap-4"
        style={{
          background:
            'var(--card)',
          border:
            '1px solid var(--border)'
        }}
      >
        {/* COURSE FILTER */}
        <div className="flex-1">
          <label
            className="block text-xs font-semibold mb-1.5"
            style={{
              color:
                'var(--muted-foreground)'
            }}
          >
            Course
          </label>

          <select
            value={courseFilter}
            onChange={(e) => {
              const value =
                e.target.value

              setCourseFilter(value)

              // Reset group filter
              setGroupFilter('')
            }}
            className="w-full px-3 py-2.5 rounded-lg text-sm"
            style={{
              border:
                '1px solid var(--border)',
              background:
                'var(--muted)'
            }}
          >
            <option value="">
              All Courses
            </option>

            {courses.map(
              (course) => (
                <option
                  key={course.id}
                  value={course.id}
                >
                  {course.name}
                </option>
              )
            )}
          </select>
        </div>

        {/* GROUP FILTER */}
        <div className="flex-1">
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
            value={groupFilter}
            onChange={(e) => {
              const value =
                e.target.value

              setGroupFilter(value)
            }}
            className="w-full px-3 py-2.5 rounded-lg text-sm"
            style={{
              border:
                '1px solid var(--border)',
              background:
                'var(--muted)'
            }}
          >
            <option value="">
              All Groups
            </option>

            {filteredGroups.map(
              (group) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.name}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* TEAMS */}
      {loading ? (
        <div
          className="text-sm py-10 text-center"
          style={{
            color:
              'var(--muted-foreground)'
          }}
        >
          Loading teams...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{
            background:
              'var(--card)',
            border:
              '1px solid var(--border)'
          }}
        >
          <p className="text-sm font-medium">
            No teams found.
          </p>

          <p
            className="text-xs mt-1"
            style={{
              color:
                'var(--muted-foreground)'
            }}
          >
            Create a team to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTeams.map(
            (team) => (
              <div
                key={team.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background:
                    'var(--card)',
                  border:
                    '1px solid var(--border)'
                }}
              >

                {/* TEAM HEADER */}
                <div
                  className="px-5 py-4 flex items-center gap-3"
                  style={{
                    background:
                      'var(--muted)',
                    borderBottom:
                      '1px solid var(--border)'
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{
                      background:
                        '#EDE9FE',
                      color:
                        '#6D28D9'
                    }}
                  >
                    {team.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      {team.name}
                    </p>

                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color:
                          'var(--muted-foreground)'
                      }}
                    >
                      {team.course_name
                        ? `${team.course_name} · `
                        : ''}
                      {team.group_name ??
                        `Group ${team.group_id}`}
                    </p>
                  </div>

                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() =>
                        openMembers(team)
                      }
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        background:
                          'var(--secondary)',
                        border:
                          '1px solid var(--border)'
                      }}
                    >
                      Members
                    </button>

                    <button
                      onClick={() =>
                        openEdit(team)
                      }
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        background:
                          'var(--secondary)',
                        border:
                          '1px solid var(--border)'
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        remove(team)
                      }
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        background:
                          '#FEE2E2',
                        color:
                          '#B91C1C',
                        border:
                          'none'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* MEMBERS */}
                <div className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {team.members?.length ? (
                      team.members.map(
                        (member) => (
                          <span
                            key={member.id}
                            className="text-xs px-2.5 py-1 rounded-lg"
                            style={{
                              background:
                                'var(--secondary)',
                              color:
                                'var(--muted-foreground)'
                            }}
                          >
                            {member.name}
                          </span>
                        )
                      )
                    ) : (
                      <span
                        className="text-xs"
                        style={{
                          color:
                            'var(--muted-foreground)'
                        }}
                      >
                        No members yet
                      </span>
                    )}
                  </div>

                  <p
                    className="text-xs mt-3"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    {team.members?.length ?? 0}{' '}
                    member
                    {(team.members?.length ?? 0) !==
                    1
                      ? 's'
                      : ''}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(modal === 'create' ||
        modal === 'edit') && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            background:
              'rgba(0,0,0,.4)'
          }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{
              background:
                'var(--card)',
              border:
                '1px solid var(--border)'
            }}
          >
            <h2 className="text-lg font-semibold mb-5">
              {modal === 'create'
                ? 'Create Team'
                : 'Edit Team'}
            </h2>

            <div className="space-y-4">

              {/* GROUP FOR NEW TEAM */}
              {modal === 'create' && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Group
                  </label>

                  <select
                    value={createGroupId}
                    onChange={(e) => {
                      const value =
                        e.target.value

                      setCreateGroupId(value)

                      loadGroupStudents(value)
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm"
                    style={{
                      border:
                        '1px solid var(--border)',
                      background:
                        'var(--muted)'
                    }}
                  >
                    <option value="">
                      Select group
                    </option>

                    {filteredGroups.map(
                      (group) => (
                        <option
                          key={group.id}
                          value={group.id}
                        >
                          {group.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              {/* TEAM NAME */}
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Team name
                </label>

                <input
                  value={teamName}
                  onChange={(e) =>
                    setTeamName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Team Alpha"
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--muted)'
                  }}
                />
              </div>

              {/* STUDENTS OF SELECTED GROUP */}
              {modal === 'create' && (
                <div>
                  <label className="block text-xs font-semibold mb-2">
                    Students
                  </label>

                  {!createGroupId ? (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          'var(--muted-foreground)'
                      }}
                    >
                      Select a group first.
                    </p>
                  ) : loadingStudents ? (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          'var(--muted-foreground)'
                      }}
                    >
                      Loading students...
                    </p>
                  ) : groupStudents.length ===
                    0 ? (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          'var(--muted-foreground)'
                      }}
                    >
                      No students in this group.
                    </p>
                  ) : (
                    <div
                      className="max-h-48 overflow-y-auto rounded-lg"
                      style={{
                        border:
                          '1px solid var(--border)'
                      }}
                    >
                      {groupStudents.map(
                        (student) => (
                          <label
                            key={student.id}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                            style={{
                              borderBottom:
                                '1px solid var(--border)'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(
                                String(
                                  student.id
                                )
                              )}
                              onChange={() =>
                                toggleStudent(
                                  String(
                                    student.id
                                  )
                                )
                              }
                            />

                            <div>
                              <p className="text-sm">
                                {student.name}
                              </p>

                              <p
                                className="text-xs"
                                style={{
                                  color:
                                    'var(--muted-foreground)'
                                }}
                              >
                                {student.email}
                              </p>
                            </div>
                          </label>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setModal(null)
                  setError('')
                }}
                className="flex-1 py-2.5 rounded-lg"
                style={{
                  border:
                    '1px solid var(--border)'
                }}
              >
                Cancel
              </button>

              <button
                onClick={saveTeam}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg font-semibold"
                style={{
                  background:
                    'var(--primary)',
                  color: 'white',
                  border: 'none',
                  opacity: saving
                    ? 0.7
                    : 1
                }}
              >
                {saving
                  ? 'Saving...'
                  : modal === 'create'
                  ? 'Create Team'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS MODAL */}
      {modal === 'members' &&
        selectedTeam && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{
              background:
                'rgba(0,0,0,.4)'
            }}
          >
            <div
              className="rounded-xl p-6 w-full max-w-md"
              style={{
                background:
                  'var(--card)',
                border:
                  '1px solid var(--border)'
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedTeam.name}
                  </h2>

                  <p
                    className="text-xs mt-1"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    Manage team members
                  </p>
                </div>

                <button
                  onClick={() =>
                    setModal(null)
                  }
                  className="text-sm"
                >
                  ✕
                </button>
              </div>

              {/* CURRENT MEMBERS */}
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2">
                  Current members
                </p>

                {teamStudents.length ===
                0 ? (
                  <p
                    className="text-sm"
                    style={{
                      color:
                        'var(--muted-foreground)'
                    }}
                  >
                    No members yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {teamStudents.map(
                      (member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg"
                          style={{
                            background:
                              'var(--secondary)'
                          }}
                        >
                          <div>
                            <p className="text-sm">
                              {member.name}
                            </p>

                            <p
                              className="text-xs"
                              style={{
                                color:
                                  'var(--muted-foreground)'
                              }}
                            >
                              {member.email}
                            </p>

                            {editingGithubId === member.id ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>github.com/</span>
                                <input
                                  autoFocus
                                  value={githubDraft}
                                  onChange={(e) => setGithubDraft(e.target.value)}
                                  placeholder="username"
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ border: '1px solid var(--border)', background: 'var(--card)', outline: 'none', width: '130px' }}
                                />
                                <button
                                  onClick={() => saveGithubUsername(member.id)}
                                  disabled={savingGithub}
                                  className="text-xs px-2 py-1 rounded font-medium"
                                  style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: savingGithub ? 'default' : 'pointer' }}
                                >
                                  {savingGithub ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingGithubId(null)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingGithubId(member.id); setGithubDraft(member.github_username || '') }}
                                className="flex items-center gap-1 mt-0.5 text-xs"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: member.github_username ? 'var(--primary)' : 'var(--muted-foreground)' }}
                              >
                                ⎇ {member.github_username || 'Add GitHub username'}
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              removeMember(
                                member.id
                              )
                            }
                            className="text-xs"
                            style={{
                              color:
                                '#B91C1C'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* ADD MEMBER */}
              <div>
                <p className="text-xs font-semibold mb-2">
                  Add student
                </p>

                <div
                  className="max-h-40 overflow-y-auto rounded-lg"
                  style={{
                    border:
                      '1px solid var(--border)'
                  }}
                >
                  {availableStudents.length ===
                  0 ? (
                    <p
                      className="p-3 text-sm"
                      style={{
                        color:
                          'var(--muted-foreground)'
                      }}
                    >
                      All students are already
                      members.
                    </p>
                  ) : (
                    availableStudents.map(
                      (student) => (
                        <button
                          key={student.id}
                          onClick={() =>
                            addMember(
                              student.id
                            )
                          }
                          className="w-full text-left px-3 py-2.5"
                          style={{
                            borderBottom:
                              '1px solid var(--border)'
                          }}
                        >
                          <p className="text-sm">
                            {student.name}
                          </p>

                          <p
                            className="text-xs"
                            style={{
                              color:
                                'var(--muted-foreground)'
                            }}
                          >
                            {student.email}
                          </p>
                        </button>
                      )
                    )
                  )}
                </div>
              </div>

              <button
                onClick={() =>
                  setModal(null)
                }
                className="w-full mt-5 py-2.5 rounded-lg"
                style={{
                  border:
                    '1px solid var(--border)'
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
    </div>
  )
}