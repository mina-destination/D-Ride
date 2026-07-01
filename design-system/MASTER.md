# D-Ride Design System: MASTER.md

> **Hierarchical Retrieval Rule:** 
> When styling/refactoring a specific portal page, check if a corresponding override file exists in `design-system/pages/`.
> If it exists, prioritize its settings. Otherwise, strictly adhere to the global master tokens below.

---

## 🏛️ Brand Identity & Theme
D-Ride implements a premium, high-contrast OLED Dark Mode system inspired by modern transport applications, utilizing a Cairo-night themed palette.

### 🎨 Color Tokens (Golden Amber & Deep Onyx)

| Token Name | Value | CSS Custom Property | Usage |
|:---|:---|:---|:---|
| **Primary Golden Amber** | `#ffcc33` | `--color-primary` | Main accent, active states, branding highlights |
| **Primary Amber Hover** | `#ebc246` | `--color-primary-hover` | Interactive hover states |
| **Deep Onyx Base** | `#10131a` | `--color-bg-base` | Core background surface |
| **Elevated Surface (Dark)** | `#1d2027` | `--color-bg-surface` | Card layers, tables, menus |
| **Onyx Input Surface** | `#181b22` | `--color-bg-input` | Form input backgrounds |
| **Border Soft** | `rgba(255, 255, 255, 0.08)` | `--color-border-soft` | Component borders |
| **Border Active** | `#ffcc33` | `--color-border-active` | Focused inputs, primary borders |
| **Text High-Contrast** | `#e0e2ec` | `--color-text-primary` | Display titles, primary body |
| **Text Secondary** | `#d0c5af` | `--color-text-secondary` | Sub-labels, minor text |
| **Text Muted** | `#99907b` | `--color-text-muted` | Placeholders, inactive items |
| **On-Primary Label** | `#241a00` | `--color-text-on-primary` | High-contrast text on primary buttons |
| **Destructive/Danger** | `#ef4444` | `--color-destructive` | Errors, warning status, cancel action |

---

## 📝 Typography Hierarchy

- **Primary Font Family:** `Inter, system-ui, -apple-system, sans-serif`
- **Mood:** Clean, cinematic, high-end technical utility.
- **Scale:**
  - **Display / Hero H1:** `text-4xl md:text-6xl tracking-tighter leading-none font-bold`
  - **Section Titles H2:** `text-2xl md:text-3xl tracking-tight font-semibold`
  - **Card Headers H3:** `text-lg md:text-xl font-medium`
  - **Body / Main Text:** `text-base leading-relaxed max-w-[65ch]`
  - **Captions / Details:** `text-xs md:text-sm font-medium`

---

## 📐 Spacing Scale
A consistent 4px/8px-based spacing grid:

- `--space-xs`: `4px` / `0.25rem`
- `--space-sm`: `8px` / `0.5rem`
- `--space-md`: `16px` / `1rem`
- `--space-lg`: `24px` / `1.5rem`
- `--space-xl`: `32px` / `2rem`
- `--space-2xl`: `48px` / `3rem`

---

## ✨ Micro-interactions & Motion

- **State Transitions:** Standard duration `150ms` to `300ms` with `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Button Press/Active Feedback:** Tactile push simulation via `active:scale-[0.98]` or `active:translate-y-[0.5px]`.
- **Hover Pointer Constraint:** All clickable items must have `cursor-pointer` explicitly added, with color/opacity transitions.
- **Glassmorphic Shadows & Glows:**
  - `--shadow-glow`: `0 0 20px rgba(255, 204, 51, 0.2)`
  - `--shadow-glow-strong`: `0 0 40px rgba(255, 204, 51, 0.45)`
  - `--shadow-card`: `0 8px 32px 0 rgba(0, 0, 0, 0.37)`

---

## 🧱 Ant Design ConfigProvider Settings
Used to configure the admin portal interface components cleanly:
```typescript
export const antThemeConfig = {
  token: {
    colorPrimary: '#ffcc33',
    colorBgContainer: '#1d2027', // Elevated surface
    colorBgLayout: '#10131a',      // Deep Onyx base
    colorBgElevated: '#272a31',    // Dropdowns/Modals
    colorTextBase: '#e0e2ec',      // High-contrast primary text
    colorTextSecondary: '#d0c5af',
    colorBorder: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  components: {
    Layout: {
      siderBg: '#10131a',
      headerBg: '#1d2027',
      bodyBg: '#10131a',
    },
  }
};
```

---

## 🚫 Pre-flight Code Restrictions
1. **NO Emojis as UI Icons:** Use clean SVG elements or Lucide React icons.
2. **Explicit Interactive Cursor:** All action elements (links, custom buttons, toggles) must declare `cursor-pointer`.
3. **No Instant Hovers:** Ensure `transition-all duration-200` is defined for hover states.
4. **Contrast Compliance:** Avoid pure white labels on Golden Amber backgrounds. Text on Amber backgrounds should be near-black (`#241a00`).
