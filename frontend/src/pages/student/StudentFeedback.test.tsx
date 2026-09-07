import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StudentFeedback from './StudentFeedback'
import { getFeedback } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getFeedback: vi.fn(),
  }
})

const mockedGetFeedback = vi.mocked(getFeedback)

const feedbackItem = {
  id: 1,
  student_id: 10,
  teacher_id: 5,
  teacher_name: 'Ms. Ada',
  assessment_id: 100,
  assessment_title: 'Sprint 1 Project',
  template_id: null,
  template_category: 'Excellent',
  content: 'Great work on the API design.',
  created_at: '2026-01-15T10:00:00Z',
}

describe('StudentFeedback', () => {
  beforeEach(() => {
    mockedGetFeedback.mockReset()
  })

  it('shows a loading state while fetching', () => {
    mockedGetFeedback.mockReturnValue(new Promise(() => {}))

    render(<StudentFeedback />)

    expect(screen.getByText('Loading feedback...')).toBeInTheDocument()
  })

  it('renders the empty state when there is no feedback', async () => {
    mockedGetFeedback.mockResolvedValue({ data: [] } as any)

    render(<StudentFeedback />)

    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument()
  })

  it('renders feedback items with teacher name, category and content', async () => {
    mockedGetFeedback.mockResolvedValue({ data: [feedbackItem] } as any)

    render(<StudentFeedback />)

    expect(await screen.findByText('Ms. Ada')).toBeInTheDocument()
    expect(screen.getByText('Great work on the API design.')).toBeInTheDocument()
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByText(/Re: Sprint 1 Project/)).toBeInTheDocument()
  })

  it('falls back to the default style for an unknown category', async () => {
    mockedGetFeedback.mockResolvedValue({
      data: [{ ...feedbackItem, id: 2, template_category: 'Something Custom' }],
    } as any)

    render(<StudentFeedback />)

    expect(await screen.findByText('Something Custom')).toBeInTheDocument()
  })

  it('does not render a category badge when none is set', async () => {
    mockedGetFeedback.mockResolvedValue({
      data: [{ ...feedbackItem, id: 3, template_category: null, assessment_title: null }],
    } as any)

    render(<StudentFeedback />)

    expect(await screen.findByText('Great work on the API design.')).toBeInTheDocument()
    expect(screen.queryByText('Excellent')).not.toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedGetFeedback.mockRejectedValue(new Error('Server exploded'))

    render(<StudentFeedback />)

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  })

  it('handles a non-array response gracefully', async () => {
    mockedGetFeedback.mockResolvedValue({ data: null } as any)

    render(<StudentFeedback />)

    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument()
  })
})
