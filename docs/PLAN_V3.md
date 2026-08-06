# UniHorario USS v3 — Plan Maestro: Ecosistema `uss-apps`

> **Estado**: Aprobado en diseño — pendiente de ejecución (Fase A)
> **Última actualización**: 2026-08-06
> **Relación con otros docs**: `PLAN_V2.md` sigue siendo la **spec funcional** de features (malla interactiva, prioridad automática, admin panel, esquema de DB). Este documento es la **spec de plataforma**: cómo se organizan, comunican, autentican y despliegan las aplicaciones. `PROJECT_HANDOFF.md` describe el v1 actual.

**En un párrafo**: UniHorario deja de ser una app aislada y pasa a ser parte de un ecosistema de aplicaciones USS detrás de un hub central (login + dashboard). Todas las apps viven en un **monorepo**, hablan con **un solo API NestJS** (única dueña de la base de datos) mediante **contratos OpenAPI**, y se autentican con **Outlook (@*.uss.cl)** vía JWT. Cualquier app futura —incluso en otro stack, como Godot— entra por HTTP sin tocar nada existente.

---

## 1. Decisiones de arquitectura (ADRs)

Estas son las decisiones tomadas. Cada una incluye el POR QUÉ — no las cambies sin reabrir la discusión completa.

| # | Decisión | Alternativa descartada | Motivo principal |
|---|----------|------------------------|------------------|
| ADR-1 | **Monorepo** (pnpm workspaces + turbo) | Multi-repo + GHCR | Solo dev: el tooling extra no compra nada; la independencia viene de los límites HTTP, no de la cantidad de repos |
| ADR-2 | **Contrato = OpenAPI** generado por el API | Paquete TS compartido como fuente de verdad | Desacopla el stack: apps no-TS (Godot) consumen el mismo contrato por HTTP |
| ADR-3 | **DB con un solo dueño**: el API NestJS | DB compartida entre apps | Anti-patrón integration database: acoplamiento por schema, sin ownership, cambios que rompen apps silenciosamente |
| ADR-4 | **Auth centralizada en el hub** (OAuth Microsoft → JWT) | Auth por app | SSO: un solo login, las apps solo adjuntan el token |
| ADR-5 | **Migración con historia** (`git filter-repo`) | Arranque limpio | Conserva blame y log completos bajo `apps/horarios/` |
| ADR-6 | **Módulos NestJS = límites de dominio** (monolito modular) | Microservicios | A esta escala, microservicios cobran 90% del costo por 10% del beneficio. Si un módulo escala de verdad, se extrae después con SU propia DB |

### ADR-1: Monorepo

**Contexto**: Se evaluó multi-repo (un repo por app + repo paraguas de deploy). El usuario prefiere trabajar independiente por app y contempla apps en otros stacks.

**Decisión**: Monorepo único (`uss-apps`). La independencia de trabajo se logra con límites de carpetas + CI por paths afectados, no con repos separados.

**Consecuencias**:
- Cambios cross-app (endpoint + consumidor) = 1 commit atómico.
- Tipos TS compartidos por conveniencia (`packages/shared-types`), pero NUNCA como fuente de verdad del contrato (ver ADR-2).
- Si una app futura necesita su propio repo, se extrae con fricción mínima porque el límite siempre fue HTTP (puerta de doble sentido).

### ADR-2: El contrato vive en OpenAPI

**Regla de oro**: la fuente de verdad de los contratos entre apps y el API es el documento **OpenAPI** que genera el API (`@nestjs/swagger`). No es un `.ts` compartido, no es la DB, no es documentación escrita a mano.

- Apps TypeScript: code-generan su cliente (`openapi-typescript`) en prebuild.
- Apps no-TypeScript (Godot, Python, lo que sea): cliente HTTP fino escrito a mano (pocos endpoints, ver §7.3).
- `packages/shared-types` existe SOLO como conveniencia interna TS (enums, utilidades). Si contradice al OpenAPI, el OpenAPI gana.

### ADR-3: Una tabla, un dueño

**Regla de oro**: cada tabla de la DB tiene exactamente UN módulo dueño. Nadie más la toca — ni otras apps, ni otros módulos por SQL, ni scripts manuales en prod.

- Los datos fluyen por HTTP (o internamente por servicios NestJS entre módulos), nunca por tablas compartidas.
- El schema SÍ cambia en producción — para eso están las migraciones Prisma. Lo que permanece estable es el **contrato de la API**, que es el firewall detrás del cual el schema es un detalle de implementación.

### ADR-4: Auth centralizada

