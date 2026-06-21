import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import SEO from '../SEO'

describe('SEO Component', () => {
  beforeEach(() => {
    // Clear head elements before each test
    document.head.innerHTML = ''
  })

  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('updates the document title and appends the brand name', () => {
    render(<SEO title="Home Page" />)
    expect(document.title).toBe('Home Page | D-Ride')
  })

  it('does not duplicate the brand name if it is already present in the title', () => {
    render(<SEO title="D-Ride Passenger Portal" />)
    expect(document.title).toBe('D-Ride Passenger Portal')
  })

  it('injects meta description tags if description is provided', () => {
    render(<SEO title="Test" description="This is a test description" />)
    const descMeta = document.querySelector('meta[name="description"]')
    expect(descMeta).not.toBeNull()
    expect(descMeta?.getAttribute('content')).toBe('This is a test description')

    const ogDesc = document.querySelector('meta[property="og:description"]')
    expect(ogDesc).not.toBeNull()
    expect(ogDesc?.getAttribute('content')).toBe('This is a test description')
  })

  it('injects default and custom keywords meta tags', () => {
    render(<SEO title="Test" keywords="booking, transit" />)
    const keywordsMeta = document.querySelector('meta[name="keywords"]')
    expect(keywordsMeta).not.toBeNull()
    expect(keywordsMeta?.getAttribute('content')).toContain('booking, transit')
    expect(keywordsMeta?.getAttribute('content')).toContain('d-ride, mass transit egypt')
  })

  it('injects canonical link rel and og:url properties', () => {
    render(<SEO title="Test" />)
    const canonicalLink = document.querySelector('link[rel="canonical"]')
    expect(canonicalLink).not.toBeNull()
    expect(canonicalLink?.getAttribute('href')).toContain(window.location.pathname)

    const ogUrl = document.querySelector('meta[property="og:url"]')
    expect(ogUrl).not.toBeNull()
    expect(ogUrl?.getAttribute('content')).toContain(window.location.pathname)
  })
})
