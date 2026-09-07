import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherGroups from './TeacherGroups'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/api')>('../../lib/api')

  return {
    ...actual,
    apiFetch: vi.fn(),
    getMyGroups: vi.fn(),
    createGroup: vi.fn(),
    getCourses: vi.fn(),
    getUsers: vi.fn(),
    getGroupStudents: vi.fn(),
    addStudentToGroup: vi.fn(),
    removeStudentFromGroup: vi.fn(),
    getTeams: vi.fn(),
    createTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
    updateTeam: vi.fn(),
    getAssessments: vi.fn(),
  }
})

const mocked = {
  apiFetch: vi.mocked(api.apiFetch),
  createGroup: vi.mocked(api.createGroup),
  getCourses: vi.mocked(api.getCourses),
  getUsers: vi.mocked(api.getUsers),
  getGroupStudents: vi.mocked(api.getGroupStudents),
  addStudentToGroup: vi.mocked(api.addStudentToGroup),
  removeStudentFromGroup: vi.mocked(api.removeStudentFromGroup),
  getTeams: vi.mocked(api.getTeams),
  createTeam: vi.mocked(api.createTeam),
  deleteTeam: vi.mocked(api.deleteTeam),
  addTeamMember: vi.mocked(api.addTeamMember),
  removeTeamMember: vi.mocked(api.removeTeamMember),
  updateTeam: vi.mocked(api.updateTeam),
  getAssessments: vi.mocked(api.getAssessments),
}

const GROUP_A = {
  id: 1,
  name: 'Group A',
  course_id: 10,
  course_name: 'Full Stack',
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-06-01T00:00:00Z',
  student_count: 2,
}

function mockGroupsList(groups: any[] = [GROUP_A]) {
  mocked.apiFetch.mockResolvedValue({ data: groups } as any)
}

