# my-neon-app (frontend)

Scaffolded Vite + React + TypeScript app for Neon Auth integration.

Quick start (pnpm):

1. Install dependencies:
   pnpm install

2. Run dev server:
   pnpm dev

3. Build production:
   pnpm build

Notes:
- Install required packages: `@neondatabase/neon-js` and `react-router-dom`.
- Add `VITE_NEON_AUTH_URL` to a `.env` file (see `.env.example`).
- This project is a minimal scaffold. Replace `src/lib/auth.ts` and `src/pages/*` with Neon Auth code as needed.

Packaging/executable:
- To produce a distributable app you can either:
  - Serve the `dist/` static files (recommended) using any static server.
  - Wrap with Electron or Tauri if you need native executables.
