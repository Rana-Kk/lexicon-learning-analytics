import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminAnalytics from './AdminAnalytics'
import {
  getGroupAnalytics,
  getCourses,
  getGroups,
  getTeams,
  getUsers,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getGroupAnalytics: vi.fn(),
    getCourses: vi.fn(),
    getGroups: vi.fn(),
    getTeams: vi.fn(),
    getUsers: vi.fn(),
  }
})

const mockedGetGroupAnalytics = vi.mocked(getGroupAnalytics)
const mockedGetCourses = vi.mocked(getCourses)
const mockedGetGroups = vi.mocked(getGroups)
const mockedGetTeams = vi.mocked(getTeams)
const mockedGetUsers = vi.mocked(getUsers)

function mockStructure({
  courses = [],
  groups = [],
  teams = [],
  students = [],
}: {
  courses?: any[]
  groups?: any[]
  teams?: any[]
  students?: any[]
} = {}) {
  mockedGetCourses.mockResolvedValue({ data: courses } as any)
  mockedGetGroups.mockResolvedValue({ data: groups } as any)
  mockedGetTeams.mockResolvedValue({ data: teams } as any)
  mockedGetUsers.mockResolvedValue({ data: students } as any)
}

describe('AdminAnalytics', () => {
  beforeEach(() => {
    mockedGetGroupAnalytics.mockReset()
    mockedGetCourses.mockReset()
    mockedGetGroups.mockReset()
    mockedGetTeams.mockReset()
    mockedGetUsers.mockReset()
  })

  it('shows a loading state before the data resolves', () => {
    mockedGetGroupAnalytics.mockReturnValue(new Promise(() => {}) as any)
    mockedGetCourses.mockReturnValue(new Promise(() => {}) as any)
    mockedGetGroups.mockReturnValue(new Promise(() => {}) as any)
    mockedGetTeams.mockReturnValue(new Promise(() => {}) as any)
    mockedGetUsers.mockReturnValue(new Promise(() => {}) as any)

    render(<AdminAnalytics />)

    expect(screen.getByText('Loading analytics…')).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedGetGroupAnalytics.mockRejectedValue(new Error('Network error'))
    mockStructure()

    render(<AdminAnalytics />)

    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })

  it('shows a generic error message when the failure has no message', async () => {
    mockedGetGroupAnalytics.mockRejectedValue({})
    mockStructure()

    render(<AdminAnalytics />)

    expect(
      await screen.findByText('Could not load analytics data.')
    ).toBeInTheDocument()
  })

  it('shows empty-state messages when there is no group or course data', async () => {
    mockedGetGroupAnalytics.mockResolvedValue({ data: [] } as any)
    mockStructure()

    render(<AdminAnalytics />)

    expect(
      await screen.findByText('No group analytics data available yet.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('No courses available yet.')
    ).toBeInTheDocument()
    // Summary stats default to 0% when there is no group data.
    expect(screen.getAllByText('0%')).toHaveLength(3)
    // Structure counters default to 0.
    expect(screen.getAllByText('0')).toHaveLength(4)
  })

  it('averages attendance, quiz and progress across groups using varied field names', async () => {
    mockedGetGroupAnalytics.mockResolvedValue({
      data: [
        { group_name: 'Group A', attendance: 80, quizAvg: 60, course_progress: 40 },
        { group: 'Group B', attendance_percentage: 100, quiz_avg: 100, progress: 100 },
      ],
    } as any)
    mockStructure()

    render(<AdminAnalytics />)

    // Attendance avg (80+100)/2=90, Quiz avg (60+100)/2=80, Progress avg (40+100)/2=70
    expect(await screen.findByText('90%')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('reads group analytics data nested under a "groups" key', async () => {
    mockedGetGroupAnalytics.mockResolvedValue({
      data: { groups: [{ group: 'Nested Group', attendance: 55 }] },
    } as any)
    mockStructure()

    render(<AdminAnalytics />)

    // The average is computed from the nested "groups" array, proving it was picked up.
    expect(await screen.findByText('55%')).toBeInTheDocument()
    expect(
      screen.queryByText('No group analytics data available yet.')
    ).not.toBeInTheDocument()
  })

  it('shows total counts for students, courses, groups and teams', async () => {
    mockedGetGroupAnalytics.mockResolvedValue({ data: [] } as any)
    mockStructure({
      courses: [{ id: 1, name: 'Backend 101' }],
      groups: [{ id: 10, name: 'Group A', course_id: 1, student_count: 3 }],
      teams: [{ id: 100, group_id: 10, name: 'Team Alpha' }],
      students: [{ id: 1 }, { id: 2 }, { id: 3 }],
    })

    render(<AdminAnalytics />)

    await waitFor(() =>
      expect(screen.queryByText('Loading analytics…')).not.toBeInTheDocument()
    )

    expect(screen.getByText('Students')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // student count
    expect(screen.getByText('Courses')).toBeInTheDocument()
    expect(screen.getByText('Groups')).toBeInTheDocument()
    expect(screen.getByText('Teams')).toBeInTheDocument()
  })

  it('renders the course -> group -> team breakdown', async () => {
    mockedGetGroupAnalytics.mockResolvedValue({ data: [] } as any)
    mockStructure({
      courses: [{ id: 1, name: 'Backend 101' }],
      groups: [
        { id: 10, name: 'Group A', course_id: 1, student_count: 5 },
        { id: 11, name: 'Group B', course_id: 1, student_count: 2 },
      ],
      teams: [
        { id: 100, group_id: 10, name: 'Team Alpha' },
        { id: 101, group_id: 10, name: 'Team Beta' },
      ],
      students: [],
    })

    render(<AdminAnalytics />)

    expect(await screen.findByText('Backend 101')).toBeInTheDocument()
    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Group B')).toBeInTheDocument()

    // Course header shows aggregate group/team counts.
    expect(screen.getByText('2 groups · 2 teams')).toBeInTheDocument()

    // Group A has 2 teams, Group B has 0.
    expect(screen.getByText('5 students · 2 teams')).toBeInTheDocument()
    expect(screen.getByText('2 students · 0 teams')).toBeInTheDocument()
  })

  it('shows a message for courses with no linked groups', async () => {
    mockedGetGroupAnalytics.mockResolvedValue({ data: [] } as any)
    mockStructure({
      courses: [{ id: 1, name: 'Unassigned Course' }],
      groups: [],
      teams: [],
      students: [],
    })

    render(<AdminAnalytics />)

    expect(await screen.findByText('Unassigned Course')).toBeInTheDocument()
    expect(
      screen.getByText('No groups linked to this course yet.')
    ).toBeInTheDocument()
    expect(screen.getByText('0 groups · 0 teams')).toBeInTheDocument()
  })
})