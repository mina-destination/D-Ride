// ============================================================
// D-Ride Shared Theme — Golden Amber Design System
// ============================================================
// Derived from: color_palette.md.resolved + D-Ride brand logo
// Exports: Tailwind tokens, Ant Design ConfigProvider, CSS variables
// ============================================================

// ── Light Mode Palette ──────────────────────────────────────
export const lightPalette = {
  primary: {
    DEFAULT: '#F5B731',
    hover: '#E5A520',
    light: '#FEF3CD',
    dark: '#B8860B',
  },
  surfaces: {
    background: '#F4F5F7',
    surface: '#FFFFFF',
    surfaceElevated: '#F8F9FA',
    surfaceHover: '#F0F2F5',
  },
  typography: {
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    textOnPrimary: '#1A1A2E',
  },
  borders: {
    border: '#E5E7EB',
    borderFocus: '#F5B731',
  },
  sidebar: {
    bg: '#050509',
    text: '#9CA3AF',
    textActive: '#F5B731',
    itemHover: '#0E0E1B',
    border: 'rgba(255, 255, 255, 0.08)',
  },
};

// ── Dark Mode Palette ───────────────────────────────────────
export const darkPalette = {
  primary: {
    DEFAULT: '#F5B731',
    hover: '#FFD04A',
    light: 'rgba(245, 183, 49, 0.15)',
    dark: '#E5A520',
  },
  surfaces: {
    background: '#06060E',
    surface: '#0E0E1B',
    surfaceElevated: '#161628',
    surfaceHover: '#1E1E35',
  },
  typography: {
    textPrimary: '#F0F1F5',
    textSecondary: '#9CA3AF',
    textMuted: '#5A5F73',
    textOnPrimary: '#0E0E1B',
  },
  borders: {
    border: '#1E1E35',
    borderFocus: '#F5B731',
  },
  sidebar: {
    bg: '#050509',
    text: '#9CA3AF',
    textActive: '#F5B731',
    itemHover: '#0E0E1B',
    border: 'rgba(255, 255, 255, 0.08)',
  },
};

