# Auditoría de `services/api` — Fase B (2026-08-06)

> **Estado**: código funcional verificado; hallazgos de seguridad y diseño sin corregir (pendientes de decisión).
> **Autor**: revisión independiente al trabajo de otro agente.
> **Alcance**: módulo auth, guards, CRUDs (users/malla/aprobados/scheduler), scheme, seed, config.
> **Referencias**: `docs/IMPLEMENT_API_PLAN.md`, `docs/COLLAB_PLAN.md`, `PLAN_V3 §4`, `PLAN_V2 §3`.

---

## Resumen ejecutivo

La base del API **compila, migra y responde correctamente**. El flujo OAuth está bien diseñado en la parte crítica (PKCE + state, tenant pineado, dominio validado, JWT en cookie httpOnly). Sin embargo la auditoría encontró **1 hallazgo de seguridad real (IDOR)**, **varios desvíos de la especificación/contrato** y **sobreafirmaciones en el checklist del plan**. Nada de esto es impedimento para que el servidor funcione, pero **el IDOR debe corregirse antes de subir a cualquier entorno con usuarios reales**.

| ID | Severidad | Tipo | Hallazgo |
|----|-----------|------|----------|
| H1 | 🔴 Alto | Seguridad | `GET /users/:id` expone el perfil completo de otro usuario (IDOR) |
| H2 | 🟠 Medio | Contrato | `/auth/me` no devuelve `name` ni `mallaId` (contradice COLLAB_PLAN) |
| H3 | 🟠 Medio | Diseño | El refresh token **no rota** (el doc dice que sí) |
| H4 | 🟡 Medio-Bajo | Spec | `JwtStrategy.validate` no valida el dominio por request (PLAN_V3 §4.3) |
| H5 | 🟡 Medio-Bajo | Robustez | Manejo de errores incorrecto en `AprobadosService` (500 en vez de 404, 401 equivocado) |
| H6 | 🟠 Alcance-doc | Veracidad | Checklist de `IMPLEMENT_API_PLAN` marca done CRUD que no existen |
| H7 | ⚪ Bajo | Contrato | `microsoftLogin` devuelve JSON en vez de redirect; token en query (`?`) en vez de fragment (`#`) |
| H8 | ⚪ Bajo | Schema | `users.updated_at` no tiene default en DB (falla todo INSERT raw) |

---

## Método de verificación (qué se probó y resultado)

Verificación de tipo **caja gris**: lectura completa del código + ejecución real del servidor.

| Prueba | Resultado |
|--------|-----------|
| `pnpm --filter api run typecheck` | ✅ pasa |
| `pnpm --filter api run build` (nest build) | ✅ `dist/main.js` generado |
| `prisma migrate deploy` sobre DB vacía (`uss_apps_verify`) | ✅ las 9 tablas de PLAN_V2 §3 + `_prisma_migrations` |
| `prisma/seed.ts` (vía `pnpm prisma db seed`) | ✅ idempotente (upserts) |
| `GET /api/v1/health` sin token | ✅ 200 |
| `GET /api/v1/auth/me` sin token | ✅ 401 (guard global activo) |
| `GET /api/v1/auth/me` con token inválido | ✅ 401 |
| `GET /api/v1/auth/me` con JWT `student` válido | ✅ 200 |
| `GET /api/v1/users` con JWT `student` | ✅ 403 (admin-only respetado) |
| `GET /api/v1/users` con JWT `admin` | ✅ 200 |
| `GET /api/v1/mallas` con JWT | ✅ 200 (seed 2021/2024) |
| `GET /api/v1/mallas/2024` | ✅ devuelve cursos + prerrequisitos + equivalencias |
| `GET /api/v1/aprobados/me` con JWT `student` | ✅ 200 (`[]`) |
| `GET /api/v1/users/:id` con JWT `student` sobre usuario admin | ⚠️ **200 con datos ajenos** → **H1 confirmado** |

> Los usuarios/tokens de prueba se crearon y **se eliminaron** después (no quedó basura en la DB).

---

## Hallazgo H1 — 🔴 IDOR en `GET /users/:id`

**Severidad**: Alta (seguridad de datos)
**Ubicación**: `services/api/src/modules/users/users.controller.ts:19-23` + `users.service.ts:13-19`

