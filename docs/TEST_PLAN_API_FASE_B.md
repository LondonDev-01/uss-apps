# Plan de testeo — Fase B (services/api)

> **Objetivo**: validar que la API NestJS de Fase B funciona end-to-end y que los fixes H1–H8 (ver `docs/REVIEW_API_FASE_B.md`) corrigen los hallazgos.
>
> **Fecha**: 2026-08-07 · **Spec funcional**: `docs/PLAN_V2.md` §3 · **Spec plataforma**: `docs/PLAN_V3.md` (Fase B–D).
>
> **Runner**: vos — tenés las credenciales de OAuth reales y la cuenta `@uss.cl`. El plan separa lo **automático** (curl con JWT firmado) de lo **e2e browser** (OAuth).
>
> **Compromiso**: al terminar, llenar la matriz de cierre (sección 7) con estado pass/fail. Ese resultado se anexa al commit de docs o se reporta en revisión.

---

## 1. Prerrequisitos

Antes de cualquier test, el entorno tiene que estar así:

| # | Requisito | Comando / nota |
|---|-----------|----------------|
| R1 | Postgres dev arriba (localhost:5435) | `docker compose up -d postgres` en la raíz |
| R2 | Migraciones aplicadas | `pnpm --filter api run db:migrate` (o `db:deploy` sobre DB vacía) |
| R3 | Prisma Client al día | `pnpm --filter api run generate` |
| R4 | `.env` completo | copiar `services/api/.env.example` y llenar `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` reales |
| R5 | API compilada | `pnpm --filter api run build` |
| R6 | API levantada | `node services/api/dist/main.js` (boot a `localhost:3001`) |
| R7 | Seed corrido | `pnpm --filter api run db:seed` (mallas 2021/2024 + admin) |

> La DB en dev sí tiene credenciales y datos de prueba. No ejecutar `db:reset` salvo que el paso del test lo pida.

---

## 2. Nivel 0 — Sanidad (smoke)

Debería pasar en 1 minuto. Si falla acá, no seguir.

| ID | Test | Comando | Esperado |
|----|------|---------|----------|
| S1 | Health check público | `curl -s http://localhost:3001/api/v1/health` | `{"status":"ok"}` y NO requiere token |
| S2 | OpenAPI accesible | abrir `http://localhost:3001/api/docs` en el browser | Swagger UI renderiza, sin error, con tags auth/users/mallas/aprobados/periodos |
| S3 | health sin token | `curl -s http://localhost:3001/api/v1/health` | 200 (comprueba que `@Public()` lo excluye del guard) |
| S4 | endpoint protegido sin token | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/users` | `401` (el guard global exige JWT) |

---

## 3. Nivel 1 — Auth por HTTP sin OAuth (JWT firmado a mano)

Para el `auth` no se necesita OAuth para la mayoría de los tests: se firma un JWT HS256 con el **mismo `JWT_SECRET` de dev** que usa la API. Solo así se validan guards + roles + dominio sin depender del login de Microsoft.

**Setup (una vez)**: NO se necesita exportar nada. El repo incluye un helper que lee `JWT_SECRET` del `.env` y firma el token en un solo comando:

```bash
# desde la raíz del repo
STUDENT=$(node scripts/sign-jwt.mjs 3a3b0a6e-0000-4000-8000-000000000001 alumno1@uss.cl student Alumno 2024)
ADMIN=$(node scripts/sign-jwt.mjs 3a3b0a6e-0000-4000-8000-000000000001 admin@uss.cl admin Admin -)
```

> Args: `<sub> <email> <role> <name> [mallaId]`. El `sub` debe ser un **UUID válido** (`ParseUUIDPipe` en `GET /users/:id`), aunque el usuario no exista en la DB. Usar `-` como `mallaId` para `null`.
>
> 💡 Si al firmar sale token pero el endpoint da `401`, revisar que **no se corrió el export de un `JWT_SECRET` distinto**: el script usa el `.env` de `services/api`; cualquier variable `JWT_SECRET` ya exportada en tu shell lo pisa (ver sección 8).

### Matriz por Hallazgo

| ID | Regresión | Test | Esperado |
|----|-----------|------|----------|
| T-H1a | **H1** — solo admin lee perfiles | `curl -H "Authorization: Bearer $STUDENT" http://localhost:3001/api/v1/users/<uuid>` | **403** (antes: 200 → filtraba perfiles ajenos) |
| T-H1b | **H1** — admin sí puede | `curl -H "Authorization: Bearer $ADMIN" http://localhost:3001/api/v1/users/<uuid>` | **404** si el user no existe, o **200** si existe (pero no 403) |
| T-H1c | **H1** — sin token | `curl http://localhost:3001/api/v1/users/<uuid>` | 401 |
| T-H2 | **H2** — `/auth/me` completo | `curl -H "Authorization: Bearer $STUDENT" http://localhost:3001/api/v1/auth/me` | JSON con `name`, `mallaId`, `email`, `role` |
| T-H4a | **H4** — dominio válido pasa | token con `email: alumno1@uss.cl` | 200 (pasa el guard) |
| T-H4b | **H4** — dominio ajeno rechazado | firmar con `email: hacker@gmail.com` → `curl http://localhost:3001/api/v1/auth/me` | 401 con mensaje de dominio |
| T-H4c | **H4** — sin email | firmar sin `email` → `/auth/me` | 401 |
| T-R1 | **roles** — student no ve periodos de admin | (si hay un endpoint admin-only además de users) | 403 si existe, 404 si no hay ruta 📝 |