// ── Semantic Colors (shared across modes) ───────────────────
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
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
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
// Use this in tailwind.config.js: colors: { ...themeColors }
export const themeColors = {
  primary: {
    DEFAULT: 'var(--primary)',
    hover: 'var(--primary-hover)',
    light: 'var(--primary-light)',
    dark: 'var(--primary-dark)',
  },
  success: {
    DEFAULT: 'var(--success)',
  },
  danger: {
    DEFAULT: 'var(--danger)',
  },
  warning: {
    DEFAULT: 'var(--warning)',
  },
  info: {
    DEFAULT: 'var(--info)',
  },
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

// ── CSS Custom Properties Generator ─────────────────────────
// Inject these into :root {} for vanilla CSS access
export function getCSSVariables(mode: 'light' | 'dark' = 'light'): Record<string, string> {
  const palette = mode === 'light' ? lightPalette : darkPalette;

  const focusRing = mode === 'light' 
    ? '0 0 0 3px rgba(245, 183, 49, 0.35)' 
    : '0 0 0 3px rgba(245, 183, 49, 0.25)';

  const navBg = mode === 'light'
    ? 'rgba(255, 255, 255, 0.75)'
    : 'rgba(6, 6, 14, 0.8)';

  const glassBg = mode === 'light'
    ? 'rgba(255, 255, 255, 0.6)'
    : 'rgba(14, 14, 27, 0.65)';

  const glassBorder = mode === 'light'
    ? 'rgba(229, 231, 235, 0.5)'
    : 'rgba(245, 183, 49, 0.08)';

  const glowAmber = mode === 'light'
    ? 'rgba(245, 183, 49, 0.35)'
    : 'rgba(245, 183, 49, 0.2)';

  const glowBlue = mode === 'light'
    ? 'rgba(59, 130, 246, 0.2)'
    : 'rgba(59, 130, 246, 0.12)';

  const glowPurple = mode === 'light'
    ? 'rgba(168, 85, 247, 0.15)'
    : 'rgba(168, 85, 247, 0.1)';

  return {
    '--primary': palette.primary.DEFAULT,
    '--primary-hover': palette.primary.hover,
    '--primary-light': palette.primary.light,
    '--primary-dark': palette.primary.dark,
    '--background': palette.surfaces.background,
    '--surface': palette.surfaces.surface,
    '--surface-elevated': palette.surfaces.surfaceElevated,
    '--surface-hover': palette.surfaces.surfaceHover,
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
    '--success': semanticColors.success.DEFAULT,
    '--danger': semanticColors.danger.DEFAULT,
    '--warning': semanticColors.warning.DEFAULT,
    '--info': semanticColors.info.DEFAULT,
    '--font-family': typography.fontFamily,
    '--radius-sm': designTokens.borderRadius.sm,
    '--radius-md': designTokens.borderRadius.md,
    '--radius-lg': designTokens.borderRadius.lg,
    '--transition-base': 'all 0.2s ease-in-out',
    '--transition-spring': 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    '--shadow-glow': designTokens.shadows.glow,
    '--shadow-glow-strong': designTokens.shadows.glowStrong,
    '--focus-ring': focusRing,
    '--nav-bg': navBg,
    '--glass-bg': glassBg,
    '--glass-border': glassBorder,
    '--glow-amber': glowAmber,
    '--glow-blue': glowBlue,
    '--glow-purple': glowPurple,
  };
}


// ── Ant Design ConfigProvider Theme ─────────────────────────
// Use: <ConfigProvider theme={antThemeConfig}>
export const antThemeConfig = {
  token: {
    // Brand Colors
    colorPrimary: lightPalette.primary.DEFAULT,
    colorSuccess: semanticColors.success.DEFAULT,
    colorError: semanticColors.danger.DEFAULT,
    colorWarning: semanticColors.warning.DEFAULT,
    colorInfo: semanticColors.info.DEFAULT,

    // Typography
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,

    // Surfaces & Layout
    colorBgContainer: lightPalette.surfaces.surface,
    colorBgLayout: lightPalette.surfaces.background,
    colorBgElevated: lightPalette.surfaces.surfaceElevated,
    colorTextBase: lightPalette.typography.textPrimary,
    colorTextSecondary: lightPalette.typography.textSecondary,

    // Borders & Radius
    colorBorder: lightPalette.borders.border,
    borderRadius: 8,
    borderRadiusLG: 12,

    // Shadows
    boxShadow: designTokens.shadows.md,
    boxShadowSecondary: designTokens.shadows.lg,
  },
  components: {
    Layout: {
      siderBg: lightPalette.sidebar.bg,
      headerBg: lightPalette.surfaces.surface,
      bodyBg: lightPalette.surfaces.background,
    },
    Menu: {
      darkItemBg: lightPalette.sidebar.bg,
      darkItemColor: lightPalette.sidebar.text,
      darkItemSelectedBg: lightPalette.sidebar.itemHover,
      darkItemSelectedColor: lightPalette.primary.DEFAULT,
      darkItemHoverBg: lightPalette.sidebar.itemHover,
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(245, 183, 49, 0.35)',
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};

// ── Dark Mode Ant Design Config ─────────────────────────────
export const antThemeConfigDark = {
  ...antThemeConfig,
  token: {
    ...antThemeConfig.token,
    colorBgContainer: darkPalette.surfaces.surface,
    colorBgLayout: darkPalette.surfaces.background,
    colorBgElevated: darkPalette.surfaces.surfaceElevated,
    colorTextBase: darkPalette.typography.textPrimary,
    colorTextSecondary: darkPalette.typography.textSecondary,
    colorBorder: darkPalette.borders.border,
  },
  components: {
    ...antThemeConfig.components,
    Layout: {
      siderBg: darkPalette.sidebar.bg,
      headerBg: darkPalette.surfaces.surface,
      bodyBg: darkPalette.surfaces.background,
    },
    Menu: {
      darkItemBg: darkPalette.sidebar.bg,
      darkItemColor: darkPalette.sidebar.text,
      darkItemSelectedBg: darkPalette.sidebar.itemHover,
      darkItemSelectedColor: darkPalette.primary.DEFAULT,
      darkItemHoverBg: darkPalette.sidebar.itemHover,
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(245, 183, 49, 0.35)',
    },
  },
};

// ── MapLibre GL Shared Hook ───────────────────────────────────
// Provides consistent map initialization across all apps
export interface UseMapLibreOptions {
  style?: string;
  center?: [number, number];
  zoom?: number;
  onLoad?: (map: any) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function patchMapLabels(map: any) {
  const isDark = document.documentElement.classList.contains('dark') || 
                 document.body.getAttribute('data-theme') === 'dark';
  map.getStyle()?.layers?.forEach((layer: any) => {
    if (layer.type === 'symbol') {
      try {
        map.setPaintProperty(layer.id, 'text-color', isDark ? '#ffffff' : '#1f2937');
        map.setPaintProperty(layer.id, 'text-halo-color', isDark ? '#111827' : '#ffffff');
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
