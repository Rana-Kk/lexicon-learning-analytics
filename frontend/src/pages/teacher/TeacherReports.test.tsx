import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherReports from './TeacherReports'
import { getMyGroups, getGroupStudents, getStudentReport } from '../../lib/api'

const { pdfInstance, JsPDFMock } = vi.hoisted(() => {
  const pdfInstance = {
    internal: {
      pageSize: {
        getHeight: () => 210,
        getWidth: () => 297,
      },
    },

    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setTextColor: vi.fn(),

    text: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),

    splitTextToSize: vi.fn((text: string) => [String(text)]),

    addPage: vi.fn(),
    save: vi.fn(),
  }

  const JsPDFMock = vi.fn(function () {
    return pdfInstance
  })

  return {
    pdfInstance,
    JsPDFMock,
  }
})

vi.mock('jspdf', () => ({
  default: JsPDFMock,
  jsPDF: JsPDFMock,
}))

vi.mock('../../lib/api', () => ({
  getMyGroups: vi.fn(),
  getGroupStudents: vi.fn(),
  getStudentReport: vi.fn(),
}))

const groups = vi.mocked(getMyGroups)
const groupStudents = vi.mocked(getGroupStudents)
const report = vi.mocked(getStudentReport)

function allTextCalls() {
  return pdfInstance.text.mock.calls.flatMap(([value]) =>
    Array.isArray(value) ? value : [value]
  ) as string[]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TeacherReports - loading list', () => {
  it('shows a loading state while students resolve', () => {
    groups.mockReturnValue(new Promise(() => {}) as any)

    render(<TeacherReports />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no students', async () => {
    groups.mockResolvedValue({ data: [] } as any)

    render(<TeacherReports />)

    expect(
      await screen.findByText('You have no students yet.')
    ).toBeInTheDocument()
  })

  it('deduplicates students across groups and sorts them by name', async () => {
    groups.mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
    } as any)

    groupStudents.mockImplementation((id: any) =>
      id === 1
        ? (Promise.resolve({
            data: [{ id: 5, name: 'Zara' }],
          }) as any)
        : (Promise.resolve({
            data: [
              { id: 5, name: 'Zara' },
              { id: 6, name: 'Amir' },
            ],
          }) as any)
    )

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    const options = await screen.findAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual([
      'Amir',
      'Zara',
    ])

    expect(groupStudents).toHaveBeenCalledTimes(2)
  })

  it('auto-selects the first (alphabetically) student', async () => {
    groups.mockResolvedValue({
      data: [{ id: 1 }],
    } as any)

    groupStudents.mockResolvedValue({
      data: [
        { id: 5, name: 'Zara' },
        { id: 6, name: 'Amir' },
      ],
    } as any)

    render(<TeacherReports />)

    const select = (await screen.findByRole(
      'combobox'
    )) as HTMLSelectElement

    await waitFor(() => {
      expect(select.value).toBe('6')
    })
  })

  it('shows an error message when loading groups fails', async () => {
    groups.mockRejectedValue(new Error('Groups unavailable'))

    render(<TeacherReports />)

    expect(
      await screen.findByText('Groups unavailable')
    ).toBeInTheDocument()
  })

  it('falls back to a generic error message when none is provided', async () => {
    groups.mockRejectedValue({})

    render(<TeacherReports />)

    expect(
      await screen.findByText('Failed to load students')
    ).toBeInTheDocument()
  })
})

describe('TeacherReports - section selection', () => {
  beforeEach(() => {
    groups.mockResolvedValue({
      data: [{ id: 1 }],
    } as any)

    groupStudents.mockResolvedValue({
      data: [{ id: 5, name: 'Zara' }],
    } as any)
  })

  it('includes every section by default', async () => {
    render(<TeacherReports />)

    await screen.findByRole('combobox')

    const checkboxes = screen.getAllByRole('checkbox')

    expect(
      checkboxes.every(
        (checkbox) => (checkbox as HTMLInputElement).checked
      )
    ).toBe(true)

    expect(
      screen.getAllByText('✓ Attendance Records')
    ).toHaveLength(2)

    expect(
      screen.getAllByText('🏆 Certificates')
    ).toHaveLength(2)
  })

  it('unchecking a section removes it from the preview', async () => {
    const user = userEvent.setup()

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(screen.getAllByRole('checkbox')[0])

    await waitFor(() => {
      expect(
        screen.getAllByText('✓ Attendance Records')
      ).toHaveLength(1)
    })
  })

  it('disables the generate button once every section is unchecked', async () => {
    const user = userEvent.setup()

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    const checkboxes = screen.getAllByRole('checkbox')

    for (const checkbox of checkboxes) {
      await user.click(checkbox)
    }

    expect(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    ).toBeDisabled()
  })
})

