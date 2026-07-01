# Admin CRM Portal Overrides

## 🖥️ Fleet Cockpit Control Layouts

- **Density:** High visual density (`VISUAL_DENSITY: 8`). Dense data tables with reduced padding (`py-2 px-3`) to maximize visible real-estate on desktop monitors.
- **Collapsible Sider:** The navigation panel collapsible sidebar operates with a `300ms` transition. Selected nav items are highlighted using the Amber theme (`text-[#ffcc33] bg-white/5 border-r-2 border-[#ffcc33]`).
- **Telemetry Map Containers:** Leaflet maps utilize custom dark mode styling (`positron` style with custom Onyx opacity filters) to match the dark theme and reduce operator eye strain during night shifts.
- **Analytics Charts:** High-performance inline SVGs utilize mathematical path calculations styled with high-contrast glowing accents:
  - Fill glow: `rgba(255, 204, 51, 0.15)`
  - Stroke: `#ffcc33`
- **Tables and Lists:** Tabular numbers (`font-mono`) are mandatory for booking amounts, capacity counts, and status timestamps.
