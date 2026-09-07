import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherCompetency from './TeacherCompetency'
import {
  getGroups,
  getGroupStudents,
  getStudentCompetencies,
  saveCompetency,
  getGroupCompetencies,
  createCompetency,
  deleteGroupCompetency,
  ApiError,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getGroups: vi.fn(),
    getGroupStudents: vi.fn(),
    getStudentCompetencies: vi.fn(),
    saveCompetency: vi.fn(),
    getGroupCompetencies: vi.fn(),
    createCompetency: vi.fn(),
    deleteGroupCompetency: vi.fn(),
  }
})

const mockedGetGroups = vi.mocked(getGroups)
const mockedGetGroupStudents = vi.mocked(getGroupStudents)
const mockedGetStudentCompetencies = vi.mocked(getStudentCompetencies)
const mockedSaveCompetency = vi.mocked(saveCompetency)
const mockedGetGroupCompetencies = vi.mocked(getGroupCompetencies)
const mockedCreateCompetency = vi.mocked(createCompetency)
const mockedDeleteGroupCompetency = vi.mocked(deleteGroupCompetency)

const group = { id: 1, name: 'Group A', course_name: 'Course A' }
const student = { id: 10, name: 'Ada Lovelace', email: 'ada@example.com' }
const groupCompetency = { id: 100, name: 'Communication', description: 'Explains ideas clearly' }
const studentCompetency = { competency_id: 100, name: 'Communication', score: 75, trend: 'up' }

