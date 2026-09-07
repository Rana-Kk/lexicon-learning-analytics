import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminTeams from './AdminTeams'
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
  removeTeamMember,
  apiFetch,
  ApiError,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getTeams: vi.fn(),
    getGroups: vi.fn(),
    getCourses: vi.fn(),
    getUsers: vi.fn(),
    getGroupStudents: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
    apiFetch: vi.fn(),
  }
})

const mockedGetTeams = vi.mocked(getTeams)
const mockedGetGroups = vi.mocked(getGroups)
const mockedGetCourses = vi.mocked(getCourses)
const mockedGetUsers = vi.mocked(getUsers)
const mockedGetGroupStudents = vi.mocked(getGroupStudents)
const mockedCreateTeam = vi.mocked(createTeam)
const mockedUpdateTeam = vi.mocked(updateTeam)
const mockedDeleteTeam = vi.mocked(deleteTeam)
const mockedAddTeamMember = vi.mocked(addTeamMember)
const mockedRemoveTeamMember = vi.mocked(removeTeamMember)
const mockedApiFetch = vi.mocked(apiFetch)

const course = { id: 100, name: 'Course A' }
const group = { id: 10, name: 'Group A', course_id: 100 }
const member = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', github_username: 'adaL' }
const otherStudent = { id: 2, name: 'Grace Hopper', email: 'grace@example.com' }
const team = {
  id: 5,
  name: 'Team Alpha',
  group_id: 10,
  group_name: 'Group A',
  course_id: 100,
  course_name: 'Course A',
  members: [member],
}

function mockLoad(overrides: { teams?: any[]; groups?: any[]; courses?: any[]; students?: any[] } = {}) {
  mockedGetTeams.mockResolvedValue({ data: overrides.teams ?? [team] } as any)
  mockedGetGroups.mockResolvedValue({ data: overrides.groups ?? [group] } as any)
  mockedGetCourses.mockResolvedValue({ data: overrides.courses ?? [course] } as any)
  mockedGetUsers.mockResolvedValue({ data: overrides.students ?? [member, otherStudent] } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<AdminTeams />)
  await waitFor(() => expect(screen.queryByText('Loading teams...')).not.toBeInTheDocument())
}

