import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

import {
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react'

import { act } from 'react'

import userEvent from '@testing-library/user-event'

import TeacherAttendance from './TeacherAttendance'
import * as api from '../../lib/api'

// =====================================================
// MOCK AttendanceStatusSelect
// =====================================================

vi.mock('../../components/AttendanceStatusSelect', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: any) => void
  }) => (
    <select
      aria-label="attendance-status"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="Present">Present</option>
      <option value="Late">Late</option>
      <option value="Absent">Absent</option>
      <option value="Excused">Excused</option>
    </select>
  ),
}))

// =====================================================
// MOCK API
// =====================================================

vi.mock('../../lib/api', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/api')>(
      '../../lib/api'
    )

  return {
    ...actual,

    getMyGroups: vi.fn(),

    getPendingAttendanceAppeals: vi.fn(),

    getGroupStudents: vi.fn(),

    getGroupAttendanceSummary: vi.fn(),

    getAttendance: vi.fn(),

    saveAttendance: vi.fn(),

    reviewAttendanceAppeal: vi.fn(),
  }
})

// =====================================================
// MOCK REFERENCES
// =====================================================

const getMyGroupsMock =
  vi.mocked(api.getMyGroups)

const getPendingAppealsMock =
  vi.mocked(api.getPendingAttendanceAppeals)

const getGroupStudentsMock =
  vi.mocked(api.getGroupStudents)

const getGroupSummaryMock =
  vi.mocked(api.getGroupAttendanceSummary)

const getAttendanceMock =
  vi.mocked(api.getAttendance)

const saveAttendanceMock =
  vi.mocked(api.saveAttendance)

const reviewAppealMock =
  vi.mocked(api.reviewAttendanceAppeal)

// =====================================================
// DATA
// =====================================================

const GROUP = {
  id: 1,
  name: 'Group A',
  course_name: 'Full Stack',
  student_count: 2,
}

const STUDENTS = [
  {
    id: 101,
    name: 'Alice Johnson',
    email: 'alice@test.com',
  },
  {
    id: 102,
    name: 'Bob Smith',
    email: 'bob@test.com',
  },
]

const SUMMARY = [
  {
    student_id: 101,
    student_name: 'Alice Johnson',

    counts: {
      present: 8,
      late: 1,
      absent: 1,
      excused: 0,
    },

    total_sessions: 10,
    attendance_percentage: 90,
  },

  {
    student_id: 102,
    student_name: 'Bob Smith',

    counts: {
      present: 4,
      late: 2,
      absent: 3,
      excused: 1,
    },

    total_sessions: 10,
    attendance_percentage: 60,
  },
]

const GROUP_ATTENDANCE = [
  {
    id: 1001,
    student_id: 101,
    student_name: 'Alice Johnson',
    group_id: 1,
    attendance_date: '2026-09-01',
    session: 'morning',
    status: 'present',
  },

  {
    id: 1002,
    student_id: 102,
    student_name: 'Bob Smith',
    group_id: 1,
    attendance_date: '2026-09-01',
    session: 'morning',
    status: 'absent',
  },

  {
    id: 1003,
    student_id: 101,
    student_name: 'Alice Johnson',
    group_id: 1,
    attendance_date: '2026-09-02',
    session: 'afternoon',
    status: 'late',
  },

  {
    id: 1004,
    student_id: 102,
    student_name: 'Bob Smith',
    group_id: 1,
    attendance_date: '2026-09-02',
    session: 'afternoon',
    status: 'excused',
  },
]

const APPEAL = {
  id: 501,
  attendance_id: 1001,
  student_id: 101,
  student_name: 'Alice Johnson',
  attendance_date: '2026-09-01',
  session: 'morning',
  group_id: 1,
  group_name: 'Group A',
  course_name: 'Full Stack',
  status: 'pending',
}

// =====================================================
// DEFAULT MOCK SETUP
// =====================================================

