# Plan de implementación — Fase B (API NestJS + Auth)

> **Objetivo**: terminar la implementación de `services/api` (Fase B de PLAN_V3). Base limpia: solo scaffold (app.module, prisma, health, swagger) + `schema.prisma` completo + migración `init` + `.env.example` con placeholders. **0% del trabajo funcional hecho.**
>
> **Fecha**: 2026-08-06 · **Spec**: `docs/PLAN_V3.md` (Fases B, C, D) + `docs/PLAN_V2.md` · **Prioridad de liberación**: `docs/COLLAB_PLAN.md`
>
> **Disponible para verificación e2e**: `MICROSOFT_CLIENT_ID` + secret + cuenta `@uss.cl` de prueba.

## Alcance de Fase B (checklist PLAN_V3 §293-307)

- [x] Setup NestJS + Prisma + PostgreSQL (compose de dev) — **hecho** (base)
- [x] OAuth Microsoft + validación de dominio `*.uss.cl` + emisión de JWT
- [x] `@nestjs/swagger` configurado desde el primer endpoint (ADR-2) — **hecho** (base)
- [x] CRUDs: users, mallas, malla_cursos, user_cursos_aprobados — **hecho**
- [~] `periodos` — parcial (list/findOne/create; sin update/delete ni CRUD de `horarios_disponibles`)
- [ ] `horarios_disponibles`, `electivo_categorias` — **diferidos a Fase E** (COLLAB_PLAN no los necesita en C/D)
- [x] Guards de autenticación y de roles
- [~] Login end-to-end: Outlook → callback → JWT — **pendiente: credenciales reales + login en browser**
- [~] Login rechaza emails fuera de `*.uss.cl` — implementado; e2e pendiente
- [x] `/api/docs` muestra el spec completo generado
- [x] Migraciones Prisma reproducibles desde cero (`migrate deploy` sobre DB vacía)

## 1. Dependencias a agregar (`services/api`)

**Decisión: Opción A** (set completo). **Importante**: `openid-client` se instaló en **v5.7.1** (CJS) — la v6 es ESM-only y no compila al target CommonJS de NestJS.

- `openid-client@^5` — flujo auth-code + PKCE + issuer público del tenant USS
- `@nestjs/passport`, `passport`, `passport-jwt` + `@types/passport-jwt`
- `tsx` (devDep) — correr el Prisma seed
- `esModuleInterop: true` en `tsconfig.json` (obligatorio: sin él `import cookieParser from 'cookie-parser'` emite `.default` inexistente y crashea al boot)

Ya presentes: `@nestjs/jwt`, `cookie-parser`, `class-transformer`, `class-validator`.

## 2. Módulo Auth — lo crítico de Fase B

- `POST /api/v1/auth/microsoft/login` → URL de autorización (code_challenge PKCE + scopes `openid profile email offline_access`)
- `GET /api/v1/auth/microsoft/callback` — intercambio de code → valida dominio `@uss.cl` → busca-crea `User` por `outlookId`/`email` → emite **JWT access + refresh**
- `GET /api/v1/auth/me` — usuario actual (guard). Clave para C
- `POST /api/v1/auth/refresh` — rota el refresh (checklist de C, implementado acá)
- `JwtAuthGuard` + `RolesGuard` (roles `student`/`admin`)
- Cookie httpOnly para el refresh (el hub será el dueño; se implementa acá)

## 3. CRUDs — los 6 del checklist §300

Todos con `@ApiTags` + `@nestjs/swagger`, `@ApiBearerAuth`, detrás de guard salvo lo público:

- `users` — listar/perfil (self) + role
- `mallas` + `malla_cursos` — **lectura prioritaria** (destraba D): `GET /mallas`, `GET /mallas/:id` (curso + prerrequisitos + equivalencias)
- `user_cursos_aprobados`
- `periodos`
- `horarios_disponibles`

**Orden (COLLAB_PLAN)**: auth → `/auth/me` → mallas (lectura) → CRUDs restantes (bajo costo).

## 4. Seed mínimo

- Usuario admin + mallas 2021/2024 **básicas** para poder loguear y probar.
- La validación completa de mallas es Fase D (profe Hugo). Fuente de datos: `assets/`.

## 5. Verificación

- `pnpm --filter api run db:deploy` sobre DB vacía (migraciones reproducibles)
- `pnpm --filter api run typecheck` + `build` por slice
- **Login e2e** con cuenta `@uss.cl`: login → callback → me → refresh
- **Rechazo** de email fuera de `*.uss.cl` (checklist)
- `/api/docs` con el spec completo

## Pendiente para e2e real

- Completar en `services/api/.env` (el dev no debe duplicar credenciales): `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET` reales (hoy placeholder `REEMPLAZA_ME`). El resto de la config (tenant, redirect, JWT secrets dev, success redirect) ya está.
- Login en browser con cuenta `@uss.cl`: `/auth/microsoft/login` → redirige a Microsoft → callback → `/auth/me`.

## Notas de riesgo

- El punto con mayor riesgo de bug es el **flujo OAuth callback → intercambio de token → refresh en cookie** (PLAN_V3 §4.3). La verificación e2e requiere las credenciales reales + login en browser.
- Repo sin test runner/linter/formatter: la verificación se apoyó en typecheck + build + **prueba HTTP manual** con JWT firmado (guard, roles, CRUD y detalle de malla validados). Queda la validación del flujo browser con las credenciales reales.