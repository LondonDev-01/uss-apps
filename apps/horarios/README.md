# my-neon-app (frontend)

Scaffolded Vite + React + TypeScript app for Neon Auth integration.

Quick start (pnpm):

1. Install dependencies:
   pnpm install

2. Run dev server:
   pnpm dev

3. Build production:
   pnpm build
Admin API

If you want to manage migration keys via HTTP locally, run the admin API server:

```bash
export ADMIN_KEY="un-secret-strong"
export NEON_DB_URL="postgresql://..."
python3 scripts/admin_api.py --host 127.0.0.1 --port 8001
```

Then open `http://localhost:3000/admin` in the frontend, paste the `ADMIN_KEY` and use the UI to generate/list/delete keys.

Notes:
Install required packages: `@neondatabase/neon-js` and `react-router-dom`.

Install packages (examples):

pnpm:
```
pnpm add @neondatabase/neon-js react-router-dom
```

npm:
```
npm install @neondatabase/neon-js react-router-dom
```

yarn:
```
yarn add @neondatabase/neon-js react-router-dom
```

  - Serve the `dist/` static files (recommended) using any static server.
  - Wrap with Electron or Tauri if you need native executables.

Note: the scaffold includes a placeholder import for Neon; after installing, update `src/lib/auth.ts` to use the actual client/API from `@neondatabase/neon-js` as per the SDK docs.

When you install `@neondatabase/neon-js`, update `src/lib/auth.ts` to export the real `NeonAuthUIProvider` (or similar) and then the `NeonAuthProvider` in `src/main.tsx` will wire it into the app.

Example replacement (pseudo-code):

```tsx
import { NeonAuthUIProvider } from '@neondatabase/neon-js'
// then use <NeonAuthUIProvider config={{ url: import.meta.env.VITE_NEON_AUTH_URL }}>
```
