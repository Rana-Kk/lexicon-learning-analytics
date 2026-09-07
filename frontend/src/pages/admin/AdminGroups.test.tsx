import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminGroups from './AdminGroups'
import { apiFetch, ApiError } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const mockedApiFetch = vi.mocked(apiFetch)

const group = { id: 1, course_id: 100, name: 'Group A', start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-06-01T00:00:00.000Z' }
const course = { id: 100, name: 'Course A' }
const studentUser = { id: 10, name: 'Ada Lovelace', email: 'ada@example.com', role: 'student', github_username: 'adaL' }
const teacherUser = { id: 20, name: 'John Doe', email: 'john@example.com', role: 'teacher' }

function mockLoad(overrides: { groups?: any[]; courses?: any[]; users?: any[] } = {}) {
  mockedApiFetch.mockImplementation((path: string) => {
    if (path === '/groups') return Promise.resolve({ data: overrides.groups ?? [group] })
    if (path === '/courses') return Promise.resolve({ data: overrides.courses ?? [course] })
    if (path === '/users') return Promise.resolve({ data: overrides.users ?? [studentUser, teacherUser] })
    return Promise.reject(new Error(`Unhandled path in test: ${path}`))
  })
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<AdminGroups />)
  await waitFor(() => expect(screen.queryByText('Loading groups…')).not.toBeInTheDocument())
}

