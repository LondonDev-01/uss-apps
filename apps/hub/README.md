# 🔑 Hub USS (`apps/hub`)

Portal central del ecosistema `uss-apps`: login con Outlook, dashboard y menú
de aplicaciones disponibles (PLAN_V3 §7 Fase C — ADR-4: auth centralizada).

## Qué hace

- Único lugar donde ocurre el login (OAuth 2.0 con Microsoft, dominio `*.uss.cl`).
- Mantiene el access token **en memoria** (nunca en `localStorage`) y lo
  rehidrata al recargar la página usando el refresh token (cookie httpOnly).
- Muestra el usuario autenticado y una grilla de apps del ecosistema
  (`src/registry.ts`).
- Reenvía al usuario a la app de origen tras loguearse, si llegó vía
  `?returnTo=<url>` (ver "Redirect de retorno" abajo).

## Desarrollo

Desde la raíz del monorepo:

```bash
pnpm install
pnpm --filter hub run dev
```

Abre http://localhost:3002

Requiere el API corriendo en paralelo (`pnpm --filter api run dev`, puerto
3001 por defecto) y, para que el callback de Microsoft redirija de vuelta
acá, `AUTH_SUCCESS_REDIRECT=http://localhost:3002/` en `services/api/.env`.

## Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api/v1` | Base URL del API NestJS |

## Build

```bash
pnpm --filter hub run build      # tsc -b && vite build -> dist/
pnpm --filter hub run typecheck  # solo typecheck
```

## Endpoints del API que consume

- `GET /auth/microsoft/login` — navegación de página completa (no fetch),
  redirige a Microsoft OAuth.
- `GET /auth/microsoft/callback` — lo maneja el API; el browser vuelve a
  `AUTH_SUCCESS_REDIRECT` con `#access_token=<jwt>`.
- `POST /auth/refresh` — con `credentials: 'include'`, rota el access token
  usando la cookie httpOnly de refresh (rehidrata sesión al recargar).
- `GET /auth/me` — con `Authorization: Bearer <token>`, datos del usuario
  autenticado.

No hay codegen OpenAPI configurado todavía en el repo (PLAN_V3 §5 lo deja
para una fase futura); `src/lib/api.ts` es un cliente `fetch` escrito a mano.

## Mecanismo de token hacia apps hijas

El hub recibe su propio token del API como fragmento **desnudo**:
`http://localhost:3002/#access_token=<jwt>` (así lo define
`auth.controller.ts`; el fragmento nunca viaja al servidor, por seguridad).
`src/lib/token.ts#consumeAccessTokenFromHash` lo extrae y limpia la URL
**antes** de que monte `HashRouter`, para que el router no intente
navegar a una ruta `access_token=...` inexistente.

Para pasar el token a una app hija (ej. al clickear la card de "horarios"),
el hub usa el mismo criterio — el fragmento, nunca query string, para que el
token no quede en logs de acceso del servidor estático — pero anidado bajo
la raíz de la app hija para no romper su propio `HashRouter`:

```
${appUrl}/#/?access_token=<jwt>
```

Es decir: `http://localhost:3000/#/?access_token=eyJhbGci...`. La app hija
lee `access_token` de la parte de query dentro de su hash (o de un query
string normal, si en el futuro se navega ahí sin pasar por HashRouter) y
limpia la URL apenas lo consume. `apps/horarios` implementa esto en
`src/components/AuthStatus.tsx` como demostración mínima del flujo completo
(ver su README).

## Redirect de retorno (`returnTo`)

Cualquier app sin sesión puede mandar al usuario al hub con
`?returnTo=<url-encoded-de-la-app>` en `/login`
(ej: `http://localhost:3002/#/login?returnTo=http%3A%2F%2Flocalhost%3A3000`).

- `LoginPage` guarda ese `returnTo` en `sessionStorage` (única excepción
  deliberada a "sin persistencia": es efímero por pestaña y nunca contiene
  el JWT, solo la URL de vuelta — necesario porque el login es una
  navegación de página completa a Microsoft y de vuelta, que borra
  cualquier estado en memoria de React).
- Al resolver la sesión (ya sea porque el usuario acaba de loguearse o
  porque ya tenía una cookie de refresh válida), si hay un `returnTo`
  pendiente, el hub redirige ahí con el token en el fragmento
  (`buildChildAppUrl`) en vez de mostrar el dashboard.
- Sin `returnTo`, el flujo cae en el dashboard normal.

## Diseño: sidebar + dashboard mock (2026-08-08)

El dashboard usa un layout de sidebar (oculto bajo `md`, reemplazado por
`MobileTopBar`) con:

- **Marca**: `public/uss-logo-horizontal.png` (isotipo + wordmark oficial de
  la USS). El logo es navy/dorado sobre fondo transparente pensado para
  superficies claras — se muestra dentro de una placa blanca (`bg-white`)
  en el sidebar, la topbar móvil y el login, para que no se pierda contra
  el fondo oscuro. `public/uss-logo.png` (versión apilada) queda disponible
  sin usar todavía, por si hace falta en el futuro.
- **Nav**: "Dashboard" + el registry de apps (`src/registry.ts`), cada una
  con el mismo mecanismo de token que las cards.
- **Cuenta**: iniciales del usuario, nombre, rol y logout, al pie.
- **Contenido central**: `src/mock/dashboardMock.ts` — datos de ejemplo
  (progreso de carrera, ramos cursando, aprobados/total, próximo período)
  para validar el layout antes de que existan los endpoints reales de
  `malla`/`scheduler` (Fase D/E). Reemplazar ese módulo completo cuando
  esos endpoints existan.

Simplificación conocida: `MobileTopBar` no repite el nav completo (solo
marca + logout) — si el hub se usa seriamente desde mobile, hay que
agregarle un drawer o menú propio.

## Pendientes / decisiones fuera de este alcance

- ~~**Logout server-side**~~ — resuelto 2026-08-08: `POST /auth/logout`
  revoca el `jti` del refresh token y limpia la cookie; `logout()` lo
  dispara además de limpiar el estado local (best-effort, no bloquea la UI).
- **Toggle de tema**: `styles.css` define `.theme-light` (mismas variables
  que `apps/horarios`) pero el hub no expone un botón para cambiarlo; queda
  fijo en oscuro por defecto, que es lo que pide el checklist de Fase C. Se
  puede agregar un `ThemeToggle` igual al de `apps/horarios` si hace falta.
