import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherFeedback from './TeacherFeedback'
import {
  getGroups,
  getGroupStudents,
  getFeedback,
  createFeedback,
  getFeedbackTemplates,
  deleteFeedback,
  ApiError,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getGroups: vi.fn(),
    getGroupStudents: vi.fn(),
    getFeedback: vi.fn(),
    createFeedback: vi.fn(),
    getFeedbackTemplates: vi.fn(),
    deleteFeedback: vi.fn(),
  }
})

const mockedGetGroups = vi.mocked(getGroups)
const mockedGetGroupStudents = vi.mocked(getGroupStudents)
const mockedGetFeedback = vi.mocked(getFeedback)
const mockedCreateFeedback = vi.mocked(createFeedback)
const mockedGetFeedbackTemplates = vi.mocked(getFeedbackTemplates)
const mockedDeleteFeedback = vi.mocked(deleteFeedback)

const group = { id: 1, name: 'Group A', course_name: 'Course A' }
const student = { id: 10, name: 'Ada Lovelace' }
const feedbackItem = { id: 100, content: 'Great work!', created_at: '2026-01-15T00:00:00.000Z', assessment_title: 'Assessment A' }

function mockLoad(overrides: { groups?: any[]; students?: any[]; feedback?: any[]; templates?: any[] } = {}) {
  mockedGetGroups.mockResolvedValue({ data: overrides.groups ?? [group] } as any)
  mockedGetFeedback.mockResolvedValue({ data: overrides.feedback ?? [feedbackItem] } as any)
  mockedGetFeedbackTemplates.mockResolvedValue({ data: overrides.templates ?? [] } as any)
  mockedGetGroupStudents.mockResolvedValue({ data: overrides.students ?? [student] } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherFeedback />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
}

describe('TeacherFeedback', () => {
  beforeEach(() => {
    mockedGetGroups.mockReset()
    mockedGetGroupStudents.mockReset()
    mockedGetFeedback.mockReset()
    mockedCreateFeedback.mockReset()
    mockedGetFeedbackTemplates.mockReset()
    mockedDeleteFeedback.mockReset()
  })

  it('shows a loading state before data resolves', () => {
    mockedGetGroups.mockReturnValue(new Promise(() => {}) as any)
    mockedGetFeedback.mockReturnValue(new Promise(() => {}) as any)
    mockedGetFeedbackTemplates.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherFeedback />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no groups', async () => {
    await renderLoaded({ groups: [] })

    expect(screen.getByText('No groups assigned.')).toBeInTheDocument()
  })

  it('shows an error message when loading fails with an ApiError', async () => {
    mockedGetGroups.mockRejectedValue(new ApiError(500, 'Could not reach the server'))
    mockedGetFeedback.mockResolvedValue({ data: [] } as any)
    mockedGetFeedbackTemplates.mockResolvedValue({ data: [] } as any)

    render(<TeacherFeedback />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('loads students for the first group and shows feedback for the first student', async () => {
    await renderLoaded()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(mockedGetGroupStudents).toHaveBeenCalledWith(1)
    expect(screen.getByText('Great work!')).toBeInTheDocument()
    expect(screen.getByText('Assessment A')).toBeInTheDocument()
  })

  it('shows an empty state when the group has no students', async () => {
    await renderLoaded({ students: [] })

    expect(await screen.findByText('No students in this group')).toBeInTheDocument()
  })

  it('shows an empty state when the student has no feedback', async () => {
    await renderLoaded({ feedback: [] })

    expect(await screen.findByText('No feedback for this student yet.')).toBeInTheDocument()
  })

  it('shows "General feedback" when the entry has no assessment title', async () => {
    await renderLoaded({ feedback: [{ ...feedbackItem, assessment_title: undefined }] })

    expect(await screen.findByText('General feedback')).toBeInTheDocument()
  })

  it('fills the textarea from a template button', async () => {
    const user = userEvent.setup()
    await renderLoaded({ templates: [{ id: 1, category: 'Positive', content: 'Keep up the great work!' }] })

    await user.click(screen.getByRole('button', { name: 'Positive' }))

    expect(screen.getByPlaceholderText('Write feedback for this student...')).toHaveValue('Keep up the great work!')
  })

  it('disables Publish until there is content', async () => {
    await renderLoaded()

    expect(screen.getByRole('button', { name: 'Publish Feedback' })).toBeDisabled()
  })

  it('publishes feedback and reloads the list', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateFeedback.mockResolvedValue({} as any)

    await user.type(screen.getByPlaceholderText('Write feedback for this student...'), 'Nice job!')
    await user.click(screen.getByRole('button', { name: 'Publish Feedback' }))

    await waitFor(() =>
      expect(mockedCreateFeedback).toHaveBeenCalledWith({ student_id: 10, content: 'Nice job!' })
    )
    expect(screen.getByPlaceholderText('Write feedback for this student...')).toHaveValue('')
  })

  it('shows an error message when publishing fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateFeedback.mockRejectedValue(new ApiError(400, 'Content is required'))

    await user.type(screen.getByPlaceholderText('Write feedback for this student...'), 'x')
    await user.click(screen.getByRole('button', { name: 'Publish Feedback' }))

    expect(await screen.findByText('Content is required')).toBeInTheDocument()
  })

  it('deletes feedback after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteFeedback.mockResolvedValue({} as any)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mockedDeleteFeedback).toHaveBeenCalledWith(100))
  })

  it('does not delete feedback when confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(mockedDeleteFeedback).not.toHaveBeenCalled()
  })

  it('switches groups and reloads students for the new group', async () => {
    const user = userEvent.setup()
    const secondGroup = { id: 2, name: 'Group B', course_name: 'Course B' }
    const secondStudent = { id: 20, name: 'Grace Hopper' }
    mockedGetGroups.mockResolvedValue({ data: [group, secondGroup] } as any)
    mockedGetFeedback.mockResolvedValue({ data: [feedbackItem] } as any)
    mockedGetFeedbackTemplates.mockResolvedValue({ data: [] } as any)
    mockedGetGroupStudents.mockImplementation((id: number) =>
      Promise.resolve({ data: id === 2 ? [secondStudent] : [student] }) as any
    )

    render(<TeacherFeedback />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    await screen.findByText('Ada Lovelace')

    await user.selectOptions(screen.getByDisplayValue('Group A · Course A'), '2')

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
    expect(mockedGetGroupStudents).toHaveBeenCalledWith(2)
  })
})
