import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherAIEvaluation from './TeacherAIEvaluations'
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
const assessmentOption = { id: 10, group_id: 1, title: 'Assessment A' }

const submissionListItem = {
  id: 1,
  assessment_id: 10,
  student_name: 'Ada Lovelace',
  assessment_title: 'Assessment A',
  status: 'AI Draft Ready',
  github_repo_url: 'https://github.com/ada/repo',
  final_score: null,
  ai_score: 80,
  assessment_max_score: 100,
}

const submissionDetail = {
  id: 1,
  assessment_id: 10,
  assessment_title: 'Assessment A',
  assessment_description: 'Build a REST API',
  assessment_max_score: 100,
  student_id: 5,
  student_name: 'Ada Lovelace',
  student_email: 'ada@example.com',
  github_repo_url: 'https://github.com/ada/repo',
  submitted_at: '2026-01-15T10:00:00.000Z',
  status: 'AI Draft Ready',
  ai_evaluation_status: 'draft',
  ai_score: 80,
  ai_feedback: 'Good job',
  final_score: null,
  teacher_feedback: null,
  strengths: 'Clean code',
  areas_for_improvement: 'More tests',
  recommendations: 'Add CI',
  suggested_next_steps: 'Deploy it',
  criteria_scores: [
    { criterion_id: 1, criterion_name: 'Code Quality', criterion_max_score: 50, ai_score: 40, ai_rationale: 'Solid', teacher_final_score: 40, teacher_override: 0 },
  ],
  checklist_criteria: [
    { id: 1, name: 'Has README', criterion_type: 'yes_no', ai_yes_no_value: 1 },
  ],
}

function mockLoad(overrides: { list?: any[]; detail?: any } = {}) {
  mockedApiFetch.mockImplementation((path: string) => {
    if (path === '/groups') return Promise.resolve({ data: [group] })
    if (path === '/assessments') return Promise.resolve({ data: [assessmentOption] })
    if (path === '/submissions') return Promise.resolve({ data: overrides.list ?? [submissionListItem] })
    if (path === `/submissions/${overrides.detail?.id ?? submissionDetail.id}`) {
      return Promise.resolve({ data: overrides.detail ?? submissionDetail })
    }
    return Promise.reject(new Error(`Unhandled path: ${path}`))
  })
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherAIEvaluation onNavigate={vi.fn()} />)
  await waitFor(() => expect(screen.queryByText('Loading submissions…')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.queryByText('Loading evaluation details…')).not.toBeInTheDocument())
}

