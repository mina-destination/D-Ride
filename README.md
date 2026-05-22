# 🚐 D-Ride: Smart Autonomous Mass-Transit Platform (Monorepo)

D-Ride is a cutting-edge mass-transit booking, tracking, and fleet management platform custom-tailored for the Egyptian market (modeled after the Swvl paradigm). It features real-time WebSocket vehicle GPS updates, dynamic route coordinates planning, automated Paymob cashless transactions, and an interactive admin live-simulator.

---

## 🏗️ Platform Architecture

D-Ride is built as a unified **Turborepo npm Workspaces Monorepo** containerized with Docker and ready for direct serverless deployment to Google Cloud Run.

```
transport-monorepo/
├── apps/
│   ├── api/                 # NestJS microservices server with Mongoose & Socket-io
│   ├── client-app/          # passenger web portal (Vite/React, Leaflet Map, Paymob)
│   └── admin-dashboard/     # Administrative CRM (Ant Design, Route Planner, Live Simulator)
├── packages/
│   ├── shared-theme/        # Standardized theme design system tokens & assets
│   └── shared-types/        # Shared TypeScript interfaces across client, admin, and API
├── docker-compose.yml       # Orchestrated multi-service local system launch configuration
├── deploy.sh                # Google Cloud Run multi-service build and release automation script
└── cloudbuild.yaml          # Google Cloud Build CI/CD pipeline template
```

---

## ⚡ Tech Stack Highlights

*   **Monorepo Engine**: [Turborepo](https://turbo.build/) + npm Workspaces
*   **Backend Framework**: [NestJS](https://nestjs.com/) (TypeScript, MongoDB Mongoose, Redis)
*   **Frontends**: [React 18](https://react.dev/) + [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Design & UI Styling**: [Ant Design v5](https://ant.design/) + Vanilla CSS design system
*   **Geospatial Maps**: [React Leaflet](https://react-leaflet.js.org/) + OpenStreetMap
*   **Real-Time Gateway**: [Socket.io](https://socket.io/) (High-Frequency WebSockets)
*   **Cashless Checkout**: [Paymob Integration](https://paymob.com/) (Cards / Mobile Wallets)
*   **API Specification**: [NestJS Swagger Documentation](https://swagger.io/)

---

## 🚀 Local Quickstart

### 1. Prerequisites
Ensure you have the following installed:
*   [Node.js (v20+)](https://nodejs.org/)
*   [Docker & Docker Compose](https://www.docker.com/)

### 2. Standard Launch (Docker Compose)
Launch the entire platform (Database, Cache, API, Client App, and Admin Dashboard) locally in one command:
```bash
docker-compose up --build -d
```
Once initialized, the services will be running on:
*   **Passenger Client Portal**: [http://localhost](http://localhost) (Port `80`)
*   **Admin CRM Dashboard**: [http://localhost:8080](http://localhost:8080) (Port `8080`)
*   **Microservice API Endpoint**: [http://localhost:3000/api](http://localhost:3000/api)
*   **Interactive Swagger Documentation**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

### 3. Developer Local Mode (Hot Reload)
To run the packages in active development mode locally with Turborepo hot-reloading:
```bash
# 1. Install dependencies in workspace
npm install

# 2. Run local databases (MongoDB & Redis)
docker-compose up mongodb redis -d

# 3. Spin up dev servers with Turborepo
npm run dev
```

---

## 🛰️ Real-Time GPS Simulator Setup

D-Ride connects route-drawing with live tracking in three steps:
1.  **Plot Route**: Open the **Admin Routes** page and draw custom coordinate routes across Cairo/Alexandria using the interactive Leaflet tool.
2.  **Assign & Track**: Book a seat in the **Client Portal**, click **Track 📍** to open the passenger's real-time WebSocket map.
3.  **Start Live Run**: On the **Admin Trips** page, click **Live GPS Run 🚀**. The admin browser will stream coordinate updates to the WebSocket server, and you'll watch the bus marker glide smoothly along the exact map curves in real-time!

---

## ☁️ Google Cloud Platform Deployment

Automate multi-stage builds, tag, push, and release to serverless Google Cloud Run using the integrated deployment pipeline script:

```bash
# Provide execute permissions
chmod +x deploy.sh

# Deploy to Cloud Run (automatically builds backend, extracts dynamic URL, builds frontends)
GCP_PROJECT_ID="your-project-id" GCP_REGION="us-central1" ./deploy.sh
```

---

## 🎨 Design System

All visual layouts conform to the premium Egyptian **Golden Amber & Deep Onyx** design system. Light and dark modes are driven dynamically by system-level preferences and persisted to local storage. 
*   **Primary Amber Color**: `#f5b731`
*   **Deep Glassmorphism Surfaces**: Glass overlays with modern backdrop-blur values.
