import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentTeam from './StudentTeam'
import { getMyTeam } from '../../lib/api.ts'

vi.mock('../../lib/api.ts', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api.ts')>('../../lib/api.ts')
  return {
    ...actual,
    getMyTeam: vi.fn(),
  }
})

const mockedGetMyTeam = vi.mocked(getMyTeam)

const team = {
  id: 1,
  name: 'Team Rocket',
  group_id: 10,
  group_name: 'Group A',
  members: [
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: 2, name: 'Grace Hopper', email: 'grace@example.com' },
  ],
}

describe('StudentTeam', () => {
  beforeEach(() => {
    mockedGetMyTeam.mockReset()
  })

  it('shows a loading state while fetching', () => {
    mockedGetMyTeam.mockReturnValue(new Promise(() => {}))

    render(<StudentTeam />)

    expect(screen.getByText('Loading your team...')).toBeInTheDocument()
  })

  it('renders the team name, group and members', async () => {
    mockedGetMyTeam.mockResolvedValue({ data: [team] } as any)

    render(<StudentTeam />)

    expect(await screen.findByText('Team Rocket')).toBeInTheDocument()
    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('2 members')).toBeInTheDocument()
  })

  it('uses singular "member" when the team has one member', async () => {
    mockedGetMyTeam.mockResolvedValue({
      data: [{ ...team, members: [team.members[0]] }],
    } as any)

    render(<StudentTeam />)

    expect(await screen.findByText('1 member')).toBeInTheDocument()
  })

  it('shows a not-assigned message when there is no team', async () => {
    mockedGetMyTeam.mockResolvedValue({ data: [] } as any)

    render(<StudentTeam />)

    expect(await screen.findByText('You are not assigned to a team yet.')).toBeInTheDocument()
  })

  it('shows an error state with a retry button and retries on click', async () => {
    const user = userEvent.setup()
    mockedGetMyTeam.mockRejectedValueOnce(new Error('Could not load your team.'))

    render(<StudentTeam />)

    expect(await screen.findByText('Could not load your team.')).toBeInTheDocument()

    mockedGetMyTeam.mockResolvedValueOnce({ data: [team] } as any)
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Team Rocket')).toBeInTheDocument()
    expect(mockedGetMyTeam).toHaveBeenCalledTimes(2)
  })

  it('falls back to a generic error message when none is provided', async () => {
    mockedGetMyTeam.mockRejectedValue({})

    render(<StudentTeam />)

    expect(await screen.findByText('Could not load your team.')).toBeInTheDocument()
  })
})