describe('TeacherAIEvaluation', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it('shows a loading state before the submissions list resolves', () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherAIEvaluation />)

    expect(screen.getByText('Loading submissions…')).toBeInTheDocument()
  })

  it('shows an empty state when there are no submissions', async () => {
    await renderLoaded({ list: [] })

    expect(screen.getByText('No submissions available for review.')).toBeInTheDocument()
  })

  it('shows an error message when loading the list fails', async () => {
    mockedApiFetch.mockRejectedValue(new ApiError(500, 'Could not reach the server'))
    render(<TeacherAIEvaluation />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('auto-selects and loads the first submission\'s detail', async () => {
    await renderLoaded()

    expect(mockedApiFetch).toHaveBeenCalledWith('/submissions/1')
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    expect(screen.getByText('Build a REST API')).toBeInTheDocument()
    expect(screen.getByText('AI Draft — Awaiting Review')).toBeInTheDocument()
  })

  it('opens directly on the submission passed via initialSubmissionId', async () => {
    const secondSubmission = { ...submissionListItem, id: 2, student_name: 'Grace Hopper' }
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/submissions') return Promise.resolve({ data: [submissionListItem, secondSubmission] })
      if (path === '/submissions/2') return Promise.resolve({ data: { ...submissionDetail, id: 2, student_name: 'Grace Hopper' } })
      return Promise.reject(new Error(`Unhandled path: ${path}`))
    })

    render(<TeacherAIEvaluation initialSubmissionId={2} />)

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith('/submissions/2'))
  })

  it('renders the rubric criteria breakdown', async () => {
    await renderLoaded()

    expect(screen.getByText('Code Quality')).toBeInTheDocument()
    expect(screen.getByDisplayValue('40')).toBeInTheDocument()
  })

  it('shows an empty message when there are no rubric criteria', async () => {
    await renderLoaded({ detail: { ...submissionDetail, criteria_scores: [] } })

    expect(screen.getByText('No individual criteria configured for this assessment.')).toBeInTheDocument()
  })

  it('shows an empty message when there is no checklist', async () => {
    await renderLoaded({ detail: { ...submissionDetail, checklist_criteria: [] } })

    expect(screen.getByText('No checklist criteria configured for this assessment.')).toBeInTheDocument()
  })

  it('renders the checklist AI result and lets the teacher pick a value', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    expect(screen.getByText('Has README')).toBeInTheDocument()
    expect(screen.getAllByText('Yes').length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByDisplayValue('Not evaluated'), 'yes')

    expect(screen.getByDisplayValue('Yes')).toBeInTheDocument()
  })

  it('recalculates the total score when a criterion score is edited', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    const scoreInput = screen.getByDisplayValue('40')
    await user.clear(scoreInput)
    await user.type(scoreInput, '45')

    await waitFor(() => expect(scoreInput).toHaveValue(45))
  })

  it('clamps an edited criterion score to its maximum', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    const scoreInput = screen.getByDisplayValue('40')
    await user.clear(scoreInput)
    await user.type(scoreInput, '999')

    await waitFor(() => expect(scoreInput).toHaveValue(50))
  })

  it('switches to another submission when clicked in the list', async () => {
    const secondSubmission = { ...submissionListItem, id: 2, student_name: 'Grace Hopper' }
    await renderLoaded({
      list: [submissionListItem, secondSubmission],
    })
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/submissions') return Promise.resolve({ data: [submissionListItem, secondSubmission] })
      if (path === '/submissions/1') return Promise.resolve({ data: submissionDetail })
      if (path === '/submissions/2') return Promise.resolve({ data: { ...submissionDetail, id: 2, student_name: 'Grace Hopper' } })
      return Promise.reject(new Error('unhandled'))
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Grace Hopper'))

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith('/submissions/2'))
  })

  it('saves changes and shows a confirmation notice', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedApiFetch.mockImplementation((path: string, opts?: any) => {
      if (path === '/submissions/1/review' && opts?.method === 'PUT') return Promise.resolve({})
      if (path === '/submissions') return Promise.resolve({ data: [submissionListItem] })
      if (path === '/submissions/1') return Promise.resolve({ data: submissionDetail })
      return Promise.reject(new Error('unhandled'))
    })

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Draft changes saved.')).toBeInTheDocument()
    const putCall = mockedApiFetch.mock.calls.find(([p, o]: any) => p === '/submissions/1/review' && o?.method === 'PUT')!
    expect(JSON.parse((putCall[1] as any).body).action).toBe('save')
  })

  it('approves the evaluation', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedApiFetch.mockImplementation((path: string, opts?: any) => {
      if (path === '/submissions/1/review' && opts?.method === 'PUT') return Promise.resolve({})
      if (path === '/submissions') return Promise.resolve({ data: [submissionListItem] })
      if (path === '/submissions/1') return Promise.resolve({ data: { ...submissionDetail, status: 'Approved' } })
      return Promise.reject(new Error('unhandled'))
    })

    await user.click(screen.getByRole('button', { name: '✓ Approve Evaluation' }))

    expect(await screen.findByText('Evaluation approved — the student can now see their final result.')).toBeInTheDocument()
  })

  it('rejects the evaluation', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedApiFetch.mockImplementation((path: string, opts?: any) => {
      if (path === '/submissions/1/review' && opts?.method === 'PUT') return Promise.resolve({})
      if (path === '/submissions') return Promise.resolve({ data: [submissionListItem] })
      if (path === '/submissions/1') return Promise.resolve({ data: submissionDetail })
      return Promise.reject(new Error('unhandled'))
    })

    await user.click(screen.getByRole('button', { name: '✕ Reject Evaluation' }))

    expect(await screen.findByText('Evaluation marked as not approved.')).toBeInTheDocument()
  })

  it('requests a resubmission', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedApiFetch.mockImplementation((path: string, opts?: any) => {
      if (path === '/submissions/1/request-resubmission' && opts?.method === 'PUT') return Promise.resolve({})
      if (path === '/submissions') return Promise.resolve({ data: [submissionListItem] })
      if (path === '/submissions/1') return Promise.resolve({ data: submissionDetail })
      return Promise.reject(new Error('unhandled'))
    })

    await user.click(screen.getByRole('button', { name: '↻ Request Resubmission' }))

    expect(await screen.findByText('Resubmission requested — the student has been notified.')).toBeInTheDocument()
  })

  it('shows an error message when saving fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedApiFetch.mockImplementation((path: string, opts?: any) => {
      if (path === '/submissions/1/review' && opts?.method === 'PUT') return Promise.reject({ message: 'Score is required' })
      return Promise.resolve({ data: submissionDetail })
    })

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Score is required')).toBeInTheDocument()
  })

  it('navigates back to submissions', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    mockLoad()
    render(<TeacherAIEvaluation onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.queryByText('Loading submissions…')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '← Back to Submissions' }))

    expect(onNavigate).toHaveBeenCalledWith('submissions')
  })
})