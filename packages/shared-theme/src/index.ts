// ============================================================
// D-Ride Shared Theme — Golden Amber Design System (Unified Dark)
// ============================================================
// Single unified dark theme — no light/dark toggle.
// Deep Onyx + Golden Amber across all apps.
// ============================================================

// ── Brand Palette (Unified Dark) ────────────────────────────
export const palette = {
  primary: {
    DEFAULT: '#ffcc33',
    hover: '#ffe08b',
    light: 'rgba(255, 204, 51, 0.12)',
    dark: '#745b00',
    interactive: '#ebc246',
  },
  surfaces: {
    background: '#10131a',
    surface: '#10131a',
    surfaceElevated: '#1d2027',
    surfaceHover: '#272a31',
  },
  typography: {
    textPrimary: '#e0e2ec',
    textSecondary: '#d0c5af',
    textMuted: '#99907b',
    textOnPrimary: '#241a00',
  },
  borders: {
    border: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#ffcc33',
  },
  sidebar: {
    bg: '#0b0e15',
    text: '#d0c5af',
    textActive: '#ffcc33',
    itemHover: '#1d2027',
    border: 'rgba(255, 255, 255, 0.08)',
  },
};

// ── Legacy Exports (backward compat) ────────────────────────
/** @deprecated Use `palette` instead */
export const darkPalette = palette;
/** @deprecated Use `palette` instead */
export const lightPalette = palette;

// ── Semantic Colors ─────────────────────────────────────────
export const semanticColors = {
  success: {
    DEFAULT: '#10B981',
    dark: '#34D399',
    light: '#D1FAE5',
  },
  danger: {
    DEFAULT: '#EF4444',
    dark: '#F87171',
    light: '#FEE2E2',
  },
  warning: {
    DEFAULT: '#F59E0B',
    dark: '#FBBF24',
    light: '#FEF3C7',
  },
  info: {
    DEFAULT: '#3B82F6',
    dark: '#60A5FA',
    light: '#DBEAFE',
  },
};

// ── Typography System ───────────────────────────────────────
export const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
};

// ── Spacing & Radius ────────────────────────────────────────
export const designTokens = {
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    glow: '0 0 20px rgba(245, 183, 49, 0.3)',
    glowStrong: '0 0 40px rgba(245, 183, 49, 0.5)',
  },
};

// ── Tailwind Color Token Export ──────────────────────────────
export const themeColors = {
  primary: {
    DEFAULT: 'var(--primary)',
    hover: 'var(--primary-hover)',
    light: 'var(--primary-light)',
    dark: 'var(--primary-dark)',
    interactive: 'var(--primary-interactive)',
  },
  success: { DEFAULT: 'var(--success)' },
  danger: { DEFAULT: 'var(--danger)' },
  warning: { DEFAULT: 'var(--warning)' },
  info: { DEFAULT: 'var(--info)' },
  sidebar: {
    bg: 'var(--sidebar-bg)',
    text: 'var(--sidebar-text)',
    active: 'var(--sidebar-text-active)',
    hover: 'var(--sidebar-item-hover)',
    border: 'var(--sidebar-border)',
  },
  surface: {
    DEFAULT: 'var(--surface)',
    elevated: 'var(--surface-elevated)',
    hover: 'var(--surface-hover)',
  },
  'surface-container-lowest': 'var(--surface-container-lowest)',
  'surface-container-low': 'var(--surface-container-low)',
  'surface-container': 'var(--surface-container)',
  'surface-container-high': 'var(--surface-container-high)',
  'surface-container-highest': 'var(--surface-container-highest)',
  'surface-bright': 'var(--surface-bright)',
  'pure-white': 'var(--pure-white)',
  'accent-purple': 'var(--accent-purple)',
  background: 'var(--background)',
  border: {
    DEFAULT: 'var(--border)',
    focus: 'var(--border-focus)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    onPrimary: 'var(--text-on-primary)',
  },
  deepspace: {
    DEFAULT: '#1A1A2E',
    dark: '#0F0F1A',
    mid: '#22223A',
    light: '#2D2D44',
  },
};

