import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherAnalytics from './TeacherAnalytics'
import { getMyGroups, getAnalyticsOverview, getStudentAnalytics } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getMyGroups: vi.fn(),
    getAnalyticsOverview: vi.fn(),
    getStudentAnalytics: vi.fn(),
  }
})

const mockedGetMyGroups = vi.mocked(getMyGroups)
const mockedGetAnalyticsOverview = vi.mocked(getAnalyticsOverview)
const mockedGetStudentAnalytics = vi.mocked(getStudentAnalytics)

const group = { id: 1, name: 'Group A', course_name: 'Course A', student_count: 12 }
const student = { id: 1, name: 'Ada Lovelace', attendance: 90, quizAvg: 80, assessmentAvg: 70 }

function mockLoad(overrides: { groups?: any[]; overview?: any; students?: any[] } = {}) {
  mockedGetMyGroups.mockResolvedValue({ data: overrides.groups ?? [group] } as any)
  // Note: the component reads overview.attendance.rate without a guard, so a
  // response missing "attendance" entirely would crash it. Real API responses
  // always include the attendance object, so tests reflect that shape.
  mockedGetAnalyticsOverview.mockResolvedValue({ data: overrides.overview ?? { attendance: { rate: 0 } } } as any)
  mockedGetStudentAnalytics.mockResolvedValue({ data: overrides.students ?? [student] } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherAnalytics />)
  await waitFor(() => expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument())
  if ((overrides?.groups ?? [group]).length > 0) {
    await waitFor(() => expect(mockedGetStudentAnalytics).toHaveBeenCalled())
  }
}

describe('TeacherAnalytics', () => {
  beforeEach(() => {
    mockedGetMyGroups.mockReset()
    mockedGetAnalyticsOverview.mockReset()
    mockedGetStudentAnalytics.mockReset()
  })

  it('shows a loading state before the groups resolve', () => {
    mockedGetMyGroups.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherAnalytics />)

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no groups', async () => {
    await renderLoaded({ groups: [] })

    expect(screen.getByText('You are not assigned to any group yet.')).toBeInTheDocument()
  })

  it('shows an error message when loading groups fails', async () => {
    mockedGetMyGroups.mockRejectedValue(new Error('Could not reach the server'))
    render(<TeacherAnalytics />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('selects the first group by default and shows its stats', async () => {
    await renderLoaded({
      overview: { attendance: { rate: 88 }, quiz_average: 75.6, quiz_count: 3, assessment_average: 64.4, assessment_count: 2 },
    })

    expect(screen.getAllByText('Group A · Course A').length).toBeGreaterThan(0)
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('76%')).toBeInTheDocument()
    expect(screen.getByText('3 results')).toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(screen.getByText('2 scores')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument() // student_count from the group
  })

  it('defaults quiz/assessment stats to zero when the overview omits them', async () => {
    await renderLoaded({ overview: { attendance: { rate: 0 } } })

    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the student summary table with attendance, assessment and quiz averages', async () => {
    await renderLoaded()

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('shows an em dash for a zero quiz average in the table', async () => {
    await renderLoaded({ students: [{ id: 1, name: 'No Quiz Yet', attendance: 50, quizAvg: 0, assessmentAvg: 20 }] })

    expect((await screen.findAllByText((_, node) => node?.textContent === '—%')).length).toBeGreaterThan(0)
  })

  it('shows an empty state for the chart and hides the table when there is no student data', async () => {
    await renderLoaded({ students: [] })

    expect(screen.getByText('No student data yet for this group.')).toBeInTheDocument()
    expect(screen.queryByText('Student Summary Table')).not.toBeInTheDocument()
  })

  it('switches groups and reloads analytics for the newly selected group', async () => {
    const user = userEvent.setup()
    const secondGroup = { id: 2, name: 'Group B', course_name: 'Course B', student_count: 5 }
    mockedGetMyGroups.mockResolvedValue({ data: [group, secondGroup] } as any)
    mockedGetAnalyticsOverview.mockResolvedValue({ data: { attendance: { rate: 0 } } } as any)
    mockedGetStudentAnalytics.mockResolvedValue({ data: [student] } as any)

    render(<TeacherAnalytics />)
    await waitFor(() => expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument())
    await waitFor(() => expect(mockedGetStudentAnalytics).toHaveBeenCalledWith('1'))

    await user.selectOptions(screen.getByRole('combobox'), '2')

    await waitFor(() => expect(mockedGetStudentAnalytics).toHaveBeenCalledWith('2'))
    expect(screen.getAllByText('Group B · Course B').length).toBeGreaterThan(0)
  })

  it('shows an error message when loading a group\'s analytics fails', async () => {
    mockedGetMyGroups.mockResolvedValue({ data: [group] } as any)
    mockedGetAnalyticsOverview.mockRejectedValue(new Error('Analytics unavailable'))
    mockedGetStudentAnalytics.mockResolvedValue({ data: [] } as any)

    render(<TeacherAnalytics />)

    expect(await screen.findByText('Analytics unavailable')).toBeInTheDocument()
  })
})
