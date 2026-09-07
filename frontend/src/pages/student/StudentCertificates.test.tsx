import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentCertificates from './StudentCertificates'
import { getCertificates } from '../../lib/api'

const pdfInstances: any[] = []

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFillColor = vi.fn()
    rect = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    addImage = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    text = vi.fn()
    line = vi.fn()
    save = vi.fn()
    output = vi.fn(() => new Blob(['certificate'], { type: 'application/pdf' }))

    constructor() {
      pdfInstances.push(this)
    }
  }

  return { default: MockJsPDF }
})

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return {
    ...actual,
    getCertificates: vi.fn(),
  }
})

const mockedGetCertificates = vi.mocked(getCertificates)

const certificate = {
  id: 1,
  name: 'Full Stack Development',
  studentName: 'Rana Test',
  issuingOrganization: 'Lexicon Malmö',
  issueDate: '2026-06-15',
  certificateCode: 'LEX-2026-001',
}

class FailingImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 100
  height = 50

  set src(_value: string) {
    queueMicrotask(() => this.onerror?.())
  }
}

describe('StudentCertificates', () => {
  const originalImage = globalThis.Image
  const originalCreateObjectURL = URL.createObjectURL

  beforeEach(() => {
    mockedGetCertificates.mockReset()
    pdfInstances.length = 0
    vi.restoreAllMocks()
    globalThis.Image = FailingImage as any
    URL.createObjectURL = vi.fn(() => 'blob:certificate-url')
  })

  afterEach(() => {
    globalThis.Image = originalImage
    URL.createObjectURL = originalCreateObjectURL
  })

  it('shows a loading state while certificates are being fetched', () => {
    mockedGetCertificates.mockReturnValue(new Promise(() => {}) as any)

    render(<StudentCertificates />)

    expect(screen.getByText('Loading certificates...')).toBeInTheDocument()
  })

  it('shows an empty state when there are no certificates', async () => {
    mockedGetCertificates.mockResolvedValue({ data: [] } as any)

    render(<StudentCertificates />)

    expect(await screen.findByText('No certificates available.')).toBeInTheDocument()
    expect(screen.getByText('Certificates issued by your teacher will appear here.')).toBeInTheDocument()
  })

  it('treats a non-array API response as an empty certificate list', async () => {
    mockedGetCertificates.mockResolvedValue({ data: null } as any)

    render(<StudentCertificates />)

    expect(await screen.findByText('No certificates available.')).toBeInTheDocument()
  })

  it('shows the API error together with the empty state', async () => {
    mockedGetCertificates.mockRejectedValue(new Error('Could not fetch certificates'))

    render(<StudentCertificates />)

    expect(await screen.findByText('Could not fetch certificates')).toBeInTheDocument()
    expect(screen.getByText('No certificates available.')).toBeInTheDocument()
  })

  it('renders certificate details and action buttons', async () => {
    mockedGetCertificates.mockResolvedValue({ data: [certificate] } as any)

    render(<StudentCertificates />)

    expect(await screen.findByText('Full Stack Development')).toBeInTheDocument()
    expect(screen.getByText('Lexicon Malmö')).toBeInTheDocument()
    expect(screen.getByText('2026-06-15')).toBeInTheDocument()
    expect(screen.getByText('LEX-2026-001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Certificate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument()
  })

  it('uses Lexicon and a dash as fallbacks for missing organization and issue date', async () => {
    mockedGetCertificates.mockResolvedValue({
      data: [{ ...certificate, issuingOrganization: undefined, issueDate: undefined, certificateCode: undefined }],
    } as any)

    render(<StudentCertificates />)

    expect(await screen.findByText('Full Stack Development')).toBeInTheDocument()
    expect(screen.getByText('Lexicon')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Certificate ID')).not.toBeInTheDocument()
  })

  it('downloads a generated PDF with a sanitized filename', async () => {
    const user = userEvent.setup()
    mockedGetCertificates.mockResolvedValue({
      data: [{ ...certificate, studentName: 'Rana / Test', name: 'React: Advanced!' }],
    } as any)

    render(<StudentCertificates />)

    await user.click(await screen.findByRole('button', { name: 'Download PDF' }))

    await waitFor(() => expect(pdfInstances).toHaveLength(1))
    const pdf = pdfInstances[0]

    expect(pdf.save).toHaveBeenCalledWith('Rana  Test-React Advanced-Certificate.pdf')
    expect(pdf.text).toHaveBeenCalledWith('LEXICON', 297 / 2, 42, { align: 'center' })
    expect(pdf.text).toHaveBeenCalledWith('Certificate ID: LEX-2026-001', 45, 185)
  })

  it('opens a generated certificate PDF in a new browser tab', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockedGetCertificates.mockResolvedValue({ data: [certificate] } as any)

    render(<StudentCertificates />)

    await user.click(await screen.findByRole('button', { name: 'View Certificate' }))

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(openSpy).toHaveBeenCalledWith(
        'blob:certificate-url',
        '_blank',
        'noopener,noreferrer'
      )
    })

    expect(pdfInstances[0].output).toHaveBeenCalledWith('blob')
  })
})
