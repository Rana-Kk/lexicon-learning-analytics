import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCourses from './AdminCourses'
import { apiFetch, ApiError } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const mockedApiFetch = vi.mocked(apiFetch)

const course = {
  id: 1,
  name: 'Full Stack Web Development',
  description: 'Learn the full stack',
  start_date: '2026-01-15T00:00:00.000Z',
  end_date: '2026-06-15T00:00:00.000Z',
}

async function renderLoaded(courses: any[] = [course]) {
  mockedApiFetch.mockResolvedValueOnce({ data: courses })
  render(<AdminCourses />)
  await waitFor(() => expect(screen.queryByText('Loading courses…')).not.toBeInTheDocument())
}

describe('AdminCourses', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it('shows a loading state, then lists loaded courses', async () => {
    mockedApiFetch.mockResolvedValueOnce({ data: [course] })
    render(<AdminCourses />)

    expect(screen.getByText('Loading courses…')).toBeInTheDocument()

    expect(await screen.findByText('Full Stack Web Development')).toBeInTheDocument()
    expect(screen.getByText('Learn the full stack')).toBeInTheDocument()
    expect(screen.getByText('2026-01-15')).toBeInTheDocument()
    expect(screen.getByText('2026-06-15')).toBeInTheDocument()
    expect(mockedApiFetch).toHaveBeenCalledWith('/courses')
  })

  it('shows an empty state when there are no courses', async () => {
    await renderLoaded([])

    expect(screen.getByText('No courses found. Click "+ New Course" to create one.')).toBeInTheDocument()
  })

  it('shows an em dash for missing description and dates', async () => {
    await renderLoaded([{ id: 2, name: 'Bare Course', description: null, start_date: null, end_date: null }])

    const row = screen.getByText('Bare Course').closest('tr')!
    expect(within(row).getAllByText('—')).toHaveLength(3)
  })

  it('shows an error message when loading courses fails with an ApiError', async () => {
    mockedApiFetch.mockRejectedValueOnce(new ApiError(500, 'Could not reach the server'))
    render(<AdminCourses />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('shows a generic error message when loading fails with a non-ApiError', async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error('boom'))
    render(<AdminCourses />)

    expect(await screen.findByText('Failed to load courses')).toBeInTheDocument()
  })

  it('opens the create modal with an empty form', async () => {
    const user = userEvent.setup()
    await renderLoaded([])

    await user.click(screen.getByRole('button', { name: '+ New Course' }))

    expect(screen.getByRole('heading', { name: 'Create Course' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Full Stack Web Development')).toHaveValue('')
  })

  it('opens the edit modal pre-filled with the course data', async () => {
    const user = userEvent.setup()
    await renderLoaded([course])

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Edit Course')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Full Stack Web Development')).toHaveValue('Full Stack Web Development')
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('creates a new course and reloads the list', async () => {
    const user = userEvent.setup()
    await renderLoaded([])

    mockedApiFetch.mockResolvedValueOnce({}) // POST /courses
    mockedApiFetch.mockResolvedValueOnce({ data: [course] }) // reload

    await user.click(screen.getByRole('button', { name: '+ New Course' }))
    await user.type(screen.getByPlaceholderText('e.g. Full Stack Web Development'), 'New Course')
    await user.click(screen.getByRole('button', { name: 'Create Course' }))

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/courses',
        expect.objectContaining({ method: 'POST' })
      )
    )
    const postCall = mockedApiFetch.mock.calls.find(([, opts]) => (opts as any)?.method === 'POST')!
    expect(JSON.parse((postCall[1] as any).body)).toEqual({
      name: 'New Course',
      description: null,
      start_date: null,
      end_date: null,
    })

    // Modal closes after a successful save.
    await waitFor(() => expect(screen.queryByText('Create Course')).not.toBeInTheDocument())
  })

  it('disables the save button while the name is blank', async () => {
    const user = userEvent.setup()
    await renderLoaded([])

    await user.click(screen.getByRole('button', { name: '+ New Course' }))

    expect(screen.getByRole('button', { name: 'Create Course' })).toBeDisabled()
  })

  it('updates an existing course via PUT', async () => {
    const user = userEvent.setup()
    await renderLoaded([course])

    mockedApiFetch.mockResolvedValueOnce({}) // PUT
    mockedApiFetch.mockResolvedValueOnce({ data: [course] }) // reload

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/courses/1',
        expect.objectContaining({ method: 'PUT' })
      )
    )
  })

  it('deletes a course after confirmation and reloads the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded([course])

    mockedApiFetch.mockResolvedValueOnce({}) // DELETE
    mockedApiFetch.mockResolvedValueOnce({ data: [] }) // reload

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith('/courses/1', expect.objectContaining({ method: 'DELETE' }))
    )
  })

  it('does not delete a course when the confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded([course])
    mockedApiFetch.mockClear()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockedApiFetch).not.toHaveBeenCalled()
  })
})
