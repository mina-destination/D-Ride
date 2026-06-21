import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CustomDatePicker } from '../CustomDatePicker'

// Mock context translation relative to the test file
vi.mock('../../context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'en',
    isRtl: false,
  }),
}))

describe('CustomDatePicker Component', () => {
  it('renders with correct display format for initial value', () => {
    const handleChange = vi.fn()
    render(<CustomDatePicker value="2026-06-21" onChange={handleChange} />)

    // Displays June 21, 2026
    expect(screen.getByText('June 21, 2026')).toBeInTheDocument()
  })

  it('toggles calendar dropdown when clicked', () => {
    const handleChange = vi.fn()
    render(<CustomDatePicker value="2026-06-21" onChange={handleChange} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    // Should open portal and display month/year header in calendar
    expect(screen.getByText('June 2026')).toBeInTheDocument()
  })
})
