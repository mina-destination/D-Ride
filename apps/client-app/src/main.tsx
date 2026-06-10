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

// Global MapLibre customization to fix black text labels in dark mode
const OriginalMap = maplibregl.Map;
class PatchedMap extends OriginalMap {
  private _currentStyleUrlOrObj: any;

  constructor(options: any) {
    super(options);
    this._currentStyleUrlOrObj = options?.style;

    this.on('style.load', () => {
      try {
        const style = this.getStyle();
        let isDark = false;
        const styleStr = typeof this._currentStyleUrlOrObj === 'string' ? this._currentStyleUrlOrObj : '';
        
        if (styleStr.includes('dark')) {
          isDark = true;
        } else if (styleStr.includes('bright') || styleStr.includes('light')) {
          isDark = false;
        } else if (style?.name && /dark/i.test(style.name)) {
          isDark = true;
        } else if (
          document.body.classList.contains('dark') || 
          document.documentElement.classList.contains('dark') ||
          document.body.getAttribute('data-theme') === 'dark'
        ) {
          isDark = true;
        }

        const layers = style?.layers;
        if (layers) {
          layers.forEach((layer: any) => {
            if (layer.type === 'symbol') {
              try {
                if (isDark) {
                  this.setPaintProperty(layer.id, 'text-color', '#ffffff');
                  this.setPaintProperty(layer.id, 'text-halo-color', '#111827');
                  this.setPaintProperty(layer.id, 'text-halo-width', 1.5);
                } else {
                  this.setPaintProperty(layer.id, 'text-color', '#1f2937');
                  this.setPaintProperty(layer.id, 'text-halo-color', '#ffffff');
                  this.setPaintProperty(layer.id, 'text-halo-width', 1.5);
                }
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

  override setStyle(style: any, options?: any) {
    this._currentStyleUrlOrObj = style;
    return super.setStyle(style, options);
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
