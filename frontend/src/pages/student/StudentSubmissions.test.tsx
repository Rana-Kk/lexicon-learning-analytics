import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentSubmissions from './StudentSubmissions'
import {
getStudentAssessments,
getSubmissions,
getSubmissionById,
createSubmission,
getAssessmentById,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
const actual = await vi.importActual<typeof import('../../lib/api')>(
'../../lib/api'
)

return {
...actual,
getStudentAssessments: vi.fn(),
getSubmissions: vi.fn(),
getSubmissionById: vi.fn(),
createSubmission: vi.fn(),
getAssessmentById: vi.fn(),
}
})

const mockedGetStudentAssessments = vi.mocked(getStudentAssessments)
const mockedGetSubmissions = vi.mocked(getSubmissions)
const mockedGetSubmissionById = vi.mocked(getSubmissionById)
const mockedCreateSubmission = vi.mocked(createSubmission)
const mockedGetAssessmentById = vi.mocked(getAssessmentById)

const notSubmittedAssessment = {
id: 1,
title: 'Build a REST API',
description: 'Create endpoints.',
group_name: 'Group A',
due_date: '2026-02-01',
max_score: 100,
submission_mode: 'individual',
}

function mockBaseLoad(overrides: { assessments?: any[] } = {}) {
mockedGetStudentAssessments.mockResolvedValue({
data: overrides.assessments ?? [notSubmittedAssessment],
} as any)

mockedGetSubmissions.mockResolvedValue({
data: [],
} as any)

mockedGetAssessmentById.mockResolvedValue({
data: {
assignment_evaluation_criteria: [],
},
} as any)
}