describe('AdminTeams', () => {
  beforeEach(() => {
    mockedGetTeams.mockReset()
    mockedGetGroups.mockReset()
    mockedGetCourses.mockReset()
    mockedGetUsers.mockReset()
    mockedGetGroupStudents.mockReset()
    mockedCreateTeam.mockReset()
    mockedUpdateTeam.mockReset()
    mockedDeleteTeam.mockReset()
    mockedAddTeamMember.mockReset()
    mockedRemoveTeamMember.mockReset()
    mockedApiFetch.mockReset()
  })

  it('lists teams with their course, group and members', async () => {
    await renderLoaded()

    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Course A · Group A')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('1 member')).toBeInTheDocument()
    expect(screen.getByText('1 teams')).toBeInTheDocument()
  })

  it('shows a placeholder group label when there is no group name', async () => {
    await renderLoaded({ teams: [{ ...team, group_name: undefined, course_name: undefined }] })

    expect(screen.getByText('Group 10')).toBeInTheDocument()
  })

  it('shows "No members yet" and pluralises the member count', async () => {
    await renderLoaded({ teams: [{ ...team, members: [] }] })

    expect(screen.getByText('No members yet')).toBeInTheDocument()
    expect(screen.getByText('0 members')).toBeInTheDocument()
  })

  it('shows an empty state when there are no teams', async () => {
    await renderLoaded({ teams: [] })

    expect(screen.getByText('No teams found.')).toBeInTheDocument()
    expect(screen.getByText('Create a team to get started.')).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedGetTeams.mockRejectedValue(new ApiError(500, 'Could not reach the server'))
    mockedGetGroups.mockResolvedValue({ data: [] } as any)
    mockedGetCourses.mockResolvedValue({ data: [] } as any)
    mockedGetUsers.mockResolvedValue({ data: [] } as any)

    render(<AdminTeams />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('filters teams by course and group', async () => {
    const otherTeam = { ...team, id: 6, name: 'Team Beta', group_id: 20, course_id: 200, group_name: 'Group B', course_name: 'Course B' }
    await renderLoaded({
      teams: [team, otherTeam],
      groups: [group, { id: 20, name: 'Group B', course_id: 200 }],
      courses: [course, { id: 200, name: 'Course B' }],
    })

    expect(screen.getByText('Team Beta')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByDisplayValue('All Courses'), 'Course A')

    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Team Beta')).not.toBeInTheDocument()
    expect(screen.getByText('1 teams')).toBeInTheDocument()
  })

  it('resets the group filter when the course filter changes', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(screen.getByDisplayValue('All Groups'), 'Group A')
    await user.selectOptions(screen.getByDisplayValue('All Courses'), 'Course A')

    expect(screen.getByDisplayValue('All Groups')).toBeInTheDocument()
  })

  describe('create team', () => {
    it('requires a team name', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await user.click(screen.getByRole('button', { name: '+ Create Team' }))
      await user.click(screen.getByRole('button', { name: 'Create Team' }))

      expect(await screen.findByText('Team name is required')).toBeInTheDocument()
      expect(mockedCreateTeam).not.toHaveBeenCalled()
    })

    it('requires a group to be selected', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await user.click(screen.getByRole('button', { name: '+ Create Team' }))
      await user.type(screen.getByPlaceholderText('e.g. Team Alpha'), 'Team Gamma')
      await user.click(screen.getByRole('button', { name: 'Create Team' }))

      expect(await screen.findByText('Please select a group first')).toBeInTheDocument()
      expect(mockedCreateTeam).not.toHaveBeenCalled()
    })

    it('loads students for the selected group', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedGetGroupStudents.mockResolvedValue({ data: [member, otherStudent] } as any)

      await user.click(screen.getByRole('button', { name: '+ Create Team' }))
      await user.selectOptions(screen.getByDisplayValue('Select group'), 'Group A')

      expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
      expect(mockedGetGroupStudents).toHaveBeenCalledWith('10')
    })

    it('shows "No students in this group." when the group has none', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedGetGroupStudents.mockResolvedValue({ data: [] } as any)

      await user.click(screen.getByRole('button', { name: '+ Create Team' }))
      await user.selectOptions(screen.getByDisplayValue('Select group'), 'Group A')

      expect(await screen.findByText('No students in this group.')).toBeInTheDocument()
    })

    it('creates a team with the selected students', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedGetGroupStudents.mockResolvedValue({ data: [member, otherStudent] } as any)
      mockedCreateTeam.mockResolvedValue({} as any)

      await user.click(screen.getByRole('button', { name: '+ Create Team' }))
      await user.type(screen.getByPlaceholderText('e.g. Team Alpha'), 'Team Gamma')
      await user.selectOptions(screen.getByDisplayValue('Select group'), 'Group A')
      await user.click(await screen.findByText('Grace Hopper'))
      await user.click(screen.getByRole('button', { name: 'Create Team' }))

      await waitFor(() =>
        expect(mockedCreateTeam).toHaveBeenCalledWith({
          group_id: '10',
          name: 'Team Gamma',
          student_ids: ['2'],
        })
      )
    })
  })

  describe('edit team', () => {
    it('pre-fills the team name and updates it', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedUpdateTeam.mockResolvedValue({} as any)

      await user.click(screen.getByRole('button', { name: 'Edit' }))
      expect(screen.getByPlaceholderText('e.g. Team Alpha')).toHaveValue('Team Alpha')

      await user.clear(screen.getByPlaceholderText('e.g. Team Alpha'))
      await user.type(screen.getByPlaceholderText('e.g. Team Alpha'), 'Renamed Team')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => expect(mockedUpdateTeam).toHaveBeenCalledWith(5, { name: 'Renamed Team' }))
    })

    it('shows an error message when saving fails', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedUpdateTeam.mockRejectedValue(new ApiError(400, 'Name already taken'))

      await user.click(screen.getByRole('button', { name: 'Edit' }))
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(await screen.findByText('Name already taken')).toBeInTheDocument()
    })
  })

  describe('delete team', () => {
    it('deletes a team after confirmation', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      await renderLoaded()
      mockedDeleteTeam.mockResolvedValue({} as any)

      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(mockedDeleteTeam).toHaveBeenCalledWith(5))
    })

    it('does not delete a team when confirmation is dismissed', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      await renderLoaded()

      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(mockedDeleteTeam).not.toHaveBeenCalled()
    })
  })

  describe('members modal', () => {
    it('lists current members and available students to add', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await user.click(screen.getByRole('button', { name: 'Members' }))

      expect(screen.getByText('Current members')).toBeInTheDocument()
      const membersSection = screen.getByText('Current members').closest('div')!
      expect(within(membersSection).getByText('Ada Lovelace')).toBeInTheDocument()
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    })

    it('shows "All students are already members." when there is nobody left to add', async () => {
      const user = userEvent.setup()
      await renderLoaded({ students: [member] })

      await user.click(screen.getByRole('button', { name: 'Members' }))

      expect(screen.getByText('All students are already members.')).toBeInTheDocument()
    })

    it('adds a member and refreshes the team', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      const updatedTeam = { ...team, members: [member, otherStudent] }
      mockedAddTeamMember.mockResolvedValue({} as any)
      mockedGetTeams.mockResolvedValue({ data: [updatedTeam] } as any)

      await user.click(screen.getByRole('button', { name: 'Members' }))
      await user.click(screen.getByText('Grace Hopper'))

      await waitFor(() => expect(mockedAddTeamMember).toHaveBeenCalledWith(5, 2))
      expect(await screen.findByText('All students are already members.')).toBeInTheDocument()
    })

    it('removes a member and refreshes the team', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      const updatedTeam = { ...team, members: [] }
      mockedRemoveTeamMember.mockResolvedValue({} as any)
      mockedGetTeams.mockResolvedValue({ data: [updatedTeam] } as any)

      await user.click(screen.getByRole('button', { name: 'Members' }))
      await user.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => expect(mockedRemoveTeamMember).toHaveBeenCalledWith(5, 1))
      expect(await screen.findByText('No members yet.')).toBeInTheDocument()
    })

    it('saves a GitHub username for a member', async () => {
      const user = userEvent.setup()
      await renderLoaded({ teams: [{ ...team, members: [{ ...member, github_username: undefined }] }] })
      const updatedTeam = { ...team, members: [{ ...member, github_username: 'newhandle' }] }
      mockedApiFetch.mockResolvedValue({} as any)
      mockedGetTeams.mockResolvedValue({ data: [updatedTeam] } as any)

      await user.click(screen.getByRole('button', { name: 'Members' }))
      await user.click(screen.getByRole('button', { name: /Add GitHub username/ }))
      await user.type(screen.getByPlaceholderText('username'), 'newhandle')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(mockedApiFetch).toHaveBeenCalledWith(
          '/users/1',
          expect.objectContaining({ method: 'PUT', body: JSON.stringify({ github_username: 'newhandle' }) })
        )
      )
    })

    it('closes the members modal with Done', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await user.click(screen.getByRole('button', { name: 'Members' }))
      await user.click(screen.getByRole('button', { name: 'Done' }))

      expect(screen.queryByText('Current members')).not.toBeInTheDocument()
    })
  })
})