function mockLoad(overrides: { groups?: any[]; students?: any[]; groupCompetencies?: any[]; studentCompetencies?: any[] } = {}) {
  mockedGetGroups.mockResolvedValue({ data: overrides.groups ?? [group] } as any)
  mockedGetGroupStudents.mockResolvedValue({ data: overrides.students ?? [student] } as any)
  mockedGetGroupCompetencies.mockResolvedValue({ data: overrides.groupCompetencies ?? [groupCompetency] } as any)
  mockedGetStudentCompetencies.mockResolvedValue({ data: overrides.studentCompetencies ?? [studentCompetency] } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherCompetency />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
  if ((overrides?.groups ?? [group]).length > 0) {
    await waitFor(() => expect(mockedGetGroupCompetencies).toHaveBeenCalled())
  }
}

describe('TeacherCompetency', () => {
  beforeEach(() => {
    mockedGetGroups.mockReset()
    mockedGetGroupStudents.mockReset()
    mockedGetStudentCompetencies.mockReset()
    mockedSaveCompetency.mockReset()
    mockedGetGroupCompetencies.mockReset()
    mockedCreateCompetency.mockReset()
    mockedDeleteGroupCompetency.mockReset()
  })

  it('shows a loading state before groups resolve', () => {
    mockedGetGroups.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherCompetency />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no groups', async () => {
    await renderLoaded({ groups: [] })

    expect(screen.getByText('No groups assigned.')).toBeInTheDocument()
  })

  it('shows an error message when loading groups fails', async () => {
    mockedGetGroups.mockRejectedValue(new ApiError(500, 'Could not reach the server'))
    render(<TeacherCompetency />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('lists competencies for the first group and student with their score', async () => {
    await renderLoaded()

    expect(screen.getByText('Competencies for Group A')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.getByText('Explains ideas clearly')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('75')).toBeInTheDocument()
  })

  it('shows an em dash when a competency has no description', async () => {
    await renderLoaded({ groupCompetencies: [{ ...groupCompetency, description: null }] })

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('defaults an unscored competency to 0', async () => {
    await renderLoaded({ studentCompetencies: [] })

    expect(screen.getByDisplayValue('0')).toBeInTheDocument()
  })

  it('shows an empty state when the group has no competencies yet', async () => {
    await renderLoaded({ groupCompetencies: [] })

    expect(screen.getByText('No competencies have been added to this group yet.')).toBeInTheDocument()
  })

  it('shows "No students available" when the group has no students', async () => {
    await renderLoaded({ students: [] })

    expect(screen.getByText('No students available')).toBeInTheDocument()
  })

  it('requires a name before adding a competency', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    expect(screen.getByRole('button', { name: '+ Add Competency' })).toBeDisabled()
  })

  it('adds a new competency and reloads the list', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateCompetency.mockResolvedValue({} as any)

    await user.type(screen.getByPlaceholderText('Competency name'), 'Teamwork')
    await user.type(screen.getByPlaceholderText('Description (optional)'), 'Works well with others')
    await user.click(screen.getByRole('button', { name: '+ Add Competency' }))

    await waitFor(() =>
      expect(mockedCreateCompetency).toHaveBeenCalledWith({
        name: 'Teamwork',
        description: 'Works well with others',
        group_id: 1,
      })
    )
    expect(await screen.findByText('Competency added successfully.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Competency name')).toHaveValue('')
  })

  it('shows an error message when adding a competency fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateCompetency.mockRejectedValue(new ApiError(400, 'Competency already exists'))

    await user.type(screen.getByPlaceholderText('Competency name'), 'Teamwork')
    await user.click(screen.getByRole('button', { name: '+ Add Competency' }))

    expect(await screen.findByText('Competency already exists')).toBeInTheDocument()
  })

  it('removes a competency after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteGroupCompetency.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(mockedDeleteGroupCompetency).toHaveBeenCalledWith(1, 100))
    expect(await screen.findByText('Competency removed from this group.')).toBeInTheDocument()
  })

  it('does not remove a competency when confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(mockedDeleteGroupCompetency).not.toHaveBeenCalled()
  })

  it('edits a score and saves all changes', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedSaveCompetency.mockResolvedValue({} as any)

    const scoreInput = await screen.findByDisplayValue('75')
    await user.clear(scoreInput)
    await user.type(scoreInput, '90')
    await user.click(screen.getByRole('button', { name: 'Save All Changes' }))

    await waitFor(() =>
      expect(mockedSaveCompetency).toHaveBeenCalledWith({
        student_id: 10,
        competency_id: 100,
        score: 90,
      })
    )
    expect(await screen.findByText('All competency scores saved successfully.')).toBeInTheDocument()
  })

  it('shows an error message when saving fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedSaveCompetency.mockRejectedValue(new ApiError(400, 'Score must be between 0 and 100'))

    await user.click(screen.getByRole('button', { name: 'Save All Changes' }))

    expect(await screen.findByText('Score must be between 0 and 100')).toBeInTheDocument()
  })

  it('disables Save All Changes when there is no student selected', async () => {
    await renderLoaded({ students: [] })

    expect(screen.getByRole('button', { name: 'Save All Changes' })).toBeDisabled()
  })

  it('switches groups and reloads competencies for the new group', async () => {
    const user = userEvent.setup()
    const secondGroup = { id: 2, name: 'Group B', course_name: 'Course B' }
    mockedGetGroups.mockResolvedValue({ data: [group, secondGroup] } as any)
    mockedGetGroupStudents.mockResolvedValue({ data: [student] } as any)
    mockedGetGroupCompetencies.mockResolvedValue({ data: [groupCompetency] } as any)
    mockedGetStudentCompetencies.mockResolvedValue({ data: [studentCompetency] } as any)

    render(<TeacherCompetency />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    await waitFor(() => expect(mockedGetGroupCompetencies).toHaveBeenCalledWith(1))

    await user.selectOptions(screen.getByDisplayValue('Group A · Course A'), '2')

    await waitFor(() => expect(mockedGetGroupCompetencies).toHaveBeenCalledWith(2))
    expect(await screen.findByText('Competencies for Group B')).toBeInTheDocument()
  })

  it('switches students and reloads their competency scores', async () => {
    const user = userEvent.setup()
    const secondStudent = { id: 20, name: 'Grace Hopper', email: 'grace@example.com' }
    mockedGetGroups.mockResolvedValue({ data: [group] } as any)
    mockedGetGroupStudents.mockResolvedValue({ data: [student, secondStudent] } as any)
    mockedGetGroupCompetencies.mockResolvedValue({ data: [groupCompetency] } as any)
    mockedGetStudentCompetencies.mockImplementation((id: string | number) =>
      Promise.resolve({ data: id === 20 ? [{ ...studentCompetency, score: 55 }] : [studentCompetency] }) as any
    )

    render(<TeacherCompetency />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    await waitFor(() => expect(mockedGetStudentCompetencies).toHaveBeenCalledWith(10))

    await user.selectOptions(screen.getByDisplayValue('Ada Lovelace · ada@example.com'), '20')

    await waitFor(() => expect(mockedGetStudentCompetencies).toHaveBeenCalledWith(20))
    expect(await screen.findByDisplayValue('55')).toBeInTheDocument()
  })
})