describe('TeacherGroups - list view', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before groups resolve', () => {
    mocked.apiFetch.mockReturnValue(new Promise(() => {}) as any)

    render(<TeacherGroups />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an empty state when there are no groups', async () => {
    mockGroupsList([])

    render(<TeacherGroups />)

    expect(
      await screen.findByText('No groups assigned to you yet.')
    ).toBeInTheDocument()
  })

  it('shows an error message when loading groups fails with an ApiError', async () => {
    mocked.apiFetch.mockRejectedValue(
      new api.ApiError(500, 'Server exploded')
    )

    render(<TeacherGroups />)

    expect(
      await screen.findByText('Server exploded')
    ).toBeInTheDocument()
  })

  it('shows a generic error message for a non-ApiError failure', async () => {
    mocked.apiFetch.mockRejectedValue(new Error('network down'))

    render(<TeacherGroups />)

    expect(
      await screen.findByText('Failed to load groups')
    ).toBeInTheDocument()
  })

  it('renders each group with course name, date range and student count', async () => {
    mockGroupsList([GROUP_A])

    render(<TeacherGroups />)

    expect(await screen.findByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Full Stack')).toBeInTheDocument()
    expect(
      screen.getByText('2024-01-01 → 2024-06-01')
    ).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('falls back to 0 students when the count is missing', async () => {
    mockGroupsList([{ id: 2, name: 'Group B', course_id: 1 }])

    render(<TeacherGroups />)

    await screen.findByText('Group B')

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('pluralizes the group count in the header', async () => {
    mockGroupsList([
      GROUP_A,
      { id: 2, name: 'Group B', course_id: 1 },
    ])

    render(<TeacherGroups />)

    expect(
      await screen.findByText('2 groups within your scope')
    ).toBeInTheDocument()
  })

  it('uses singular wording for a single group', async () => {
    mockGroupsList([GROUP_A])

    render(<TeacherGroups />)

    expect(
      await screen.findByText('1 group within your scope')
    ).toBeInTheDocument()
  })
})

describe('TeacherGroups - create group modal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates required fields before submitting', async () => {
    const user = userEvent.setup()

    mockGroupsList([])
    mocked.getCourses.mockResolvedValue({ data: [] } as any)

    render(<TeacherGroups />)

    await screen.findByText(/No groups/i)

    await user.click(
      screen.getByRole('button', { name: /Create Group/i })
    )

    await user.click(
      screen.getByRole('button', { name: 'Create Group' })
    )

    expect(
      await screen.findByText('Group name is required')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Please select a course')
    ).toBeInTheDocument()
  })

  it('shows a load error when courses fail to load', async () => {
    const user = userEvent.setup()

    mockGroupsList([])
    mocked.getCourses.mockRejectedValue(new Error('boom'))

    render(<TeacherGroups />)

    await screen.findByText(/No groups/i)

    await user.click(
      screen.getByRole('button', { name: /Create Group/i })
    )

    expect(
      await screen.findByText('Failed to load courses')
    ).toBeInTheDocument()
  })

  it('preselects the first course once courses load', async () => {
    const user = userEvent.setup()

    mockGroupsList([])

    mocked.getCourses.mockResolvedValue({
      data: [{ id: 5, name: 'React Course' }],
    } as any)

    render(<TeacherGroups />)

    await screen.findByText(/No groups/i)

    await user.click(
      screen.getByRole('button', { name: /Create Group/i })
    )

    const select = await screen.findByDisplayValue('React Course')

    expect(select).toBeInTheDocument()
  })

  it('creates a group and shows its detail view on success', async () => {
    const user = userEvent.setup()

    mockGroupsList([])

    mocked.getCourses.mockResolvedValue({
      data: [{ id: 5, name: 'React Course' }],
    } as any)

    mocked.createGroup.mockResolvedValue({
      data: {
        id: 99,
        name: 'New Group',
        course_id: 5,
        course_name: 'React Course',
        student_count: 0,
      },
    } as any)

    mocked.getGroupStudents.mockResolvedValue({
      data: [],
    } as any)

    render(<TeacherGroups />)

    await screen.findByText(/No groups/i)

    await user.click(
      screen.getByRole('button', { name: /Create Group/i })
    )

    await user.type(
      screen.getByPlaceholderText('e.g. FSWD-2026-C'),
      'New Group'
    )

    await user.click(
      screen.getByRole('button', { name: 'Create Group' })
    )

    expect(mocked.createGroup).toHaveBeenCalledWith({
      course_id: 5,
      name: 'New Group',
      start_date: null,
      end_date: null,
    })

    expect(await screen.findByText('← Groups')).toBeInTheDocument()
  })

  it('shows the API error message when group creation fails', async () => {
    const user = userEvent.setup()

    mockGroupsList([])

    mocked.getCourses.mockResolvedValue({
      data: [{ id: 5, name: 'React Course' }],
    } as any)

    mocked.createGroup.mockRejectedValue(
      new api.ApiError(409, 'Group already exists')
    )

    render(<TeacherGroups />)

    await screen.findByText(/No groups/i)

    await user.click(
      screen.getByRole('button', { name: /Create Group/i })
    )

    await user.type(
      screen.getByPlaceholderText('e.g. FSWD-2026-C'),
      'Dup Group'
    )

    await user.click(
      screen.getByRole('button', { name: 'Create Group' })
    )

    expect(
      await screen.findByText('Group already exists')
    ).toBeInTheDocument()
  })

  it('closes the modal on cancel', async () => {
    const user = userEvent.setup()

    mockGroupsList([])
    mocked.getCourses.mockResolvedValue({ data: [] } as any)

    render(<TeacherGroups />)

    await screen.findByText(/No groups/i)

    await user.click(
      screen.getByRole('button', { name: /Create Group/i })
    )

    expect(
      screen.getByText('Create New Group')
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Cancel' })
    )

    expect(
      screen.queryByText('Create New Group')
    ).not.toBeInTheDocument()
  })
})

describe('TeacherGroups - GroupDetail students tab', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the empty state when there are no students', async () => {
    mockGroupsList([GROUP_A])
    mocked.getGroupStudents.mockResolvedValue({ data: [] } as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))

    expect(
      await screen.findByText('No students yet.')
    ).toBeInTheDocument()
  })

  it('renders a row for each student', async () => {
    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Sam',
          email: 'sam@x.com',
          github_username: 'samgh',
        },
        {
          id: 2,
          name: 'Robin',
          email: 'robin@x.com',
        },
      ],
    } as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))

    expect(await screen.findByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('sam@x.com')).toBeInTheDocument()
    expect(screen.getByText('samgh')).toBeInTheDocument()
    expect(screen.getByText('Robin')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('removes a student and decrements the group count', async () => {
    const user = userEvent.setup()

    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [{ id: 1, name: 'Sam', email: 'sam@x.com' }],
    } as any)

    mocked.removeStudentFromGroup.mockResolvedValue({} as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))
    await screen.findByText('Sam')

    await user.click(
      screen.getByRole('button', { name: 'Remove' })
    )

    expect(mocked.removeStudentFromGroup).toHaveBeenCalledWith(
      GROUP_A.id,
      1
    )

    await waitFor(() =>
      expect(
        screen.getByText('No students yet.')
      ).toBeInTheDocument()
    )
  })

  it('shows an alert when removing a student fails', async () => {
    const user = userEvent.setup()
    const alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation(() => {})

    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [{ id: 1, name: 'Sam', email: 'sam@x.com' }],
    } as any)

    mocked.removeStudentFromGroup.mockRejectedValue(
      new api.ApiError(400, 'Cannot remove')
    )

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))
    await screen.findByText('Sam')

    await user.click(
      screen.getByRole('button', { name: 'Remove' })
    )

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Cannot remove')
    )

    alertSpy.mockRestore()
  })

  it('opens the student detail view when clicking a student name', async () => {
    const user = userEvent.setup()

    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [{ id: 1, name: 'Sam', email: 'sam@x.com' }],
    } as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))

    await user.click(
      await screen.findByRole('button', { name: 'Sam' })
    )

    await waitFor(() =>
      expect(
        screen.queryByText('← Groups')
      ).not.toBeInTheDocument()
    )
  })
})

