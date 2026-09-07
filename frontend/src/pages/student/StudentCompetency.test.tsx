import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StudentCompetency from './StudentCompetency'
import { getMyCompetencies } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getMyCompetencies: vi.fn(),
  }
})

const mockedGetMyCompetencies = vi.mocked(getMyCompetencies)

const competencies = [
  {
    competency_id: 1,
    name: 'React',
    description: 'Frontend framework',
    score: 90,
    previous_score: 80,
    trend: 'improving',
  },
  {
    competency_id: 2,
    name: 'SQL',
    description: 'Database querying',
    score: 50,
    previous_score: 60,
    trend: 'declining',
  },
]

describe('StudentCompetency', () => {
  beforeEach(() => {
    mockedGetMyCompetencies.mockReset()
  })

  it('shows a loading state while fetching', () => {
    mockedGetMyCompetencies.mockReturnValue(new Promise(() => {}))

    render(<StudentCompetency />)

    expect(screen.getByText('Loading competencies...')).toBeInTheDocument()
  })

  it('renders the empty state when there is no competency data', async () => {
    mockedGetMyCompetencies.mockResolvedValue({ data: [] } as any)

    render(<StudentCompetency />)

    expect(await screen.findByText('No competency data available yet.')).toBeInTheDocument()
  })

  it('computes overall average, strongest area and development focus', async () => {
    mockedGetMyCompetencies.mockResolvedValue({ data: competencies } as any)

    render(<StudentCompetency />)

    await screen.findByText('Competency Matrix')
    expect(screen.getByText('70%')).toBeInTheDocument() // average of 90 and 50
    expect(screen.getByText('Strongest Area')).toBeInTheDocument()
    expect(screen.getByText('Development Focus')).toBeInTheDocument()
  })

  it('lists each competency with its score and trend label', async () => {
    mockedGetMyCompetencies.mockResolvedValue({ data: competencies } as any)

    render(<StudentCompetency />)

    expect(await screen.findByText('📈 Improving')).toBeInTheDocument()
    expect(screen.getByText('📉 Needs attention')).toBeInTheDocument()
  })

  it('shows a stable trend indicator', async () => {
    mockedGetMyCompetencies.mockResolvedValue({
      data: [{ ...competencies[0], trend: 'stable' }],
    } as any)

    render(<StudentCompetency />)

    expect(await screen.findByText('➡ Stable')).toBeInTheDocument()
  })

  it('shows an error message when loading fails, without blocking the empty state', async () => {
    mockedGetMyCompetencies.mockRejectedValue(new Error('Failed to load competencies'))

    render(<StudentCompetency />)

    expect(await screen.findByText('Failed to load competencies')).toBeInTheDocument()
    expect(screen.getByText('No competency data available yet.')).toBeInTheDocument()
  })
})
