import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherSubmissions from './TeacherSubmissions'
import { apiFetch, ApiError } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const mockedApiFetch = vi.mocked(apiFetch)

const group = { id: 1, name: 'Group A', course_name: 'Course A' }
const assessment = { id: 100, group_id: 1, title: 'Assessment A', submission_mode: 'individual', due_date: null, max_score: 100 }
const submission = {
  id: 1000,
  assessment_id: 100,
  student_id: 10,
  student_name: 'Ada Lovelace',
  github_repo_url: 'https://github.com/ada/repo',
  submitted_at: '2026-01-01T00:00:00.000Z',
  status: 'Submitted',
  final_score: 90,
}

function mockLoad(overrides: { groups?: any[]; assessments?: any[]; submissions?: any[] } = {}) {
  mockedApiFetch.mockImplementation((path: string) => {
    if (path === '/groups') return Promise.resolve({ data: overrides.groups ?? [group] })
    if (path === '/assessments') return Promise.resolve({ data: overrides.assessments ?? [assessment] })
    if (path === '/submissions') return Promise.resolve({ data: overrides.submissions ?? [submission] })
    return Promise.reject(new Error(`Unhandled path: ${path}`))
  })
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherSubmissions onNavigate={vi.fn()} />)
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
}

describe('TeacherSubmissions', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it('shows a loading state before data resolves', () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherSubmissions onNavigate={vi.fn()} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no groups', async () => {
    await renderLoaded({ groups: [] })

    expect(screen.getByText('No groups assigned to you yet.')).toBeInTheDocument()
  })

  it('shows an error message when loading fails with an ApiError', async () => {
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/groups') return Promise.reject(new ApiError(500, 'Could not reach the server'))
      return Promise.resolve({ data: [] })
    })
    render(<TeacherSubmissions onNavigate={vi.fn()} />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('shows a generic error message on a non-ApiError failure', async () => {
    mockedApiFetch.mockRejectedValue(new Error('boom'))
    render(<TeacherSubmissions onNavigate={vi.fn()} />)

    expect(await screen.findByText('Failed to load submissions')).toBeInTheDocument()
  })

  it('only keeps submissions that belong to the teacher\'s own assessments', async () => {
    await renderLoaded({
      submissions: [submission, { ...submission, id: 2000, assessment_id: 999, student_name: 'Not Mine' }],
    })

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Not Mine')).not.toBeInTheDocument()
  })

  it('selects the first group and its first assessment by default', async () => {
    await renderLoaded()

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('90 / 100')).toBeInTheDocument()
  })

  it('shows an empty state when the selected group has no assessments', async () => {
    await renderLoaded({ assessments: [] })

    expect(screen.getByText('No assessments found for this group.')).toBeInTheDocument()
  })

  it('shows an empty state when the selected assessment has no submissions', async () => {
    await renderLoaded({ submissions: [] })

    expect(screen.getByText('No submissions found for this assignment.')).toBeInTheDocument()
  })

  it('shows a fallback student label when there is no name', async () => {
    await renderLoaded({ submissions: [{ ...submission, student_name: undefined }] })

    expect(screen.getByText('Student #10')).toBeInTheDocument()
  })

  it('shows a dash when there is no repo link', async () => {
    await renderLoaded({ submissions: [{ ...submission, github_repo_url: undefined }] })

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the uploader when different from the student in team mode', async () => {
    await renderLoaded({
      assessments: [{ ...assessment, submission_mode: 'team' }],
      submissions: [{ ...submission, submitted_by_name: 'Grace Hopper' }],
    })

    expect(screen.getByText('Uploaded by Grace Hopper')).toBeInTheDocument()
  })

  it('falls back to "-" when there is no score at all', async () => {
    await renderLoaded({ submissions: [{ ...submission, final_score: undefined, ai_score: undefined }] })

    expect(screen.getByText('— / 100')).toBeInTheDocument()
  })

  it('switches groups and resets the selected assessment', async () => {
    const user = userEvent.setup()
    const secondGroup = { id: 2, name: 'Group B', course_name: 'Course B' }
    const secondAssessment = { ...assessment, id: 200, group_id: 2, title: 'Assessment B' }
    const secondSubmission = { ...submission, id: 2000, assessment_id: 200, student_name: 'Grace Hopper' }
    await renderLoaded({
      groups: [group, secondGroup],
      assessments: [assessment, secondAssessment],
      submissions: [submission, secondSubmission],
    })

    const [groupSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(groupSelect, 'Course B — Group B')

    expect(screen.getByRole('heading', { name: 'Assessment B' })).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('switches assessments within the same group', async () => {
    const user = userEvent.setup()
    const secondAssessment = { ...assessment, id: 200, title: 'Assessment B' }
    const secondSubmission = { ...submission, id: 2000, assessment_id: 200, student_name: 'Grace Hopper' }
    await renderLoaded({
      assessments: [assessment, secondAssessment],
      submissions: [submission, secondSubmission],
    })

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()

    const [, assessmentSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(assessmentSelect, 'Assessment B')

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('navigates to the AI evaluation view when a submission row is clicked', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    mockLoad()
    render(<TeacherSubmissions onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    await user.click(screen.getByText('Ada Lovelace'))

    expect(onNavigate).toHaveBeenCalledWith('aievaluations', 1000)
  })

  it('does not navigate when the repository link is clicked', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    mockLoad()
    render(<TeacherSubmissions onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    await user.click(screen.getByText(/ada\/repo/))

    expect(onNavigate).not.toHaveBeenCalled()
  })
})