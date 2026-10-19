# Implementation Plan - Fix Dev Server Startup

Revert the development environment to a standard Vite-only setup to resolve the "Connection refused" error and ensure reliable application startup.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your feedback, we are reverting to a standard Vite-only setup for development. This is the most reliable path for the AI Studio preview environment. The custom Express server (`server.ts`) will be retained for production builds and deployment, but development will use the simpler, default Vite flow.

- **Confirmed Decision**: Revert `npm run dev` to use `vite` directly.
- **Confirmed Decision**: Maintain full-stack readiness by keeping `server.ts` for production (`npm start`).

## 1. Overview & Core Concept

- **What It Does**: Restores the default Vite development workflow on port 3000.
- **Key Value**: Fixes the "Connection refused" issue by using the optimized Vite dev server instead of a custom Express wrapper during development.

## 2. User Experience & Visual Design

- **Key User Flows**:
    - User starts the dev environment.
    - The browser successfully connects to the app on port 3000.
    - Standard Vite HMR (Hot Module Replacement) and error overlays are restored.
- **Visual Identity**: No changes to the visual design; this is a purely technical reliability fix.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Reverting the Dev Script**
    - *Chosen Approach*: Change `"dev": "tsx server.ts"` back to `"dev": "vite --port=3000 --host=0.0.0.0"`.
    - *Why*: To eliminate potential port-binding conflicts or `tsx` execution issues in the preview environment.
- **Decision 2: Standardizing `vite.config.ts`**
    - *Chosen Approach*: Ensure `vite.config.ts` correctly handles the port and host settings.
    - *Why*: Redundancy check to ensure the server starts on the expected port (3000) even if CLI flags are omitted.

## 4. Technical Architecture & Data Strategy

```text
┌───────────────────────┐
│   Preview Environment │
└───────────┬───────────┘
            │
    ┌───────▼───────┐
    │ Vite CLI (Dev)│ ◄─── Restored Path
    └───────┬───────┘
            │
    ┌───────▼───────┐
    │  React App    │
    └───────────────┘
```

- **Technical Reference**:
    - **Development**: `npm run dev` calls `vite` directly.
    - **Production**: `npm run start` calls `node server.ts` (serves the built `dist` folder).
- **Interactive Component Mapping**:
    - No changes to component logic or state.
    - The "Wipe Registry Database" and other features will remain fully functional as they rely on client-side Firebase SDKs.
