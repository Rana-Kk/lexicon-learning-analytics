import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentAssignments from './StudentAssignments'
import { getStudentAssessments } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getStudentAssessments: vi.fn(),
  }
})

const mockedGetStudentAssessments = vi.mocked(getStudentAssessments)

const notSubmitted = {
  id: 1,
  title: 'Build a REST API',
  description: 'Create a REST API with CRUD endpoints.',
  type: 'Project',
  due_date: '2026-02-01',
  max_score: 100,
  submission_mode: 'individual',
  status: 'Not Submitted',
}

const approved = {
  id: 2,
  title: 'Frontend Dashboard',
  type: 'Assignment',
  due_date: '2026-01-20',
  max_score: 50,
  submission_mode: 'team',
  submission_status: 'approved',
}

const rejectedNeedsResubmission = {
  id: 3,
  title: 'Database Design',
  type: 'Project',
  due_date: '2026-01-15',
  max_score: 80,
  submission_status: 'rejected',
  resubmission_requested: true,
  resubmission_comment: 'Please fix the schema.',
}

const rejectedFinal = {
  id: 4,
  title: 'Auth Module',
  type: 'Project',
  due_date: '2026-01-10',
  max_score: 60,
  submission_status: 'rejected',
  resubmission_requested: false,
  rejection_comment: 'Did not meet requirements.',
}

describe('StudentAssignments', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    mockedGetStudentAssessments.mockReset()
    onNavigate.mockReset()
  })

  it('shows a loading state while fetching', () => {
    mockedGetStudentAssessments.mockReturnValue(new Promise(() => {}))

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(screen.getByText('Loading your assignments...')).toBeInTheDocument()
  })

  it('shows an empty state when there are no assignments', async () => {
    mockedGetStudentAssessments.mockResolvedValue({ data: [] } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText('No assignments have been assigned to you yet.')).toBeInTheDocument()
  })

  it('shows an error state with a retry button and retries on click', async () => {
    const user = userEvent.setup()
    mockedGetStudentAssessments.mockRejectedValueOnce(new Error('Server down'))

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText('Server down')).toBeInTheDocument()

    mockedGetStudentAssessments.mockResolvedValueOnce({ data: [notSubmitted] } as any)
    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(await screen.findByText('Build a REST API')).toBeInTheDocument()
    expect(mockedGetStudentAssessments).toHaveBeenCalledTimes(2)
  })

  it('renders an assignment with individual/team badge, due date and max score', async () => {
    mockedGetStudentAssessments.mockResolvedValue({ data: [notSubmitted] } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText('Build a REST API')).toBeInTheDocument()
    expect(screen.getByText('○ Individual')).toBeInTheDocument()
    expect(screen.getByText('Due: 2026-02-01')).toBeInTheDocument()
    expect(screen.getByText('Max: 100 pts')).toBeInTheDocument()
    expect(screen.getByText('Not Submitted')).toBeInTheDocument()
  })

  it('lets the student navigate to submissions for a not-submitted assignment', async () => {
    const user = userEvent.setup()
    mockedGetStudentAssessments.mockResolvedValue({ data: [notSubmitted] } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    await user.click(await screen.findByRole('button', { name: 'Submit Repository →' }))

    expect(onNavigate).toHaveBeenCalledWith('submissions', 1)
  })

  it('shows a team badge and a "View Result" button for approved assignments', async () => {
    const user = userEvent.setup()
    mockedGetStudentAssessments.mockResolvedValue({ data: [approved] } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText('⬡ Team')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Result →' }))
    expect(onNavigate).toHaveBeenCalledWith('submissions', 2)
  })

  it('shows a resubmission banner and button when the teacher requests one', async () => {
    mockedGetStudentAssessments.mockResolvedValue({ data: [rejectedNeedsResubmission] } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText('↻ Resubmission Requested')).toBeInTheDocument()
    expect(screen.getByText('Please fix the schema.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↻ Resubmit Repository' })).toBeInTheDocument()
  })

  it('shows a final rejection banner without a resubmit option', async () => {
    mockedGetStudentAssessments.mockResolvedValue({ data: [rejectedFinal] } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('Did not meet requirements.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Status' })).toBeInTheDocument()
  })

  it('truncates long descriptions to 80 characters with an ellipsis', async () => {
    const longDescription = 'A'.repeat(120)
    mockedGetStudentAssessments.mockResolvedValue({
      data: [{ ...notSubmitted, description: longDescription }],
    } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText(`${'A'.repeat(80)}…`)).toBeInTheDocument()
  })

  it('renders rubric criteria when present', async () => {
    mockedGetStudentAssessments.mockResolvedValue({
      data: [
        {
          ...notSubmitted,
          rubric: [{ id: 1, name: 'Code Quality', max_score: 20 }],
        },
      ],
    } as any)

    render(<StudentAssignments onNavigate={onNavigate} />)

    expect(await screen.findByText(/Code Quality/)).toBeInTheDocument()
    expect(screen.getByText(/1 criteria/)).toBeInTheDocument()
  })
})