// ── CSS Custom Properties Generator (Unified Dark) ──────────
// Kept the `mode` parameter signature for backward compat, but it's ignored.
export function getCSSVariables(_mode: 'light' | 'dark' = 'dark'): Record<string, string> {
  return {
    '--primary': palette.primary.DEFAULT,
    '--primary-hover': palette.primary.hover,
    '--primary-light': palette.primary.light,
    '--primary-dark': palette.primary.dark,
    '--primary-interactive': palette.primary.interactive,
    '--background': palette.surfaces.background,
    '--surface': palette.surfaces.surface,
    '--surface-elevated': palette.surfaces.surfaceElevated,
    '--surface-hover': palette.surfaces.surfaceHover,
    '--surface-container-lowest': '#0b0e15',
    '--surface-container-low': '#191b23',
    '--surface-container': '#1d2027',
    '--surface-container-high': '#272a31',
    '--surface-container-highest': '#32353c',
    '--surface-bright': '#363941',
    '--pure-white': '#FFFFFF',
    '--accent-purple': '#A855F7',
    '--text-primary': palette.typography.textPrimary,
    '--text-secondary': palette.typography.textSecondary,
    '--text-muted': palette.typography.textMuted,
    '--text-on-primary': palette.typography.textOnPrimary,
    '--border': palette.borders.border,
    '--border-focus': palette.borders.borderFocus,
    '--sidebar-bg': palette.sidebar.bg,
    '--sidebar-text': palette.sidebar.text,
    '--sidebar-text-active': palette.sidebar.textActive,
    '--sidebar-item-hover': palette.sidebar.itemHover,
    '--sidebar-border': palette.sidebar.border,
    '--success': semanticColors.success.dark,
    '--danger': semanticColors.danger.dark,
    '--warning': semanticColors.warning.dark,
    '--info': semanticColors.info.dark,
    '--font-family': typography.fontFamily,
    '--radius-sm': designTokens.borderRadius.sm,
    '--radius-md': designTokens.borderRadius.md,
    '--radius-lg': designTokens.borderRadius.lg,
    '--transition-base': 'all 0.2s ease-in-out',
    '--transition-spring': 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    '--shadow-glow': designTokens.shadows.glow,
    '--shadow-glow-strong': designTokens.shadows.glowStrong,
    '--focus-ring': '0 0 0 3px rgba(255, 204, 51, 0.25)',
    '--nav-bg': 'rgba(16, 19, 26, 0.8)',
    '--glass-bg': 'rgba(29, 32, 39, 0.7)',
    '--glass-border': 'rgba(255, 255, 255, 0.08)',
    '--glow-amber': 'rgba(255, 204, 51, 0.2)',
    '--glow-blue': 'rgba(59, 130, 246, 0.12)',
    '--glow-purple': 'rgba(168, 85, 247, 0.1)',
  };
}

// ── Ant Design ConfigProvider Theme (Unified Dark) ──────────
export const antThemeConfig = {
  token: {
    colorPrimary: palette.primary.DEFAULT,
    colorSuccess: semanticColors.success.dark,
    colorError: semanticColors.danger.dark,
    colorWarning: semanticColors.warning.dark,
    colorInfo: semanticColors.info.dark,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    colorBgContainer: palette.surfaces.surface,
    colorBgLayout: palette.surfaces.background,
    colorBgElevated: palette.surfaces.surfaceElevated,
    colorTextBase: palette.typography.textPrimary,
    colorTextSecondary: palette.typography.textSecondary,
    colorBorder: palette.borders.border,
    borderRadius: 8,
    borderRadiusLG: 12,
    boxShadow: designTokens.shadows.md,
    boxShadowSecondary: designTokens.shadows.lg,
  },
  components: {
    Layout: {
      siderBg: palette.sidebar.bg,
      headerBg: palette.surfaces.surface,
      bodyBg: palette.surfaces.background,
    },
    Menu: {
      darkItemBg: palette.sidebar.bg,
      darkItemColor: palette.sidebar.text,
      darkItemSelectedBg: palette.sidebar.itemHover,
      darkItemSelectedColor: palette.primary.DEFAULT,
      darkItemHoverBg: palette.sidebar.itemHover,
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(255, 204, 51, 0.35)',
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};

/** @deprecated Use `antThemeConfig` — there is only one theme now */
export const antThemeConfigDark = antThemeConfig;

// ── MapLibre GL Shared Utilities ────────────────────────────

export interface UseMapLibreOptions {
  style?: string;
  center?: [number, number];
  zoom?: number;
  onLoad?: (map: any) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function patchMapLabels(map: any) {
  // Always dark mode — no need to check DOM classes
  map.getStyle()?.layers?.forEach((layer: any) => {
    if (layer.type === 'symbol') {
      try {
        map.setPaintProperty(layer.id, 'text-color', '#ffffff');
        map.setPaintProperty(layer.id, 'text-halo-color', '#111827');
        map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
      } catch {}
    }
  });
}

export function setupRTLPlugin(maplibregl: any) {
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(
      'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js',
      true
    );
  }
}

export function createMap(
  container: HTMLDivElement,
  maplibregl: any,
  options: UseMapLibreOptions = {}
): any {
  const {
    style = 'https://tiles.openfreemap.org/styles/dark',
    center = [31.2357, 30.0444],
    zoom = 14,
    onLoad,
  } = options;

  const map = new maplibregl.Map({
    container,
    style,
    center,
    zoom,
    attributionControl: false,
  });

  // Suppress missing sprite image warnings
  map.on('styleimagemissing', (e: any) => {
    if (!map.hasImage(e.id)) {
      map.addImage(e.id, { width: 16, height: 16, data: new Uint8Array(1024) });
    }
  });

  // Patch labels for dark mode
  map.on('style.load', () => patchMapLabels(map));

  // Add navigation control
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

  onLoad?.(map);

  return map;
}
