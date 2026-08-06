# USS Apps — Ecosistema UniHorario

Monorepo de las aplicaciones para estudiantes de la **Universidad San Sebastián**. Hoy contiene **UniHorario** (optimizador de horarios académicos); la plataforma crece hacia un hub central con login Outlook, API única y más apps (ver `docs/PLAN_V3.md`).

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=for-the-badge&logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)

---

## 📁 Estructura

```
uss-apps/
├── apps/
│   └── horarios/        # UniHorario — optimizador de horarios (React 19 + Vite)
├── services/            # Backend (API NestJS — llega en Fase B)
├── packages/            # Librerías internas TS
├── docs/                # Specs y planes del ecosistema
└── assets/              # Excels de prueba, PDF de malla, scripts
```

## 🚀 Desarrollo

Requisitos: Node 20+ y pnpm 9+.

```bash
pnpm install                      # instala todo el workspace
pnpm --filter horarios run dev    # levanta UniHorario en http://localhost:3000
pnpm build                        # build de todo vía turbo
```

## 📚 Documentación

| Doc | Qué es |
|-----|--------|
| `docs/PLAN_V3.md` | **Spec de plataforma** — arquitectura del ecosistema, ADRs, estándares de apps, fases A–F |
| `docs/PLAN_V2.md` | **Spec funcional** — features v2/v3 (malla interactiva, prioridades automáticas, admin panel, DB) |
| `docs/PROJECT_HANDOFF.md` | Documentación del código v1 (arquitectura, tipos, fórmulas de scoring, bugs) |
| `apps/horarios/README.md` | La app UniHorario en detalle |

---

*Desarrollado para optimizar la vida académica de los Sebastianos.*
