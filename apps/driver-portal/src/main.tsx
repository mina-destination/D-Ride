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

// Global MapLibre customization — always dark mode labels
const OriginalMap = maplibregl.Map;
class PatchedMap extends OriginalMap {
  constructor(options: any) {
    super(options);

    this.on('style.load', () => {
      try {
        const style = this.getStyle();
        const layers = style?.layers;
        if (layers) {
          layers.forEach((layer: any) => {
            if (layer.type === 'symbol') {
              try {
                this.setPaintProperty(layer.id, 'text-color', '#ffffff');
                this.setPaintProperty(layer.id, 'text-halo-color', '#111827');
                this.setPaintProperty(layer.id, 'text-halo-width', 1.5);
              } catch (e) {
                // Ignore layers that do not support text paint properties
              }
            }
          });
        }
      } catch (err) {
        console.warn('Failed to style map labels:', err);
      }
    });
  }
}

(maplibregl as any).Map = PatchedMap;


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