- El **hub** es el único lugar donde ocurre el login (OAuth 2.0 con Microsoft).
- El API valida el dominio (`@*.uss.cl`), crea el usuario si no existe, y emite un **JWT firmado**.
- Las apps **no interpretan el registro ni validan firmas**: adjuntan el JWT en `Authorization: Bearer` y el API lo valida. Si una app no tiene sesión válida → redirige al hub.

### ADR-6: Monolito modular, extracción futura

El API es UN proceso NestJS con módulos por dominio. Extraer un módulo a microservicio es una decisión que se toma **con evidencia de escala real**, no de entrada. Criterio para extraer: carga medible que lo justifique + equipo que lo mantenga.

---

## 2. Estructura del monorepo

```
uss-apps/                          ← repo NUEVO (nombre final a confirmar al crearlo)
├── apps/
│   ├── horarios/                  ← UniHorario (migrado desde frontend/ del repo v1)
│   ├── hub/                       ← Login Outlook + dashboard + menú de apps  [Fase C]
│   └── malla/                     ← Malla curricular interactiva              [Fase D]
├── services/
│   └── api/                       ← NestJS + Prisma + PostgreSQL — ÚNICO dueño de la DB
│       └── src/modules/
│           ├── auth/              ← OAuth Microsoft, emisión y validación de JWT
│           ├── users/             ← users, roles
│           ├── malla/             ← mallas, cursos, prerrequisitos, aprobados, equivalencias
│           └── scheduler/         ← periodos, horarios_disponibles, electivos, optimizer
├── packages/
│   └── shared-types/              ← conveniencia TS únicamente (ver ADR-2)
├── docs/                          ← PLAN_V2.md, PLAN_V3.md, PROJECT_HANDOFF.md
├── assets/                        ← excels de prueba, PDF de malla, scripts de export
├── docker-compose.yml             ← [Fase F] postgres + api + caddy (frontends estáticos)
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                   ← root, private, scripts orquestadores
├── AGENTS.md
└── README.md
```

**Reglas de la estructura**:
- Toda app nueva va en `apps/<nombre>/`. Todo servicio backend en `services/<nombre>/` (hoy solo `api`).
- Las apps NUNCA importan código de `services/`. Los servicios NUNCA importan de `apps/`.
- `packages/` solo contiene librerías internas consumidas vía `pnpm workspace:*`.

---

## 3. Estándares de aplicaciones

Esta sección es la **ley para cualquier app del ecosistema**, presente o futura. Una app que no cumple el checklist no se mergea.

### 3.1 Checklist obligatorio de toda app

- [ ] Vive en `apps/<nombre>/` dentro del monorepo
- [ ] **Nunca** se conecta a PostgreSQL directamente (ni aunque "sea solo lectura")
- [ ] Consume el API mediante cliente generado desde OpenAPI (TS) o cliente HTTP fino (otros stacks)
- [ ] Auth: si no hay JWT válido, redirige al hub. Nunca implementa login propio
- [ ] Envía el JWT en header `Authorization: Bearer <token>` en toda request
- [ ] Maneja el `401` del API → limpia sesión local y redirige al hub
- [ ] UI en español neutro; tema dark por defecto (`.theme-light` para claro)
- [ ] Build reproducible desde la raíz: `pnpm build` la incluye vía turbo
- [ ] `README.md` propio con: qué hace, cómo correrla en dev, qué endpoints consume

### 3.2 Stack estándar de apps web

| Capa | Estándar | Notas |
|------|----------|-------|
| Framework | React 19 + TypeScript + Vite | Mismo que v1 |
| Estilos | Tailwind CSS 3 | Misma config base que `apps/horarios` |
| Routing | `react-router-dom` con **HashRouter** | Deep links `#/path` (compatibilidad con hosting estático) |
| Estado | React Context store local | No persistir en `localStorage` salvo tema; confirmar antes de agregar persistencia |
| Animaciones | framer-motion | Opcional, según la app |
| i18n | UI en español neutro; código e identificadores en inglés | Convención existente del proyecto |

### 3.3 Receta: agregar una app nueva al ecosistema

```bash
# 1. Crear la app (ejemplo: apps/reportes)
pnpm create vite apps/reportes --template react-ts

# 2. El workspace la detecta por glob (apps/*) — no hay nada que registrar en pnpm

# 3. Generar el cliente del API (ver §5)
pnpm --filter reportes run codegen   # openapi-typescript → src/lib/api-client.ts

# 4. Envolver el árbol con el AuthGate estándar (redirige al hub sin sesión)

# 5. Registrar la app en el menú del hub (apps/hub/src/registry.ts)
```

Turbo la incluye automáticamente en `pnpm build` / `pnpm dev` al detectar el `package.json`.