describe('StudentSubmissions', () => {
beforeEach(() => {
mockedGetStudentAssessments.mockReset()
mockedGetSubmissions.mockReset()
mockedGetSubmissionById.mockReset()
mockedCreateSubmission.mockReset()
mockedGetAssessmentById.mockReset()
})

it('shows a loading state while fetching assignments', () => {
mockedGetStudentAssessments.mockReturnValue(
new Promise(() => {})
)

 
render(<StudentSubmissions />)

expect(
  screen.getByText('Loading your submissions...')
).toBeInTheDocument()
 

})

it('shows an empty state when there are no assignments', async () => {
mockBaseLoad({
assessments: [],
})

 
render(<StudentSubmissions />)

expect(
  await screen.findByText(
    'No assignments have been assigned to you yet.'
  )
).toBeInTheDocument()
 

})

it('shows an error state with a retry button', async () => {
const user = userEvent.setup()

 
mockedGetStudentAssessments.mockRejectedValueOnce(
  new Error('Could not load assignments.')
)

render(<StudentSubmissions />)

expect(
  await screen.findByText('Could not load assignments.')
).toBeInTheDocument()

mockBaseLoad()

await user.click(
  screen.getByRole('button', {
    name: 'Try Again',
  })
)

expect(
  await screen.findByRole('heading', {
    name: 'Build a REST API',
  })
).toBeInTheDocument()
 

})

it('renders assignment details and a submission form for a not-submitted assignment', async () => {
mockBaseLoad()

 
render(<StudentSubmissions />)

expect(
  await screen.findByRole('heading', {
    name: 'Build a REST API',
  })
).toBeInTheDocument()

expect(
  screen.getByText('Group A')
).toBeInTheDocument()

expect(
  screen.getByPlaceholderText(
    'https://github.com/username/project-name'
  )
).toBeInTheDocument()
 

})

it('validates the GitHub URL before submitting', async () => {
const user = userEvent.setup()

 
mockBaseLoad()

render(<StudentSubmissions />)

await screen.findByRole('heading', {
  name: 'Build a REST API',
})

await user.click(
  screen.getByRole('button', {
    name: 'Submit Repository',
  })
)

expect(
  await screen.findByText(
    'Please enter a GitHub repository URL.'
  )
).toBeInTheDocument()

expect(
  mockedCreateSubmission
).not.toHaveBeenCalled()

await user.type(
  screen.getByPlaceholderText(
    'https://github.com/username/project-name'
  ),
  'https://gitlab.com/user/repo'
)

await user.click(
  screen.getByRole('button', {
    name: 'Submit Repository',
  })
)

expect(
  await screen.findByText(
    'URL must be a valid GitHub repository (e.g. https://github.com/username/repo).'
  )
).toBeInTheDocument()

expect(
  mockedCreateSubmission
).not.toHaveBeenCalled()
 

})

it('submits a valid GitHub URL', async () => {
const user = userEvent.setup()

 
mockBaseLoad()

mockedCreateSubmission.mockResolvedValue({} as any)

render(<StudentSubmissions />)

await screen.findByRole('heading', {
  name: 'Build a REST API',
})

await user.type(
  screen.getByPlaceholderText(
    'https://github.com/username/project-name'
  ),
  'https://github.com/user/repo'
)

await user.click(
  screen.getByRole('button', {
    name: 'Submit Repository',
  })
)

await waitFor(() =>
  expect(
    mockedCreateSubmission
  ).toHaveBeenCalledWith({
    assessment_id: 1,
    github_url: 'https://github.com/user/repo',
  })
)
 

})

it('shows the pending-review message once a submission exists', async () => {
mockedGetStudentAssessments.mockResolvedValue({
data: [
{
...notSubmittedAssessment,
submission_status: 'submitted',
},
],
} as any)

 
mockedGetSubmissions.mockResolvedValue({
  data: [{ id: 50 }],
} as any)

mockedGetSubmissionById.mockResolvedValue({
  data: {
    id: 50,
    status: 'submitted',
    github_url: 'https://github.com/user/repo',
    submitted_at: '2026-01-10T10:00:00Z',
    ai_evaluations: [],
    criteria_scores: [],
    checklist_results: [],
  },
} as any)

mockedGetAssessmentById.mockResolvedValue({
  data: {
    assignment_evaluation_criteria: [],
  },
} as any)

render(<StudentSubmissions />)

expect(
  await screen.findByText(
    'Your submission is currently being reviewed by your teacher.'
  )
).toBeInTheDocument()

expect(
  screen.getByText(
    'Your result will be available once the review is complete.'
  )
).toBeInTheDocument()

expect(
  screen.queryByText('Submission not approved')
).not.toBeInTheDocument()
 

})

it('shows the approved result with feedback sections', async () => {
mockedGetStudentAssessments.mockResolvedValue({
data: [
{
...notSubmittedAssessment,
submission_status: 'approved',
},
],
} as any)

 
mockedGetSubmissions.mockResolvedValue({
  data: [{ id: 51 }],
} as any)

mockedGetSubmissionById.mockResolvedValue({
  data: {
    id: 51,
    status: 'approved',
    github_url: 'https://github.com/user/repo',
    submitted_at: '2026-01-10T10:00:00Z',
    ai_evaluations: [
      {
        id: 1,
        status: 'approved',
        total_teacher_score: 90,
        strengths: 'Clean code.',
        teacher_comment: 'Well done!',
        reviewed_by_name: 'Mr. Smith',
      },
    ],
    criteria_scores: [],
    checklist_results: [],
  },
} as any)

mockedGetAssessmentById.mockResolvedValue({
  data: {
    assignment_evaluation_criteria: [],
  },
} as any)

render(<StudentSubmissions />)

expect(
  await screen.findByText(
    '✓ Your result is now available'
  )
).toBeInTheDocument()

expect(
  screen.getByText('Clean code.')
).toBeInTheDocument()

expect(
  screen.getByText('Well done!')
).toBeInTheDocument()

expect(
  screen.getByText(/Mr. Smith/)
).toBeInTheDocument()
 

})

it('shows the rejected state with the teacher comment', async () => {
mockedGetStudentAssessments.mockResolvedValue({
data: [
{
...notSubmittedAssessment,
submission_status: 'rejected',
},
],
} as any)

 
mockedGetSubmissions.mockResolvedValue({
  data: [{ id: 52 }],
} as any)

mockedGetSubmissionById.mockResolvedValue({
  data: {
    id: 52,
    status: 'rejected',
    github_url: 'https://github.com/user/repo',
    submitted_at: '2026-01-10T10:00:00Z',
    ai_evaluations: [
      {
        id: 1,
        status: 'rejected',
        total_teacher_score: null,
        teacher_comment: 'Needs more tests.',
      },
    ],
    criteria_scores: [],
    checklist_results: [],
  },
} as any)

mockedGetAssessmentById.mockResolvedValue({
  data: {
    assignment_evaluation_criteria: [],
  },
} as any)

render(<StudentSubmissions />)

expect(
  await screen.findByText('Submission not approved')
).toBeInTheDocument()

expect(
  await screen.findByText('Needs more tests.')
).toBeInTheDocument()
 

})

it('switches assessments when clicking a different tab', async () => {
const user = userEvent.setup()


const secondAssessment = {
  ...notSubmittedAssessment,
  id: 2,
  title: 'Frontend Dashboard',
}

mockedGetStudentAssessments.mockResolvedValue({
  data: [
    notSubmittedAssessment,
    secondAssessment,
  ],
} as any)

mockedGetSubmissions.mockResolvedValue({
  data: [],
} as any)

mockedGetAssessmentById.mockResolvedValue({
  data: {
    assignment_evaluation_criteria: [],
  },
} as any)

render(<StudentSubmissions />)

await screen.findByRole('heading', {
  name: 'Build a REST API',
})

await user.click(
  screen.getByRole('button', {
    name: 'Frontend Dashboard',
  })
)

expect(
  await screen.findByRole('heading', {
    name: 'Frontend Dashboard',
  })
).toBeInTheDocument()

})

it('honors the assessmentId prop to preselect an assignment', async () => {
const secondAssessment = {
...notSubmittedAssessment,
id: 2,
title: 'Frontend Dashboard',
}

mockedGetStudentAssessments.mockResolvedValue({
  data: [
    notSubmittedAssessment,
    secondAssessment,
  ],
} as any)

mockedGetSubmissions.mockResolvedValue({
  data: [],
} as any)

mockedGetAssessmentById.mockResolvedValue({
  data: {
    assignment_evaluation_criteria: [],
  },
} as any)

render(
  <StudentSubmissions assessmentId={2} />
)

expect(
  await screen.findByRole('heading', {
    name: 'Frontend Dashboard',
  })
).toBeInTheDocument()

})
})