describe('TeacherGroups - Add Student modal', () => {
  beforeEach(() => vi.clearAllMocks())

  async function openAddStudentModal(options?: {
    groupStudents?: any[]
    users?: any[]
  }) {
    const groupStudents = options?.groupStudents ?? []

    const users =
      options?.users ?? [
        {
          id: 1,
          name: 'Existing',
          email: 'existing@x.com',
        },
      ]

    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: groupStudents,
    } as any)

    mocked.getUsers.mockResolvedValue({
      data: users,
    } as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))

    if (groupStudents.length === 0) {
      await screen.findByText('No students yet.')
    }

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add Student' })
    )

    // IMPORTANT:
    // There are two "Add Student" texts in the modal:
    // the heading and the submit button.
    // Therefore we specifically target the heading.
    await screen.findByRole('heading', {
      name: 'Add Student',
    })
  }

  it('flags an invalid email', async () => {
    const user = userEvent.setup()

    await openAddStudentModal()

    await user.type(
      screen.getByPlaceholderText('student@lexicon.edu'),
      'not-an-email'
    )

    await user.click(
      screen.getByRole('button', { name: 'Find' })
    )

    expect(
      await screen.findByText(
        'Please enter a valid email address.'
      )
    ).toBeInTheDocument()
  })

  it('reports when no student matches the email', async () => {
    const user = userEvent.setup()

    await openAddStudentModal()

    await user.type(
      screen.getByPlaceholderText('student@lexicon.edu'),
      'nobody@x.com'
    )

    await user.click(
      screen.getByRole('button', { name: 'Find' })
    )

    expect(
      await screen.findByText(
        'No student found with this email address.'
      )
    ).toBeInTheDocument()
  })

  it('reports when the student is already in the group', async () => {
    const user = userEvent.setup()

    await openAddStudentModal({
      groupStudents: [
        {
          id: 1,
          name: 'Existing',
          email: 'existing@x.com',
        },
      ],
      users: [
        {
          id: 1,
          name: 'Existing',
          email: 'existing@x.com',
        },
      ],
    })

    await user.type(
      screen.getByPlaceholderText('student@lexicon.edu'),
      'existing@x.com'
    )

    await user.click(
      screen.getByRole('button', { name: 'Find' })
    )

    expect(
      await screen.findByText(/already in Group A/)
    ).toBeInTheDocument()
  })

  it('finds a matching student and adds them to the group', async () => {
    const user = userEvent.setup()

    await openAddStudentModal()

    mocked.addStudentToGroup.mockResolvedValue({} as any)

    await user.type(
      screen.getByPlaceholderText('student@lexicon.edu'),
      'Existing@X.com'
    )

    await user.click(
      screen.getByRole('button', { name: 'Find' })
    )

    expect(
      await screen.findByText('✓ Found')
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /^Add Student$/,
      })
    )

    expect(
      mocked.addStudentToGroup
    ).toHaveBeenCalledWith(GROUP_A.id, 1)

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: 'Add Student',
        })
      ).not.toBeInTheDocument()
    })
  })

  it('shows an error and stays open when adding the student fails', async () => {
    const user = userEvent.setup()

    await openAddStudentModal()

    mocked.addStudentToGroup.mockRejectedValue(
      new api.ApiError(400, 'Add failed')
    )

    await user.type(
      screen.getByPlaceholderText('student@lexicon.edu'),
      'existing@x.com'
    )

    await user.click(
      screen.getByRole('button', { name: 'Find' })
    )

    await screen.findByText('✓ Found')

    await user.click(
      screen.getByRole('button', {
        name: /^Add Student$/,
      })
    )

    expect(
      await screen.findByText('Add failed')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: 'Add Student',
      })
    ).toBeInTheDocument()
  })

  it('looks up on Enter key press', async () => {
    const user = userEvent.setup()

    await openAddStudentModal()

    const input = screen.getByPlaceholderText(
      'student@lexicon.edu'
    )

    await user.type(
      input,
      'existing@x.com{Enter}'
    )

    expect(
      await screen.findByText('✓ Found')
    ).toBeInTheDocument()
  })
})
describe('TeacherGroups - GroupDetail teams tab', () => {
  beforeEach(() => vi.clearAllMocks())

  async function openTeamsTab(teams: any[] = []) {
    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Sam',
          email: 'sam@x.com',
        },
      ],
    } as any)

    mocked.getTeams.mockResolvedValue({
      data: teams,
    } as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))

    // Sam exists in the mocked group, so wait for the student list
    // to finish loading instead of waiting for the empty state.
    await screen.findByText('Sam')

    await userEvent.click(
      screen.getByRole('button', { name: /^Teams/ })
    )
  }

  it('shows an empty state when there are no teams', async () => {
    await openTeamsTab([])

    expect(
      await screen.findByText(
        'No teams yet. Create teams to organise students.'
      )
    ).toBeInTheDocument()
  })

  it('creates a team with the selected students', async () => {
    const user = userEvent.setup()

    await openTeamsTab([])

    mocked.createTeam.mockResolvedValue({
      data: {
        id: 1,
        name: 'Team Delta',
        group_id: GROUP_A.id,
        members: [],
      },
    } as any)

    await user.click(
      screen.getByRole('button', { name: '+ Create Team' })
    )

    await user.type(
      screen.getByPlaceholderText(
        'Team name e.g. Team Delta'
      ),
      'Team Delta'
    )

    await user.click(screen.getByRole('checkbox'))

    await user.click(
      screen.getByRole('button', { name: 'Create Team' })
    )

    expect(mocked.createTeam).toHaveBeenCalledWith({
      group_id: GROUP_A.id,
      name: 'Team Delta',
      student_ids: [1],
    })

    await waitFor(() =>
      expect(
        screen.getByText('Team Delta')
      ).toBeInTheDocument()
    )
  })

  it('disables the create button while the name is empty', async () => {
    const user = userEvent.setup()

    await openTeamsTab([])

    await user.click(
      screen.getByRole('button', { name: '+ Create Team' })
    )

    expect(
      screen.getByRole('button', { name: 'Create Team' })
    ).toBeDisabled()
  })

  it('alerts when team creation fails', async () => {
    const user = userEvent.setup()

    const alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation(() => {})

    await openTeamsTab([])

    mocked.createTeam.mockRejectedValue(
      new api.ApiError(400, 'Cannot create team')
    )

    await user.click(
      screen.getByRole('button', { name: '+ Create Team' })
    )

    await user.type(
      screen.getByPlaceholderText(
        'Team name e.g. Team Delta'
      ),
      'Team Delta'
    )

    await user.click(
      screen.getByRole('button', { name: 'Create Team' })
    )

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Cannot create team'
      )
    )

    alertSpy.mockRestore()
  })

  it('renders existing teams with their member count', async () => {
    await openTeamsTab([
      {
        id: 1,
        name: 'Team Alpha',
        group_id: GROUP_A.id,
        members: [
          {
            id: 1,
            name: 'Sam',
            email: 'sam@x.com',
          },
        ],
      },
    ])

    expect(
      await screen.findByText('Team Alpha')
    ).toBeInTheDocument()

    expect(
      screen.getByText('1 member')
    ).toBeInTheDocument()

    expect(screen.getByText('Sam')).toBeInTheDocument()
  })

  it('renames a team', async () => {
    const user = userEvent.setup()

    await openTeamsTab([
      {
        id: 1,
        name: 'Team Alpha',
        group_id: GROUP_A.id,
        members: [],
      },
    ])

    mocked.updateTeam.mockResolvedValue({
      data: { name: 'Team Beta' },
    } as any)

    await screen.findByText('Team Alpha')

    await user.click(
      screen.getByRole('button', { name: 'Edit' })
    )

    const input = screen.getByDisplayValue('Team Alpha')

    await user.clear(input)
    await user.type(input, 'Team Beta')

    await user.click(
      screen.getByRole('button', { name: 'Save' })
    )

    expect(mocked.updateTeam).toHaveBeenCalledWith(1, {
      name: 'Team Beta',
    })

    await waitFor(() =>
      expect(
        screen.getByText('Team Beta')
      ).toBeInTheDocument()
    )
  })

  it('deletes a team', async () => {
    const user = userEvent.setup()

    await openTeamsTab([
      {
        id: 1,
        name: 'Team Alpha',
        group_id: GROUP_A.id,
        members: [],
      },
    ])

    mocked.deleteTeam.mockResolvedValue({} as any)

    await screen.findByText('Team Alpha')

    await user.click(
      screen.getByRole('button', { name: 'Delete' })
    )

    expect(mocked.deleteTeam).toHaveBeenCalledWith(1)

    await waitFor(() =>
      expect(
        screen.queryByText('Team Alpha')
      ).not.toBeInTheDocument()
    )
  })

  it('adds an available student to a team via the select dropdown', async () => {
    const user = userEvent.setup()

    await openTeamsTab([
      {
        id: 1,
        name: 'Team Alpha',
        group_id: GROUP_A.id,
        members: [],
      },
    ])

    await screen.findByText('Team Alpha')

    mocked.addTeamMember.mockResolvedValue({} as any)

    mocked.getTeams.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Team Alpha',
          group_id: GROUP_A.id,
          members: [{ id: 1, name: 'Sam' }],
        },
      ],
    } as any)

    await user.selectOptions(
      screen.getByRole('combobox'),
      '1'
    )

    expect(mocked.addTeamMember).toHaveBeenCalledWith(1, 1)

    await waitFor(() =>
      expect(
        screen.queryByText('No members in this team.')
      ).not.toBeInTheDocument()
    )
  })

  it('removes a team member', async () => {
    const user = userEvent.setup()

    await openTeamsTab([
      {
        id: 1,
        name: 'Team Alpha',
        group_id: GROUP_A.id,
        members: [
          {
            id: 1,
            name: 'Sam',
            email: 'sam@x.com',
          },
        ],
      },
    ])

    await screen.findByText('Team Alpha')

    mocked.removeTeamMember.mockResolvedValue({} as any)

    mocked.getTeams.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Team Alpha',
          group_id: GROUP_A.id,
          members: [],
        },
      ],
    } as any)

    await user.click(
      screen.getByRole('button', { name: 'Remove' })
    )

    expect(mocked.removeTeamMember).toHaveBeenCalledWith(1, 1)

    await waitFor(() =>
      expect(
        screen.getByText('No members in this team.')
      ).toBeInTheDocument()
    )
  })
})