---

## 4. Nivel 2 — CRUDs por módulo (a mano, sin OAuth)

### 4.1 Mallas (lectura — destraba fase D)

| ID | Test | Comando | Esperando |
|----|------|---------|----------|
| M1 | listar mallas | `curl -H "Authorization: Bearer $ADMIN" http://localhost:3001/api/v1/mallas` | array con mallas seed 2021/2024 |
| M2 | malla por id | `curl .../mallas/2024` | detalle 2024 con cursos |
| M3 | curso con prerrequisitos | `curl .../mallas/2024/cursos/2024-PRG101` | incluye prerrequisitos |
| M4 | malla inexistente | `curl .../mallas/noexiste` | 404 |
| M5 | sin token | `curl .../mallas` | 401 |

### 4.2 Aprobados (propios del usuario — H5)

| ID | Test | Comando | Esperando |
|----|------|---------|----------|
| P1 | listar aprobados | `curl -H "Authorization: Bearer $STUDENT" .../aprobados/me` | 200 (array, originalmente vacío) |
| P2 | marcar aprobado | `POST .../aprobados/me/2024-PRG101` body `{}` | 201/200, crea relación |
| P3 | desmarcar | `DELETE .../aprobados/me/2024-PRG101` | 200 |
| P4 | **H5** — borrar curso inexistent | `DELETE .../aprobados/me/curso-no-existe` | **404** (antes 500) |
| P5 | **H5** — upsert sobre curso inexist | `POST .../aprobados/me/curso-no-existe` | **404** (antes 401) |
| P6 | idempotencia | marcar 2 veces el mismo curso | no duplica (upsert) |

### 4.3 Periodos (scheduler — parcial, Fase E)

| ID | Test | Comando | Esperando |
|----|------|---------|----------|
| C1 | listar | `curl -H "Authorization: Bearer $STUDENT" .../periodos` | 200 |
| C2 | crear | `POST .../periodos` body `{"nombre":"2026-2"}` | 201 y `id` |
| C3 | detalle | `GET .../periodos/<id>` | 200 con el creado |
| C4 | `horarios_disponibles`/`electivo_categorias` | probar un GET | **404** ruta (diferido a Fase E — no es un bug) 📝 |

---

## 5. Nivel 3 — Auth OAuth end-to-end (browser, con credenciales reales)

Este es el único que requiere el flujo real con Microsoft. H8 se confirma además en la DB.

**Flujo**:
1. Copiar `.env.example` → `.env`, llenar `MICROSOFT_CLIENT_ID` + secret reales (en `.env` NO se commitez).
2. `pnpm --filter api run build` + correr la API.
3. Abrir en browser: `http://localhost:3001/api/v1/auth/microsoft/login`
4. Loginear con la cuenta `@uss.cl` (puede pedir consentimiento).
5. **Esperado**: redirecciona a `http://localhost:3000/#access_token=...` (token en **fragment**, no query — H7).
6. Probar con un email fuera de `@uss.cl` → **debe rechazar** con mensaje de dominio.

