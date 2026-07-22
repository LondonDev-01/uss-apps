# UniHorario USS — Documentación de Proyecto

## Visión General

App web (Electron + React + TypeScript + Tailwind CSS) que optimiza horarios universitarios para estudiantes de la USS. El usuario sube un Excel del portal USS, categoriza ramos por prioridad, asigna días a cada bloque, y el optimizer genera las mejores combinaciones de horario.

---

## Arquitectura

```
frontend/src/
├── App.tsx                    # Router + Layout + Tabs
├── store.tsx                  # Estado global (React Context)
├── types.ts                   # Todas las interfaces y tipos
├── icons.tsx                  # Lucide React icons
├── lib/
│   ├── excelParser.ts         # Parseo de Excel → HorarioCrudo[]
│   ├── excelExport.ts         # Exportación a Excel HTML coloreado
│   ├── parser.ts              # Parser de texto/tabular (legacy, JSON)
│   ├── optimizer.ts           # Core del optimizador combinatorio
│   └── colors.ts              # Paleta de colores para ramos
├── pages/
│   ├── UploadPage.tsx         # Paso 1: Subir Excel
│   ├── CategorizePage.tsx     # Paso 2: Asignar prioridades (P0/P1/P2)
│   ├── ProcessPage.tsx        # Paso 3: Asignar días + preferencias + optimizar
│   ├── SchedulePage.tsx       # Paso 4: Ver horario optimizado
│   └── ExportPage.tsx         # Paso 5: Exportar
└── components/
    └── ScheduleGrid.tsx       # Grid visual del horario
```

---

## Flujo de Datos

```
Excel (.xlsx) 
  → parseExcelFile() 
  → HorarioCrudo[] (raw rows)
  → CategorizePage (asigna prioridad 0/1/2 a cada NRC)
  → ProcessPage (asigna día a cada bloque, selecciona NRC)
  → procesarSeleccionesUsuario() 
  → ClaseConDia[] (candidatos con día y hora parseados)
  → generarTopHorarios() 
  → ResultadoOptimizacion { horarios: ClaseConDia[][] }
  → SchedulePage (muestra horarios optimizados)
```

---

## Interfaces Principales (`types.ts`)

### `HorarioCrudo`
Row crudo del Excel. Un row = un bloque (ej: "Matemáticas TEO Lunes 08:00-09:20").

```typescript
interface HorarioCrudo {
  nrc: string           // Código NRC del curso (ej: "12345")
  titulo: string        // Nombre del curso (ej: "MATEMÁTICAS I")
  tipo: string          // "TEO" o "LAB"
  seccion: string       // Sección (ej: "T01")
  hora_str: string      // "08:00 - 09:20"
  dia_parseado: string | null  // "Lunes", "Martes", etc.
  prioridad: number     // 0=Prioridad, 1=Opcional, 2=Electivo
  liga: string          // Código de vinculación con LAB
  conector: string      // Código de conexión con TEO
  // ... otros campos
}
```

### `ClaseConDia`
Un bloque con día y hora parseados en minutos. Es la unidad básica del optimizer.

```typescript
interface ClaseConDia {
  nrc: string
  titulo: string
  tipo: string           // "TEO" | "LAB"
  seccion: string
  dia: string            // "Lunes", "Martes", etc.
  hora_inicio: string    // "08:00"
  hora_fin: string       // "09:20"
  minutos_inicio: number // 480 (8*60)
  minutos_fin: number    // 560
  prioridad: number      // 0, 1, o 2
  liga: string
  conector: string
}
```

### Prioridades

| Código | Label | Comportamiento |
|--------|-------|----------------|
| `0` | Prioridad | **Obligatorio**. Siempre debe estar en el horario final. |
| `1` | Opcionales | Intenta incluir. Puede faltar si hay conflictos. |
| `2` | Electivos | Intenta incluir al menos 1. Son los ÚNICOS que pueden desaparecer. |

---

## Lógica del Optimizer (`optimizer.ts`)

