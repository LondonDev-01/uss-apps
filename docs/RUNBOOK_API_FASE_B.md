# RUNBOOK — Fase B: services/api

> **Para qué sirve**: activar la DB de dev, correr el backend, y ejecutar todos los tests de la Fase B en orden. Lo usa tanto el dev principal como el compañero que arranca la Fase C (hub).
>
> **Spec**: `docs/PLAN_V3.md` (Fase B) · **Tests detallados**: `docs/TEST_PLAN_API_FASE_B.md` · **Auditoría previa**: `docs/REVIEW_API_FASE_B.md`.
>
> Requisitos: Node ≥20, pnpm ≥9, Docker con compose. Puertos: **5435** (Postgres) y **3001** (API).

---

## 0. Estado de referencia (qué debería haber)

- `.env` en `services/api/.env` con credenciales reales (ya cargadas). **No se commitea** (está en `.gitignore`).
- Migraciones: `add_refresh_tokens_and_updated_at_default` + `init` (2 en total).
- Secciones que dependen de tu cuenta `@uss.cl` están marcadas con 🔴 (solo vos).

---

## 1. Activar la DB (si no está funcional)

### 1.1 Chequear
```bash
docker ps --filter "name=uss-apps-db"
nc -z 127.0.0.1 5435 && echo "puerto OK" || echo "puerto cerrado"
```

### 1.2 Levantar (si está apagada / no existe)
```bash
docker compose up -d postgres     # desde la raíz del repo
docker compose ps --filter name=uss-apps-db
```

### 1.3 Diagnóstico si el puerto no responde
```bash
docker compose logs postgres --tail 50
lsof -i :5435                      # confirmar que nada más ocupa el puerto
```

### 1.4 Si arranca en loop / falla
```bash
docker compose down && docker compose up -d          # recrea el contenedor (preserva el volumen pgdata)
# ⚠️ SOLO si querés tirar los datos de dev desde cero:
#   docker compose down -v && docker compose up -d   # -v BORRA el volumen. Úsalo a conciencia.
```

> El `.env` de la RAÍZ (POSTGRES_*) es de docker-compose. El de `services/api` lo lee NestJS/Prisma. No confundirlos.

---

## 2. Preparar la base (schema + seed)

```bash
pnpm install                    # solo la primera vez / tras clonar
pnpm --filter api run generate  # regenera Prisma Client según el schema
pnpm --filter api run db:migrate
pnpm --filter api run db:seed   # mallas 2021/2024 + admin (idempotente)
```

> `db:migrate` aplica lo que falte; si el schema no cambió, no crea migraciones nuevas.
> Desde cero (sin preguntas, DB vacía): `pnpm --filter api run db:deploy`.

---

## 3. Correr el backend

```bash
# Opción A — dev con hot reload (recomendado while desarrollando)
pnpm --filter api run dev          # → http://localhost:3001

# Opción B — como producción (sin watch)
pnpm --filter api run build
pnpm --filter api run start
```

Verificar rápido:
- `http://localhost:3001/api/v1/health` → `{"status":"ok"}`
- `http://localhost:3001/api/docs` → Swagger (contrato ADR-2)

---

## 4. Tests

### 4.1 Smoke + guards/roles con JWT firmado (no necesita OAuth)

Firmá un JWT con el **mismo `JWT_SECRET`** del `.env` usando el helper incluido en el repo **NO depende de `export`**:

```bash
STUDENT=$(node scripts/sign-jwt.mjs 3a3b0a6e-0000-4000-8000-000000000001 alumno1@uss.cl student Alumno 2024)
ADMIN=$(node scripts/sign-jwt.mjs 3a3b0a6e-0000-4000-8000-000000000001 admin@uss.cl admin Admin -)
```

Args: `<sub> <email> <role> <name> [mallaId]` (`-` = `null`). El `sub` debe ser un UUID válido.

Entonces los checks de la matriz de `docs/TEST_PLAN_API_FASE_B.md` (H1/H2/H4/H5):

