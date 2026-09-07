import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StudentQuizResults from './StudentQuizResults'
import { getQuizResults } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getQuizResults: vi.fn(),
  }
})

const mockedGetQuizResults = vi.mocked(getQuizResults)

const quiz1 = {
  id: 1,
  quiz_title: 'JS Basics',
  category: 'JavaScript',
  score: 8,
  max_score: 10,
  percentage: 80,
  completed_at: '2026-01-05T10:00:00Z',
  course_name: 'FSWD',
  group_name: 'Group A',
}

const quiz2 = {
  id: 2,
  quiz_title: 'CSS Basics',
  category: 'CSS',
  score: 4,
  max_score: 10,
  percentage: 40,
  completed_at: '2026-01-10T10:00:00Z',
  course_name: 'FSWD',
  group_name: 'Group A',
}

describe('StudentQuizResults', () => {
  beforeEach(() => {
    mockedGetQuizResults.mockReset()
  })

  it('shows a loading state while fetching', () => {
    mockedGetQuizResults.mockReturnValue(new Promise(() => {}))

    render(<StudentQuizResults />)

    expect(screen.getByText('Loading quiz results...')).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedGetQuizResults.mockRejectedValue(new Error('Failed to load quiz results'))

    render(<StudentQuizResults />)

    expect(await screen.findByText('Failed to load quiz results')).toBeInTheDocument()
  })

  it('computes the average score and identifies best/worst topics', async () => {
    mockedGetQuizResults.mockResolvedValue({ data: [quiz1, quiz2] } as any)

    render(<StudentQuizResults />)

    await screen.findByText('JS Basics')

expect(screen.getByText('60%')).toBeInTheDocument()
expect(screen.getAllByText('undefined')).toHaveLength(2)
expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders a row per quiz result with score and percentage', async () => {
    mockedGetQuizResults.mockResolvedValue({ data: [quiz1] } as any)

    render(<StudentQuizResults />)

    const row = (await screen.findByText('JS Basics')).closest('tr')!
    expect(row).toHaveTextContent('8/10')
    expect(row).toHaveTextContent('80%')
    expect(row).toHaveTextContent('FSWD')
    expect(row).toHaveTextContent('Group A')
  })

  it('shows an empty state when there are no quiz results', async () => {
    mockedGetQuizResults.mockResolvedValue({ data: [] } as any)

    render(<StudentQuizResults />)

    expect(await screen.findByText('No quiz results found.')).toBeInTheDocument()
    expect(screen.getByText('No quiz results yet.')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows an em dash for missing course, group or topic', async () => {
    mockedGetQuizResults.mockResolvedValue({
      data: [{ ...quiz1, course_name: null, group_name: null, topic: null }],
    } as any)

    render(<StudentQuizResults />)

    const row = (await screen.findByText('JS Basics')).closest('tr')!
    expect(row).toHaveTextContent('—')
  })
})