### Tests del flujo

| ID | Test | Esperado |
|----|------|---------|
| O1 | login inicia el redirect a Microsoft | 302 → login.microsoftonline |
| O2 | callback correcto → landing con token | URL `#access_token=...` (fragment) |
| O3 | **H7**: token NO va en query `?` | en la URL de destino solo `#`, nada después de `?` |
| O4 | cookie `uss_refresh` set (httpOnly) | DevTools → Application → Cookies |
| O5 | `POST /auth/refresh` con cookie válida | devuelve `accessToken` nuevo + cookie ROTA (ver O6) |
| O6 | **H3**: rotación — reutilizar el refresh OLD | una vez usado, llamar con el mismo → 401 (revocado por reuso) |
| O7 | email fuera de `*.uss.cl` | rechazo (mensaje dominio) |
| O8 | `/auth/me` tras refrescar | sigue con los mismos `email`/`role` (identidad estable) |

### Verificación de la rotación en DB (H3)

Tras O5/O6, inspeccionar:

```sql
SELECT jti, "userId", "expiresAt", "revokedAt" FROM refresh_tokens ORDER BY "createdAt" DESC;
```

- El token usado en O5 debe tener `revokedAt` NOT NULL (rotado).
- El reutilizado en O6 debe haber sido **rechazado** y su fila quedar marcada.

---

## 6. Nivel 4 — Configuración y reproducción (H8 y build)

| ID | Test | Esperado |
|----|------|---------|
| H8a | **default de DB** — insertar `User` vía raw SQL sin `updated_at` | `updated_at` queda con `now()` (no NULL/colapsado) |
| H8b | migraciones desde cero | `db`reset` de la DB + `prisma migrate deploy` → schema al día (sin errores) |
| H9 | seed idempotente | correr `db:seed` 2 veces | no duplica mallas/cursos (±0 inserts) |
| H10 | build exitoso | `pnpm --filter api run build` + `typecheck` | exit 0, sin errores TS |

---

## 7. Matriz de cierre (completar al final)

| ID | Hallazgo/feature | Resultado (PASS / FAIL) | Notas |
|----|------------------|------------------------|-------|
| S1–S4 | Sanidad | — | |
| A1a | H1 student block 403 | — | |
| A1b | H1 admin 200/404 | — | |
| A1c | H1 sin token 401 | — | |
| A2 | H2 `/auth/me` completo | — | |
| A4a/b/c | H4 dominio | — | |
| M1–M5 | mallas | — | |
| P1–P6 | aprobados (H5) | — | |
| C1–C4 | periodos | — | |
| O1–O8 | OAuth e2e (H3/H7) | — | requiere credentials real |
| H8–H10 | config/seed | — | |

**Cierre**: al completar, registrar el resultado en este archivo y/o en el commit de docs.

---

## 8. Notas

- La DB de `services/api/.env` trae secretos de dev que ya figuran en `.env.example` (de propósito, para que el flujo se pueda probar). 🚨 **No commitear `.env` real. Solo se commitea `.env.example`.** (`.env` ya está en `.gitignore` de la raíz).
- `export` en bash/zsh **no imprime nada**: si un comando con `export SEC=$(...)` "no devuelve nada", es normal. Verificá con `echo "${#SEC}"`. Para no sufrir esto, el test usa `scripts/sign-jwt.mjs` que lee el secret él solo (no depende de variables de tu shell).
- Si `scripts/sign-jwt.mjs` firma con el secret correcto pero el endpoint responde `401`, revisá que tu shell no tenga un `JWT_SECRET` viejo exportado (el script prioriza `process.env.JWT_SECRET` sobre el `.env`).
- `horarios_disponibles` y `electivo_categorias` **no tienen endpoint aún** (diferido Fase E) — C4 espera 404 (ruta inexistente).
- Compatibilidad de mensaje: `401` para usuario autenticado con dominio inválido (H4) y `401` para refresh revocado (H3) son la semántica elegida en el fix.