### 3.4 Apps en otros stacks (caso Godot)

Godot es el caso de prueba del ADR-2: entra por HTTP como cualquier cliente, sin codegen.

- **HTTP**: nodo `HTTPRequest` + `JSON.parse_string()` nativo de GDScript.
- **Cliente**: `ApiClient.gd` escrito a mano con los pocos endpoints que necesite (`get_malla()`, `get_progreso()`, etc.). No existe codegen OpenAPI→GDScript y NO hace falta a esta escala.
- **Auth**: OAuth de Microsoft requiere browser, así que se usa el patrón **device code** (tipo "vincular TV"):
  1. El juego pide `POST /auth/device` → recibe `code` corto + URL
  2. El usuario entra a la URL en su browser, se loguea en el hub, ingresa el código
  3. El juego hace polling a `POST /auth/device/poll` hasta recibir su JWT
- **Ubicación**: puede vivir en `apps/juego/` (Godot no necesita pnpm; queda fuera del pipeline turbo) o extraerse a repo propio después. Decisión reversible, no bloquea nada.
- **Detalle a resolver en su fase**: CORS del API para exports web de Godot, y almacenamiento seguro del token en desktop/mobile.

---

## 4. El API (`services/api`)

### 4.1 Módulos y ownership de tablas

| Módulo | Tablas que posee | Responsabilidad |
|--------|------------------|-----------------|
| `auth` | (ninguna propia; lee `users`) | OAuth Microsoft, validación de dominio, emisión/validación de JWT |
| `users` | `users` | Perfil, roles (`student`/`admin`), `malla_id` del usuario |
| `malla` | `mallas`, `malla_cursos`, `malla_prerrequisitos`, `user_cursos_aprobados`, `cursos_equivalentes` | Malla interactiva, progreso, prerrequisitos |
| `scheduler` | `periodos`, `horarios_disponibles`, `electivo_categorias` | Excel del período, optimizer, prioridades automáticas |

El esquema detallado de tablas está en `PLAN_V2.md` §3 — no se duplica acá.

### 4.2 Stack y configuración

- **NestJS + Prisma + PostgreSQL** (decisión ya tomada en PLAN_V2 §14).
- **`@nestjs/swagger`** desde el PRIMER endpoint: el documento OpenAPI se genera en `/api/docs` y el spec JSON en `/api/docs-json`. No es opcional — es el contrato (ADR-2).
- **Prefijo de versión**: todas las rutas bajo `/api/v1/`. Regla de evolución:
  - Cambios aditivos (nuevo campo, nuevo endpoint) → OK dentro de `v1`.
  - Cambios breaking (renombrar, eliminar, cambiar tipo) → `/api/v2/`, mantener `v1` hasta migrar consumidores.
- **Validación**: `class-validator` en todos los DTOs — el spec OpenAPI se deriva de ellos, así que DTO mal anotado = contrato mal publicado.

### 4.3 Autenticación (detalle de flujos)

**Flujo web (hub y apps web)**:

```
App sin sesión → redirect al hub
Hub → "Iniciar sesión con Outlook" → Microsoft OAuth authorize
Microsoft → callback al API: GET /api/v1/auth/microsoft/callback?code=...
API valida:
  1. Intercambia code por tokens con Microsoft
  2. Email matchea /^[^@]+@([a-z0-9-]+\.)*uss\.cl$/i   ← cubre @uss.cl, @alu.uss.cl, etc.
  3. Si el email no existe en users → crea cuenta (role='student')
API → emite JWT propio (access 1h) + refresh token (7 días, cookie httpOnly)
Hub → guarda el access token en memoria/storage y lo entrega a las apps vía redirect con token fragment
App → adjunta Authorization: Bearer en cada request al API
```

**Reglas**:
- Las apps NO renuevan tokens por sí mismas: el refresh vive en el hub (único con la cookie). Token expirado → vuelta al hub.
- El API valida firma + expiración + dominio del email en CADA request (guard global de NestJS).
- El `role` va como claim del JWT; los guards de admin verifican `role === 'admin'`.

**Flujo dispositivo (Godot, futuro)**: ver §3.4.

---

## 5. Contratos y codegen

```
services/api (NestJS + @nestjs/swagger)
      │  genera
      ▼
openapi.json  ────────────┬────────────────────────────┐
      │                   │                            │
      ▼                   ▼                            ▼
openapi-typescript   cliente a mano (GDScript)    docs humanos (/api/docs)
(src/lib/api-client.ts en cada app TS)
```

