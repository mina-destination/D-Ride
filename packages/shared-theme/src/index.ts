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
  primary: lightPalette.primary,
  success: semanticColors.success,
  danger: semanticColors.danger,
  warning: semanticColors.warning,
  info: semanticColors.info,
  sidebar: {
    bg: lightPalette.sidebar.bg,
    text: lightPalette.sidebar.text,
    active: lightPalette.sidebar.textActive,
    hover: lightPalette.sidebar.itemHover,
  },
  surface: {
    DEFAULT: lightPalette.surfaces.surface,
    elevated: lightPalette.surfaces.surfaceElevated,
    hover: lightPalette.surfaces.surfaceHover,
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
