import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttendanceStatusSelect from './AttendanceStatusSelect'

describe('AttendanceStatusSelect', () => {
  it('renders a button for each attendance status', () => {
    render(<AttendanceStatusSelect value="Present" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Present' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Late' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Absent' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excused' })).toBeInTheDocument()
  })

  it('highlights the currently selected status', () => {
    render(<AttendanceStatusSelect value="Late" onChange={() => {}} />)

    const late = screen.getByRole('button', { name: 'Late' })
    const present = screen.getByRole('button', { name: 'Present' })

    expect(late.style.background).toBe('rgb(254, 243, 199)')
    expect(present.style.background).toBe('transparent')
  })

  it('calls onChange with the clicked status', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AttendanceStatusSelect value="Present" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Absent' }))

    expect(onChange).toHaveBeenCalledWith('Absent')
  })

  it('calls onChange even when clicking the already-selected status', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AttendanceStatusSelect value="Excused" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Excused' }))

    expect(onChange).toHaveBeenCalledWith('Excused')
  })
})