function setDefaultMocks() {
  getMyGroupsMock.mockResolvedValue({
    data: [GROUP],
  } as any)

  getPendingAppealsMock.mockResolvedValue({
    data: [],
  } as any)

  getGroupStudentsMock.mockResolvedValue({
    data: STUDENTS,
  } as any)

  getGroupSummaryMock.mockResolvedValue({
    data: {
      students: SUMMARY,
    },
  } as any)

  getAttendanceMock.mockResolvedValue({
    data: GROUP_ATTENDANCE,
  } as any)

  saveAttendanceMock.mockResolvedValue({
    data: {},
  } as any)

  reviewAppealMock.mockResolvedValue({
    data: {},
  } as any)
}

// =====================================================
// HELPERS
// =====================================================

async function renderGroupsView() {
  render(<TeacherAttendance />)

  await screen.findByRole('heading', {
    name: 'Attendance',
  })
}

async function openGroup() {
  const user = userEvent.setup()

  await renderGroupsView()

  const groupButton =
    await screen.findByRole('button', {
      name: /Group A/i,
    })

  await user.click(groupButton)

  await screen.findByRole('button', {
    name: 'Take Attendance',
  })

  return user
}

async function openTakeAttendance() {
  const user = await openGroup()

  await user.click(
    screen.getByRole('button', {
      name: 'Take Attendance',
    })
  )

  await screen.findByRole('heading', {
    name: 'Take Attendance',
  })

  return user
}

// =====================================================
// TESTS
// =====================================================

