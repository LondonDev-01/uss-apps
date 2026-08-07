# Plan de colaboración — Fase B → C + D en paralelo

> **Objetivo**: arrancar a trabajar en dos devs para terminar la API (Fase B, el mínimo de contrato) y destrabar **C (hub)** y **D (malla)** en paralelo.
>
> **Fecha**: 2026-08-06 · **Spec**: `docs/PLAN_V3.md` (Fases B, C, D)

## Fundamentos (por qué este plan funciona)

- C y D son **apps independientes** que consumen el mismo contrato OpenAPI (ADR-2). Ninguna importa de otra.
- El contrato se genera desde el primer endpoint (ADR-2), así que **frontend no espera a que termine toda la API**: puede construir contra el spec con mocks.
- Hay **una sola pieza serial** en todo este tramo: el auth (B1). No se divide entre dos personas.

## Modelo de reparto: 2 devs fullstack

Los dos devs son **fullstack**, así que el reparto NO es por perfil (backend/frontend) sino por **ownership de un slice vertical completo** (su backend + su frontend + su app).

El criterio de asignación es balancear el **camino crítico** y evitar conflictos de escritura en los mismos archivos:

- Cada dev se hace dueño de **una app entera** (C o D), con su backend y su frontend.
- La **única pieza compartida** es el auth (B1): un solo dev la escribe (no se divide), y ese dev consensúa el contrato de DTOs para que el otro trabaje en paralelo.

## Mínimo contrato de la API para destrabar C + D (orden de liberación)

Estrictamente en este orden:

1. `GET /auth/login` + `GET /auth/callback` — OAuth Microsoft + validación `*.uss.cl` + emisión de JWT  → **destraba C** (y da el token a D)
2. `GET /auth/me` — id, email, name, role, mallaId  → **destraba C** (dashboard)
3. `GET /mallas` + `GET /mallas/:id` (detalle + `MallaCurso` + prerrequisitos + equivalencias)  → **destraba D** con datos reales
4. `GET /api/v1/optimizer/prioridades`  → cierra D (depende de 3)

**Explícitamente FUERA de este tramo** (los necesita la Fase E, no C ni D):
`horarios_disponibles`, `periodos`, `electivo_categorias`.

## Asignación por ownership (2 devs fullstack)

Ambos son fullstack: cada uno se lleva una app completa (backend + frontend). El que escribe el auth (B1) itera también C, porque el hub es ~80% reuso directo de ese auth.

### Dev A — owner de C (hub) + auth + un slice de D

| Orden | Qué | Destraba |
|---|---|---|
| 1 | Auth backbone: OAuth Microsoft, callback, validación de dominio, JWT strategy + guard, `GET /auth/me` — **acordar el contrato de DTOs con B antes de codear** | C + token para D |
| 2 | **C (hub)**: login, dashboard, registry, refresh/redirect | C completo |
| 3 | CRUD lectura de mallas + seed 2021/2024 (validar con profe Hugo) — **slice de D atrás del contrato acordado en el paso 1** | D |
| 4 | `GET /api/v1/optimizer/prioridades` | D completo |

### Dev B — owner de D (malla)

1. **Malla interactiva con los 5 estados** (PLAN_V2 §6) contra **mocks** del contrato que A definió — 100% paralelo a A
2. Matching Excel↔Malla + UI correcta — sigue en paralelo
3. Apagar mocks y conectar a la API real — cuando A publica los pasos 3→4

Cuando A termina el auth (paso 1), entrega a B un token real vía `/auth/login` para que D no quede clavada en mock.

> **Reparto en el fondo**: quien quiere más backend-take C; a quien tira el frontend le queda D, con backend ligera (2 endpoints) en cuanto A le pase el contrato. Como son fullstack, ambos cubren el hueco del otro sin problema.

## El único cuello (honesto)

El paso **B1 (auth)** es una sola escritura: un solo dev lo escribe, no se divide entre 2 personas (hay un único dueño de la llave del login). Esa parte **no reduce el tiempo real con 2 devs** (es la constante), y por eso el otro no debería tocar esos archivos: se concentra en D con mocks mientras A define el contrato, escribe el auth y arma C.

## Checklist de cierre

Con las 4 slices del contrato listas, C y D quedan funcionales en paralelo:

- [ ] `GET /auth/login` + callback + JWT funcionando
- [ ] `GET /auth/me` devolviendo el usuario
- [ ] `GET /mallas` + `GET /mallas/:id` respondiendo
- [ ] `GET /api/v1/optimizer/prioridades` respondiendo
- [ ] Hub (C): flujo app sin sesión → hub → login → app con JWT
- [ ] Malla (D): 5 estados visuales + seed validado con el profe Hugo