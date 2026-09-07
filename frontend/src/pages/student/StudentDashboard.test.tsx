import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'

import StudentDashboard from './StudentDashboard'

import {
getAnalyticsOverview,
getGroups,
getMyCompetencies,
getFeedback,
getQuizResults,
me,
} from '../../lib/api'

vi.mock('../../lib/api', async () => {
const actual =
await vi.importActual<typeof import('../../lib/api')>(
'../../lib/api'
)

return {
...actual,
getAnalyticsOverview: vi.fn(),
getGroups: vi.fn(),
getMyCompetencies: vi.fn(),
getFeedback: vi.fn(),
getQuizResults: vi.fn(),
me: vi.fn(),
}
})

vi.mock('../../components/StatCard', () => ({
default: ({
label,
value,
sub,
}: {
label: string
value: string
sub?: string
}) => ( <div> <span>{label}</span> <span>{value}</span>
{sub && <span>{sub}</span>} </div>
),
}))

vi.mock('recharts', () => ({
ResponsiveContainer: ({
children,
}: {
children: ReactNode
}) => <div>{children}</div>,

LineChart: ({
children,
data,
}: {
children: ReactNode
data: any[]
}) => ( <div
   data-testid="line-chart"
   data-points={JSON.stringify(data)}
 >
{children} </div>
),

Line: () => null,
XAxis: () => null,
YAxis: () => null,
CartesianGrid: () => null,
Tooltip: () => null,
}))

const mockedMe = vi.mocked(me)
const mockedGetGroups = vi.mocked(getGroups)
const mockedGetOverview = vi.mocked(getAnalyticsOverview)
const mockedGetCompetencies = vi.mocked(getMyCompetencies)
const mockedGetFeedback = vi.mocked(getFeedback)
const mockedGetQuizResults = vi.mocked(getQuizResults)

const group = {
id: 1,
name: 'Group A',
course_id: 10,
course_name: 'Full Stack Development',
start_date: '2026-01-01',
end_date: '2026-06-30',
}

const competencyData = [
{
competency_id: 1,
name: 'React',
score: 85,
previous_score: 75,
},
{
competency_id: 2,
name: 'SQL',
score: 60,
previous_score: 70,
},
{
competency_id: 3,
name: 'Testing',
score: 70,
previous_score: 70,
},
]

function mockDashboardLoad(
overrides: {
student?: any
groups?: any[]
overview?: any
competencies?: any[]
feedback?: any[]
quizzes?: any[]
} = {}
) {
mockedMe.mockResolvedValue(
(overrides.student ?? {
id: 1,
name: 'Rana',
}) as any
)

mockedGetGroups.mockResolvedValue({
data: overrides.groups ?? [group],
} as any)

mockedGetOverview.mockResolvedValue({
data:
overrides.overview ?? {
quiz_average: 80,
quiz_count: 2,
assessment_average: 90,
assessment_count: 3,
attendance: {
rate: 75,
total: 20,
},
},
} as any)

mockedGetCompetencies.mockResolvedValue({
data: overrides.competencies ?? [],
} as any)

mockedGetFeedback.mockResolvedValue({
data: overrides.feedback ?? [],
} as any)

mockedGetQuizResults.mockResolvedValue({
data: overrides.quizzes ?? [],
} as any)
}

describe('StudentDashboard', () => {
const onNavigate = vi.fn()

beforeEach(() => {
mockedMe.mockReset()
mockedGetGroups.mockReset()
mockedGetOverview.mockReset()
mockedGetCompetencies.mockReset()
mockedGetFeedback.mockReset()
mockedGetQuizResults.mockReset()
onNavigate.mockReset()
})

it('shows a loading state while dashboard data is being fetched', () => {
mockedMe.mockReturnValue(
new Promise(() => {}) as any
)

mockedGetGroups.mockReturnValue(
  new Promise(() => {}) as any
)

mockedGetOverview.mockReturnValue(
  new Promise(() => {}) as any
)

mockedGetCompetencies.mockReturnValue(
  new Promise(() => {}) as any
)

mockedGetFeedback.mockReturnValue(
  new Promise(() => {}) as any
)

mockedGetQuizResults.mockReturnValue(
  new Promise(() => {}) as any
)

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  screen.getByText('Loading your dashboard...')
).toBeInTheDocument()

})

it('renders the student name, group information and calculated statistics', async () => {
mockDashboardLoad({
competencies: competencyData,
})

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  await screen.findByText('Good morning, Rana')
).toBeInTheDocument()

expect(
  screen.getByText(
    'Group A · Full Stack Development'
  )
).toBeInTheDocument()

expect(
  screen.getByText('Full Stack Development')
).toBeInTheDocument()

expect(
  screen.getByText('Group: Group A')
).toBeInTheDocument()

expect(
  screen.getByText(
    '2026-01-01 → 2026-06-30'
  )
).toBeInTheDocument()

expect(
  screen.getByText('React')
).toBeInTheDocument()

expect(
  screen.getByText('SQL')
).toBeInTheDocument()

expect(
  screen.getByText('Testing')
).toBeInTheDocument()

// Overall Progress + React competency
expect(
  screen.getAllByText('85%')
).toHaveLength(2)

expect(
  screen.getByText('60%')
).toBeInTheDocument()

expect(
  screen.getByText('70%')
).toBeInTheDocument()

expect(
  screen.getByText('75%')
).toBeInTheDocument()

expect(
  screen.getByText('90%')
).toBeInTheDocument()

expect(
  screen.getByText('80%')
).toBeInTheDocument()

expect(
  screen.getByText('20 sessions')
).toBeInTheDocument()

expect(
  screen.getByText('3 assessments')
).toBeInTheDocument()

expect(
  screen.getByText('2 quizzes')
).toBeInTheDocument()

})

