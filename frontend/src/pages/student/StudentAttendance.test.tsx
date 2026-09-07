import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentAttendance from './StudentAttendance'
import {
  getAttendance,
  getMyAttendanceAppeals,
  createAttendanceAppeal,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getAttendance: vi.fn(),
    getMyAttendanceAppeals: vi.fn(),
    createAttendanceAppeal: vi.fn(),
  }
})

const mockedGetAttendance = vi.mocked(getAttendance)
const mockedGetAppeals = vi.mocked(getMyAttendanceAppeals)
const mockedCreateAppeal = vi.mocked(createAttendanceAppeal)

const presentRecord = {
  id: 1,
  attendance_date: '2026-01-10',
  session: 'morning',
  status: 'present',
  group_id: 1,
  group_name: 'Group A',
}

const absentRecord = {
  id: 2,
  attendance_date: '2026-01-11',
  session: 'afternoon',
  status: 'absent',
  group_id: 1,
  group_name: 'Group A',
}

function mockLoad(overrides: { records?: any[]; appeals?: any[] } = {}) {
  mockedGetAttendance.mockResolvedValue({ data: overrides.records ?? [presentRecord, absentRecord] } as any)
  mockedGetAppeals.mockResolvedValue({ data: overrides.appeals ?? [] } as any)
}

describe('StudentAttendance', () => {
  beforeEach(() => {
    mockedGetAttendance.mockReset()
    mockedGetAppeals.mockReset()
    mockedCreateAppeal.mockReset()
  })

  it('shows a loading state while fetching', () => {
    mockedGetAttendance.mockReturnValue(new Promise(() => {}))
    mockedGetAppeals.mockReturnValue(new Promise(() => {}))

    render(<StudentAttendance />)

    expect(screen.getByText('Loading attendance...')).toBeInTheDocument()
  })

  it('computes and displays the attendance rate and session counts', async () => {
    mockLoad()

    render(<StudentAttendance />)

    await screen.findByText('Attendance')
    expect(screen.getByText('50%')).toBeInTheDocument() // 1 of 2 present
    expect(screen.getByText('Sessions Attended')).toBeInTheDocument()
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
  })

  it('lists attendance rows in a single table when only one group is present', async () => {
    mockLoad()

    render(<StudentAttendance />)

    const dateCell = await screen.findByText('2026-01-10')
    expect(dateCell).toBeInTheDocument()
    expect(screen.getByText('2026-01-11')).toBeInTheDocument()
    expect(screen.getByText('☀ Morning')).toBeInTheDocument()
    expect(screen.getByText('🌤 Afternoon')).toBeInTheDocument()
  })

  it('splits records into per-group sections when multiple groups exist', async () => {
    mockLoad({
      records: [
        presentRecord,
        { ...absentRecord, group_id: 2, group_name: 'Group B' },
      ],
    })

    render(<StudentAttendance />)

    expect(await screen.findByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Group B')).toBeInTheDocument()
  })

  it('shows an empty state when there are no records', async () => {
    mockLoad({ records: [] })

    render(<StudentAttendance />)

    expect(await screen.findByText('No attendance records found.')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows an Appeal button only for absent sessions without an existing appeal', async () => {
    mockLoad()

    render(<StudentAttendance />)

    await screen.findByText('2026-01-10')
    expect(screen.getAllByRole('button', { name: 'Appeal' })).toHaveLength(1)
  })

  it('submits an appeal and reloads the attendance data', async () => {
    const user = userEvent.setup()
    mockLoad()
    mockedCreateAppeal.mockResolvedValue({} as any)

    render(<StudentAttendance />)

    await user.click(await screen.findByRole('button', { name: 'Appeal' }))

    await waitFor(() => expect(mockedCreateAppeal).toHaveBeenCalledWith(2))
    // loadAttendance is called again after a successful appeal
    await waitFor(() => expect(mockedGetAttendance).toHaveBeenCalledTimes(2))
  })

  it('shows the appeal status badge instead of the button once an appeal exists', async () => {
    mockLoad({ appeals: [{ attendance_id: 2, status: 'pending' }] })

    render(<StudentAttendance />)

    expect(await screen.findByText('Appeal Pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Appeal' })).not.toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedGetAttendance.mockRejectedValue(new Error('Network error'))
    mockedGetAppeals.mockResolvedValue({ data: [] } as any)

    render(<StudentAttendance />)

    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })
})
