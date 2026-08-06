# 📅 UniHorario USS (`apps/horarios`)

Optimizador de horarios académicos para estudiantes de la **Universidad San Sebastián**. Sube el Excel de oferta académica del portal USS y obtén automáticamente las mejores combinaciones de horario según tus preferencias.

## ✨ Características

- 🧠 **Motor de optimización** — Algoritmo combinatorio que genera hasta 20 horarios diversos, priorizando los mejores según tus reglas.
- 🎯 **Preferencias personalizadas** — Entrar tarde, salir temprano, evitar ventanas, sin clases los sábados.
- 📋 **3 categorías de ramos** — Obligatorios (P0), opcionales para adelantar (P1) y electivos (P2).
- 📥 **Carga de Excel USS** — Sube el `.xlsx` de oferta académica; detecta hojas y filtra solo los ramos habilitados (columna ICIF marcada).
- ✏️ **Edición manual** — Ajusta cualquier horario generado cambiando secciones/NRCs a mano.
- 📅 **Exportar a calendario** — Genera `.ics` compatible con Google Calendar, Apple Calendar y Outlook.
- 📊 **Exportar a CSV/Excel** — Para imprimir o respaldar.
- 🌗 **Modo oscuro/claro** — Oscuro por defecto.
- 💾 **Sin login, sin servidor** — Todo funciona en tu navegador. Tus datos nunca salen de tu computador.

## 🚀 Desarrollo

Desde la **raíz del monorepo**:

```bash
pnpm install
pnpm --filter horarios run dev
```

Abre http://localhost:3000

Para probar, usa los excels de ejemplo en `assets/excels/` de la raíz del repo.

## 📦 Build

```bash
pnpm --filter horarios run build      # tsc -b && vite build -> dist/
pnpm --filter horarios run typecheck  # solo typecheck
```

## ☁️ Deploy (Vercel)

- **Root Directory**: `apps/horarios`
- Vercel detecta el workspace pnpm y usa `apps/horarios/vercel.json` (Vite, `dist/`).
- Sin variables de entorno: la app es 100% client-side.

## 🏗️ Arquitectura

```
src/
├── App.tsx              # Layout principal con navegación (HashRouter)
├── main.tsx             # Entry point
├── styles.css           # Estilos globales (tema claro/oscuro)
├── store.tsx            # Estado global (React Context, no persistido)
├── types.ts             # Tipos TypeScript
├── lib/
│   ├── constants.ts     # Fechas del semestre y constantes
│   ├── excelParser.ts   # Parser del Excel USS (columna ICIF)
│   ├── optimizer.ts     # Motor de optimización combinatoria
│   ├── icsExport.ts     # Export .ics
│   └── parser.ts        # LEGACY: parser de texto pegado
├── pages/
│   ├── UploadPage.tsx       # Paso 1: Subir Excel
│   ├── CategorizePage.tsx   # Paso 2: Prioridades P0/P1/P2
│   ├── ProcessPage.tsx      # Paso 3: Días + preferencias → optimizar
│   ├── SchedulePage.tsx     # Paso 4: Ver/editar horarios
│   └── ExportPage.tsx       # Paso 5: Exportar
└── components/
    └── ScheduleGrid.tsx # Grilla visual de horario
```

Flujo: `Excel → excelParser.ts → HorarioCrudo[] → Categorize → Process → optimizer.ts → ClaseConDia[][] → Schedule/Export`.

Los detalles finos (semántica de prioridades, gotchas del optimizer) están en el `AGENTS.md` de la raíz y en `docs/PROJECT_HANDOFF.md`.
