import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminStudents from './AdminStudents'
import {
  createUser,
  deleteUser,
  getCourses,
  getGroups,
  getUsers,
  importStudentsExcel,
  updateUser,
  ApiError,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getCourses: vi.fn(),
    getGroups: vi.fn(),
    getUsers: vi.fn(),
    importStudentsExcel: vi.fn(),
    updateUser: vi.fn(),
  }
})

const mockedCreateUser = vi.mocked(createUser)
const mockedDeleteUser = vi.mocked(deleteUser)
const mockedGetCourses = vi.mocked(getCourses)
const mockedGetGroups = vi.mocked(getGroups)
const mockedGetUsers = vi.mocked(getUsers)
const mockedImportStudentsExcel = vi.mocked(importStudentsExcel)
const mockedUpdateUser = vi.mocked(updateUser)

const student = {
  id: 1,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  group_ids: '10',
  group_names: 'Group A',
  course_ids: '100',
  course_names: 'Course A',
}

const course = { id: 100, name: 'Course A' }
const group = { id: 10, name: 'Group A', course_id: 100 }

function mockLoad(overrides: { students?: any[]; courses?: any[]; groups?: any[] } = {}) {
  mockedGetUsers.mockResolvedValue({ data: overrides.students ?? [student] } as any)
  mockedGetCourses.mockResolvedValue({ data: overrides.courses ?? [course] } as any)
  mockedGetGroups.mockResolvedValue({ data: overrides.groups ?? [group] } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<AdminStudents />)
  await waitFor(() => expect(screen.getByText('Students')).toBeInTheDocument())
  const firstStudent = (overrides?.students ?? [student])[0]
  if (firstStudent) await screen.findByText(firstStudent.name)
}

describe('AdminStudents', () => {
  beforeEach(() => {
    mockedCreateUser.mockReset()
    mockedDeleteUser.mockReset()
    mockedGetCourses.mockReset()
    mockedGetGroups.mockReset()
    mockedGetUsers.mockReset()
    mockedImportStudentsExcel.mockReset()
    mockedUpdateUser.mockReset()
  })

  it('lists students with their course and group', async () => {
    await renderLoaded()

    const row = screen.getByText('Ada Lovelace').closest('tr')!
    expect(within(row).getByText('ada@example.com')).toBeInTheDocument()
    expect(within(row).getByText('Course A')).toBeInTheDocument()
    expect(within(row).getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText((_, node) => node?.textContent === '1 students shown')).toBeInTheDocument()
  })

  it('shows an em dash when a student has no course or group', async () => {
    await renderLoaded({
      students: [{ id: 2, name: 'No Group', email: 'x@example.com', group_ids: '', group_names: '', course_ids: '', course_names: '' }],
    })

    const row = screen.getByText('No Group').closest('tr')!
    expect(within(row).getAllByText('—')).toHaveLength(2)
  })

  it('shows an error message when loading fails', async () => {
    mockedGetUsers.mockRejectedValue(new ApiError(500, 'Server exploded'))
    mockedGetCourses.mockResolvedValue({ data: [] } as any)
    mockedGetGroups.mockResolvedValue({ data: [] } as any)

    render(<AdminStudents />)

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  })

  it('filters the list by course', async () => {
    const otherCourse = { id: 200, name: 'Course B' }
    const otherStudent = { id: 3, name: 'Grace Hopper', email: 'grace@example.com', group_ids: '20', group_names: 'Group B', course_ids: '200', course_names: 'Course B' }
    await renderLoaded({ students: [student, otherStudent], courses: [course, otherCourse], groups: [group, { id: 20, name: 'Group B', course_id: 200 }] })

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByDisplayValue('All Courses'), 'Course A')

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument()
    expect(screen.getByText('1 students shown')).toBeInTheDocument()
    expect(screen.getByText('Clear Filters')).toBeInTheDocument()
  })

  it('clears filters when "Clear Filters" is clicked', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(screen.getByDisplayValue('All Courses'), 'Course A')
    await user.click(screen.getByText('Clear Filters'))

    expect(screen.getByDisplayValue('All Courses')).toBeInTheDocument()
    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument()
  })

  it('opens the add-student modal with an empty form', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Add Student' }))

    expect(screen.getByRole('heading', { name: 'Add Student' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('')
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('requires name, email and group before saving', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Add Student' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name, email and group are required')).toBeInTheDocument()
    expect(mockedCreateUser).not.toHaveBeenCalled()
  })

  it('requires a password when adding a student manually', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Add Student' }))
    await user.type(screen.getByPlaceholderText('Full name'), 'New Student')
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await user.selectOptions(screen.getByDisplayValue('Select course'), 'Course A')
    await user.selectOptions(screen.getByDisplayValue('Select group'), 'Group A')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Please enter a password when adding a student manually')).toBeInTheDocument()
    expect(mockedCreateUser).not.toHaveBeenCalled()
  })

  it('creates a new student with the selected group', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateUser.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: '+ Add Student' }))
    await user.type(screen.getByPlaceholderText('Full name'), 'New Student')
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'secret123')
    await user.selectOptions(screen.getByDisplayValue('Select course'), 'Course A')
    await user.selectOptions(screen.getByDisplayValue('Select group'), 'Group A')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedCreateUser).toHaveBeenCalledWith({
        name: 'New Student',
        email: 'new@example.com',
        password: 'secret123',
        role: 'student',
        group_ids: [10],
      })
    )
  })

  it('opens the edit modal pre-filled with the student data', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'View / Edit' }))

    expect(screen.getByRole('heading', { name: 'Edit Student' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('Ada Lovelace')
    expect(screen.getByPlaceholderText('Email')).toHaveValue('ada@example.com')
    expect(screen.getByPlaceholderText('New password (leave blank to keep current)')).toBeInTheDocument()
  })

  it('updates a student without requiring a new password', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedUpdateUser.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'View / Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedUpdateUser).toHaveBeenCalledWith(1, {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        group_ids: [10],
      })
    )
  })

  it('deletes a student after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteUser.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mockedDeleteUser).toHaveBeenCalledWith(1))
  })

  it('does not delete a student when confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockedDeleteUser).not.toHaveBeenCalled()
  })

  it('rejects a non-.xlsx file on import', async () => {
    const user = userEvent.setup({ applyAccept: false })
    await renderLoaded()

    const file = new File(['data'], 'students.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Import Excel', { selector: 'input' })
    await user.upload(input, file)

    expect(await screen.findByText('Please upload an .xlsx Excel file.')).toBeInTheDocument()
    expect(mockedImportStudentsExcel).not.toHaveBeenCalled()
  })

  it('imports a valid .xlsx file and shows the result summary', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedImportStudentsExcel.mockResolvedValue({
      imported: 2,
      skipped: 1,
      data: [{ id: 5, email: 'stu@example.com', must_change_password: true }],
      skippedRows: [{ email: 'bad@example.com', reason: 'Missing group' }],
    } as any)

    const file = new File(['data'], 'students.xlsx', { type: 'application/vnd.ms-excel' })
    const input = screen.getByLabelText('Import Excel', { selector: 'input' })
    await user.upload(input, file)

    await waitFor(() => expect(mockedImportStudentsExcel).toHaveBeenCalled())
    expect(await screen.findByText((_, node) => node?.textContent === 'Imported 2, skipped 1.')).toBeInTheDocument()
    expect(screen.getByText(/must change it on first login/)).toBeInTheDocument()
    expect(screen.getByText(/Missing group/)).toBeInTheDocument()
  })
})
