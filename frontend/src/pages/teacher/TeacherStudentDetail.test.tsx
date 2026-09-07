import { describe,it,expect,vi,beforeEach } from 'vitest'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherStudentDetail from './TeacherStudentDetail'
import { getStudentAcademicOverview,saveFinalGrade } from '../../lib/api'
vi.mock('../../lib/api',()=>({ApiError:class ApiError extends Error{},getStudentAcademicOverview:vi.fn(),saveFinalGrade:vi.fn()}))
const overview=vi.mocked(getStudentAcademicOverview), save=vi.mocked(saveFinalGrade)
const data={student:{name:'Rana',email:'rana@test.com'},summary:{academic_average:80},attendance:{rate:90},assessments:[],quizzes:[],competencies:[],feedback:[],certificates:[],final_grade:null}
describe('TeacherStudentDetail',()=>{beforeEach(()=>vi.resetAllMocks())
 it('shows loading',()=>{overview.mockReturnValue(new Promise(()=>{}) as any);render(<TeacherStudentDetail studentId={1} groupId={2} onBack={vi.fn()}/>);expect(screen.getByText('Loading student overview…')).toBeInTheDocument()})
 it('renders overview data',async()=>{overview.mockResolvedValue({data} as any);render(<TeacherStudentDetail studentId={1} groupId={2} onBack={vi.fn()}/>);expect(await screen.findByText('Rana')).toBeInTheDocument();expect(screen.getByText('80%')).toBeInTheDocument()})
 it('shows generic load error and back action',async()=>{const back=vi.fn();overview.mockRejectedValue(new Error());const user=userEvent.setup();render(<TeacherStudentDetail studentId={1} groupId={2} onBack={back}/>);await screen.findByText('Failed to load student overview');await user.click(screen.getByRole('button',{name:/Back to group/i}));expect(back).toHaveBeenCalled()})
 it('validates final grade before saving',async()=>{const user=userEvent.setup();overview.mockResolvedValue({data} as any);render(<TeacherStudentDetail studentId={1} groupId={2} onBack={vi.fn()}/>);await screen.findByText('Rana');const input=screen.getByRole('spinbutton');await user.clear(input);await user.type(input,'101');await user.click(screen.getByRole('button',{name:/Save Final Grade/i}));expect(await screen.findByText('Final grade must be a number between 0 and 100.')).toBeInTheDocument();expect(save).not.toHaveBeenCalled()})
 it('saves valid final grade',async()=>{const user=userEvent.setup();overview.mockResolvedValue({data} as any);save.mockResolvedValue({data:{score:95,comment:'Excellent'}} as any);render(<TeacherStudentDetail studentId={1} groupId={2} onBack={vi.fn()}/>);await screen.findByText('Rana');const input=screen.getByRole('spinbutton');await user.clear(input);await user.type(input,'95');await user.click(screen.getByRole('button',{name:/Save Final Grade/i}));await waitFor(()=>expect(save).toHaveBeenCalledWith(1,{group_id:2,score:95,comment:''}))})
})
