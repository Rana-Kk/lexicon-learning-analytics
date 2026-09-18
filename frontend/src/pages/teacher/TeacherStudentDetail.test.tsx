import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest'

import {
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import TeacherStudentDetail from './TeacherStudentDetail'

import {
  ApiError,
  getStudentAcademicOverview,
  saveFinalGrade,
} from '../../lib/api'

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {},

  getStudentAcademicOverview: vi.fn(),

  saveFinalGrade: vi.fn(),
}))

const overview = vi.mocked(
  getStudentAcademicOverview,
)

const save = vi.mocked(saveFinalGrade)

const baseData = {
  student: {
    name: 'Rana',
    email: 'rana@test.com',
    course_name: 'Software Engineering',
    group_name: 'Group A',
  },

  summary: {
    academic_average: 80,
  },

  attendance: {
    percentage: 90,
  },

  assessments: [],

  quizzes: [],

  competencies: [],

  feedback: [],

  certificates: [],

  final_grade: null,
}

function renderPage(data: any = baseData) {
  overview.mockResolvedValue({
    data,
  } as any)

  return render(
    <TeacherStudentDetail
      studentId={1}
      groupId={2}
      onBack={vi.fn()}
    />,
  )
}

describe('TeacherStudentDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // =========================================================
  // LOADING
  // =========================================================

  it('shows loading state', () => {
    overview.mockReturnValue(
      new Promise(() => {}) as any,
    )

    render(
      <TeacherStudentDetail
        studentId={1}
        groupId={2}
        onBack={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        'Loading student overview…',
      ),
    ).toBeInTheDocument()
  })

  // =========================================================
  // HEADER / SUMMARY
  // =========================================================

  it('renders student header and summary cards', async () => {
    renderPage()

    expect(
      await screen.findByText('Rana'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('rana@test.com'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Software Engineering · Group A',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('80%'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('90%'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('0'),
    ).toBeInTheDocument()
  })

  it('renders GitHub profile when connected', async () => {
    renderPage({
      ...baseData,

      student: {
        ...baseData.student,

        github_username: 'rana-dev',
      },
    })

    const githubLink =
      await screen.findByText(
        'GitHub Profile ↗',
      )

    expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/rana-dev',
    )
  })

  it('shows no GitHub connected when profile is missing', async () => {
    renderPage()

    expect(
      await screen.findByText(
        'No GitHub connected',
      ),
    ).toBeInTheDocument()
  })

  // =========================================================
  // LOAD ERRORS
  // =========================================================

  it('shows generic load error and back action', async () => {
    const back = vi.fn()

    overview.mockRejectedValue(
      new Error('network'),
    )

    const user = userEvent.setup()

    render(
      <TeacherStudentDetail
        studentId={1}
        groupId={2}
        onBack={back}
      />,
    )

    expect(
      await screen.findByText(
        'Failed to load student overview',
      ),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Back to group/i,
      }),
    )

    expect(back).toHaveBeenCalledTimes(1)
  })

  it('shows ApiError message when overview loading fails', async () => {
    overview.mockRejectedValue(
      new ApiError(
        'Student overview unavailable',
      ),
    )

    render(
      <TeacherStudentDetail
        studentId={1}
        groupId={2}
        onBack={vi.fn()}
      />,
    )

    expect(
      await screen.findByText(
        'Student overview unavailable',
      ),
    ).toBeInTheDocument()
  })

  // =========================================================
  // AVERAGE / ATTENDANCE
  // =========================================================

  it('uses assignment and quiz scores to calculate average when summary average is missing', async () => {
    renderPage({
      ...baseData,

      summary: {
        academic_average: null,
      },

      assessments: [
        {
          id: 1,
          title: 'Assignment 1',
          score: 80,
          max_score: 100,
        },

        {
          id: 2,
          title: 'Assignment 2',
          score: 40,
          max_score: 50,
        },

        {
          id: 3,
          title: 'Ungraded',
          score: null,
          max_score: 100,
        },

        {
          id: 4,
          title: 'Invalid Max',
          score: 100,
          max_score: 0,
        },
      ],

      quizzes: [
        {
          id: 5,
          title: 'Quiz 1',
          score: 18,
          max_score: 20,
        },
      ],
    })

    expect(
      await screen.findByText('83.3%'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('4'),
    ).toBeInTheDocument()
  })

  it('shows dash for attendance when percentage is missing', async () => {
    renderPage({
      ...baseData,

      attendance: {},
    })

    await screen.findByText('Rana')

    const attendanceLabel =
      screen.getByText('Attendance')

    const attendanceCard =
      attendanceLabel.parentElement

    expect(
      attendanceCard,
    ).toHaveTextContent('—')
  })

  // =========================================================
  // ASSIGNMENTS
  // =========================================================

  it('shows empty assignment state', async () => {
    renderPage({
      ...baseData,

      assessments: [],
    })

    expect(
      await screen.findByText(
        'No assignments found.',
      ),
    ).toBeInTheDocument()
  })

  it('shows checklist empty state when assignments have no criteria', async () => {
    renderPage({
      ...baseData,

      assessments: [
        {
          id: 1,
          title: 'Assignment 1',
          score: 90,
          max_score: 100,
          checklist: [],
        },
      ],
    })

    expect(
      await screen.findByText(
        "No checklist criteria found for this student's assignments.",
      ),
    ).toBeInTheDocument()
  })

  it('renders assessment history including graded, ungraded and repository states', async () => {
    renderPage({
      ...baseData,

      assessments: [
        {
          id: 1,
          title: 'Git Assignment',
          assessment_date:
            '2026-09-10T10:00:00',

          score: 85,

          max_score: 100,

          feedback: 'Good work',

          github_url:
            'https://github.com/example/repo',

          checklist: [],
        },

        {
          id: 2,
          title: 'Unfinished Assignment',

          due_date:
            '2026-09-11T10:00:00',

          score: null,

          max_score: 100,

          feedback: null,

          github_url: null,

          checklist: [],
        },
      ],
    })

    expect(
      await screen.findByText(
        'Git Assignment',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('2026-09-10'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('85 / 100'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('85%'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Good work'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Open ↗'),
    ).toHaveAttribute(
      'href',
      'https://github.com/example/repo',
    )

    expect(
      screen.getByText(
        'Unfinished Assignment',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Not graded'),
    ).toBeInTheDocument()

    expect(
      screen.getAllByText('—').length,
    ).toBeGreaterThan(0)
  })

  // =========================================================
  // QUIZZES
  // =========================================================

  it('shows empty quiz state', async () => {
    renderPage({
      ...baseData,

      quizzes: [],
    })

    expect(
      await screen.findByText(
        'No quizzes found.',
      ),
    ).toBeInTheDocument()
  })

  it('renders quiz history and percentage', async () => {
    renderPage({
      ...baseData,

      quizzes: [
        {
          id: 1,
          title: 'React Quiz',
          topic: 'Hooks',

          quiz_date:
            '2026-09-12T12:00:00',

          score: 9,

          max_score: 10,
        },

        {
          id: 2,
          title: 'Pending Quiz',
          topic: null,

          completed_at: null,

          score: null,

          max_score: 10,
        },
      ],
    })

    expect(
      await screen.findByText(
        'React Quiz',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Hooks'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('2026-09-12'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('9 / 10'),
    ).toBeInTheDocument()

    /*
     * Scope the 90% assertion to the quiz row.
     * Attendance also displays 90%.
     */
    const quizRow =
      screen
        .getByText('React Quiz')
        .closest('tr')

    expect(quizRow).not.toBeNull()

    expect(
      quizRow,
    ).toHaveTextContent('90%')

    expect(
      screen.getByText('Pending Quiz'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Not completed'),
    ).toBeInTheDocument()
  })

  // =========================================================
  // CHECKLIST
  // =========================================================

  it('renders yes/no checklist values', async () => {
    renderPage({
      ...baseData,

      assessments: [
        {
          id: 1,
          title: 'Assignment',

          checklist: [
            {
              id: 1,

              name: 'Communication',

              criterion_type: 'yes_no',

              final: {
                yes_no_value: true,
              },
            },

            {
              id: 2,

              name: 'Testing',

              criterion_type: 'boolean',

              final: {
                yes_no_value: 0,
              },
            },

            {
              id: 3,

              name: 'Missing',

              criterion_type: 'yes_no',

              final: {
                yes_no_value: null,
              },
            },
          ],
        },
      ],
    })

    expect(
      await screen.findByText(
        'Communication',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Yes'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('No'),
    ).toBeInTheDocument()

    expect(
      screen.getAllByText('—').length,
    ).toBeGreaterThan(0)
  })

  it('renders score and text checklist values', async () => {
    renderPage({
      ...baseData,

      assessments: [
        {
          id: 1,
          title: 'Assignment',

          checklist: [
            {
              id: 1,

              name: 'Code Quality',

              criterion_type: 'score',

              max_score: 10,

              final: {
                score_value: 8,
              },
            },

            {
              id: 2,

              name: 'Written Explanation',

              criterion_type: 'text',

              final: {
                text_value:
                  'Clear explanation',
              },
            },

            {
              id: 3,

              name: 'Fallback Score',

              criterion_type: 'other',

              final: {
                score_value: 7,
              },
            },

            {
              id: 4,

              name: 'Fallback Boolean',

              criterion_type: 'other',

              final: {
                yes_no_value: true,
              },
            },

            {
              id: 5,

              name: 'Fallback Text',

              criterion_type: 'other',

              final: {
                text_value:
                  'Fallback text',
              },
            },

            {
              id: 6,

              name: 'No Final',

              criterion_type: 'score',

              final: null,
            },
          ],
        },
      ],
    })

    expect(
      await screen.findByText(
        'Code Quality',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Max: 10'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('8'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Clear explanation',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText('7'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Fallback text',
      ),
    ).toBeInTheDocument()
  })

  // =========================================================
  // FINAL GRADE
  // =========================================================

  it('loads an existing final grade and comment', async () => {
    renderPage({
      ...baseData,

      final_grade: {
        score: 88,

        comment:
          'Excellent progress',
      },
    })

    expect(
      await screen.findByDisplayValue(
        '88',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByDisplayValue(
        'Excellent progress',
      ),
    ).toBeInTheDocument()
  })

  it('validates final grade before saving', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Rana')

    const input =
      screen.getByRole('spinbutton')

    /*
     * Native number inputs can reject an out-of-range
     * value before React receives it.
     *
     * Change the DOM type to text only for this test
     * so we can exercise the component's own validation.
     */
    input.setAttribute(
      'type',
      'text',
    )

    fireEvent.change(input, {
      target: {
        value: '101',
      },
    })

    await user.click(
      screen.getByRole('button', {
        name: /Save Final Grade/i,
      }),
    )

    expect(
      await screen.findByText(
        'Final grade must be a number between 0 and 100.',
      ),
    ).toBeInTheDocument()

    expect(
      save,
    ).not.toHaveBeenCalled()
  })

  it('rejects non-numeric final grade', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Rana')

    const input =
      screen.getByRole('spinbutton')

    /*
     * HTML type="number" does not allow "abc".
     * Temporarily changing the DOM type allows us
     * to exercise Number('abc') => NaN.
     */
    input.setAttribute(
      'type',
      'text',
    )

    fireEvent.change(input, {
      target: {
        value: 'abc',
      },
    })

    await user.click(
      screen.getByRole('button', {
        name: /Save Final Grade/i,
      }),
    )

    expect(
      await screen.findByText(
        'Final grade must be a number between 0 and 100.',
      ),
    ).toBeInTheDocument()

    expect(
      save,
    ).not.toHaveBeenCalled()
  })

  it('saves valid final grade and comment', async () => {
    const user = userEvent.setup()

    save.mockResolvedValue({
      data: {
        score: 95,

        comment:
          'Excellent',
      },
    } as any)

    renderPage()

    await screen.findByText('Rana')

    const input =
      screen.getByRole('spinbutton')

    /*
     * The component has a visible "Final Comment"
     * label, but the textarea has no id/htmlFor
     * association. Therefore use its placeholder.
     */
    const textarea =
      screen.getByPlaceholderText(
        'Optional end-of-term feedback…',
      )

    await user.clear(input)

    await user.type(
      input,
      '95',
    )

    await user.type(
      textarea,
      'Excellent',
    )

    await user.click(
      screen.getByRole('button', {
        name: /Save Final Grade/i,
      }),
    )

    await waitFor(() =>
      expect(
        save,
      ).toHaveBeenCalledWith(
        1,
        {
          group_id: 2,

          score: 95,

          comment:
            'Excellent',
        },
      ),
    )

    expect(
      await screen.findByText(
        'Final grade saved successfully.',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByDisplayValue('95'),
    ).toBeInTheDocument()
  })

  it('shows ApiError message when saving fails', async () => {
    const user = userEvent.setup()

    save.mockRejectedValue(
      new ApiError(
        'Could not save final grade',
      ),
    )

    renderPage()

    await screen.findByText('Rana')

    const input =
      screen.getByRole('spinbutton')

    await user.clear(input)

    await user.type(
      input,
      '90',
    )

    await user.click(
      screen.getByRole('button', {
        name: /Save Final Grade/i,
      }),
    )

    expect(
      await screen.findByText(
        'Could not save final grade',
      ),
    ).toBeInTheDocument()
  })

  it('shows generic save error for non-ApiError failures', async () => {
    const user = userEvent.setup()

    save.mockRejectedValue(
      new Error('network'),
    )

    renderPage()

    await screen.findByText('Rana')

    const input =
      screen.getByRole('spinbutton')

    await user.clear(input)

    await user.type(
      input,
      '90',
    )

    await user.click(
      screen.getByRole('button', {
        name: /Save Final Grade/i,
      }),
    )

    expect(
      await screen.findByText(
        'Failed to save final grade',
      ),
    ).toBeInTheDocument()
  })

  it('disables save button until a grade is entered', async () => {
    renderPage()

    await screen.findByText('Rana')

    expect(
      screen.getByRole('button', {
        name: /Save Final Grade/i,
      }),
    ).toBeDisabled()
  })

  // =========================================================
  // RECORDED RESULTS
  // =========================================================

  it('renders recorded results count from graded assessments and quizzes', async () => {
    renderPage({
      ...baseData,

      assessments: [
        {
          id: 1,

          title: 'A',

          score: 80,

          max_score: 100,

          checklist: [],
        },

        {
          id: 2,

          title: 'B',

          score: null,

          max_score: 100,

          checklist: [],
        },
      ],

      quizzes: [
        {
          id: 3,

          title: 'Q1',

          score: 9,

          max_score: 10,
        },

        {
          id: 4,

          title: 'Q2',

          score: null,

          max_score: 10,
        },
      ],
    })

    expect(
      await screen.findByText('2'),
    ).toBeInTheDocument()
  })
})