### Input
- `candidatos: ClaseConDia[]` — Todos los bloques con día asignado
- `topN: number` — Cuántos horarios retornar (default 10)
- `preferencias: Preferencias` — Criterios del usuario

### Proceso Paso a Paso

#### 1. Agrupar por Prioridad y Tipo
```typescript
ramosPorPrioridad[0][titulo][tipo] = ClaseConDia[][][]
//                                       ^     ^     ^
//                               prioridad  curso  tipo (TEO/LAB)
//                                         cada elemento es un array de bloques de UN NRC
```

#### 2. Deduplicar NRCs por Time Signature
Antes de consolidar, se eliminan NRCs redundantes:
```typescript
// Si 5 NRCs tienen el mismo horario (mismo día, misma hora), solo se queda 1
for (const grupo of bloquesNrcs) {
  const sig = grupo.map(b => `${b.dia}|${b.hora_inicio}|${b.hora_fin}`).sort().join(';')
  if (!seen.has(sig)) seen.set(sig, grupo)
}
```

#### 3. Consolidar Opciones (`consolidarOpciones`)
Para cada curso, genera las combinaciones válidas de TEO+LAB:
- Si tiene TEO y LAB: prueba todas las combinaciones TEO×LAB, verifica:
  - **Liga/Conector**: Si ambos tienen liga/conector, deben coincidir cruzadamente
  - **Sin conflictos internos**: El TEO y LAB del mismo combo no deben chocar
- Si solo tiene TEO o solo LAB: toma las opciones directas

**Output**: `opciones[i]` = array de opciones para el curso i. Cada opción es un array de `ClaseConDia[]`.

#### 4. Construir Lista Final
```typescript
const listaFinal = []
for (const o of opts0) listaFinal.push(o)           // P0: obligatorios
for (const o of opts2) listaFinal.push([...o, []])   // P2: cada electivo es individualmente opcional
for (const o of opts1) listaFinal.push([...o, []])   // P1: opcionales, también con []
```

**IMPORTANTE**: Cada electivo (P2) se maneja INDIVIDUALMENTE como opcional `[...opciones, []]`. El `[]` representa "no incluir este electivo".

#### 5. Producto Cartesiano
```typescript
for (const combinacion of product(listaFinal)) {
  // combinacion = [opcion_curso1, opcion_curso2, ...,opcion_electivo1, [], ...]
  // plano = aplanar todos los bloques seleccionados
}
```

#### 6. Filtros por Combinación
Cada combinación pasa por estos filtros en orden:

1. **`plano.length > 0`**: No generar combinaciones vacías
2. **`incluyeTodoP0`**: **CRÍTICO** — Verificar que TODOS los títulos P0 estén en `titlesEnPlano`
   ```typescript
   const titlesEnPlano = new Set(plano.map(c => c.titulo))
   let incluyeTodoP0 = true
   for (const t of titlesP0Set) {
     if (!titlesEnPlano.has(t)) { incluyeTodoP0 = false; break }
   }
   if (!incluyeTodoP0) continue  // ← DESCARTA si falta algún P0
   ```
3. **`!mezclaNrcs`**: No mezclar NRCs del mismo curso+tipo
4. **`verificarConflictos(plano)`**: No haber solapes de horario

#### 7. Scoring
```typescript
const puntaje = calcularPuntaje(plano, preferencias) + (nNrcs * 500) - (gap / 5) + bonusElectivo
```

**Componentes del score**:
- `calcularPuntaje()`: Score base por preferencias del usuario
- `nNrcs * 500`: Bonus por cantidad de NRCs (más opciones = más puntos)
- `gap / 5`: Penalización por gaps entre TEO y LAB del mismo curso
- `bonusElectivo`: `nTitulosElectivos * 2000` — Bonus por cada título de electivo incluido

