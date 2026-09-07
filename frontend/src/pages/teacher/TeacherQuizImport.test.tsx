import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherQuizImport from './TeacherQuizImport'
import { importQuizResults } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    importQuizResults: vi.fn(),
  }
})

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
  SSF: { parse_date_code: vi.fn() },
}))

import * as XLSX from 'xlsx'

const mockedImportQuizResults = vi.mocked(importQuizResults)
const mockedRead = vi.mocked(XLSX.read)
const mockedSheetToJson = vi.mocked(XLSX.utils.sheet_to_json)

function mockSheet(rows: Record<string, unknown>[]) {
  mockedRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } } as any)
  mockedSheetToJson.mockReturnValue(rows as any)
}

async function uploadFile(rows: Record<string, unknown>[], fileName = 'results.xlsx') {
  mockSheet(rows)
  const user = userEvent.setup()
  const file = new File(['data'], fileName, { type: 'application/vnd.ms-excel' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, file)
  return user
}

const validRow = { 'Student Email': 'ada@example.com', 'Quiz Name': 'Quiz 1', Topic: 'React', Score: 8, Date: '2026-01-15' }

describe('TeacherQuizImport', () => {
  beforeEach(() => {
    mockedImportQuizResults.mockReset()
    mockedRead.mockReset()
    mockedSheetToJson.mockReset()
  })

  it('starts on step 1 with the upload prompt', () => {
    render(<TeacherQuizImport onDone={vi.fn()} />)

    expect(screen.getByText('Upload Excel File')).toBeInTheDocument()
    expect(screen.getByText('Drop your Excel file here')).toBeInTheDocument()
  })

  it('shows an error when the workbook has no sheets', async () => {
    render(<TeacherQuizImport onDone={vi.fn()} />)
    mockedRead.mockReturnValue({ SheetNames: [], Sheets: {} } as any)
    const user = userEvent.setup()
    const file = new File(['data'], 'empty.xlsx')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    expect(await screen.findByText('Excel sheet not found')).toBeInTheDocument()
  })

  it('shows an error when the sheet has no rows', async () => {
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([])

    expect(await screen.findByText('Excel file is empty')).toBeInTheDocument()
  })

  it('parses valid rows and advances to the Map Columns step', async () => {
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow], 'quiz-results.xlsx')

    expect(await screen.findByRole('heading', { name: 'Map Columns' })).toBeInTheDocument()
    expect(screen.getByText('quiz-results.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Student (matched by email)')).toBeInTheDocument()
  })

  it('goes back to step 1 from Map Columns', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow])
    await screen.findByRole('heading', { name: 'Map Columns' })

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Upload Excel File')).toBeInTheDocument()
  })

  it('validates rows and shows valid/invalid counts', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([
      validRow,
      { 'Student Email': '', 'Quiz Name': 'Quiz 2', Topic: '', Score: 5, Date: '' },
    ])
    await screen.findByRole('heading', { name: 'Map Columns' })

    await user.click(screen.getByRole('button', { name: 'Validate →' }))

    expect(screen.getByText('Validation Results')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // total rows
    expect(screen.getAllByText('1')).toHaveLength(2) // ready + invalid
    expect(screen.getByText(/Row 3: Student Email are required/)).toBeInTheDocument()
  })

  it('treats a non-numeric score as invalid', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([{ 'Student Email': 'ada@example.com', 'Quiz Name': 'Quiz 1', Topic: '', Score: 'abc', Date: '' }])
    await screen.findByRole('heading', { name: 'Map Columns' })
    await user.click(screen.getByRole('button', { name: 'Validate →' }))

    expect(screen.getByText(/Score are required/)).toBeInTheDocument()
  })

  it('disables advancing to preview when there are no valid rows', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([{ 'Student Email': '', 'Quiz Name': '', Topic: '', Score: '', Date: '' }])
    await screen.findByRole('heading', { name: 'Map Columns' })
    await user.click(screen.getByRole('button', { name: 'Validate →' }))

    expect(screen.getByRole('button', { name: 'Preview 0 valid rows →' })).toBeDisabled()
  })

  it('shows the preview table with valid rows only', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow])
    await screen.findByRole('heading', { name: 'Map Columns' })
    await user.click(screen.getByRole('button', { name: 'Validate →' }))
    await user.click(screen.getByRole('button', { name: 'Preview 1 valid rows →' }))

    expect(screen.getByText('Preview — 1 rows to import')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Quiz 1')).toBeInTheDocument()
  })

  it('shows a dash for missing topic/date in the preview', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([{ 'Student Email': 'ada@example.com', 'Quiz Name': 'Quiz 1', Topic: '', Score: 8, Date: '' }])
    await screen.findByRole('heading', { name: 'Map Columns' })
    await user.click(screen.getByRole('button', { name: 'Validate →' }))
    await user.click(screen.getByRole('button', { name: 'Preview 1 valid rows →' }))

    expect(screen.getAllByText('-')).toHaveLength(2)
  })

  it('reaches the confirm step and shows the summary', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow])
    await screen.findByRole('heading', { name: 'Map Columns' })
    await user.click(screen.getByRole('button', { name: 'Validate →' }))
    await user.click(screen.getByRole('button', { name: 'Preview 1 valid rows →' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Import →' }))

    expect(screen.getByText('Ready to import')).toBeInTheDocument()
    expect(screen.getByText('1 valid results')).toBeInTheDocument()
  })

  async function goToConfirmStep(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole('heading', { name: 'Map Columns' })
    await user.click(screen.getByRole('button', { name: 'Validate →' }))
    await user.click(screen.getByRole('button', { name: 'Preview 1 valid rows →' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Import →' }))
  }

  it('imports successfully and shows the completion screen', async () => {
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={onDone} />)
    await uploadFile([validRow])
    await goToConfirmStep(user)
    mockedImportQuizResults.mockResolvedValue({ data: { imported: 1, skipped: 0 } } as any)

    await user.click(screen.getByRole('button', { name: 'Confirm Import (1 rows)' }))

    expect(await screen.findByText('Import complete')).toBeInTheDocument()
    expect(screen.getByText(/1 quiz results successfully/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Quiz Results →' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('shows a warning when some rows are skipped server-side', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow])
    await goToConfirmStep(user)
    mockedImportQuizResults.mockResolvedValue({ data: { imported: 1, skipped: 2 } } as any)

    await user.click(screen.getByRole('button', { name: 'Confirm Import (1 rows)' }))

    expect(await screen.findByText(/2 rows skipped/)).toBeInTheDocument()
  })

  it('shows an error and stays on the confirm step when nothing gets imported', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow])
    await goToConfirmStep(user)
    mockedImportQuizResults.mockResolvedValue({ data: { imported: 0, skipped: 1 } } as any)

    await user.click(screen.getByRole('button', { name: 'Confirm Import (1 rows)' }))

    expect(await screen.findByText(/No rows could be imported/)).toBeInTheDocument()
    expect(screen.queryByText('Import complete')).not.toBeInTheDocument()
  })

  it('shows an error message when the import request fails', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizImport onDone={vi.fn()} />)
    await uploadFile([validRow])
    await goToConfirmStep(user)
    mockedImportQuizResults.mockRejectedValue(new Error('Network error'))

    await user.click(screen.getByRole('button', { name: 'Confirm Import (1 rows)' }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })
})
