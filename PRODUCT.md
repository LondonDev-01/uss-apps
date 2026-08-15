# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Estudiantes USS (primarios)**: Arman su horario de clases cada semestral. Necesitan subir datos del portal USS, categorizar ramos por prioridad, y generar combinaciones óptimas de horario que respeten sus preferencias.
- **Personal administrativo USS (secundarios)**: Gestionan carreras, ramos, cupos y períodos. Acceden al ecosistema desde el hub con roles diferenciados.

## Product Purpose

Ecosistema de aplicaciones web para estudiantes y administrativos de la Universidad San Sebastián. UniHorario es la primera app completa — optimiza la construcción de horarios académicos automatizando combinaciones que un estudiante no podría hacer manualmente. El ecosistema crece hacia un hub central con login, dashboard, malla curricular interactiva, y más apps que se incorporan progresivamente.

## Positioning

La capacidad de optimización automática de horarios combinada con visibilidad completa del panorama académico — UniHorario no solo muestra opciones, genera las mejores combinaciones respetando restricciones reales (P0/P1/P2, cupos, conflictos). Ninguna herramienta USS existente ofrece esto. El ecosistema agrega coherencia visual y de experiencia entre apps que hoy no se comunican.

## Operating Context

- Flujo semestral: Upload Excel del portal USS → Categorizar NRCs por prioridad (P0 requerido, P1 opcional, P2 electivo) → Procesar/optimizar → Ver horarios → Exportar (.ics, CSV, Excel)
- Datos vienen de una exportación del portal USS (archivos .xlsx con hojas de ramos)
- El hub centraliza login (OAuth Microsoft @*.uss.cl → JWT) y acceso a todas las apps
- La malla curricular es una app complementaria para visualizar avance académico
- Deploy en Vercel; tema oscuro por defecto con toggle a claro
- Routing client-side con HashRouter (deep links `#/path`)
- Estado en React Context, no persistido — se pierde en reload completo

## Capabilities and Constraints

- **UniHorario**: Upload Excel, parser de hojas, categorización de NRCs, optimizador con scoring (hasta 100k combinaciones), deduplicación, vista de grilla, export ICS/CSV/Excel
- **Hub**: Login Outlook, dashboard con tarjetas de apps, sidebar de navegación, top bar móvil
- **Malla**: Selección de malla, grilla curricular interactiva, colores por área
- **API** (Fase B en curso): NestJS + Prisma + PostgreSQL, única dueña de la DB, contratos OpenAPI
- **Constraints técnicos**: Apps NEVER conectan a PostgreSQL directamente. Apps NEVER implementan su propio login — el hub es el dueño de auth. OpenAPI es la fuente de verdad del contrato (ADR-2).
- **Optimizador**: Límite duro 100k combinaciones. Scoring: +500 por NRC, +2000 por electivo. Dedup en 2 etapas (NRC-set exacto + ~90% block-similarity). P0 es requerido — un schedule inválido si falta algún P0.

## Brand Commitments

- Nombre "UniHorario" fijado para la app de horarios
- La estética visual de UniHorario es el lenguaje de diseño del ecosistema completo — malla, hub, y futuras apps deben mantener coherencia visual
- Guidelines de estilo existentes en la app UniHorario son la referencia
- Identidad institucional USS respetada pero no subordinada a ella
- UI strings y labels en español neutral

## Evidence on Hand

- Código fuente completo de UniHorario en `apps/horarios/` (migrado con historial git del v1)
- Hub con login y dashboard en `apps/hub/`
- Malla con grilla curricular en `apps/malla/`
- API NestJS en desarrollo en `services/api/`
- Specs: `docs/PLAN_V3.md` (plataforma), `docs/PLAN_V2.md` (funcional), `docs/PROJECT_HANDOFF.md` (código v1)
- Assets de test (excels, PDF de malla) en `assets/`

## Product Principles

1. **Coherencia sobre consistencia**: Cada app preserva su identidad, pero el ecosistema se siente como un solo producto — mismos patrones de interacción, misma語言a visual heredada de UniHorario.
2. **El optimizador es el corazón**: UniHorario existe para resolver un problema que los estudiantes no pueden resolver solos. La optimización automática no es un feature — es la razón de ser.
3. **Simpleza con profundidad**: El flujo de 5 pasos (upload → categorizar → procesar → ver → exportar) debe sentirse trivial, aunque por debajo resuelva un problema combinatorio complejo.
4. **Ecosistema que crece, no que reemplaza**: Cada app nueva se integra al hub sin romper lo existente. UniHorario fue primero; las demás lo siguen.
5. **Datos del estudiante, control del estudiante**: Los datos se pierden en reload (estado no persistido). Esto es intencional — sin backend propio, sin riesgo de datos huérfanos.

## Accessibility & Inclusion

- No se han establecido requisitos de accesibilidad específicos más allá de los estándares básicos de HTML semántico y contraste de colores del tema oscuro/claro.
