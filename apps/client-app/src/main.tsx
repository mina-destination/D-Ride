import './patch-worker'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './context/ThemeContext'
import maplibregl from 'maplibre-gl'

// Setup RTL Text Plugin
try {
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(
      'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js',
      true
    );
  }
} catch (e) {
  console.error('Failed to load MapLibre RTL plugin:', e);
}

import { applyGoogleMapsDarkTheme } from '@transport/shared-theme';

// Global MapLibre customization to replicate Google Maps dark navigation theme
const OriginalMap = maplibregl.Map;
class PatchedMap extends OriginalMap {
  constructor(options: any) {
    super(options);
    this.on('style.load', () => {
      applyGoogleMapsDarkTheme(this);
    });
  }
}
(maplibregl as any).Map = PatchedMap;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // exponential backoff
      retry: 3,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
