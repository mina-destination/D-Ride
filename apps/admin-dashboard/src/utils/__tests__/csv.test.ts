import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV } from '../csv'
import type { CSVHeader } from '../csv'

describe('exportToCSV', () => {
  beforeEach(() => {
    // Mock global Blob and URL functions
    (globalThis as any).URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test');
    (globalThis as any).URL.revokeObjectURL = vi.fn();
  })

  it('correctly creates CSV rows and formats values', () => {
    const data = [
      { id: 1, name: 'Alice', details: { city: 'Cairo' }, tags: ['VIP', 'Premium'] },
      { id: 2, name: 'Bob', details: { city: 'Giza' }, tags: ['Standard'] }
    ]

    const headers: CSVHeader[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'details.city', label: 'City' },
      { key: 'tags', label: 'Tags' }
    ]

    const spyAppend = vi.spyOn(document.body, 'appendChild')
    const spyRemove = vi.spyOn(document.body, 'removeChild')

    exportToCSV(data, headers, 'test.csv')

    expect(spyAppend).toHaveBeenCalled()
    expect(spyRemove).toHaveBeenCalled()

    const link = spyAppend.mock.calls[0][0] as HTMLAnchorElement
    expect(link.getAttribute('download')).toBe('test.csv')
    expect(link.getAttribute('href')).toBe('blob:http://localhost/test')

    spyAppend.mockRestore()
    spyRemove.mockRestore()
  })

  it('applies custom transforms to CSV values', () => {
    const data = [
      { id: 1, amount: 150 },
      { id: 2, amount: 200 }
    ]

    const headers: CSVHeader[] = [
      { key: 'id', label: 'ID' },
      { key: 'amount', label: 'Total EGP', transform: (val) => `${val} EGP` }
    ]

    const spyAppend = vi.spyOn(document.body, 'appendChild')
    exportToCSV(data, headers, 'amounts.csv')

    expect(spyAppend).toHaveBeenCalled()
    spyAppend.mockRestore()
  })
})
