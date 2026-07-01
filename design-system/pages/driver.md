# Driver Navigation Portal Overrides

## 🚛 High-Contrast Navigation Display

- **Orientation & View:** Primary view optimized for landscape orientation (`tablet` mounted layout) with large touch targets.
- **Critical Interaction Target Size:** Primary action button elements (Start Trip, Arrive, Complete) must have a minimum tap size of `64x64px`.
- **Telemetry Guidance:** Cairo turn-by-turn navigation map is displayed in high-contrast night-mode color schema to prevent glare.
- **Audio Telemetry (Web Audio API):**
  - **Success Chime:** Synthesized double-tone chime (notes D5 and A5) triggered programmatically with zero external dependencies.
  - **Failure Buzz:** Low-frequency triangle oscillator buzz to alert expired ticket scans instantly.
