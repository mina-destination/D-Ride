# 🗺️ D-Ride Platform: Architecture, Technology, & Workflow Summary

D-Ride is a high-performance, real-time monorepo ecosystem designed for modern commuter mass-transit operations. Adhering to the Egypt-inspired **Golden Amber (`#f5b731`) & Deep Onyx** signature design theme, the platform encompasses a mobile-first Passenger Client App, a Driver Navigation Portal, a comprehensive Admin CRM Dashboard, and a highly scalable NestJS Web Backend.

---

## 🏗️ Monorepo Directory Structure

The codebase is organized as a workspace monorepo utilizing **turborepo** for build pipelines and local workspace dependency orchestration:

```text
├── apps/
│   ├── api/                 # NestJS Backend API Gateway
│   ├── client-app/          # Passenger Commuter Web App (React + Vite)
│   ├── driver-portal/       # Driver Portal & Telemetry (React + Vite)
│   └── admin-dashboard/     # Administrative Control & CRM Portal (React + Vite + AntD)
├── packages/
│   ├── shared-theme/        # Base design tokens, HSL color palettes, and global CSS
│   └── shared-types/        # Shared TypeScript interfaces & models
├── package.json             # Root monorepo configuration
├── turbo.json               # Turborepo task pipeline config
└── docker-compose.yml       # Local PostgreSQL database runtime
```

---

## 🛠️ Technology Stack & Libraries

### 1. NestJS Backend Gateway (`apps/api`)
* **Framework**: NestJS v11 (structured modular architecture).
* **Database & ORM**: PostgreSQL, mapped via Prisma ORM.
* **Authentication**: Passport.js, JSON Web Tokens (JWT) with dynamic payload verification, and bcryptjs passwords.
* **Real-time Channels**: Socket.io gateway integrating custom `/support` telemetry and communication namespaces.
* **Third-Party Integrations**: Paymob Egypt Payment gateway, Twilio SMS.
* **Validation**: class-validator & class-transformer.
* **API Documentation**: Swagger OpenAPI UI.

### 2. Passenger Commuter Portal (`apps/client-app`)
* **Framework**: React 19 + Vite 8.
* **Styling**: Tailwind CSS + Vanilla CSS (Egyptian Dark Mode Glassmorphism).
* **Maps & Geo**: Leaflet v1.9 + React Leaflet v5 (Dark maps, route curve geometries, draggable pins, and custom colored markers).
* **Query & Fetching**: Axios client + TanStack React Query v5.
* **Sockets**: socket.io-client.
* **Icons**: Lucide React.

### 3. Administrative CRM Control Panel (`apps/admin-dashboard`)
* **Framework**: React 19 + Vite 8.
* **Component Library**: Ant Design v5 (Tables, Modals, Forms, Drawer navigation).
* **Charts & Analytics**: Custom animated SVGs (Donuts, Line trends, Bar charts) utilizing raw math coordinates for high-performance fluid renders.
* **Sockets**: socket.io-client for real-time fleet GPS coordinates and customer service CRM queues.

### 4. Driver Navigation Portal (`apps/driver-portal`)
* **Framework**: React 19 + Vite 8.
* **Routing**: OpenStreetMap (OSM) APIs + Open Source Routing Machine (OSRM) Cairo telemetry integration.
* **QR Gates**: Web API QR-code rendering & scanning modules.

---

## 🔄 Core Workflows & Logic Gates

### 1. Route Searching & Proximity Detection
* **Checkpoints Auto-matching**: The homepage enables users to choose "Detect Location" or "Select on Map". It feeds latitude/longitude coordinates to a geospatial `/routes/nearest` backend endpoint.
* **Haversine Math Logic**: The backend parses checkpoints and maps distances via Haversine geometry, auto-selecting the closest matching route, pickup checkpoint, and corresponding city destination.

### 2. Booking, Seat Allocation, & Payment
* **Toyota HiAce Chassis Layout**: Checkout presents an interactive 14-seater minibus chassis grid.
* **Locked & Occupied Seats**: Admins can lock specific seat indexes (e.g. for heavy luggage storage). Already booked seats are rendered as occupied.
* **Seat Enforcing Lock**: The URL passes `passengers` search metrics. Checkout blocks payment until exactly $X$ seats are selected. If the passenger selects an additional seat, a FIFO (First-In, First-Out) shifting queue automatically releases the oldest selection to keep the experience smooth.
* **Paymob Checkout & Prepaid Wallet**: Charges are processed via Paymob Egypt (Credit card/Mobile wallets) or instantly deducted from the platform's `Prepaid Wallet Balance` database ledger.

### 3. Real-Time Telemetry & Active Fleet Tracking
* **WebSocket Streaming**: Active drivers stream live coordinates over WebSockets on ride dispatch.
* **Admin Control Center**: The admin map subscribes to active vehicle rooms, animating shuttle markers across real Cairo street OSRM route curves in real-time.

### 4. Support CRM Rooms
* **Floating Live Chat**: Passengers interact with a floating widget.
* **Operator Console**: Support tickets are synchronized via Socket.io to the admin's CRM dashboard where managers reply inside persistent chat logs.

### 5. Enterprise Security Guard System
* **Real-Time Permissions Validation**: The admin `ProtectedRoute` queries the server API on mount. Updates made by the `OWNER` to roles take effect immediately without requiring user re-login.
* **Role Isolation**: Driver, Passenger, and Admin pages are strictly isolated by router guards.

---

## 📅 Roadmap Execution History

```mermaid
chronology
    title D-Ride Implementation Phases
    Phase 1 : Cashless Wallet & Proximity Search : Draggable Map Location Picker, Nearest-Station API, Prepaid Wallet balances, Direct Wallet Checkout deductions
    Phase 2 : Real-time Operations & CRM : Socket.io /support Gateway, Floating Chat Widget, Admin CRM chat channels, Live-updating unread notifications
    Phase 3 : Driver Navigation & Fleet Upgrades : Cairo OSRM Turn-by-Turn routing, Active telemetry WebSockets, Cairo डिमांड Heatmap, Collapsible Sidebar, FIFO Seat locking
```

1. **Phase 1: Cashless Infrastructure & Proximity Booking (Completed)**
   * Draggable Location Pin Picker & Leaflet integration.
   * Nearest-Station geospatial backend rankings.
   * Prepaid account wallet ledger, topups, and zero-redirect payment checkouts.

2. **Phase 2: Live Support Operations & Real-Time Chat (Completed)**
   * Persistent Socket.io gateway channels.
   * Floating, Egypt-branded customer support widgets.
   * CRM center for real-time ticketing.
   * Live notifications bell alerts (Mark all as read logic).

3. **Phase 3: Telemetry & Intelligent Dispatch (Completed)**
   * OSRM Cairo street layout curves replacing straight-line flight paths.
   * Moving vehicle markers on admin maps.
   * AntD responsive collapsible navigation panel.
   * Seat selector quantity locks (FIFO rotation).

---

## 🧪 Platform Validation Status

* **TypeScript Compilation**: Clean builds (`npm run build` exits with code 0).
* **Automated Tests**: Unit test suites cover pricing logic, Haversine nearest station math, and NestJS services. All 14 tests pass.
* **Design Consistent**: Color layout matches `#f5b731` Amber and Deep Onyx.
