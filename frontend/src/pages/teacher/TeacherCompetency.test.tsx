import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherCompetency from './TeacherCompetency'
import {
  ApiError,
  getCourses,
  getGroups,
  getGroupStudents,
  getStudentCompetencies,
  saveCompetency,
  getGroupCompetencies,
  getCourseCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getCompetencyGroups,
  syncCompetencyGroups,
  addGroupCompetency,
  upsertGroupCompetencyOverride,
  removeGroupCompetencyOverride,
  deleteGroupCompetency,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getCourses: vi.fn(),
    getGroups: vi.fn(),
    getGroupStudents: vi.fn(),
    getStudentCompetencies: vi.fn(),
    saveCompetency: vi.fn(),
    getGroupCompetencies: vi.fn(),
    getCourseCompetencies: vi.fn(),
    createCompetency: vi.fn(),
    updateCompetency: vi.fn(),
    deleteCompetency: vi.fn(),
    getCompetencyGroups: vi.fn(),
    syncCompetencyGroups: vi.fn(),
    addGroupCompetency: vi.fn(),
    deleteGroupCompetency: vi.fn(),
    upsertGroupCompetencyOverride: vi.fn(),
    removeGroupCompetencyOverride: vi.fn(),
  }
})

const mockedGetCourses = vi.mocked(getCourses)
const mockedGetGroups = vi.mocked(getGroups)
const mockedGetGroupStudents = vi.mocked(getGroupStudents)
const mockedGetStudentCompetencies = vi.mocked(getStudentCompetencies)
const mockedSaveCompetency = vi.mocked(saveCompetency)
const mockedGetGroupCompetencies = vi.mocked(getGroupCompetencies)
const mockedGetCourseCompetencies = vi.mocked(getCourseCompetencies)
const mockedCreateCompetency = vi.mocked(createCompetency)
const mockedUpdateCompetency = vi.mocked(updateCompetency)
const mockedDeleteCompetency = vi.mocked(deleteCompetency)
const mockedGetCompetencyGroups = vi.mocked(getCompetencyGroups)
const mockedSyncCompetencyGroups = vi.mocked(syncCompetencyGroups)
const mockedAddGroupCompetency = vi.mocked(addGroupCompetency)
const mockedDeleteGroupCompetency = vi.mocked(deleteGroupCompetency)
const mockedUpsertGroupCompetencyOverride = vi.mocked(upsertGroupCompetencyOverride)
const mockedRemoveGroupCompetencyOverride = vi.mocked(removeGroupCompetencyOverride)

const course = { id: 1, name: 'Course A' }
const courseB = { id: 2, name: 'Course B' }
const group = { id: 1, name: 'Group A', course_id: 1, course_name: 'Course A' }
const groupB = { id: 2, name: 'Group B', course_id: 2, course_name: 'Course B' }
const student = { id: 10, name: 'Ada Lovelace', email: 'ada@example.com' }
const studentB = { id: 20, name: 'Grace Hopper', email: 'grace@example.com' }

const courseCompetency = {
  id: 100,
  course_id: 1,
  name: 'Communication',
  description: 'Explains ideas clearly',
}

const groupCompetency = {
  id: 100,
  name: 'Communication',
  description: 'Explains ideas clearly',
  course_default_name: 'Communication',
  course_default_description: 'Explains ideas clearly',
  is_overridden: 0,
}

const studentCompetency = {
  competency_id: 100,
  name: 'Communication',
  score: 75,
}