describe('AdminGroups', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it('lists groups with their course and dates', async () => {
    await renderLoaded()

    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Course A')).toBeInTheDocument()
    expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    expect(screen.getByText('2026-06-01')).toBeInTheDocument()
    expect(screen.getByText('1 groups')).toBeInTheDocument()
  })

  it('shows a placeholder course name when the course cannot be found', async () => {
    await renderLoaded({ groups: [{ ...group, course_id: 999 }] })

    expect(screen.getByText('Course #999')).toBeInTheDocument()
  })

  it('shows an em dash for missing start/end dates', async () => {
    await renderLoaded({ groups: [{ ...group, start_date: null, end_date: null }] })

    const row = screen.getByText('Group A').closest('tr')!
    expect(within(row).getAllByText('—')).toHaveLength(2)
  })

  it('shows an error message when loading fails', async () => {
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/groups') return Promise.reject(new ApiError(500, 'Could not load groups'))
      if (path === '/users') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    render(<AdminGroups />)

    expect(await screen.findByText('Could not load groups')).toBeInTheDocument()
  })

  it('disables "+ New Group" when there are no courses yet', async () => {
    await renderLoaded({ courses: [] })

    expect(screen.getByRole('button', { name: '+ New Group' })).toBeDisabled()
  })

  it('creates a new group', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ New Group' }))
    await user.type(screen.getByPlaceholderText('e.g. FSWD-2026-C'), 'New Group')
    await user.click(screen.getByRole('button', { name: 'Create Group' }))

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith('/groups', expect.objectContaining({ method: 'POST' }))
    )
    const postCall = mockedApiFetch.mock.calls.find(([, opts]) => (opts as any)?.method === 'POST')!
    expect(JSON.parse((postCall[1] as any).body)).toEqual({
      course_id: 100,
      name: 'New Group',
      start_date: null,
      end_date: null,
    })
  })

  it('updates an existing group', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith('/groups/1', expect.objectContaining({ method: 'PUT' }))
    )
  })

  it('deletes a group after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith('/groups/1', expect.objectContaining({ method: 'DELETE' }))
    )
  })

  it('does not delete a group when confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded()
    mockedApiFetch.mockClear()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockedApiFetch).not.toHaveBeenCalled()
  })

  describe('students modal', () => {
    it('loads and lists enrolled students', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string) => {
        if (path === '/groups/1/students') return Promise.resolve({ data: [studentUser] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Students' }))

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
      expect(screen.getByText('ada@example.com')).toBeInTheDocument()
      expect(screen.getByText(/adaL/)).toBeInTheDocument()
    })

    it('shows an empty state when no students are enrolled', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string) => Promise.resolve({ data: [] }))

      await user.click(screen.getByRole('button', { name: 'Students' }))

      expect(await screen.findByText('No students enrolled in this group.')).toBeInTheDocument()
    })

    it('adds a student to the group', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string, opts?: any) => {
        if (path === '/groups/1/students' && !opts) return Promise.resolve({ data: [] })
        if (path === '/groups/1/students' && opts?.method === 'POST') return Promise.resolve({})
        if (path === '/groups/1/students') return Promise.resolve({ data: [studentUser] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Students' }))
      await screen.findByText('No students enrolled in this group.')

      await user.selectOptions(screen.getByDisplayValue('Select a student to enroll...'), '10')
      await user.click(screen.getByRole('button', { name: 'Add' }))

      await waitFor(() =>
        expect(mockedApiFetch).toHaveBeenCalledWith(
          '/groups/1/students',
          expect.objectContaining({ method: 'POST', body: JSON.stringify({ studentId: 10 }) })
        )
      )
    })

    it('removes a student from the group', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string, opts?: any) => {
        if (path === '/groups/1/students' && opts?.method === 'DELETE') return Promise.resolve({})
        if (path === '/groups/1/students/10') return Promise.resolve({})
        if (path === '/groups/1/students') return Promise.resolve({ data: [studentUser] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Students' }))
      await screen.findByText('Ada Lovelace')
      await user.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() =>
        expect(mockedApiFetch).toHaveBeenCalledWith('/groups/1/students/10', expect.objectContaining({ method: 'DELETE' }))
      )
      await waitFor(() => expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument())
    })

    it('saves a GitHub username for a student', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string, opts?: any) => {
        if (path === '/users/10' && opts?.method === 'PUT') return Promise.resolve({})
        if (path === '/groups/1/students') return Promise.resolve({ data: [{ ...studentUser, github_username: undefined }] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Students' }))
      await user.click(await screen.findByRole('button', { name: /Add GitHub username/ }))
      await user.type(screen.getByPlaceholderText('username'), 'newhandle')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(mockedApiFetch).toHaveBeenCalledWith(
          '/users/10',
          expect.objectContaining({ method: 'PUT', body: JSON.stringify({ github_username: 'newhandle' }) })
        )
      )
    })

    it('closes the students modal', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation(() => Promise.resolve({ data: [] }))

      await user.click(screen.getByRole('button', { name: 'Students' }))
      await screen.findByText('No students enrolled in this group.')
      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(screen.queryByText('No students enrolled in this group.')).not.toBeInTheDocument()
    })
  })

  describe('teachers modal', () => {
    it('loads and lists assigned teachers', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string) => {
        if (path === '/groups/1/teachers') return Promise.resolve({ data: [teacherUser] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Teachers' }))

      expect(await screen.findByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })

    it('shows an empty state when no teachers are assigned', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation(() => Promise.resolve({ data: [] }))

      await user.click(screen.getByRole('button', { name: 'Teachers' }))

      expect(await screen.findByText('No teachers assigned to this group.')).toBeInTheDocument()
    })

    it('assigns a teacher to the group', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string, opts?: any) => {
        if (path === '/groups/1/teachers' && !opts) return Promise.resolve({ data: [] })
        if (path === '/groups/1/teachers' && opts?.method === 'POST') return Promise.resolve({})
        if (path === '/groups/1/teachers') return Promise.resolve({ data: [teacherUser] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Teachers' }))
      await screen.findByText('No teachers assigned to this group.')

      await user.selectOptions(screen.getByDisplayValue('Select a teacher to assign...'), '20')
      await user.click(screen.getByRole('button', { name: 'Assign' }))

      await waitFor(() =>
        expect(mockedApiFetch).toHaveBeenCalledWith(
          '/groups/1/teachers',
          expect.objectContaining({ method: 'POST', body: JSON.stringify({ teacherId: 20 }) })
        )
      )
    })

    it('removes a teacher from the group', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      mockedApiFetch.mockImplementation((path: string, opts?: any) => {
        if (path === '/groups/1/teachers/20') return Promise.resolve({})
        if (path === '/groups/1/teachers') return Promise.resolve({ data: [teacherUser] })
        return Promise.resolve({ data: [] })
      })

      await user.click(screen.getByRole('button', { name: 'Teachers' }))
      await screen.findByText('John Doe')
      await user.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() =>
        expect(mockedApiFetch).toHaveBeenCalledWith('/groups/1/teachers/20', expect.objectContaining({ method: 'DELETE' }))
      )
      await waitFor(() => expect(screen.queryByText('John Doe')).not.toBeInTheDocument())
    })
  })
})