```
@Get(':id')
@ApiOperation({ summary: 'Detalle de un usuario por id' })
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.usersService.findOne(id);
}
```

**Qué está mal**: el endpoint no está restringido por rol ni por ownership. Cualquier usuario autenticado (role `student`) puede hacer `GET /users/<uuid-ajena>` y recibe el registro completo del otro usuario: `email`, `name`, `role`, `mallaId`, `outlookId` y timestamps.

**Evidencia** (ejecutado contra el servidor con un token `student` autenticado):

```
GET /api/v1/users/22222222-...-222222222222   →   200
{
  "id": "22222222-...",
  "email": "admin.uss@uss.cl",
  "name": "Test Admin",
  "role": "admin",
  "mallaId": null,
  "outlookId": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Por qué importa**: filtra datos personales de terceros (email, identidad, ramos aprobados si se amplía). Aunque los UUID son difíciles de adivinar, es un típico **IDOR (Insecure Direct Object Reference)** que cualquier scanner o cliente autenticado puede explorar. Viola el principio de *ownership* que el propio código respeta bien en `/aprobados` (que usa `req.user.id`) pero se le escapó acá.

**Fix propuesto**:
- Opción A (recomendada): el endpoint de detalle solo responde por Admin (`@Roles('admin')`), igual que el `list()`, **o**
- Opción B: devuelve **solo el propio perfil** si `id === req.user.id`; cualquier otro id → `403 Forbidden`.
- En cualquier caso: fina e devolver sensibles (`outlookId`) — el contrato no necesita exponerlo.

---

## Hallazgo H2 — `/auth/me` no devuelve `name` ni `mallaId`

**Severidad**: Media (rompe el contrato del hub).
**Ubicación**: `src/modules/auth/jwt.strategy.ts:13-17` (tipo `AuthenticatedUser`), `auth.service.ts:63-65`, `auth.controller.ts:36-41`.

El contrato en `docs/COLLAB_PLAN.md:27` exige:
> `GET /auth/me` — id, email, name, role, mallaId → **destraba C** (dashboard del hub)

Pero `AuthenticatedUser` (lo que devuelve el endpoint) es:

```
interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
```

**Impacto**: el hub (Fase C) no tiene acceso a `name` (para mostrar "Hola <nombre>") ni a `mallaId` (para dirigir al usuario a su malla). El dashboard queda incompleto.

**Causa raíz**: el JWT payload se arma con solo `sub/email/role` y el `/me` no consulta la DB. El dato `name` y `mallaId` existe en `User` pero no se incluye.

**Fix propuesto**: agregar `name` y `mallaId` al payload del JWT y a `AuthenticatedUser` (o resolver `me` haciendo `findUnique` por `sub` — es 1 query, una mejor es la primera). Tener en cuenta que `mallaId` puede ser `null` si el usuario no la eligió.

---

## Hallazgo H3 — El refresh no se rota

**Severidad**: Media (el doc promete algo que el código no hace).
**Ubicación**: `auth.service.ts:38-61`, `auth.controller.ts:43-52`.

`IMPLEMENT_API_PLAN §3` dice: *"let nombrar: POST /auth/refresh — rota el refresh (checklist de C, implementado acá)"*.

Lo que hace actualmente:

```typescript
async refresh(refreshToken: string): Promise<{ accessToken: string }> {
  // válida el refresh JWT
  // ...
  return { accessToken };   // ← NO emite ni revoca un refresh nuevo
}
```

**Impacto**: el refresh token es **estático y de larga duración** (7 días). Si se filtra una sola vez, el atacante puede pedir access tokens indefinidamente hasta la expiración, sin más registro. Sin rotación no hay **detección de reuso** (la señal clásica de robo).

**Nota honesta**: el plan maestro del v3 no exige rotación explícita, pero el documento que documenta esta pieza **afirma que está implementada** y no lo está — es una sobreafirmación del checklist.

**Fix propuesto**:
- Emitir un refresh **nuevo** en cada `POST /auth/refresh` y entregarlo en la cookie (junto con el access nuevo), **o**
- Introducir una tabla `refresh_tokens` (`id`, `user_id`, `jti`, expira, revocado) y rotar+revocar. El modelo de cookie del hub es compatible con esto en Fase C.

---

## Hallazgo H4 — No validar el dominio por request

**Severidad**: Media-Baja (cumplimiento de spec; riesgo bajo real).
**Ubicación**: `jwt.strategy.ts:29-31`.

Con PLAN_V3 §4.3:
> "El API valida firma + expiración + **dominio del email en CADA request** (guard global de NestJS)."

`JwtStrategy.validate` devuelve el payload tal cual, sin verificar el regex del dominio `@*.uss.cl`:

```ts
async validate(payload: JwtPayload) {
  return { id: payload.sub, email: payload.email, role: payload.role };
}
```

**Análisis de riesgo**: el token lo firma **nosotros** tras validar dominio en el callback de OAuth, así que un token válido ya pasó esa validación al emitirse. La re-validación por request es defensa en profundidad que el plan pide explícitamente. El caso real a cubrir sería un error de código que emita un token con email fuera del dominio — el guard lo dejaría pasar de ser una vez.

**Fix propuesto**: en `validate()`, aplicar `USS_DOMAIN_REGEX` sobre `payload.email` y rechazar con `UnauthorizedException` si no matchea. Es 1 línea + copiar la constante (hoy vive en `oauth.service.ts`; histórico: moverla a un `constants` o exportarla).

---

## Hallazgo H5 — Manejo de errores de `AprobadosService`

**Severidad**: Media-Baja (robustez / semántica HTTP).
**Ubicación**: `aprobados.service.ts:17-35`.

`remove()`:
```ts
remove(user, mallaCursoId) {
  return this.prisma.userCursoAprobado.delete({
    where: { userId_mallaCursoId: { userId: user.id, mallaCursoId } },
  });
}
```
Si el registro no existe, Prisma lanza `PrismaClientKnownRequestError` (código P2025) → NestJS lo convierte en **HTTP 500**, cuando el usuario borró algo que no existía → debería ser **404** (jue nunca 500 a un estado esperado).

`upsert()` a su vez:
```ts
if (!curso) throw new UnauthorizedException('Curso de malla inexistente');
```
`UnauthorizedException` produce **401**, pero el problema es que el cursor no existe (lógica de recurso), no que no haya auth → semánticamente es **404/422**.

**Fix propuesto**: en `remove`, atrapar P2025 → `NotFoundException`; en `upsert`, lanzar `NotFoundException` (o `BadRequestException`) cuando el malla_curso no existe.

---

## Hallazgo H6 — Checklist de `IMPLEMENT_API_PLAN` sobreafirmado

**Severidad**: Media (veracidad en la documentación — no es un bug de runtime).
**Ubicación**: `docs/IMPLEMENT_API_PLAN.md` — filas `[x]` del checklist.

El checklist marca como hechos los CRUD de **los 6**, incluyendo `periodos` y `horarios_disponibles` y `electivo_categorias`:

- `horarios_disponibles` — **no existe** ningún endpoint
- `electivo_categorias` — **no existe** ningún endpoint
- `periodos` — implementado parcialmente (list, findOne, create; sin `delete`/`update`, sin `horarios` hijos)

**Contexto que lo relativiza**: `COLLAB_PLAN` difiere intencionalmente `horarios_disponibles`/`electivo_categorias` a la Fase E (no los necesita C ni D) — tal vez es correcto que no estén. Pero *documento la lista como "hecho" lo que no lo está*: el api de verificación no coincide con el código.

**Fix propuesto**: marcar en el checklist `periodos` (parcial → details) y `horarios_disponibles`/`electivo_categorias` como *"diferido a Fase E"* en vez de "hecho", o bien implementarlos si se quiere cumplir el contrato base.

---

## Hallazgo H7 — No redirect en login; token en query en vez de fragmento

**Severidad**: Baja.
**Ubicación**: `auth.controller.ts:52-66` (login) y `:94-99` (callback).

- `GET /auth/microsoft/login` devuelve `{ url }` en JSON en vez de hacer **302** a Microsoft. Funciona (el cliente navega a la URL), pero el contrato (`GET /auth/login → redirige`) y el flujo del hub esperan una redirección sin que el frontend tenga que leer el body.
- El callback entrega el access token así: `res.redirect(successRedirect + '?access_token=' + encodeURIComponent(token))`. En colar la **plan §4.3** dice *fragment* (`#`), no `?`. El token en query string es más propenso a quedar en logs del servidor/web/historial. El fragment no se envía al servidor de destino.

