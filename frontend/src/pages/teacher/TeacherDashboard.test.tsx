import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherDashboard from './TeacherDashboard'
import { apiFetch } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const mockedApiFetch = vi.mocked(apiFetch)

const assessment = { id: 1, title: 'Assessment A' }

function mockLoad(overrides: { groups?: any[]; submissions?: any[]; assessments?: any[] } = {}) {
  mockedApiFetch.mockImplementation((path: string) => {
    if (path === '/groups') return Promise.resolve({ data: overrides.groups ?? [] })
    if (path === '/submissions') return Promise.resolve({ data: overrides.submissions ?? [] })
    if (path === '/assessments') return Promise.resolve({ data: overrides.assessments ?? [assessment] })
    return Promise.reject(new Error(`Unhandled path: ${path}`))
  })
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherDashboard onNavigate={vi.fn()} />)
  await waitFor(() => expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument())
}

describe('TeacherDashboard', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it('shows a loading state before data resolves', () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherDashboard onNavigate={vi.fn()} />)

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
  })

  it('shows group, student and submission stats', async () => {
    await renderLoaded({
      groups: [{ id: 1, student_count: 10 }, { id: 2, student_count: 5 }, { id: 3, student_count: 0 }],
      submissions: [
        { id: 1, assessment_id: 1, status: 'Teacher Review' },
        { id: 2, assessment_id: 1, status: 'AI Draft Ready', ai_evaluation_status: 'draft' },
      ],
    })

    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument() // total students
    expect(screen.getByText('3')).toBeInTheDocument() // My Groups count
    expect(screen.getByText('2')).toBeInTheDocument() // Pending Review count
    expect(screen.getByText('1 draft')).toBeInTheDocument()
  })

  it('shows a dash for student count when there are no groups', async () => {
    await renderLoaded({ groups: [] })

    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('only counts submissions that belong to the teacher\'s own assessments', async () => {
    await renderLoaded({
      assessments: [{ id: 1, title: 'Mine' }],
      submissions: [
        { id: 1, assessment_id: 1, team_name: 'Team Mine', status: 'Submitted' },
        { id: 2, assessment_id: 999, team_name: 'Not Mine', status: 'Submitted' },
      ],
    })

    expect(screen.getByText('Team Mine')).toBeInTheDocument()
    expect(screen.queryByText('Not Mine')).not.toBeInTheDocument()
  })

  it('shows the AI evaluations banner and calls onNavigate to review', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    mockLoad({
      submissions: [
        { id: 1, assessment_id: 1, status: 'AI Draft Ready', ai_evaluation_status: 'draft', team_name: 'Team X', ai_score: 88 },
      ],
    })
    render(<TeacherDashboard onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument())

    expect(screen.getByText('1 AI evaluation waiting for your review')).toBeInTheDocument()
    expect(screen.getAllByText('Team X').length).toBeGreaterThan(0)
    expect(screen.getByText('AI Score: 88/100')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review Now →' }))
    expect(onNavigate).toHaveBeenCalledWith('aievaluations')
  })

  it('pluralises the AI evaluations banner text for more than one', async () => {
    await renderLoaded({
      submissions: [
        { id: 1, assessment_id: 1, status: 'AI Draft Ready', ai_evaluation_status: 'draft' },
        { id: 2, assessment_id: 1, status: 'AI Draft Ready', ai_evaluation_status: 'draft' },
      ],
    })

    expect(screen.getByText('2 AI evaluations waiting for your review')).toBeInTheDocument()
  })

  it('does not show the AI evaluations banner when there is nothing pending', async () => {
    await renderLoaded({ submissions: [] })

    expect(screen.queryByText(/waiting for your review/)).not.toBeInTheDocument()
  })

  it('shows an empty state for recent submissions', async () => {
    await renderLoaded({ submissions: [] })

    expect(screen.getByText('No recent submissions found.')).toBeInTheDocument()
  })

  it('navigates to submissions when "View all" is clicked', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    mockLoad({ submissions: [] })
    render(<TeacherDashboard onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument())

    const viewAllButtons = screen.getAllByText('View all →')
    await user.click(viewAllButtons[0])

    expect(onNavigate).toHaveBeenCalledWith('submissions')
  })

  it('navigates to a submission detail when a recent submission is clicked', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    mockLoad({
      submissions: [{ id: 42, assessment_id: 1, status: 'Submitted', student_name: 'Solo Student' }],
    })
    render(<TeacherDashboard onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument())

    await user.click(screen.getByText('Solo Student'))

    expect(onNavigate).toHaveBeenCalledWith('aievaluations', 42)
  })

  it('shows "No submission yet" when a submission has no repo URL', async () => {
    await renderLoaded({
      submissions: [{ id: 1, assessment_id: 1, status: 'Submitted', student_name: 'Solo Student', github_repo_url: null }],
    })

    expect(screen.getByText('No submission yet')).toBeInTheDocument()
  })

  it('lists active assessments with their due date and mode', async () => {
    await renderLoaded({
      assessments: [{ id: 1, title: 'Assessment A', type: 'Quiz', due_date: '2026-05-01T00:00:00.000Z', submission_mode: 'team' }],
    })

    expect(screen.getByText('Assessment A')).toBeInTheDocument()
    expect(screen.getByText(/Due 2026-05-01/)).toBeInTheDocument()
  })

  it('shows an em dash when an assessment has no due date', async () => {
    await renderLoaded({
      assessments: [{ id: 1, title: 'No Due Date', type: 'Quiz', due_date: null, submission_mode: 'individual' }],
    })

    expect(screen.getByText(/Due —/)).toBeInTheDocument()
  })

  it('shows an empty state when there are no assessments', async () => {
    await renderLoaded({ assessments: [] })

    expect(screen.getByText('No active assessments found.')).toBeInTheDocument()
  })

  it('recovers gracefully when the API calls fail', async () => {
    mockedApiFetch.mockRejectedValue(new Error('network error'))
    render(<TeacherDashboard onNavigate={vi.fn()} />)

    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument())
    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument()
  })
})
