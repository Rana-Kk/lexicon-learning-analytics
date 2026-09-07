import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('renders the label, value and icon', () => {
    render(<StatCard label="Total Students" value={42} icon={<span>icon</span>} />)

    expect(screen.getByText('Total Students')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('icon')).toBeInTheDocument()
  })

  it('does not render a subtitle or trend when not provided', () => {
    render(<StatCard label="Label" value={1} icon={<span />} />)

    expect(screen.queryByText('↑')).not.toBeInTheDocument()
    expect(screen.queryByText('↓')).not.toBeInTheDocument()
  })

  it('renders the sub text when provided', () => {
    render(<StatCard label="Label" value={1} sub="since last month" icon={<span />} />)

    expect(screen.getByText('since last month')).toBeInTheDocument()
  })

  it('renders a positive trend with an up arrow', () => {
    render(
      <StatCard
        label="Label"
        value={1}
        trend={{ value: '+5%', positive: true }}
        icon={<span />}
      />
    )

    expect(screen.getByText(/↑/)).toBeInTheDocument()
    expect(screen.getByText(/\+5%/)).toBeInTheDocument()
  })

  it('renders a negative trend with a down arrow', () => {
    render(
      <StatCard
        label="Label"
        value={1}
        trend={{ value: '-3%', positive: false }}
        icon={<span />}
      />
    )

    expect(screen.getByText(/↓/)).toBeInTheDocument()
    expect(screen.getByText(/-3%/)).toBeInTheDocument()
  })

  it('applies accent styling when accent is true', () => {
    const { container } = render(
      <StatCard label="Label" value={1} icon={<span />} accent />
    )

    const card = container.firstChild as HTMLElement
    expect(card.style.background).toBe('var(--primary)')
    expect(card.style.borderStyle).toBe('none')  
    })

  it('applies default (non-accent) styling when accent is false/omitted', () => {
    const { container } = render(<StatCard label="Label" value={1} icon={<span />} />)

    const card = container.firstChild as HTMLElement
    expect(card.style.background).toBe('var(--card)')
    expect(card.style.border).toBe('1px solid var(--border)')
  })
})