**Fix propuesto** (Fase C): login → `res.redirect(authUrl)`; entregar token en `#access_token=...`. En Fase B puede mantenerse JSON si se documenta, pero decidir antes de armar el hub.

---

## Hallazgo H8 — `users.updated_at` sin default en DB

**Severidad**: Baja (nota de schema).
**Ubicación**: `prisma/schema.prisma` — campo `updatedAt @updatedAt @map("updated_at")` con `@@map("users")`.

`@updatedAt` lo gestiona **Prisma en runtime**, pero la columna de la DB no tiene `DEFAULT NOW()`. Cualquier **INSERT SQL manual** (operaciones, scripts, disaster-recovery, debugs) falla con `not-null violation` en `updated_at` (se reprodujo en la auditoría). El pasado en `created_at` que sí tiene `@default(now())`.

**Fix**: como es `@updatedAt` no se le puede poner `@default` en el modelo de Prisma, pero se puede declarar el default a nivel de DB con `@db` no sirve para esto. La alternativa limpia es usar una migración manual que agregue `DEFAULT now()` sobre `updated_at`, o aceptar y documentar que todo write debe pasar por Prisma. Decidir consciente (no es bug de runtime mientras todo pasa por la app).

---

## Notas operativas

- **El otro agente no hizo `git commit`**: todo el trabajo de la Fasean vive **sin verme** (working tree): `src/modules/**`, `prisma/seed.ts`, `docs/*`, y modificaciones a `app.module`, `main.ts`, `package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`, `pnpm-lock.yaml`. Antes de facturar debe revisar y escribir los fixes, y luego **una sola unidad de commit** por módulo.
- **CORS**: `origin: true` con credenciales es correcto en dev; hay que restringirlo a los dominios del ecosistema en Fase F.
- **Estilo del código**: sin test runner/linter/formatter en el repo — la regla de verificación es `typecheck + build` (+ prueba HTTP manual como esta).

