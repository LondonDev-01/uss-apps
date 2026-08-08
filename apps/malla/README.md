# 🎓 Malla Curricular (`apps/malla`)

Malla curricular interactiva con los 5 estados visuales de ramo y prioridad
automática por período (PLAN_V3 §7 Fase D — spec funcional completa en
`docs/PLAN_V2.md` §4.2-§4.3, §6; el algoritmo de prioridad vive en el backend,
`services/api/src/modules/optimizer`, y esta app solo consume su resultado).

## Qué hace

- Auth gateada: si no hay sesión válida, redirige de página completa al hub
  (`http://localhost:3002/#/login?returnTo=...`) — esta app nunca muestra su
  propio login (ADR-4).
- Si el usuario autenticado no tiene malla seleccionada todavía, muestra una
  pantalla para elegir entre las mallas disponibles (PLAN_V2 §4.2).
- Vista principal: barra de progreso, panel de resumen (semestre actual
  estimado, aprobados, prioridad del período, opcionales, electivos),
  buscador, y grilla de 10 columnas (una por semestre) con cada ramo mostrando
  su estado (aprobado / prioridad / disponible / no disponible / no dictado).
- Click en un ramo dispara la acción correspondiente a su estado: marcar/
  desmarcar como aprobado, o ver los prerrequisitos faltantes.

## Desarrollo

Desde la raíz del monorepo:

```bash
pnpm install
pnpm --filter malla run dev
```

Abre http://localhost:3003

Requiere el API corriendo en paralelo (`pnpm --filter api run dev`, puerto
3001) y el hub corriendo (`pnpm --filter hub run dev`, puerto 3002) para
poder loguearse — esta app nunca inicia el login por sí sola.

## Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api/v1` | Base URL del API NestJS |

## Build

```bash
pnpm --filter malla run build      # tsc -b && vite build -> dist/
pnpm --filter malla run typecheck  # solo typecheck
```

## Endpoints del API que consume

- `GET /mallas` — lista de mallas disponibles.
- `GET /mallas/:mallaId` — detalle completo (cursos, prerrequisitos).
- `GET /aprobados/me` / `POST /aprobados/me` / `DELETE /aprobados/me/:id` —
  cursos aprobados del usuario.
- `GET /auth/me`, `POST /auth/refresh` — sesión.
- `PATCH /users/me` — selección de malla (PLAN_V2 §4.2).
- `GET /optimizer/prioridades` — prioridad de ramos para el período activo.
- `GET /periodos` — lista de períodos (no se usa un selector todavía).

No hay codegen OpenAPI en el repo (PLAN_V3 §5 lo deja para una fase futura);
`src/lib/api.ts` es un cliente `fetch` escrito a mano, igual que en `apps/hub`.

## Simplificaciones conocidas de esta primera versión

- **Mobile**: la grilla de semestres usa scroll horizontal en pantallas
  angostas, no un apilado vertical completo. Suficiente para esta primera
  versión; una mejor UX mobile queda pendiente.
- **Sin actualización optimista**: marcar/desmarcar un ramo como aprobado
  hace un refetch de `aprobados` + `prioridades` después de la mutación, en
  vez de actualizar el estado local de inmediato. Más simple y confiable a
  costa de un pequeño delay visual.
- **`mallaId` local**: como `PATCH /users/me` no reemite el JWT, el `mallaId`
  elegido se guarda en el estado de `AuthContext` (no en el token) hasta el
  próximo login — ver comentario en `src/lib/api.ts#setMalla`.
- **`GET /periodos` sin selector visible**: el endpoint existe y está
  tipado en `src/lib/api.ts`, pero la UI no expone un selector de período
  todavía; `/optimizer/prioridades` se llama sin `periodoId`, dejando que
  el backend use el período activo más reciente.

## Gaps de backend detectados (no resueltos acá)

- `GET /optimizer/prioridades` no informa por separado si `cursosDisponibles`
  viene vacío/con `opciones: []` porque (a) no hay ningún período activo
  cargado, vs. (b) el ramo específicamente no está en el Excel de ese
  período. Ambos casos hoy se ven igual desde el frontend (estado "no
  dictado" para ramos con `prioridad: 0` y `opciones: []`, o el mensaje
  degradado de "no se pudo calcular prioridad" si el endpoint completo
  falla). No bloquea esta fase (Fase E trae el upload de Excel), pero un
  campo explícito tipo `sinPeriodoActivo: boolean` en la respuesta ahorraría
  esta ambigüedad más adelante.
