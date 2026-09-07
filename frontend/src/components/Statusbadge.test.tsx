import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the status label', () => {
    render(<StatusBadge status="Present" />)
    expect(screen.getByText('Present')).toBeInTheDocument()
  })

  it.each([
    ['Present', '#15803D'],
    ['Late', '#B45309'],
    ['Absent', '#B91C1C'],
    ['Excused', '#64748B'],
    ['Approved', '#15803D'],
    ['Draft', '#B45309'],
    ['Rejected', '#B91C1C'],
  ] as const)('applies the right color for status %s', (status, color) => {
    render(<StatusBadge status={status} />)
    const badge = screen.getByText(status).closest('span')
    expect(badge?.style.color).toBe(hexToRgb(color))
  })

  it('defaults to the small size padding/font when size is omitted', () => {
    render(<StatusBadge status="Present" />)
    const badge = screen.getByText('Present').closest('span')
    expect(badge?.style.padding).toBe('3px 8px')
    expect(badge?.style.fontSize).toBe('12px')
  })

  it('applies medium size padding/font', () => {
    render(<StatusBadge status="Present" size="md" />)
    const badge = screen.getByText('Present').closest('span')
    expect(badge?.style.padding).toBe('4px 10px')
    expect(badge?.style.fontSize).toBe('13px')
  })

  it('applies large size padding/font', () => {
    render(<StatusBadge status="Present" size="lg" />)
    const badge = screen.getByText('Present').closest('span')
    expect(badge?.style.padding).toBe('6px 14px')
    expect(badge?.style.fontSize).toBe('14px')
  })
})

// jsdom normalizes inline hex colors to rgb() in the style object.
function hexToRgb(hex: string) {
  const value = hex.replace('#', '')
  const r = parseInt(value.substring(0, 2), 16)
  const g = parseInt(value.substring(2, 4), 16)
  const b = parseInt(value.substring(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}