**`calcularPuntaje()` Interno**:
```typescript
function calcularPuntaje(horario, prefs) {
  let total = 0
  // Por cada día:
  for (const [dia, clases] of Object.entries(porDia)) {
    if (dia === 'Sábado' && prefs.sin_sabados) total -= 10000
    // evaluarDia(): considera entrar_tarde, salir_temprano, sin_ventanas
    total += evaluarDia(ordenadas, prefs)
  }
  // Bonus por secciones TEO más frecuentes
  total += maxFreq * 150
  return total
}
```

**`evaluarDia()` — scoring por criterios**:
- `entrar_tarde`: Recompensa horarios que empiecen después de las 11:00
- `salir_temprano`: Penaliza horarios que terminen después de las 15:00
- `sin_ventanas`: Penaliza gaps > 20 minutos entre clases del mismo día

#### 8. Ordenamiento y Dedup

```typescript
// Ordenar por score descendente
validos.sort((a, b) => b[0] - a[0])

// Firma por NRCs (dedup exacto)
const signature = [...new Set(h.map(c => c.nrc))].sort().join('|')

// LayoutCore: dedup por cursos+horarios (90% threshold)
const layoutCore = (h) => new Set(h.map(c => `${c.titulo}|${c.dia}|${c.hora_inicio}|${c.hora_fin}`))
// Dos horarios con >90% de bloques iguales se consideran "similares"
```

#### 9. Garantizar Diversidad de Electivos
Después del dedup, se verifica que cada electivo esté representado:
```typescript
for (const titulo of nombres2) {
  if (electivosEnResultados.has(titulo)) continue
  // Buscar mejor opción en validos que incluya este electivo
  // Reemplazar la peor opción actual si es necesario
}
```

---

## Bugs Conocidos y Qué Arreglar

### BUG 1: Horarios con P0 faltantes (CRÍTICO)

**Síntoma**: El optimizer recomienda horarios donde falta un ramo obligatorio (P0).

**Dónde mirar**: `optimizer.ts` líneas 290-295. El check `incluyeTodoP0` debería filtrar esto.

**Posibles causas**:
- `titlesP0Set` no se está poblando correctamente
- `nombres0` viene vacío de `consolidarOpciones()` porque algún P0 no tiene opciones válidas
- El filtro de `!incluyeTodoP0` tiene un bug lógico

**Cómo debuggear**:
```typescript
// Agregar después de la línea 295:
if (!incluyeTodoP0) {
  console.log('FALTA P0:', [...titlesP0Set].filter(t => !titlesEnPlano.has(t)))
  continue
}
```

### BUG 2: Conteo de clases incorrecto

**Síntoma**: SchedulePage dice "17 clases semanales" cuando debería decir 14.

**Dónde mirar**: `SchedulePage.tsx` línea 102:
```typescript
({horarioActual.length} {horarioActual.length === 1 ? 'clase' : 'clases'} semanales)
```

**Causa probable**: `horarioActual.length` cuenta TODOS los `ClaseConDia` en el array. Pero si un curso tiene TEO+LAB, son 2 clases por semana. El conteo actual es correcto en cuanto a "bloques de tiempo", pero puede confundir si el usuario espera ver "cursos" en vez de "bloques".

**Solución**: Definir qué quiere decir "clases semanales":
- Opción A: Total de bloques de tiempo (actual) — 17 bloques = 17 clases
- Opción B: Total de clases por semana contando TEO y LAB por separado — puede ser más bajo
- Opción C: Mostrar ambos conteos: "17 bloques / 14 cursos"

### BUG 3: Electivos no aparecen en opciones

**Síntoma**: Solo se recomiendan horarios con un electivo (ej: solo INFRA), nunca el otro.

**Estado actual**: Ya se implementó fix en `optimizer.ts`:
- `layoutCore` ahora incluye `titulo` (línea 343)
- Paso post-dedup garantiza diversidad de electivos (líneas 395-428)

**Verificar**: Si el fix no funciona, revisar que `nombres2` tenga ambos electivos.

### BUG 4: Excel con varias hojas