describe('TeacherReports - generating a report', () => {
  beforeEach(() => {
    groups.mockResolvedValue({
      data: [{ id: 1 }],
    } as any)

    groupStudents.mockResolvedValue({
      data: [{ id: 5, name: 'Zara Q.' }],
    } as any)
  })

  it('shows an error when the report has no student payload', async () => {
    const user = userEvent.setup()

    report.mockResolvedValue({
      data: {},
    } as any)

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    expect(
      await screen.findByText('No report data returned')
    ).toBeInTheDocument()

    expect(pdfInstance.save).not.toHaveBeenCalled()
  })

  it('shows the error message when the report request fails', async () => {
    const user = userEvent.setup()

    report.mockRejectedValue(
      new Error('Report generation failed')
    )

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    expect(
      await screen.findByText('Report generation failed')
    ).toBeInTheDocument()
  })

  it('generates and saves a PDF with a sanitized filename', async () => {
    const user = userEvent.setup()

    report.mockResolvedValue({
      data: {
        student: {
          name: 'Zara Q.',
          email: 'zara@x.com',
        },
        attendance: [],
        scores: [],
        assignmentChecklistEvaluations: [],
        quizzes: [],
        competencies: [],
        feedback: [],
        certificates: [],
      },
    } as any)

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    await waitFor(() => {
      expect(pdfInstance.save).toHaveBeenCalledWith(
        'Zara_Q__report.pdf'
      )
    })

    expect(
      await screen.findByText(
        '✓ Report ready — download started'
      )
    ).toBeInTheDocument()
  })

  it('writes "no data" placeholders for every empty section', async () => {
    const user = userEvent.setup()

    report.mockResolvedValue({
      data: {
        student: {
          name: 'Zara',
          email: 'zara@x.com',
        },
        attendance: [],
        scores: [],
        assignmentChecklistEvaluations: [],
        quizzes: [],
        competencies: [],
        feedback: [],
        certificates: [],
      },
    } as any)

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    await waitFor(() => {
      expect(pdfInstance.save).toHaveBeenCalled()
    })

    const texts = allTextCalls()

    expect(texts).toContain('No attendance records.')
    expect(texts).toContain('No assessment scores.')
    expect(texts).toContain(
      'No assignment checklist evaluations.'
    )
    expect(texts).toContain('No quiz results.')
    expect(texts).toContain('No competency data.')
    expect(texts).toContain('No feedback recorded.')
    expect(texts).toContain('No certificates issued.')
  })

  it('writes populated rows for attendance, scores, quizzes, competencies, feedback and certificates', async () => {
    const user = userEvent.setup()

    report.mockResolvedValue({
      data: {
        student: {
          name: 'Zara',
          email: 'zara@x.com',
        },

        attendance: [
          {
            attendance_date: '2024-01-10',
            session: 'morning',
            status: 'present',
          },
        ],

        scores: [
          {
            assessment_title: 'Capstone',
            score: 90,
            max_score: 100,
          },
        ],

        assignmentChecklistEvaluations: [],

        quizzes: [
          {
            quiz_title: 'JS Basics',
            topic: 'JS',
            score: 8,
            max_score: 10,
          },
        ],

        competencies: [
          {
            name: 'React',
            score: 75,
          },
        ],

        feedback: [
          {
            teacher_name: 'Ms. Lee',
            created_at: '2024-01-05',
            content: 'Great work!',
          },
        ],

        certificates: [
          {
            name: 'React Cert',
            issuing_organization: 'Meta',
            issue_date: '2024-01-01',
            expiry_date: '2026-01-01',
          },
        ],
      },
    } as any)

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    await waitFor(() => {
      expect(pdfInstance.save).toHaveBeenCalled()
    })

    const texts = allTextCalls()

    expect(texts).toContain(
      '2024-01-10 · morning · present'
    )

    expect(texts).toContain(
      'Capstone: 90 / 100'
    )

    expect(texts).toContain(
      'JS Basics (JS): 8 / 10'
    )

    expect(texts).toContain('React: 75%')

    expect(
      texts.some((text) => text.includes('Ms. Lee'))
    ).toBe(true)

    expect(texts).toContain('Great work!')

    expect(
      texts.some(
        (text) =>
          text.includes('React Cert') &&
          text.includes('Meta')
      )
    ).toBe(true)
  })

  it('renders a checklist table with teacher and AI-fallback values, paginating past the first page', async () => {
    const user = userEvent.setup()

    const criteria = [
      {
        criterion_id: 1,
        name: 'Code Quality',
        criterion_type: 'yes_no' as const,
        teacher_yes_no_value: 1,
        sort_order: 1,
      },

      {
        criterion_id: 2,
        name: 'Tests',
        criterion_type: 'score' as const,
        ai_score_value: 7,
        max_score: 10,
        sort_order: 2,
      },

      {
        criterion_id: 3,
        name: 'Comments',
        criterion_type: 'text' as const,
        teacher_text_value: '',
        ai_text_value: '',
        sort_order: 3,
      },
    ]

    const assignmentChecklistEvaluations = Array.from(
      { length: 15 },
      (_, index) => ({
        assessment_id: index + 1,
        assessment_title: `Assignment ${index + 1}`,
        delivered_on: '2024-02-01',
        final_score: 8,
        max_score: 10,
        criteria,
      })
    )

    report.mockResolvedValue({
      data: {
        student: {
          name: 'Zara',
          email: 'zara@x.com',
        },
        attendance: [],
        scores: [],
        assignmentChecklistEvaluations,
        quizzes: [],
        competencies: [],
        feedback: [],
        certificates: [],
      },
    } as any)

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    await waitFor(() => {
      expect(pdfInstance.save).toHaveBeenCalled()
    })

    const texts = allTextCalls()

    expect(texts).toContain('Yes')
    expect(texts).toContain('7 / 10')
    expect(texts).toContain('—')

    expect(pdfInstance.addPage).toHaveBeenCalled()
  })

  it('only builds sections that are still checked', async () => {
    const user = userEvent.setup()

    report.mockResolvedValue({
      data: {
        student: {
          name: 'Zara',
          email: 'zara@x.com',
        },
        attendance: [],
        scores: [],
      },
    } as any)

    render(<TeacherReports />)

    await screen.findByRole('combobox')

    const checkboxes = screen.getAllByRole('checkbox')

    for (const checkbox of checkboxes.slice(1)) {
      await user.click(checkbox)
    }

    await user.click(
      screen.getByRole('button', {
        name: /Generate & Download PDF/,
      })
    )

    await waitFor(() => {
      expect(pdfInstance.save).toHaveBeenCalled()
    })

    const texts = allTextCalls()

    expect(texts).toContain('No attendance records.')

    expect(texts).not.toContain(
      'No assessment scores.'
    )
  })
})
