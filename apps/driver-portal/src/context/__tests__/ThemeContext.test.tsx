import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../ThemeContext'

// Test helper component
function ThemeConsumer() {
  const { theme } = useTheme()
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', '')
  })

  afterEach(() => {
    document.documentElement.setAttribute('data-theme', '')
  })

  it('provides dark theme and locks data-theme to dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