---

## Qué sigue

1. **Decidir scope**: los fixes de H1 (crítico) y H2 son bloqueantes para el hub; H3/H4/H5 conveniente; H6 requiere tocar documentación; H7 y H8 son mejoras de contrato/limpieza.
2. **¿Arreglo estos hallazgos?** En cuanto confirmes el alcance, corrijo el código, actualizo los `.md` para que el estado del checklist refleje la realidad, y commiteo la Fase B completa (hoy sin commitear).
3. Recién después: validar el **flujo browser e2e** (login → callback → `/me` → refresh) con tus credenciales reales de OAuth (el experimento del browser ya dio luz verde).

## Estado de los fixes (2026-08-07)

| Hallazgo | Severidad | Estado |
|----------|-----------|--------|
| H1 — IDOR en `GET /users/:id` | 🔴 Alta | ✅ **Arreglado** — `@Roles('admin')` (Opción A) |
| H2 — `/auth/me` sin `name`/`mallaId` | 🟡 Media | ✅ **Arreglado** — payload + `issueTokens` + `me` incluyen ambos |
| H3 — refresh sin rotación | 🟡 Media | ✅ **Arreglado** — tabla `refresh_tokens` + rotación/revocación con reuso |
| H4 — dominio no validado por request | 🟡 Media | ✅ **Arreglado** — `USS_DOMAIN_REGEX` shared en `validate()` de JwtStrategy |
| H5 — AprobadosService 500/401 | 🟠 Media-baja | ✅ **Arreglado** — `NotFoundException` en `upsert` y `remove` (P2025) |
| H6 — Checklist docs sobreafirmado | 🟠 Alcance-doc | ✅ **Arreglado** — `IMPLEMENT_API_PLAN` marca `periodos` parcial y difiere `horarios_disponibles`/`electivo_categorias` a Fase E |
| H7 — login JSON / token en query | 🟡 Media | ✅ **Arreglado** — login `302`, token en fragment `#` |
| H8 — `users.updated_at` sin default DB | 🟢 Baja | ✅ **Arreglado** — `@default(now())` + migración |

**Pendiente (fuera de estos fixes)**: validación del flujo browser e2e con credenciales reales de OAuth, y commit de la Fase B completa.