describe('TeacherGroups - GroupDetail assessments tab', () => {
  beforeEach(() => vi.clearAllMocks())

  async function openAssessmentsTab(assessments: any[] = []) {
    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [],
    } as any)

    mocked.getAssessments.mockResolvedValue({
      data: assessments,
    } as any)

    render(<TeacherGroups />)

    await userEvent.click(await screen.findByText('Group A'))

    await screen.findByText('No students yet.')

    await userEvent.click(
      screen.getByRole('button', { name: /^Assessments/ })
    )
  }

  it('shows an empty state when there are no assessments', async () => {
    await openAssessmentsTab([])

    expect(
      await screen.findByText(
        'No assessments assigned to this group yet.'
      )
    ).toBeInTheDocument()
  })

  it('renders assessment cards with due date and score', async () => {
    await openAssessmentsTab([
      {
        id: 1,
        title: 'Capstone Project',
        due_date: '2024-05-01T00:00:00Z',
        max_score: 100,
        submission_mode: 'team',
        type: 'Project',
      },
    ])

    expect(
      await screen.findByText('Capstone Project')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Due 2024-05-01 · 100 pts')
    ).toBeInTheDocument()

    expect(screen.getByText('team')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
  })

  it('shows an em dash when there is no due date', async () => {
    await openAssessmentsTab([
      {
        id: 1,
        title: 'No Due Date',
        due_date: null,
        max_score: 50,
        submission_mode: 'individual',
        type: 'Assignment',
      },
    ])

    expect(
      await screen.findByText('Due — · 50 pts')
    ).toBeInTheDocument()
  })
})

describe('TeacherGroups - navigation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns to the list view when clicking back', async () => {
    const user = userEvent.setup()

    mockGroupsList([GROUP_A])

    mocked.getGroupStudents.mockResolvedValue({
      data: [],
    } as any)

    render(<TeacherGroups />)

    await user.click(await screen.findByText('Group A'))

    await screen.findByText('← Groups')

    await user.click(screen.getByText('← Groups'))

    expect(
      await screen.findByText('Groups & Teams')
    ).toBeInTheDocument()
  })
})

