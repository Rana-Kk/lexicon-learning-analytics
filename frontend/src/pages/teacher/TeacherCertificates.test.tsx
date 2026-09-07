import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherCertificates from './TeacherCertificates'
import {
  getMyGroups,
  getGroupStudents,
  getCertificates,
  createCertificate,
  deleteCertificate,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getMyGroups: vi.fn(),
    getGroupStudents: vi.fn(),
    getCertificates: vi.fn(),
    createCertificate: vi.fn(),
    deleteCertificate: vi.fn(),
  }
})

const mockedGetMyGroups = vi.mocked(getMyGroups)
const mockedGetGroupStudents = vi.mocked(getGroupStudents)
const mockedGetCertificates = vi.mocked(getCertificates)
const mockedCreateCertificate = vi.mocked(createCertificate)
const mockedDeleteCertificate = vi.mocked(deleteCertificate)

const group = { id: 'g1', course_id: 'c1', course_name: 'Course A' }
const student = { id: 's1', name: 'Ada Lovelace', email: 'ada@example.com' }
const certificate = {
  id: 'cert1',
  studentName: 'Ada Lovelace',
  name: 'Course A',
  issueDate: '2026-01-15',
  certificateCode: 'LEX-123',
}

function mockLoad(overrides: { groups?: any[]; students?: any[]; certs?: any[] } = {}) {
  mockedGetMyGroups.mockResolvedValue({ data: overrides.groups ?? [group] } as any)
  mockedGetGroupStudents.mockResolvedValue({ data: overrides.students ?? [student] } as any)
  mockedGetCertificates.mockResolvedValue({ data: overrides.certs ?? [certificate] } as any)
}

async function renderLoaded(overrides?: Parameters<typeof mockLoad>[0]) {
  mockLoad(overrides)
  render(<TeacherCertificates />)
  await waitFor(() => expect(screen.queryByText('Loading certificates...')).not.toBeInTheDocument())
}

describe('TeacherCertificates', () => {
  beforeEach(() => {
    mockedGetMyGroups.mockReset()
    mockedGetGroupStudents.mockReset()
    mockedGetCertificates.mockReset()
    mockedCreateCertificate.mockReset()
    mockedDeleteCertificate.mockReset()
  })

  it('shows a loading state before data resolves', () => {
    mockedGetMyGroups.mockReturnValue(new Promise(() => {}) as any)
    render(<TeacherCertificates />)

    expect(screen.getByText('Loading certificates...')).toBeInTheDocument()
  })

  it('shows an error message when loading groups fails', async () => {
    mockedGetMyGroups.mockRejectedValue(new Error('Could not reach the server'))
    render(<TeacherCertificates />)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no students', async () => {
    await renderLoaded({ groups: [], students: [] })

    expect(screen.getByText('No students assigned.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Issue Certificate' })).toBeDisabled()
  })

  it('keeps loading other groups when one group\'s students fail to load', async () => {
    const secondGroup = { id: 'g2', course_id: 'c2', course_name: 'Course B' }
    mockedGetMyGroups.mockResolvedValue({ data: [group, secondGroup] } as any)
    mockedGetGroupStudents.mockImplementation((id: string) =>
      id === 'g1' ? Promise.reject(new Error('fail')) : Promise.resolve({ data: [student] } as any)
    )
    mockedGetCertificates.mockResolvedValue({ data: [] } as any)

    render(<TeacherCertificates />)

    expect(await screen.findByText('No certificates issued yet.')).toBeInTheDocument()
  })

  it('lists issued certificates', async () => {
    await renderLoaded()

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Course A')).toBeInTheDocument()
    expect(screen.getByText('2026-01-15')).toBeInTheDocument()
    expect(screen.getByText('LEX-123')).toBeInTheDocument()
  })

  it('shows an em dash for missing certificate fields', async () => {
    await renderLoaded({ certs: [{ id: 'c1', studentName: null, name: 'Course A', issueDate: null, certificateCode: null }] })

    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('shows an empty state when no certificates have been issued', async () => {
    await renderLoaded({ certs: [] })

    expect(screen.getByText('No certificates issued yet.')).toBeInTheDocument()
  })

  it('opens the issue-certificate modal with the first student and their course pre-selected', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Issue Certificate' }))

    expect(screen.getByRole('heading', { name: 'Issue Certificate' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Course A')).toBeInTheDocument()
    expect(screen.getByText('Issued by Lexicon')).toBeInTheDocument()
  })

  it('shows a message when the selected student has no enrolled course', async () => {
    const user = userEvent.setup()
    const groupNoCourse = { id: 'g2', course_id: '', course_name: '' }
    const secondStudent = { id: 's2', name: 'Grace Hopper' }
    mockedGetMyGroups.mockResolvedValue({ data: [group, groupNoCourse] } as any)
    mockedGetGroupStudents.mockImplementation((id: string) =>
      Promise.resolve({ data: id === 'g1' ? [student] : [secondStudent] }) as any
    )
    mockedGetCertificates.mockResolvedValue({ data: [certificate] } as any)
    render(<TeacherCertificates />)
    await waitFor(() => expect(screen.queryByText('Loading certificates...')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '+ Issue Certificate' }))
    await user.selectOptions(screen.getByDisplayValue('Ada Lovelace'), 'Grace Hopper')

    expect(screen.getByText('This student is not enrolled in one of your courses.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Issue Certificate' })).toBeDisabled()
  })

  it('issues a certificate and reloads the list', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateCertificate.mockResolvedValue({} as any)
    mockedGetCertificates.mockResolvedValue({ data: [certificate, { ...certificate, id: 'cert2' }] } as any)

    await user.click(screen.getByRole('button', { name: '+ Issue Certificate' }))
    await user.click(screen.getByRole('button', { name: 'Issue Certificate' }))

    await waitFor(() =>
      expect(mockedCreateCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          student_id: 's1',
          name: 'Course A',
          issuing_organization: 'Lexicon',
        })
      )
    )
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Issue Certificate' })).not.toBeInTheDocument())
  })

  it('shows an error message when issuing fails', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    mockedCreateCertificate.mockRejectedValue(new Error('Certificate already issued'))

    await user.click(screen.getByRole('button', { name: '+ Issue Certificate' }))
    await user.click(screen.getByRole('button', { name: 'Issue Certificate' }))

    expect(await screen.findByText('Certificate already issued')).toBeInTheDocument()
  })

  it('closes the modal on Cancel', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: '+ Issue Certificate' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Issue Certificate' })).not.toBeInTheDocument()
  })

  it('deletes a certificate after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteCertificate.mockResolvedValue({} as any)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mockedDeleteCertificate).toHaveBeenCalledWith('cert1'))
    await waitFor(() => expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument())
  })

  it('does not delete a certificate when confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockedDeleteCertificate).not.toHaveBeenCalled()
  })

  it('shows an error message when deleting fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderLoaded()
    mockedDeleteCertificate.mockRejectedValue(new Error('Could not delete certificate'))

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Could not delete certificate')).toBeInTheDocument()
  })
})