it('shows empty states when the student has no groups, quizzes, competencies or feedback', async () => {
mockDashboardLoad({
groups: [],
overview: {
quiz_average: 0,
quiz_count: 0,
assessment_average: 0,
assessment_count: 0,
attendance: {
rate: 0,
total: 0,
},
},
competencies: [],
feedback: [],
quizzes: [],
})

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  await screen.findByText(
    'No group assigned yet'
  )
).toBeInTheDocument()

expect(
  screen.getByText(
    'You are not assigned to any group yet.'
  )
).toBeInTheDocument()

expect(
  screen.getByText(
    'No quiz results yet.'
  )
).toBeInTheDocument()

expect(
  screen.getByText(
    'No competency data yet.'
  )
).toBeInTheDocument()

expect(
  screen.getByText(
    'No teacher feedback yet.'
  )
).toBeInTheDocument()

expect(
  screen.getAllByText('0%').length
).toBeGreaterThanOrEqual(1)

})

it('calculates overall progress from only the available score category', async () => {
mockDashboardLoad({
overview: {
quiz_average: 72,
quiz_count: 4,
assessment_average: 99,
assessment_count: 0,
attendance: {
rate: 100,
total: 12,
},
},
})

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  await screen.findByText('Overall Progress')
).toBeInTheDocument()

expect(
  screen.getAllByText('72%').length
).toBeGreaterThanOrEqual(1)

})

it('sorts quiz results chronologically and converts them to percentage scores', async () => {
mockDashboardLoad({
quizzes: [
{
id: 2,
quiz_id: 2,
quiz_title: 'Second',
score: 9,
max_score: 10,
completed_at: '2026-02-10',
},
{
id: 1,
quiz_id: 1,
quiz_title: 'First',
score: 15,
max_score: 20,
completed_at: '2026-01-10',
},
],
})

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

const chart =
  await screen.findByTestId('line-chart')

expect(
  JSON.parse(
    chart.getAttribute('data-points') || '[]'
  )
).toEqual([
  {
    week: 'Quiz 1',
    score: 75,
  },
  {
    week: 'Quiz 2',
    score: 90,
  },
])

})

it('renders competency scores and improving, declining and unchanged trends', async () => {
mockDashboardLoad({
competencies: competencyData,
})


render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  await screen.findByText('React')
).toBeInTheDocument()

expect(
  screen.getByText('SQL')
).toBeInTheDocument()

expect(
  screen.getByText('Testing')
).toBeInTheDocument()

expect(
  screen.getAllByText('85%').length
).toBeGreaterThan(0)

expect(
  screen.getByText('60%')
).toBeInTheDocument()

expect(
  screen.getByText('70%')
).toBeInTheDocument()

expect(
  screen.getByText('↑')
).toBeInTheDocument()

expect(
  screen.getByText('↓')
).toBeInTheDocument()

expect(
  screen.getByText('→')
).toBeInTheDocument()


})

it('shows only the two most recent feedback items returned by the API', async () => {
mockDashboardLoad({
feedback: [
{
id: 1,
content: 'Great progress',
assessment_title: 'Project 1',
teacher_name: 'Alex',
},
{
id: 2,
content: 'Improve testing',
assessment_title: 'Project 2',
teacher_name: 'Sam',
},
{
id: 3,
content: 'This should not be shown',
assessment_title: 'Project 3',
},
],
})

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  await screen.findByText('Great progress')
).toBeInTheDocument()

expect(
  screen.getByText('Improve testing')
).toBeInTheDocument()

expect(
  screen.queryByText(
    'This should not be shown'
  )
).not.toBeInTheDocument()

expect(
  screen.getByText('By Alex')
).toBeInTheDocument()

})

it('navigates to competency and feedback pages from dashboard actions', async () => {
const user = userEvent.setup()

mockDashboardLoad()

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

await user.click(
  await screen.findByRole('button', {
    name: 'View full competency matrix →',
  })
)

expect(onNavigate).toHaveBeenCalledWith(
  'competency'
)

await user.click(
  screen.getByRole('button', {
    name: 'View all →',
  })
)

expect(onNavigate).toHaveBeenCalledWith(
  'feedback'
)

})

it('shows an error and retries all dashboard requests', async () => {
const user = userEvent.setup()

mockedMe.mockRejectedValueOnce(
  new Error('Dashboard API failed')
)

mockedGetGroups.mockResolvedValue({
  data: [],
} as any)

mockedGetOverview.mockResolvedValue({
  data: null,
} as any)

mockedGetCompetencies.mockResolvedValue({
  data: [],
} as any)

mockedGetFeedback.mockResolvedValue({
  data: [],
} as any)

mockedGetQuizResults.mockResolvedValue({
  data: [],
} as any)

render(
  <StudentDashboard
    onNavigate={onNavigate}
  />
)

expect(
  await screen.findByText(
    'Dashboard API failed'
  )
).toBeInTheDocument()

mockDashboardLoad()

await user.click(
  screen.getByRole('button', {
    name: 'Try again',
  })
)

expect(
  await screen.findByText('Good morning, Rana')
).toBeInTheDocument()

expect(mockedMe).toHaveBeenCalledTimes(2)

expect(
  mockedGetGroups
).toHaveBeenCalledTimes(2)

expect(
  mockedGetOverview
).toHaveBeenCalledTimes(2)

expect(
  mockedGetCompetencies
).toHaveBeenCalledTimes(2)

expect(
  mockedGetFeedback
).toHaveBeenCalledTimes(2)

expect(
  mockedGetQuizResults
).toHaveBeenCalledTimes(2)

})
})