describe('TeacherAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ===================================================
  // GROUPS VIEW
  // ===================================================

  describe('groups view', () => {
    it('shows loading while groups are resolving', () => {
      getMyGroupsMock.mockReturnValue(
        new Promise(() => {}) as any
      )

      render(<TeacherAttendance />)

      expect(
        screen.getByText('Loading groups...')
      ).toBeInTheDocument()
    })

    it('renders the groups page', async () => {
      await renderGroupsView()

      expect(
        screen.getByText(
          'View attendance for your assigned groups'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByText('Group A')
      ).toBeInTheDocument()

      expect(
        screen.getByText('Full Stack')
      ).toBeInTheDocument()
    })

    it('shows empty state when no groups are assigned', async () => {
      getMyGroupsMock.mockResolvedValue({
        data: [],
      } as any)

      render(<TeacherAttendance />)

      expect(
        await screen.findByText(
          'No groups assigned to you.'
        )
      ).toBeInTheDocument()
    })

    it('treats a non-array groups response as empty', async () => {
      getMyGroupsMock.mockResolvedValue({
        data: null,
      } as any)

      render(<TeacherAttendance />)

      expect(
        await screen.findByText(
          'No groups assigned to you.'
        )
      ).toBeInTheDocument()
    })

    it('shows the API error when groups fail', async () => {
      getMyGroupsMock.mockRejectedValue(
        new Error('Groups unavailable')
      )

      render(<TeacherAttendance />)

      expect(
        await screen.findByText(
          'Groups unavailable'
        )
      ).toBeInTheDocument()
    })

    it('uses generic group loading error when error has no message', async () => {
      getMyGroupsMock.mockRejectedValue({})

      render(<TeacherAttendance />)

      expect(
        await screen.findByText(
          'Failed to load your assigned groups'
        )
      ).toBeInTheDocument()
    })

    it('loads summary statistics for a group card', async () => {
      await renderGroupsView()

      await waitFor(() => {
        expect(
          getGroupSummaryMock
        ).toHaveBeenCalledWith(1)
      })

      expect(
        await screen.findByText('75%')
      ).toBeInTheDocument()
    })

    it('keeps the group card usable when statistics loading fails', async () => {
      getGroupSummaryMock.mockRejectedValue(
        new Error('Stats failed')
      )

      render(<TeacherAttendance />)

      expect(
        await screen.findByText('Group A')
      ).toBeInTheDocument()

      await waitFor(() => {
        expect(
          getGroupSummaryMock
        ).toHaveBeenCalledWith(1)
      })

      expect(
        screen.getByRole('button', {
          name: /Group A/i,
        })
      ).toBeEnabled()
    })
  })

  // ===================================================
  // APPEALS
  // ===================================================

  describe('pending appeals', () => {
    it('renders pending appeals on the main groups page', async () => {
      getPendingAppealsMock.mockResolvedValue({
        data: [APPEAL],
      } as any)

      await renderGroupsView()

      expect(
        await screen.findByText(
          'Pending Appeals (1)'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByText(
          /Full Stack · Group A · 2026-09-01 · Morning/
        )
      ).toBeInTheDocument()

      expect(
        screen.getByRole('button', {
          name: 'Approve',
        })
      ).toBeInTheDocument()

      expect(
        screen.getByRole('button', {
          name: 'Reject',
        })
      ).toBeInTheDocument()
    })

    it('approves a pending appeal and removes it from the panel', async () => {
      const user = userEvent.setup()

      getPendingAppealsMock.mockResolvedValue({
        data: [APPEAL],
      } as any)

      await renderGroupsView()

      await user.click(
        await screen.findByRole('button', {
          name: 'Approve',
        })
      )

      await waitFor(() => {
        expect(
          reviewAppealMock
        ).toHaveBeenCalledWith(
          501,
          'accepted'
        )
      })

      await waitFor(() => {
        expect(
          screen.queryByText(
            'Pending Appeals (1)'
          )
        ).not.toBeInTheDocument()
      })
    })

    it('rejects a pending appeal', async () => {
      const user = userEvent.setup()

      getPendingAppealsMock.mockResolvedValue({
        data: [APPEAL],
      } as any)

      await renderGroupsView()

      await user.click(
        await screen.findByRole('button', {
          name: 'Reject',
        })
      )

      await waitFor(() => {
        expect(
          reviewAppealMock
        ).toHaveBeenCalledWith(
          501,
          'rejected'
        )
      })
    })

    it('does not remove an appeal if review fails', async () => {
      const user = userEvent.setup()

      getPendingAppealsMock.mockResolvedValue({
        data: [APPEAL],
      } as any)

      reviewAppealMock.mockRejectedValue(
        new Error('Review failed')
      )

      await renderGroupsView()

      await user.click(
        await screen.findByRole('button', {
          name: 'Approve',
        })
      )

      await waitFor(() => {
        expect(
          reviewAppealMock
        ).toHaveBeenCalled()
      })

      expect(
        screen.getByText(
          'Pending Appeals (1)'
        )
      ).toBeInTheDocument()
    })

    it('silently hides the appeals panel if loading appeals fails', async () => {
      getPendingAppealsMock.mockRejectedValue(
        new Error('Appeals unavailable')
      )

      await renderGroupsView()

      await waitFor(() => {
        expect(
          getPendingAppealsMock
        ).toHaveBeenCalled()
      })

      expect(
        screen.queryByText(/Pending Appeals \(/)
      ).not.toBeInTheDocument()
    })
  })

  // ===================================================
  // GROUP VIEW
  // ===================================================

  describe('group attendance view', () => {
    it('loads students, summary and attendance when a group is opened', async () => {
      await openGroup()

      expect(
        getGroupStudentsMock
      ).toHaveBeenCalledWith(1)

      expect(
        getAttendanceMock
      ).toHaveBeenCalledWith({
        group_id: 1,
      })

      expect(
        await screen.findByText(
          'Attendance Calendar'
        )
      ).toBeInTheDocument()
    })

    it('renders group summary and students', async () => {
      await openGroup()

      expect(
        screen.getAllByText('Alice Johnson').length
      ).toBeGreaterThan(0)

      expect(
        screen.getAllByText('Bob Smith').length
      ).toBeGreaterThan(0)

      expect(
        screen.getAllByText('12').length
      ).toBeGreaterThan(0)

      expect(
        screen.getAllByText('3').length
      ).toBeGreaterThan(0)

      expect(
        screen.getAllByText('4').length
      ).toBeGreaterThan(0)

      expect(
        screen.getAllByText('75%').length
      ).toBeGreaterThan(0)
    })

    it('shows no attendance records when group summary is empty', async () => {
      getGroupSummaryMock.mockResolvedValue({
        data: {
          students: [],
        },
      } as any)

      await openGroup()

      expect(
        await screen.findByText(
          'No attendance records yet.'
        )
      ).toBeInTheDocument()
    })

    it('handles malformed group responses as empty arrays', async () => {
      getGroupStudentsMock.mockResolvedValue({
        data: null,
      } as any)

      getGroupSummaryMock.mockResolvedValue({
        data: {
          students: null,
        },
      } as any)

      getAttendanceMock.mockResolvedValue({
        data: null,
      } as any)

      await openGroup()

      expect(
        await screen.findByText(
          'No attendance records yet.'
        )
      ).toBeInTheDocument()
    })

    it('shows error if opening group attendance fails', async () => {
      getGroupStudentsMock.mockRejectedValue(
        new Error('Group attendance failed')
      )

      await openGroup()

      expect(
        await screen.findByText(
          'Group attendance failed'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByText(
          'No attendance records yet.'
        )
      ).toBeInTheDocument()
    })

    it('uses generic group attendance error when no message exists', async () => {
      getGroupStudentsMock.mockRejectedValue({})

      await openGroup()

      expect(
        await screen.findByText(
          'Failed to load group attendance'
        )
      ).toBeInTheDocument()
    })

    it('returns to groups page', async () => {
      const user = await openGroup()

      await user.click(
        screen.getByRole('button', {
          name: '← Back to Groups',
        })
      )

      expect(
        await screen.findByRole('heading', {
          name: 'Attendance',
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText('Group A')
      ).toBeInTheDocument()
    })
  })

  // ===================================================
  // CALENDAR
  // ===================================================

  describe('calendar', () => {
    it('renders the latest recorded attendance date and daily roster', async () => {
      await openGroup()

      expect(
        await screen.findByText(
          'Recorded Attendance'
        )
      ).toBeInTheDocument()

      expect(
        screen.getAllByText(
          '02 Sept 2026'
        ).length
      ).toBeGreaterThan(0)

      expect(
        screen.getAllByText(
          'Alice Johnson'
        ).length
      ).toBeGreaterThan(0)

      expect(
        screen.getByText('late')
      ).toBeInTheDocument()

      expect(
        screen.getByText('excused')
      ).toBeInTheDocument()
    })

    it('moves to previous and next calendar months', async () => {
      const user = await openGroup()

      const previous =
        screen.getByRole('button', {
          name: '‹',
        })

      const next =
        screen.getByRole('button', {
          name: '›',
        })

      const monthLabelBefore =
        previous.parentElement?.querySelector(
          'span'
        )?.textContent

      await user.click(previous)

      const monthLabelAfterPrevious =
        previous.parentElement?.querySelector(
          'span'
        )?.textContent

      expect(
        monthLabelAfterPrevious
      ).not.toBe(monthLabelBefore)

      await user.click(next)

      const monthLabelAfterNext =
        previous.parentElement?.querySelector(
          'span'
        )?.textContent

      expect(
        monthLabelAfterNext
      ).toBe(monthLabelBefore)
    })

    it('selects another calendar date', async () => {
      const user = await openGroup()

      const dateButtons =
        screen.getAllByTitle('50% attendance')

      expect(
        dateButtons.length
      ).toBeGreaterThan(0)

      await user.click(
        dateButtons[dateButtons.length - 1]
      )

      expect(
        screen.getAllByText(
          '01 Sept 2026'
        ).length
      ).toBeGreaterThan(0)
    })

    it('shows inline appeal controls for attendance with an appeal', async () => {
      getPendingAppealsMock.mockResolvedValue({
        data: [APPEAL],
      } as any)

      const user = await openGroup()

      const dateButton =
        await screen.findByTitle(
          /50% attendance.*pending appeal/i
        )

      await user.click(dateButton)

      expect(
        await screen.findByText('Appeal')
      ).toBeInTheDocument()

      expect(
        screen.getByTitle(
          'Approve appeal'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByTitle(
          'Reject appeal'
        )
      ).toBeInTheDocument()
    })

    it('approves an inline calendar appeal', async () => {
      getPendingAppealsMock.mockResolvedValue({
        data: [APPEAL],
      } as any)

      const user = await openGroup()

      await user.click(
        await screen.findByTitle(
          /50% attendance.*pending appeal/i
        )
      )

      await user.click(
        await screen.findByTitle(
          'Approve appeal'
        )
      )

      await waitFor(() => {
        expect(
          reviewAppealMock
        ).toHaveBeenCalledWith(
          501,
          'accepted'
        )
      })
    })
  })

  // ===================================================
  // STUDENT HISTORY
  // ===================================================

  describe('student history', () => {
    it('opens student attendance history', async () => {
      const user = await openGroup()

      const studentButton =
        screen.getByRole('button', {
          name: /Alice Johnson.*View history/i,
        })

      getAttendanceMock.mockResolvedValueOnce({
        data: [
          {
            id: 2001,
            student_id: 101,
            group_id: 1,
            attendance_date: '2026-09-03',
            session: 'morning',
            status: 'present',
          },
        ],
      } as any)

      await user.click(studentButton)

      expect(
        await screen.findByText(
          'Attendance History'
        )
      ).toBeInTheDocument()

      expect(
        getAttendanceMock
      ).toHaveBeenCalledWith({
        group_id: 1,
        student_id: 101,
      })

      expect(
        screen.getByText(
          '☀ Morning · 09:00–12:00'
        )
      ).toBeInTheDocument()

      expect(
        screen.getAllByText('Present').length
      ).toBeGreaterThan(1)
    })

    it('renders afternoon history record', async () => {
      const user = await openGroup()

      getAttendanceMock.mockResolvedValueOnce({
        data: [
          {
            id: 2002,
            student_id: 101,
            group_id: 1,
            attendance_date: '2026-09-04',
            session: 'afternoon',
            status: 'late',
          },
        ],
      } as any)

      await user.click(
        screen.getByRole('button', {
          name: /Alice Johnson.*View history/i,
        })
      )

      expect(
        await screen.findByText(
          '🌤 Afternoon · 13:00–16:00'
        )
      ).toBeInTheDocument()

      const lateElements =
        screen.getAllByText('Late')

      expect(
        lateElements[lateElements.length - 1]
      ).toBeInTheDocument()
    })

    it('shows empty student history', async () => {
      const user = await openGroup()

      getAttendanceMock.mockResolvedValueOnce({
        data: [],
      } as any)

      await user.click(
        screen.getByRole('button', {
          name: /Alice Johnson.*View history/i,
        })
      )

      expect(
        await screen.findByText(
          'No attendance records found.'
        )
      ).toBeInTheDocument()
    })

    it('shows student history error', async () => {
      const user = await openGroup()

      getAttendanceMock.mockRejectedValueOnce(
        new Error('History unavailable')
      )

      await user.click(
        screen.getByRole('button', {
          name: /Alice Johnson.*View history/i,
        })
      )

      expect(
        await screen.findByText(
          'History unavailable'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByText(
          'No attendance records found.'
        )
      ).toBeInTheDocument()
    })

    it('uses generic student history error', async () => {
      const user = await openGroup()

      getAttendanceMock.mockRejectedValueOnce({})

      await user.click(
        screen.getByRole('button', {
          name: /Alice Johnson.*View history/i,
        })
      )

      expect(
        await screen.findByText(
          'Failed to load student attendance history'
        )
      ).toBeInTheDocument()
    })

    it('goes back from student history to group', async () => {
      const user = await openGroup()

      getAttendanceMock.mockResolvedValueOnce({
        data: [],
      } as any)

      await user.click(
        screen.getByRole('button', {
          name: /Alice Johnson.*View history/i,
        })
      )

      await screen.findByText(
        'Attendance History'
      )

      await user.click(
        screen.getByRole('button', {
          name: '← Back to Group A',
        })
      )

      expect(
        await screen.findByText(
          'Attendance Calendar'
        )
      ).toBeInTheDocument()
    })
  })

  // ===================================================
  // TAKE ATTENDANCE
  // ===================================================

  describe('take attendance', () => {
    it('opens take attendance and loads the roster', async () => {
      await openTakeAttendance()

      expect(
        await screen.findByText(
          'Alice Johnson'
        )
      ).toBeInTheDocument()

      expect(screen.getAllByText('Bob Smith')[0]).toBeInTheDocument()

      expect(
        getGroupStudentsMock
      ).toHaveBeenCalledWith(1)

      expect(
        getAttendanceMock
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 1,
          session: 'morning',
        })
      )
    })

    it('merges existing attendance statuses with students', async () => {
      const today =
        new Date()
          .toISOString()
          .split('T')[0]

      getAttendanceMock.mockImplementation(
        async (params: any) => {
          if (
            params?.attendance_date ===
            today
          ) {
            return {
              data: [
                {
                  student_id: 101,
                  group_id: 1,
                  attendance_date: today,
                  session: 'morning',
                  status: 'late',
                },

                {
                  student_id: 102,
                  group_id: 1,
                  attendance_date: today,
                  session: 'morning',
                  status: 'absent',
                },
              ],
            } as any
          }

          return {
            data: GROUP_ATTENDANCE,
          } as any
        }
      )

      await openTakeAttendance()

      const selects =
        await screen.findAllByRole(
          'combobox',
          {
            name: 'attendance-status',
          }
        )

      expect(selects).toHaveLength(2)

      expect(
        (selects[0] as HTMLSelectElement)
          .value
      ).toBe('Late')

      expect(
        (selects[1] as HTMLSelectElement)
          .value
      ).toBe('Absent')
    })

    it('defaults missing attendance to Present', async () => {
      getAttendanceMock.mockImplementation(
        async (params: any) => {
          if (params?.attendance_date) {
            return {
              data: [],
            } as any
          }

          return {
            data: GROUP_ATTENDANCE,
          } as any
        }
      )

      await openTakeAttendance()

      const selects =
        await screen.findAllByRole(
          'combobox',
          {
            name: 'attendance-status',
          }
        )

      expect(
        (selects[0] as HTMLSelectElement)
          .value
      ).toBe('Present')

      expect(
        (selects[1] as HTMLSelectElement)
          .value
      ).toBe('Present')
    })

    it('changes a student attendance status', async () => {
      const user =
        await openTakeAttendance()

      const selects =
        await screen.findAllByRole(
          'combobox',
          {
            name: 'attendance-status',
          }
        )

      await user.selectOptions(
        selects[0],
        'Absent'
      )

      expect(
        (selects[0] as HTMLSelectElement)
          .value
      ).toBe('Absent')
    })

    it('changes to afternoon session and reloads attendance', async () => {
      const user =
        await openTakeAttendance()

      await user.click(
        screen.getByRole('button', {
          name:
            '🌤 Afternoon 13:00–16:00',
        })
      )

      await waitFor(() => {
        expect(
          getAttendanceMock
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            group_id: 1,
            session: 'afternoon',
          })
        )
      })
    })

    it('changes date and reloads attendance', async () => {
      await openTakeAttendance()

      const dateInput =
        document.querySelector(
          'input[type="date"]'
        ) as HTMLInputElement

      expect(dateInput).toBeTruthy()

      fireEvent.change(
        dateInput,
        {
          target: {
            value: '2026-09-10',
          },
        }
      )

      await waitFor(() => {
        expect(
          getAttendanceMock
        ).toHaveBeenCalledWith({
          group_id: 1,
          attendance_date:
            '2026-09-10',
          session: 'morning',
        })
      })
    })

    it('shows empty roster and disables save when the group has no students', async () => {
      getGroupStudentsMock.mockResolvedValue({
        data: [],
      } as any)

      await openTakeAttendance()

      expect(
        await screen.findByText(
          'No students found in this group.'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByRole('button', {
          name: 'Save Attendance',
        })
      ).toBeDisabled()
    })

    it('shows attendance loading error', async () => {
      const user = await openGroup()

      getGroupStudentsMock.mockRejectedValueOnce(
        new Error('Roster unavailable')
      )

      await user.click(
        screen.getByRole('button', {
          name: 'Take Attendance',
        })
      )

      expect(
        await screen.findByText(
          'Roster unavailable'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByText(
          'No students found in this group.'
        )
      ).toBeInTheDocument()
    })

    it('uses generic attendance loading error', async () => {
      const user = await openGroup()

      getGroupStudentsMock.mockRejectedValueOnce({})

      await user.click(
        screen.getByRole('button', {
          name: 'Take Attendance',
        })
      )

      expect(
        await screen.findByText(
          'Failed to load attendance'
        )
      ).toBeInTheDocument()
    })

    it('returns from take attendance to group page', async () => {
      const user =
        await openTakeAttendance()

      await user.click(
        screen.getByRole('button', {
          name: '← Back to Group A',
        })
      )

      expect(
        await screen.findByText(
          'Attendance Calendar'
        )
      ).toBeInTheDocument()
    })
  })

// ===================================================
// SAVE ATTENDANCE
// ===================================================

describe('saving attendance', () => {
  it('saves attendance with mapped API statuses', async () => {
    const user = await openTakeAttendance()

    const selects =
      await screen.findAllByRole(
        'combobox',
        {
          name: 'attendance-status',
        }
      )

    await user.selectOptions(
      selects[0],
      'Late'
    )

    await user.selectOptions(
      selects[1],
      'Excused'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Save Attendance',
      })
    )

    await waitFor(() => {
      expect(
        saveAttendanceMock
      ).toHaveBeenCalledTimes(1)
    })

    expect(
      saveAttendanceMock
    ).toHaveBeenCalledWith({
      group_id: 1,

      attendance_date:
        new Date()
          .toISOString()
          .split('T')[0],

      session: 'morning',

      records: [
        {
          student_id: 101,
          status: 'late',
        },
        {
          student_id: 102,
          status: 'excused',
        },
      ],
    })

    expect(
      await screen.findByText(
        '✓ Attendance saved'
      )
    ).toBeInTheDocument()
  })

it(
'removes saved message after three seconds',
async () => {
const user =
await openTakeAttendance()

await user.click(
  screen.getByRole('button', {
    name: 'Save Attendance', 
  })
)

expect(
  await screen.findByText(
    '✓ Attendance saved'
  )
).toBeInTheDocument()

await waitFor(
  () => {
    expect(
      screen.queryByText(
        '✓ Attendance saved'
      )
    ).not.toBeInTheDocument()
  },
  {
    timeout: 4000,
  }
)


},
5000
)

  it('saves afternoon attendance as afternoon', async () => {
    const user =
      await openTakeAttendance()

    await user.click(
      screen.getByRole('button', {
        name:
          '🌤 Afternoon 13:00–16:00',
      })
    )

    await waitFor(() => {
      expect(
        screen.getAllByRole(
          'combobox',
          {
            name: 'attendance-status',
          }
        ).length
      ).toBe(2)
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Save Attendance',
      })
    )

    await waitFor(() => {
      expect(
        saveAttendanceMock
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          session: 'afternoon',
        })
      )
    })
  })

  it('shows save error', async () => {
    saveAttendanceMock.mockRejectedValue(
      new Error('Save failed')
    )

    const user =
      await openTakeAttendance()

    await user.click(
      screen.getByRole('button', {
        name: 'Save Attendance',
      })
    )

    expect(
      await screen.findByText(
        'Save failed'
      )
    ).toBeInTheDocument()
  })
})

})
