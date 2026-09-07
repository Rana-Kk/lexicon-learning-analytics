import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherQuizResults from './TeacherQuizResults'
import { getQuizResults } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getQuizResults: vi.fn(),
  }
})

vi.mock('./TeacherQuizImport', () => ({
  default: ({ onDone }: { onDone: () => void }) => (
    <div>
      <p>Quiz Import Screen</p>
      <button onClick={onDone}>Finish Import</button>
    </div>
  ),
}))

const mockedGetQuizResults = vi.mocked(getQuizResults)

const result = {
  id: 1,
  student_id: 10,
  student_name: 'Ada Lovelace',
  quiz_title: 'Quiz 1',
  topic: 'React',
  score: 8,
  max_score: 10,
  percentage: 80,
  completed_at: '2026-01-15T00:00:00.000Z',
}

async function renderLoaded(results: any[] = [result]) {
  mockedGetQuizResults.mockResolvedValue({ data: results } as any)
  render(<TeacherQuizResults />)
  await waitFor(() => expect(screen.queryByText('Loading quiz results...')).not.toBeInTheDocument())
}

describe('TeacherQuizResults', () => {
  beforeEach(() => {
    mockedGetQuizResults.mockReset()
  })

  it('shows a loading state before data resolves', () => {
    mockedGetQuizResults.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherQuizResults />)

    expect(screen.getByText('Loading quiz results...')).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedGetQuizResults.mockRejectedValue(new Error('Could not reach the server'))
    render(<TeacherQuizResults />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('shows a generic error message when the failure has no message', async () => {
    mockedGetQuizResults.mockRejectedValue({})
    render(<TeacherQuizResults />)

    expect(await screen.findByText('Could not load quiz results.')).toBeInTheDocument()
  })

  it('lists results in the table', async () => {
    await renderLoaded()

    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    expect(screen.getByText('Quiz 1')).toBeInTheDocument()
    expect(screen.getAllByText('React').length).toBeGreaterThan(0)
    expect(screen.getByText('8/10')).toBeInTheDocument()
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0)
    expect(screen.getByText('15/01/2026')).toBeInTheDocument()
  })

  it('shows an em dash for a missing topic and completion date', async () => {
    await renderLoaded([{ ...result, topic: null, completed_at: null }])

    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows an empty state when there are no results', async () => {
    await renderLoaded([])

    expect(screen.getByText('No quiz results found.')).toBeInTheDocument()
  })

  it('computes average, highest and lowest scores', async () => {
    await renderLoaded([
      { ...result, id: 1, student_id: 10, percentage: 80 },
      { ...result, id: 2, student_id: 11, student_name: 'Grace Hopper', percentage: 60 },
    ])

    expect(screen.getByText('70%')).toBeInTheDocument() // average
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0) // highest + table row
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0) // lowest + table row
    expect(screen.getByText('2')).toBeInTheDocument() // results imported
  })

  it('shows zeroed stats when there are no results', async () => {
    await renderLoaded([])

    expect(screen.getAllByText('0%').length).toBe(3)
  })

  it('filters results by student', async () => {
    const user = userEvent.setup()
    await renderLoaded([
      { ...result, id: 1, student_id: 10, student_name: 'Ada Lovelace' },
      { ...result, id: 2, student_id: 11, student_name: 'Grace Hopper' },
    ])

    await user.selectOptions(screen.getByDisplayValue('All students'), 'Grace Hopper')

    const rows = screen.getAllByRole('row')
    expect(rows.some((r) => within(r).queryByText('Grace Hopper'))).toBe(true)
    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1) // only the option remains
  })

  it('filters results by topic', async () => {
    const user = userEvent.setup()
    await renderLoaded([
      { ...result, id: 1, topic: 'React', quiz_title: 'Quiz React' },
      { ...result, id: 2, topic: 'Node', quiz_title: 'Quiz Node', student_name: 'Grace Hopper' },
    ])

    await user.selectOptions(screen.getByDisplayValue('All topics'), 'Node')

    expect(screen.getByText('Quiz Node')).toBeInTheDocument()
    expect(screen.queryByText('Quiz React')).not.toBeInTheDocument()
  })

  it('shows the quiz import screen and reloads results when done', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedGetQuizResults.mockResolvedValue({ data: [result] } as any)

    await user.click(screen.getByRole('button', { name: '↑ Import Results' }))

    expect(screen.getByText('Quiz Import Screen')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finish Import' }))

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0))
    expect(mockedGetQuizResults).toHaveBeenCalledTimes(2)
  })
})