- Cada app TS tiene script `"codegen": "openapi-typescript http://localhost:3001/api/docs-json -o src/lib/api-client.ts"` (URL parametrizable por env).
- El codegen corre en `prebuild` y en `predev` — el cliente NUNCA se edita a mano (archivo generado, marcado con header `// AUTO-GENERATED — do not edit`).
- En CI: el build del API falla si el spec cambió y los consumidores no se regeneraron (check de drift).

---

## 6. Infraestructura y deploy

### 6.1 Entornos

| Entorno | Frontends | API | DB |
|---------|-----------|-----|-----|
| Dev local | `pnpm dev` (Vite, puertos 3000+) | `pnpm dev` (puerto 3001) | Postgres en docker-compose |
| Producción | Archivos estáticos servidos por Caddy en el VPS | Contenedor en el VPS | Postgres en el VPS (volumen persistente) |

**Transición**: mientras el VPS no esté listo, `apps/horarios` sigue deployando en Vercel (Root Directory: `apps/horarios`) y el API puede ir en Neon/Railway como contempla PLAN_V2.

### 6.2 Docker Compose de producción (Fase F)

```yaml
# docker-compose.yml (raíz del monorepo) — sketch de referencia
services:
  postgres:
    image: postgres:16
    volumes: [ "pgdata:/var/lib/postgresql/data" ]
    env_file: .env

  api:
    build: ./services/api
    env_file: .env
    depends_on: [ postgres ]
    # corre `prisma migrate deploy` en el entrypoint

  caddy:
    build: ./deploy/caddy        # sirve los builds estáticos de apps/* + proxy /api → api:3001
    ports: [ "80:80", "443:443" ]
    volumes: [ "./apps/hub/dist:/srv/hub", "./apps/horarios/dist:/srv/horarios" ]

volumes:
  pgdata:
```

- Un solo `docker compose up --build` desde la raíz levanta todo el ecosistema.
- El routing por dominio/subdominio (ej: `hub.dominio.cl`, `horarios.dominio.cl`) vive en el `Caddyfile` de `deploy/caddy/`.
- Los secretos (credenciales Microsoft, `DATABASE_URL`, `JWT_SECRET`) van en `.env` del VPS, NUNCA commiteados.

---

## 7. Fases de implementación

Dependencias: **A → B → C → D → E → F**. Cada fase tiene su checklist de verificación — no se da por terminada sin pasarlo completo.

### Fase A: Migración al monorepo ⏳ PRIMERA EN EJECUTAR

**Objetivo**: Mover el v1 al repo nuevo con historia intacta. CERO cambios funcionales.

1. Crear repo nuevo vacío en GitHub (nombre final a definir; sugerencia: `uss-apps`)
2. Clonar el repo actual a un directorio temporal limpio
3. Instalar `git-filter-repo` (`pipx install git-filter-repo`)
4. Reescribir la historia: `git filter-repo --path-rename frontend/:apps/horarios/`
   - Resultado: todo el log queda como si la app SIEMPRE hubiera vivido en `apps/horarios/`
   - Nota: filter-repo remueve el remote `origin` por seguridad → re-agregar apuntando al repo nuevo
5. Reorganizar (commit nuevo): excels/PDF/scripts de export → `assets/`; `docs/` queda en raíz
6. Setup de workspace: `pnpm-workspace.yaml` (`apps/*`, `services/*`, `packages/*`), `turbo.json` (pipeline `build`/`dev`/`typecheck`), `package.json` root private con scripts orquestadores
7. Actualizar: `AGENTS.md` (paths y comandos nuevos), `README.md` (reescrito para el ecosistema), `frontend/vercel.json` → Root Directory `apps/horarios`
8. Push al repo nuevo; reconfigurar Vercel; archivar el repo viejo como read-only

**Checklist de verificación Fase A**:
- [ ] `git log --oneline` en el repo nuevo muestra la historia completa del v1
- [ ] `git blame` funciona sobre archivos en `apps/horarios/`
- [ ] `pnpm install` desde la raíz instala todo el workspace
- [ ] `pnpm --filter horarios run build` pasa (equivale al `npm run build` actual)
- [ ] `npx tsc -b` en `apps/horarios` pasa
- [ ] Vercel despliega `apps/horarios` correctamente
- [ ] El repo viejo queda archivado (read-only) en GitHub

### Fase B: API NestJS + Auth

**Objetivo**: `services/api` funcional con auth y CRUDs base. Equivale a Fase 1 de PLAN_V2.

- Setup NestJS + Prisma + PostgreSQL (compose de dev)
- OAuth Microsoft + validación de dominio `uss.cl` + emisión de JWT
- `@nestjs/swagger` configurado desde el primer endpoint (ADR-2)
- CRUDs: users, mallas, malla_cursos, user_cursos_aprobados, periodos, horarios_disponibles
- Guards de autenticación y de roles

