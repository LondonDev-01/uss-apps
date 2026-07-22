# AGENTS.md

Repo-specific guidance for OpenCode sessions working on **UniHorario USS**.

## Stack

- **Single app** lives entirely in `frontend/`. No backend, no server, no env vars. 100% client-side SPA.
- React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 3 + framer-motion.
- `xlsx` (SheetJS) for Excel parsing/export. `react-router-dom` with **HashRouter** (deep links use `#/path`).
- State is a React Context store (`src/store.tsx`) — **not persisted**: data is lost on full page reload. Do not add `localStorage` persistence without confirming intent.

## Commands (run from `frontend/`)

```bash
npm install
npm run dev        # Vite dev server on http://localhost:3000
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve built dist/
npx tsc -b         # typecheck only (no emit)
```

- **No test runner, no linter, no formatter is configured.** Don't assume `npm test` / `npm run lint` exist. Verification = `npx tsc -b` (typecheck) + `npm run build`.
- Vercel **Root Directory must be `frontend`** for deploys (see `frontend/vercel.json`).

## Architecture & flow

Wizard over 5 tabs, one page each:

| Path | Page | Role |
|------|------|------|
| `/` | `UploadPage` | Upload `.xlsx` from USS portal; sheet picker if multi-sheet |
| `/categorize` | `CategorizePage` | Assign priority to each NRC (P0/P1/P2) |
| `/process` | `ProcessPage` | Assign day to each block + set preferences → run optimizer |
| `/schedule` | `SchedulePage` | View optimized schedules |
| `/export` | `ExportPage` | Export `.ics` / CSV / Excel |

Data flow: `Excel → excelParser.ts → HorarioCrudo[] → Categorize → Process → optimizer.ts → ClaseConDia[][] → Schedule/Export`.

## Priorities semantics (critical)

- `P0` (Prioridad) = **required**. A valid schedule MUST include every P0 title. The optimizer filters combos where `incluyeTodoP0` fails — do not bypass this.
- `P1` (Opcionales) = tries to include, may be dropped on conflict.
- `P2` (Electivos) = each handled **individually** as `[...opciones, []]` (the `[]` = "skip this electivo"). At least one electivo should be represented.

## Optimizer gotchas (`src/lib/optimizer.ts`)

- Hard limit of **100k combinations** in the cartesian product. Raising it has real perf cost.
- Scoring biases toward more NRCs (`+500` each) and electivos (`+2000` per electivo title) — can give unfair advantage to schedules with electivos.
- Dedup has two stages: exact NRC-set signature, then `layoutCore` (≈90% block-similarity) keyed by `titulo|dia|hora_inicio|hora_fin`.
- Post-dedup step guarantees electivo diversity (replaces worst result to surface a missing electivo).
- Known critical bug class: schedules missing a P0 ramo — see `docs/PROJECT_HANDOFF.md` §"BUG 1".

## Docs source of truth

- **`docs/PROJECT_HANDOFF.md` is the authoritative, up-to-date doc** (architecture, types, scoring formulas, bugs).
- **`README.md` describes a LEGACY text-paste flow** (the `parser.ts` / `InputPage` flow). Current production uses Excel upload via `UploadPage` + `excelParser.ts`. `parser.ts` still exists but is legacy. Trust the handoff and the running code over the README.

## Conventions

- UI strings, labels, and user-facing copy are in **Spanish (neutral)** — match existing tone when editing UI.
- Code, identifiers, comments default to English.
- Dark theme is the default; light theme toggled via `.theme-light` class on `<html>`. Theme persists in `localStorage['theme']` only.