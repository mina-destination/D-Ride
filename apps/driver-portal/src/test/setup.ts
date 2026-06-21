import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
  Map: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    remove: vi.fn(),
    addControl: vi.fn(),
  })),
  NavigationControl: vi.fn(),
  Marker: vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
}))

// Mock Capacitor Geolocation & Haptics
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockResolvedValue({
      coords: {
        latitude: 30.0444,
        longitude: 31.2357,
      },
    }),
    watchPosition: vi.fn().mockImplementation((options, callback) => {
      callback({
        coords: {
          latitude: 30.0444,
          longitude: 31.2357,
        },
      }, null)
      return Promise.resolve('watch-id')
    }),
    clearWatch: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    vibrate: vi.fn(),
    impact: vi.fn(),
    notification: vi.fn(),
  },
}))