function mockLoadedData(overrides: {
  courses?: any[]
  groups?: any[]
  students?: any[]
  courseCompetencies?: any[]
  groupCompetencies?: any[]
  studentCompetencies?: any[]
} = {}) {
  mockedGetCourses.mockResolvedValue({
    data: overrides.courses ?? [course],
  } as any)

  mockedGetGroups.mockResolvedValue({
    data: overrides.groups ?? [group],
  } as any)

  mockedGetCourseCompetencies.mockResolvedValue({
    data: overrides.courseCompetencies ?? [courseCompetency],
  } as any)

  mockedGetGroupCompetencies.mockResolvedValue({
    data: overrides.groupCompetencies ?? [groupCompetency],
  } as any)

  mockedGetGroupStudents.mockResolvedValue({
    data: overrides.students ?? [student],
  } as any)

  mockedGetStudentCompetencies.mockResolvedValue({
    data: overrides.studentCompetencies ?? [studentCompetency],
  } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoadedData>[0]) {
  mockLoadedData(overrides)
  render(<TeacherCompetency />)

  // The component sets loading=false when bootstrap() finishes, while the
  // course/group/student effects fetch their data immediately afterwards.
  // Waiting only for "Loading..." to disappear is therefore too early.
  await waitFor(() =>
    expect(mockedGetCourses).toHaveBeenCalledTimes(1),
  )
  await waitFor(() =>
    expect(mockedGetGroups).toHaveBeenCalledTimes(1),
  )

  const expectedCourseId = (overrides?.courses ?? [course])[0]?.id
  const expectedGroupId = (overrides?.groups ?? [group])[0]?.id

  if (expectedCourseId != null) {
    await waitFor(() =>
      expect(mockedGetCourseCompetencies).toHaveBeenCalledWith(expectedCourseId),
    )
  }

  if (expectedGroupId != null) {
    await waitFor(() =>
      expect(mockedGetGroupCompetencies).toHaveBeenCalledWith(expectedGroupId),
    )
    await waitFor(() =>
      expect(mockedGetGroupStudents).toHaveBeenCalledWith(expectedGroupId),
    )
  }

  // A student is selected only when the selected group has students.
  const students = overrides?.students ?? [student]
  if (expectedGroupId != null && students.length > 0) {
    await waitFor(() =>
      expect(mockedGetStudentCompetencies).toHaveBeenCalledWith(students[0].id),
    )
  }
}

async function openGroupTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Group & scores' }))
  return user
}