```bash
BASE=http://localhost:3001/api/v1
# H1 — detalle de users
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $STUDENT" $BASE/users/3a3b0a6e-0000-4000-8000-000000000001   # 403 (solo admin)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $ADMIN"  $BASE/users/3a3b0a6e-0000-4000-8000-000000000001   # 404 (o 200 si existe)
curl -s -o /dev/null -w "%{http_code}\n"                                     $BASE/users/3a3b0a6e-0000-4000-8000-000000000001   # 401 (sin token)

# H2 — /auth/me con name + mallaId
curl -s -H "Authorization: Bearer $STUDENT" $BASE/auth/me

# H4 — email fuera de *.uss.cl rechazado
BAD=$(node scripts/sign-jwt.mjs 3a3b0a6e-0000-4000-8000-000000000001 hacker@gmail.com student Hacker -)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $BAD" $BASE/auth/me    # 401

# H5 — approve credit + borrar inexistente da 404 (no 500/401)
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE -H "Authorization: Bearer $STUDENT" $BASE/aprobados/me/curso-no-existe  # 404

# CRUDs
curl -s -H "Authorization: Bearer $ADMIN" $BASE/mallas                        # seed 2021/2024
curl -s -H "Authorization: Bearer $ADMIN" $BASE/mallas/2024/cursos/2024-PRG101
curl -s -H "Authorization: Bearer $STUDENT" $BASE/periodos                    # 200 (array)
```

### 4.2 🔴 E2e del login real (OAuth Microsoft, browser) — SOLO vos

1. API corriendo (paso 3) + `.env` con credenciales reales.
2. Abrir `http://localhost:3001/api/v1/auth/microsoft/login` → redirige a Microsoft. Debe apuntar a `.../oauth2/v2.0/authorize` (el `Issuer.discover` resuelve el endpoint real; si ves `/v2.0/authorize` estás en una versión vieja del código).
3. Login with tu cuenta `@uss.cl` → debe caer en `http://localhost:3000/#access_token=...` (**fragment,** no query — H7).
4. DevTools → Application → Cookies: exists `uss_refresh` (httpOnly; no borrarla).
5. 🔴 **Rotación refresh (H3)**: en Swagger (o `curl`) hace `POST /api/v1/auth/refresh` con la cookie → `accessToken` nuevo + cookie nueva. Reusar la cookie VIEJA → **401**.
6. 🔴 Rechazo email fuera de dominio consiste: probar con cuenta fuera de `@uss.cl` → mensaje de dominio.

> Nota: el browser setea las cookies httpOnly automáticamente. No bloquear cookies de terceros en el profile de dev.

### 4.3 Migraciones reproducibles (se sella checklist §303) — no toca `uss_apps`

```bash
psql -h localhost -p 5435 -U postgres -c 'CREATE DATABASE uss_apps_verify;'
cd services/api && DATABASE_URL="postgresql://postgres:postgres@localhost:5435/uss_apps_verify?schema=public" pnpm run db:deploy
# luego dropearla (ya no la usás)
psql -h localhost -p 5435 -U postgres -c 'DROP DATABASE uss_apps_verify;'
```

### 4.4 Cierre formal
- Marcar PASS/FAIL en la matriz de `docs/TEST_PLAN_API_FASE_B.md`.
- Actualizar checklist PLAN_V3 §303 + `docs/IMPLEMENT_API_PLAN.md` → Fase B terminada.
- Anotar resultados en `docs/TESTPLAN_API_FASE_B.md`.

---

## 5. Troubleshooting común

| Síntoma | Causa probable | Fix |
|---|---|---|
| Puerto 5435 cerrado | Postgres apagada | `docker compose up -d postgres` |
| `db:migrate` cuelga → la DB no arranca | Postgres rota | logs en 1.3 / `docker compose down && up` |
| `401` al usar `scripts/sign-jwt.mjs` | secret firmware con un `JWT_SECRET` distinto exportado | Usar `env -u JWT_SECRET node scripts/sign-jwt.mjs ...` |
| Login/OAuth redirect mismatch | REDIRECT_URI del `.env` ≠ el registrado en Azure | copiar exacto del registro de la app |
| `EADDRINUSE 3001` | ya corre otra instancia | `lsof -ti:3001 | xargs kill` y volver a arrancar |
| `export SEC=...` no "devuelve nada" | normal. `export` no imprime | verificar con `echo "${#SEC}"`. Mejor: usar `scripts/sign-jwt.mjs` |

---

## 6. Secuencia sugerida de ejecución completa

1. `docker compose up -d postgres && docker compose ps`
2. `pnpm install && pnpm --filter api run generate`
3. `pnpm --filter api run db:migrate && pnpm --filter api run db:seed`
4. `pnpm --filter api run build && pnpm --filter api run start`
5. Smoke (4.1) → 🔴 e2e (4.2) → reproducibilidad (4.3) → cierre (4.4)