import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminTeachers from './AdminTeachers'
import { createUser, deleteUser, getUsers, updateUser, ApiError } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getUsers: vi.fn(),
    updateUser: vi.fn(),
  }
})

const mockedCreateUser = vi.mocked(createUser)
const mockedDeleteUser = vi.mocked(deleteUser)
const mockedGetUsers = vi.mocked(getUsers)
const mockedUpdateUser = vi.mocked(updateUser)

const teacher = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'teacher',
  group_names: 'Group A',
}

async function renderLoaded(teachers: any[] = [teacher]) {
  mockedGetUsers.mockResolvedValue({ data: teachers } as any)
  render(<AdminTeachers />)
  await waitFor(() => expect(mockedGetUsers).toHaveBeenCalledWith('teacher'))
  if (teachers[0]) await screen.findByText(teachers[0].name)
}

describe('AdminTeachers', () => {
  beforeEach(() => {
    mockedCreateUser.mockReset()
    mockedDeleteUser.mockReset()
    mockedGetUsers.mockReset()
    mockedUpdateUser.mockReset()
  })

  it('lists teachers with their group', async () => {
    await renderLoaded()

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('1 instructors registered')).toBeInTheDocument()
  })

  it('shows "Unassigned" when a teacher has no group', async () => {
    await renderLoaded([{ id: 2, name: 'No Group', email: 'x@example.com', role: 'teacher', group_names: undefined }])

    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows an error when loading fails with an ApiError', async () => {
    mockedGetUsers.mockRejectedValue(new ApiError(500, 'Failed to fetch teachers'))
    render(<AdminTeachers />)

    expect(await screen.findByText('Failed to fetch teachers')).toBeInTheDocument()
  })

  it('shows a generic error when loading fails without an ApiError', async () => {
    mockedGetUsers.mockRejectedValue(new Error('boom'))
    render(<AdminTeachers />)

    expect(await screen.findByText('Could not load teachers.')).toBeInTheDocument()
  })

  it('opens the add-teacher modal with a prefilled temporary password', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Add Teacher' }))

    expect(screen.getByRole('heading', { name: 'Add Teacher' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('')
    expect(screen.getByPlaceholderText('Temporary password')).toHaveValue('Temp1234')
  })

  it('requires a name and email before saving', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Add Teacher' }))
    await user.clear(screen.getByPlaceholderText('Temporary password'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name and email are required')).toBeInTheDocument()
    expect(mockedCreateUser).not.toHaveBeenCalled()
  })

  it('creates a new teacher with the default temporary password', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateUser.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: '+ Add Teacher' }))
    await user.type(screen.getByPlaceholderText('Full name'), 'New Teacher')
    await user.type(screen.getByPlaceholderText('Temporary password'), 'x')
    await user.clear(screen.getByPlaceholderText('Temporary password'))
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedCreateUser).toHaveBeenCalledWith({
        name: 'New Teacher',
        email: 'new@example.com',
        password: 'Temp1234',
        role: 'teacher',
      })
    )
  })

  it('opens the edit modal pre-filled with the teacher data', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('heading', { name: 'Edit Teacher' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('John Doe')
    expect(screen.getByPlaceholderText('Email')).toHaveValue('john@example.com')
    expect(screen.getByPlaceholderText('New password (optional)')).toHaveValue('')
  })

  it('updates a teacher without sending a password when left blank', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedUpdateUser.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedUpdateUser).toHaveBeenCalledWith(1, {
        name: 'John Doe',
        email: 'john@example.com',
      })
    )
  })

  it('removes a teacher after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteUser.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(mockedDeleteUser).toHaveBeenCalledWith(1))
  })

  it('does not remove a teacher when confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(mockedDeleteUser).not.toHaveBeenCalled()
  })

  it('shows an error message when save fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedUpdateUser.mockRejectedValue(new ApiError(409, 'Email already in use'))

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Email already in use')).toBeInTheDocument()
  })

  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Add Teacher' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Add Teacher' })).not.toBeInTheDocument()
  })
})