**Checklist Fase B**:
- [ ] Login end-to-end: Outlook → callback → JWT
- [ ] Login rechaza emails fuera de `*.uss.cl`
- [ ] `/api/docs` muestra el spec completo generado
- [ ] Migraciones Prisma reproducibles desde cero (`migrate deploy` sobre DB vacía)

### Fase C: Hub mínimo

**Objetivo**: `apps/hub` con login, dashboard y menú de apps. Al inicio es deliberadamente simple.

- Pantalla de login (botón Microsoft)
- Dashboard: datos del usuario + cards de apps disponibles (registry estático `apps/hub/src/registry.ts`)
- Manejo del refresh token (única app con cookie httpOnly)
- Redirect de retorno: apps sin sesión → hub → vuelta a la app de origen con token

**Checklist Fase C**:
- [ ] Flujo completo: app sin sesión → hub → login → app con JWT funcional
- [ ] El menú lista `horarios` y enlaza correctamente

### Fase D: Malla interactiva + prioridad automática

**Objetivo**: `apps/malla` + lógica de prioridades del backend. Equivale a Fases 0, 2 y 3 de PLAN_V2 — la spec funcional (estados visuales, algoritmo `calcularPrioridades`, matching Excel↔Malla, equivalencias) está ahí y NO se duplica acá.

**Checklist Fase D**:
- [ ] Seed de mallas 2021 y 2024 validado con el profe Hugo
- [ ] Malla interactiva con los 5 estados visuales de PLAN_V2 §6
- [ ] `GET /api/v1/optimizer/prioridades` responde según PLAN_V2 §10

### Fase E: Admin panel + integración optimizer

Equivale a Fases 4 y 5 de PLAN_V2: upload de Excel por admin, etiquetado de electivos, mapeo manual de no-matcheados, conexión del optimizer con prioridades automáticas, eliminación del CategorizePage manual.

### Fase F: Deploy VPS

**Objetivo**: todo el ecosistema en el VPS con `docker compose up --build`.

- `Dockerfile` del API + entrypoint con `prisma migrate deploy`
- Builds estáticos de las apps + Caddy (routing + TLS)
- `.env` de producción en el VPS (fuera del repo)
- Apagar el deploy de Vercel cuando el VPS esté estable

### Futuro (post-v3)

- `apps/juego` en Godot (§3.4) — auth device code + cliente HTTP fino
- Extracción de módulo a microservicio SOLO con evidencia de escala (ADR-6)
- Notificaciones de nuevos períodos, dashboard de stats para admin (PLAN_V2 §11 Fase 6)

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| `git filter-repo` corrompe o pierde historia | Baja | Alto | Trabajar sobre un clon; el repo original NO se toca hasta verificar el checklist de Fase A |
| Drift entre OpenAPI y clientes generados | Media | Medio | Codegen en `prebuild` + check de drift en CI (§5) |
| Una app futura "ataja" y pega directo a la DB | Baja | Crítico | La DB no es alcanzable desde fuera del compose (sin puerto expuesto en prod); checklist §3.1 en review |
| El scope v2+v3 crece demasiado para un solo dev | Alta | Alto | Las fases son entregables independientes; PLAN_V2 ya estimó duraciones por fase |
| OAuth Microsoft complejo | Media | Alto | `@azure/msal-node` o Passport (ya identificado en PLAN_V2 §13) |

Los riesgos funcionales del v2 (matching Excel↔Malla, seed de mallas, etc.) están en PLAN_V2 §13 y siguen aplicando.

---

## 9. Comandos de referencia

```bash
# Desarrollo
pnpm install                        # instala todo el workspace
pnpm dev                            # turbo: levanta apps + api en paralelo
pnpm --filter horarios run dev      # solo una app
pnpm --filter api run dev           # solo el API

# Verificación (equivale al estándar del v1)
pnpm --filter horarios exec tsc -b  # typecheck
pnpm build                          # build de todo vía turbo

# Codegen de contratos
pnpm --filter horarios run codegen  # regenera cliente desde openapi.json

# Migración (one-time, Fase A)
pipx install git-filter-repo
git clone <repo-v1> /tmp/migracion && cd /tmp/migracion
git filter-repo --path-rename frontend/:apps/horarios/
git remote add origin <repo-nuevo> && git push -u origin main
```

---

*Este documento es vivo. Se actualiza conforme avanzan las fases y se toman decisiones nuevas (con su ADR correspondiente en §1).*