describe('TeacherCompetency - current UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetCompetencyGroups.mockResolvedValue({ data: [] } as any)
    mockedSyncCompetencyGroups.mockResolvedValue({} as any)
    mockedAddGroupCompetency.mockResolvedValue({} as any)
    mockedUpsertGroupCompetencyOverride.mockResolvedValue({} as any)
    mockedRemoveGroupCompetencyOverride.mockResolvedValue({} as any)
    mockedDeleteGroupCompetency.mockResolvedValue({} as any)
    mockedSaveCompetency.mockResolvedValue({} as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading before the initial data resolves', () => {
    mockedGetCourses.mockReturnValue(new Promise(() => {}) as any)
    mockedGetGroups.mockReturnValue(new Promise(() => {}) as any)

    render(<TeacherCompetency />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('loads the first course and first group on startup', async () => {
    await renderLoaded()

    expect(mockedGetCourses).toHaveBeenCalledTimes(1)
    expect(mockedGetGroups).toHaveBeenCalledTimes(1)
    expect(mockedGetCourseCompetencies).toHaveBeenCalledWith(1)
    expect(mockedGetGroupCompetencies).toHaveBeenCalledWith(1)
    expect(mockedGetGroupStudents).toHaveBeenCalledWith(1)
    expect(mockedGetStudentCompetencies).toHaveBeenCalledWith(10)
  })

  it('shows course competencies in the Course competencies tab', async () => {
    await renderLoaded()

    expect(screen.getByText('Course competencies')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.getByText('Explains ideas clearly')).toBeInTheDocument()
    expect(screen.getByText('Assign to all 1 group(s) in this course')).toBeInTheDocument()
  })

  it('shows the current empty course state', async () => {
    await renderLoaded({
      courseCompetencies: [],
    })

    expect(screen.getByText('This course has no competencies yet.')).toBeInTheDocument()
  })

  it('shows zero groups when the teacher has no groups', async () => {
    await renderLoaded({
      groups: [],
      courseCompetencies: [],
    })

    expect(screen.getByText('Assign to all 0 group(s) in this course')).toBeInTheDocument()
    expect(screen.getByText('This course has no competencies yet.')).toBeInTheDocument()
  })

  it('shows an error when the initial data cannot be loaded', async () => {
    mockedGetCourses.mockResolvedValue({ data: [course] } as any)
    mockedGetGroups.mockRejectedValue(
      new ApiError(500, 'Could not reach the server'),
    )

    render(<TeacherCompetency />)

    expect(
      await screen.findByText('Could not reach the server'),
    ).toBeInTheDocument()
  })

  it('requires a competency name before creating one', async () => {
    await renderLoaded()

    expect(
      screen.getByRole('button', { name: '+ Add Competency' }),
    ).toBeDisabled()
  })

  it('creates a course competency with the current form fields', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateCompetency.mockResolvedValue({} as any)

    await user.type(
      screen.getByPlaceholderText('Competency name'),
      'Teamwork',
    )
    await user.type(
      screen.getByPlaceholderText('Description (optional)'),
      'Works well with others',
    )
    await user.click(
      screen.getByRole('button', { name: '+ Add Competency' }),
    )

    await waitFor(() =>
      expect(mockedCreateCompetency).toHaveBeenCalledWith({
        course_id: 1,
        name: 'Teamwork',
        description: 'Works well with others',
        group_ids: 'all',
      }),
    )

    expect(
      await screen.findByText(
        'Added to the course and assigned to every group.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Competency name')).toHaveValue('')
  })

  it('creates a course competency without assigning it to all groups when unchecked', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateCompetency.mockResolvedValue({} as any)

    await user.type(
      screen.getByPlaceholderText('Competency name'),
      'Leadership',
    )
    await user.click(
      screen.getByRole('checkbox', {
        name: /Assign to all 1 group\(s\)/,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: '+ Add Competency' }),
    )

    await waitFor(() =>
      expect(mockedCreateCompetency).toHaveBeenCalledWith({
        course_id: 1,
        name: 'Leadership',
        description: '',
        group_ids: [],
      }),
    )
  })

  it('shows the API error when creating a competency fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    mockedCreateCompetency.mockRejectedValue(
      new ApiError(400, 'Competency already exists'),
    )

    await user.type(
      screen.getByPlaceholderText('Competency name'),
      'Communication',
    )
    await user.click(
      screen.getByRole('button', { name: '+ Add Competency' }),
    )

    expect(
      await screen.findByText('Competency already exists'),
    ).toBeInTheDocument()
  })

  it('edits and saves a course competency', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedUpdateCompetency.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const inputs = screen.getAllByDisplayValue('Communication')
    expect(inputs.length).toBeGreaterThan(0)

    await user.clear(inputs[0])
    await user.type(inputs[0], 'Clear Communication')

    const descriptionInput = screen.getByDisplayValue('Explains ideas clearly')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Communicates technical ideas clearly')

    await user.click(
      screen.getByRole('button', { name: 'Save for all groups' }),
    )

    await waitFor(() =>
      expect(mockedUpdateCompetency).toHaveBeenCalledWith(100, {
        name: 'Clear Communication',
        description: 'Communicates technical ideas clearly',
      }),
    )
  })

  it('does not save an edited course competency when the name is empty', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getAllByDisplayValue('Communication')[0]
    await user.clear(input)
    await user.click(
      screen.getByRole('button', { name: 'Save for all groups' }),
    )

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(mockedUpdateCompetency).not.toHaveBeenCalled()
  })

  it('deletes a course competency after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteCompetency.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(mockedDeleteCompetency).toHaveBeenCalledWith(100),
    )
    expect(
      await screen.findByText('Competency deleted from the course.'),
    ).toBeInTheDocument()
  })

  it('does not delete a course competency when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    await renderLoaded({
      courseCompetencies: [courseCompetency],
    })

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockedDeleteCompetency).not.toHaveBeenCalled()
  })

  it('opens the Groups panel and loads group assignments', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedGetCompetencyGroups.mockResolvedValue({
      data: [
        { id: 1, name: 'Group A', assigned: 1, is_overridden: 0 },
        { id: 2, name: 'Group B', assigned: 0, is_overridden: 0 },
      ],
    } as any)

    await user.click(screen.getByRole('button', { name: 'Groups' }))

    await waitFor(() =>
      expect(mockedGetCompetencyGroups).toHaveBeenCalledWith(100),
    )
    expect(screen.getByText(/Which groups use “Communication”/)).toBeInTheDocument()
    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Group B')).toBeInTheDocument()
  })

  it('saves changed group assignments', async () => {
    const user = userEvent.setup()
    await renderLoaded({
      courseCompetencies: [courseCompetency],
    })
    mockedGetCompetencyGroups.mockResolvedValue({
      data: [
        { id: 1, name: 'Group A', assigned: 1, is_overridden: 0 },
        { id: 2, name: 'Group B', assigned: 0, is_overridden: 0 },
      ],
    } as any)

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await waitFor(() =>
      expect(mockedGetCompetencyGroups).toHaveBeenCalledWith(100),
    )

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[2])

    await user.click(
      screen.getByRole('button', { name: 'Save assignments' }),
    )

    await waitFor(() =>
      expect(mockedSyncCompetencyGroups).toHaveBeenCalledWith(100, [1, 2]),
    )
  })

  it('shows group competencies and student scores on the Group & scores tab', async () => {
    await renderLoaded()
    await openGroupTab()

    expect(
      screen.getByRole('columnheader', { name: 'Competency' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.getByText('Explains ideas clearly')).toBeInTheDocument()
    expect(screen.getByDisplayValue('75')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save All Changes' })).toBeEnabled()
  })

  it('shows an em dash for a group competency without a description', async () => {
    await renderLoaded({
      groupCompetencies: [{ ...groupCompetency, description: null }],
    })
    await openGroupTab()

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('defaults an unscored competency to 0', async () => {
    await renderLoaded({
      studentCompetencies: [],
    })
    await openGroupTab()

    expect(screen.getByDisplayValue('0')).toBeInTheDocument()
  })

  it('shows the current empty group competency state', async () => {
    await renderLoaded({
      groupCompetencies: [],
    })
    await openGroupTab()

    expect(
      screen.getByText('No competencies assigned to this group yet.'),
    ).toBeInTheDocument()
  })

  it('shows no students available when the selected group has no students', async () => {
    await renderLoaded({
      students: [],
    })
    await openGroupTab()

    expect(screen.getByText('No students available')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save All Changes' }),
    ).toBeDisabled()
  })

  it('adds a course competency to the selected group', async () => {
    const user = userEvent.setup()
    await renderLoaded({
      courseCompetencies: [courseCompetency, {
        id: 101,
        course_id: 1,
        name: 'Leadership',
        description: 'Leads effectively',
      }],
      groupCompetencies: [groupCompetency],
    })
    await openGroupTab()

    const selects = screen.getAllByRole('combobox')
    // Group = 0, Student = 1, Add-from-course = 2.
    const competencySelect = selects[2]
    await user.selectOptions(competencySelect, '101')

    await user.click(screen.getByRole('button', { name: 'Add to group' }))

    await waitFor(() =>
      expect(mockedAddGroupCompetency).toHaveBeenCalledWith({
        group_id: 1,
        competency_id: 101,
      }),
    )
  })

  it('switches groups and reloads group data', async () => {
    await renderLoaded({
      groups: [group, groupB],
    })
    const user = await openGroupTab()

    // The group selector is the first combobox in the Group & scores tab.
    const groupSelect = screen.getAllByRole('combobox')[0]

    // Wait for the initial group data before switching groups.
    await waitFor(() =>
      expect(mockedGetGroupCompetencies).toHaveBeenCalledWith(1),
    )

    await user.selectOptions(groupSelect, '2')

    await waitFor(() =>
      expect(mockedGetGroupCompetencies).toHaveBeenCalledWith(2),
    )
    await waitFor(() =>
      expect(mockedGetGroupStudents).toHaveBeenCalledWith(2),
    )
  })

it('switches students and reloads their scores', async () => {
  const user = userEvent.setup()

  await renderLoaded({
    students: [student, studentB],
  })

  // Configure the student-specific response AFTER renderLoaded,
  // because renderLoaded() initializes the default mocks.
  mockedGetStudentCompetencies.mockImplementation(
    (id: string | number) =>
      Promise.resolve({
        data:
          Number(id) === 20
            ? [{ ...studentCompetency, score: 55 }]
            : [{ ...studentCompetency, score: 75 }],
      }) as any,
  )

  await openGroupTab()

  await waitFor(() =>
    expect(mockedGetStudentCompetencies).toHaveBeenCalledWith(10),
  )

  await waitFor(() =>
    expect(screen.getByRole('spinbutton')).toHaveValue(75),
  )

  const selects = screen.getAllByRole('combobox')

  // Group = 0, Student = 1, Add-from-course = 2.
  const studentSelect = selects[1]

  await user.selectOptions(studentSelect, '20')

  await waitFor(() =>
    expect(mockedGetStudentCompetencies).toHaveBeenCalledWith(20),
  )

  await waitFor(() =>
    expect(screen.getByRole('spinbutton')).toHaveValue(55),
  )
})
  it('edits and saves all competency scores', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await openGroupTab()

    const scoreInput = screen.getByDisplayValue('75')
    await user.clear(scoreInput)
    await user.type(scoreInput, '90')
    await user.click(
      screen.getByRole('button', { name: 'Save All Changes' }),
    )

    await waitFor(() =>
      expect(mockedSaveCompetency).toHaveBeenCalledWith({
        student_id: 10,
        competency_id: 100,
        score: 90,
      }),
    )
    expect(
      await screen.findByText('All competency scores saved successfully.'),
    ).toBeInTheDocument()
  })

  it('shows an error when saving scores fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await openGroupTab()

    mockedSaveCompetency.mockRejectedValue(
      new ApiError(400, 'Could not save scores'),
    )

    await user.click(
      screen.getByRole('button', { name: 'Save All Changes' }),
    )

    expect(
      await screen.findByText('Could not save scores'),
    ).toBeInTheDocument()
  })

  it('opens and saves a group-specific competency override', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await openGroupTab()

    await user.click(
      screen.getByRole('button', { name: 'Customise for this group' }),
    )

    const nameInput = screen.getByDisplayValue('Communication')
    await user.clear(nameInput)
    await user.type(nameInput, 'Technical Communication')

    const descriptionInput = screen.getByDisplayValue('Explains ideas clearly')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Explains technical ideas clearly')

    await user.click(
      screen.getByRole('button', { name: 'Save for this group' }),
    )

    await waitFor(() =>
      expect(mockedUpsertGroupCompetencyOverride).toHaveBeenCalledWith(
        1,
        100,
        {
          name: 'Technical Communication',
          description: 'Explains technical ideas clearly',
        },
      ),
    )
  })

  it('reverts a group-specific override after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded({
      groupCompetencies: [{ ...groupCompetency, is_overridden: 1 }],
    })
    await openGroupTab()

    await user.click(
      screen.getByRole('button', { name: 'Revert to default' }),
    )

    await waitFor(() =>
      expect(mockedRemoveGroupCompetencyOverride).toHaveBeenCalledWith(1, 100),
    )
  })

  it('removes a competency from the group after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()

    await openGroupTab()

    await user.click(
      screen.getByRole('button', { name: 'Remove from group' }),
    )

    await waitFor(() =>
      expect(mockedDeleteGroupCompetency).toHaveBeenCalledWith(1, 100),
    )
    expect(
      await screen.findByText('Removed from this group. It still exists in the course.'),
    ).toBeInTheDocument()
  })
})