**Estado actual**: Ya se implementó sheet picker modal en `UploadPage.tsx`.

**Flujo**: Si el Excel tiene >1 hoja, aparece modal para elegir. Si tiene 1 hoja, se carga directo.

---

## Scoring Detallado

### Fórmula Final
```
score = evaluarDia() + (nNrcs * 500) - (teoLabGap / 5) + (nTitulosElectivos * 2000)
```

### Pesos de Criterios
```typescript
const ponderacion = (pos) => {
  if (prefs.criterios.length === 0) return 1
  const pesoBase = prefs.criterios.length === 1 ? 3 : 1
  return prefs.criterios[pos] !== undefined ? pesoBase : 0
}
```

- Si hay 1 solo criterio: peso base = 3
- Si hay 2 criterios: peso base = 1 para ambos
- Si no hay criterios: peso = 1 para todos

### Ejemplo de Scoring
```
Horario con 8 NRCs, 1 electivo, gap 30min, entra 11:00, sale 14:00, sin sábado:

evaluarDia = 0 (sin penalizaciones)
nNrcs * 500 = 8 * 500 = 4000
gap / 5 = 30 / 5 = 6 (penalización)
bonusElectivo = 1 * 2000 = 2000

TOTAL = 0 + 4000 - 6 + 2000 = 5994
```

---

## Estructura del Store (`store.tsx`)

```typescript
interface Store {
  horariosCrudos: HorarioCrudo[]          // Datos crudos del Excel
  selecciones: Record<string, SeleccionUsuario>  // Día seleccionado por cada bloque
  mejoresHorarios: ClaseConDia[][]        // Top N horarios optimizados
  indiceHorario: number                   // Índice del horario actualmente visible
  excluidosDetallados: ExcluidoInfo[]     // Cursos que no cupieron y por qué
  preferencias: Preferencias              // Criterios del usuario
  activeTab: number                       // Tab activa (0-4)
}
```

**Persistencia**: El store usa React Context. Los datos persisten al cambiar de tab (mismo componente). Se pierden al recargar la página.

---

## Archivos Clave para Debugging

| Archivo | Qué buscar |
|---------|-----------|
| `lib/optimizer.ts:290-295` | Check de P0 obligatorios |
| `lib/optimizer.ts:343` | `layoutCore` — dedup por curso+hora |
| `lib/optimizer.ts:395-428` | Garantía de diversidad de electivos |
| `lib/optimizer.ts:504-524` | `calcularPuntaje()` — scoring |
| `pages/SchedulePage.tsx:102` | Conteo de clases en header |
| `pages/UploadPage.tsx` | Sheet picker para multi-sheet |
| `lib/excelParser.ts` | Parseo de Excel, detección de columnas |
| `lib/colors.ts` | Paleta de 15 colores para ramos |

---

## Comandos Útiles

```bash
# Typecheck
cd frontend && npx tsc -b

# Build
cd frontend && npx vite build

# Dev
cd frontend && npm run dev

# Commit y push
git add -A && git commit -m "msg" && git push
```

---

## Notas para el que Arregle

1. **El bug de P0 faltantes es el más crítico.** Los usuarios no deberían ver horarios sin ramos obligatorios. Verificar que `titlesP0Set` se popula correctamente y que el filtro `incluyeTodoP0` funciona.

2. **El conteo de "clases semanales"** puede ser confuso. Preguntar al usuario qué quiere decir: bloques de tiempo, cursos únicos, o clases reales (TEO+LAB separados).

3. **Los electivos** están hardcodeados como individuales `[...o, []]`. Si se quieren combinar (ej: "INFRA + ML"), habría que cambiar la lógica del `listaFinal`.

4. **El LIMITE de 100K combinaciones** puede ser bajo para usuarios con muchos NRCs. Subir si es necesario, pero con cuidado de performance.

5. **El scoring** favorece horarios con más NRCs (cada NRC da +500 puntos). Esto puede causar que opciones con electivos tengan ventaja injusta.
