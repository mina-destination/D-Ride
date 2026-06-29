import './patch-worker'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
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


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
