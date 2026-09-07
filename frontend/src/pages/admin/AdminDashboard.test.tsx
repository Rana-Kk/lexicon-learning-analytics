import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminDashboard from './AdminDashboard'
import { getAnalyticsOverview, getGroupAnalytics, getGroups, getUsers } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getUsers: vi.fn(),
    getGroups: vi.fn(),
    getGroupAnalytics: vi.fn(),
    getAnalyticsOverview: vi.fn(),
  }
})

const mockedGetUsers = vi.mocked(getUsers)
const mockedGetGroups = vi.mocked(getGroups)
const mockedGetGroupAnalytics = vi.mocked(getGroupAnalytics)
const mockedGetAnalyticsOverview = vi.mocked(getAnalyticsOverview)

function mockAllResolved(overrides: {
  students?: any[]
  teachers?: any[]
  groups?: any[]
  performance?: any[]
  attendanceRate?: number
} = {}) {
  mockedGetUsers.mockImplementation((role?: string) =>
    Promise.resolve({ data: role === 'teacher' ? overrides.teachers ?? [] : overrides.students ?? [] }) as any
  )
  mockedGetGroups.mockResolvedValue({ data: overrides.groups ?? [] } as any)
  mockedGetGroupAnalytics.mockResolvedValue({ data: overrides.performance ?? [] } as any)
  mockedGetAnalyticsOverview.mockResolvedValue({
    data: { attendance: { rate: overrides.attendanceRate ?? 0 } },
  } as any)
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    mockedGetUsers.mockReset()
    mockedGetGroups.mockReset()
    mockedGetGroupAnalytics.mockReset()
    mockedGetAnalyticsOverview.mockReset()
  })

  it('shows a loading state before the data resolves', () => {
    mockedGetUsers.mockReturnValue(new Promise(() => {}) as any)
    mockedGetGroups.mockReturnValue(new Promise(() => {}) as any)
    mockedGetGroupAnalytics.mockReturnValue(new Promise(() => {}) as any)
    mockedGetAnalyticsOverview.mockReturnValue(new Promise(() => {}) as any)

    render(<AdminDashboard />)

    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
  })

  it('renders student, teacher, group and attendance stats once loaded', async () => {
    mockAllResolved({
      students: [{ id: 1 }, { id: 2 }, { id: 3 }],
      teachers: [{ id: 1 }, { id: 2 }],
      groups: [{ id: 1, name: 'Group A', course_name: 'React', student_count: 10 }],
      attendanceRate: 87,
    })

    render(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument())

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
  })

  it('renders a row per active group with course and student count', async () => {
    mockAllResolved({
      groups: [
        { id: 1, name: 'Group A', course_name: 'React', student_count: 12 },
        { id: 2, name: 'Group B', course_name: null, student_count: null },
      ],
    })

    render(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('Group A')).toBeInTheDocument())
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()

    expect(screen.getByText('Group B')).toBeInTheDocument()
    // Missing course name / student count fall back to an em dash.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('defaults every list to empty when the API returns no data field', async () => {
    mockedGetUsers.mockResolvedValue({} as any)
    mockedGetGroups.mockResolvedValue({} as any)
    mockedGetGroupAnalytics.mockResolvedValue({} as any)
    mockedGetAnalyticsOverview.mockResolvedValue({} as any)

    render(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument())

    // Total Students / Teachers / Active Groups all render as 0, Avg Attendance as 0%.
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
