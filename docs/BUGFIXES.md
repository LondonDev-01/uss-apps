# Documentación de Cambios — Bugfixes

Registro de los arreglos aplicados a partir de los bugs listados en
[`PROJECT_HANDOFF.md`](./PROJECT_HANDOFF.md) §"Bugs Conocidos y Qué Arreglar".

## Resumen

| Bug | Severidad | Estado | Archivos tocados |
|-----|-----------|--------|------------------|
| BUG 1: Horarios con P0 faltantes | Crítico | Endurecido + logging + red de seguridad | `frontend/src/lib/optimizer.ts` |
| BUG 2: Conteo de clases incorrecto | UX | Resuelto | `frontend/src/pages/SchedulePage.tsx` |
| BUG 3: Electivos no aparecen en opciones | Medio | Sin cambios (ya implementado) | — |
| BUG 4: Excel con varias hojas | Bajo | Sin cambios (ya implementado) | — |
| BUG 5: Clases visibles en detalle pero no en grilla (renderizado) | Crítico | Resuelto | `frontend/src/components/ScheduleGrid.tsx` |
| Mejora UX: autoscroll al cambiar de pestaña | UX | Implementado | `frontend/src/pages/UploadPage.tsx`, `frontend/src/pages/CategorizePage.tsx`, `frontend/src/pages/ProcessPage.tsx`, `frontend/src/pages/SchedulePage.tsx` |

---

## BUG 1 — Horarios con P0 faltantes (crítico)

### Síntoma original

> El optimizer recomienda horarios donde falta un ramo obligatorio (P0).

### Análisis previo al fix

Se trazó `frontend/src/lib/optimizer.ts` línea por línea y se concluyó
que el síntoma descrito (un horario entregado al usuario sin un P0) es
**estructuralmente imposible** con el código previo al fix. La razón:

1. En la construcción de `listaFinal` (línea 260 del archivo original),
   las opciones de P0 se empujan **sin** el `[]` centinela de "opcional"
   (que sí tienen P1 y P2 en las líneas siguientes). Por lo tanto, el
   producto cartesiano **siempre** incluye una opción no-vacía por cada
   P0.
2. Como consecuencia, todo `plano` resultante contiene todos los
   títulos P0 y el filtro `incluyeTodoP0` (L290) es una red de seguridad
   redundante que nunca debería disparar.
3. Adicionalmente ya existe un guardia temprano (L241) que aborta con
   mensaje claro cuando algún P0 no tiene combinación válida.

Por lo tanto, las "posibles causas" que lista la doc son hipótesis no
confirmadas. Sin un Excel de reproducción con el que se haya observado
el síntoma, no es posible aislar el origen exacto. Sí se puede afirmar
que cualquier regresión futura en el post-procesamiento de electivos
(que sí muta `mejores` después del producto cartesiano) podría romper
esa invariante.

### Cambios aplicados

#### 1. Logging de debug en el filtro `incluyeTodoP0`

Se agregó un `console.warn` cuando una combinación no incluye todos los
P0, con el detalle de los títulos faltantes — exactamente lo que
sugería la doc en §"Cómo debuggear".

```typescript
if (!incluyeTodoP0) {
  console.warn('[optimizer] combinación descartada, faltan P0:',
    [...titlesP0Set].filter(t => !titlesEnPlano.has(t)))
  continue
}
```

#### 2. Red de seguridad defensiva antes de retornar

Después de todo el post-procesamiento de electivos y antes de calcular
los excluidos, se fuerza explícitamente la invariante "todo horario
entregado contiene todos los P0". Si algún horario la viola, se
descarta con `console.warn`; si todos se descartan, se retorna un
mensaje claro en lugar de entregar resultados incorrectos.

```typescript
const titulosP0Esperados = new Set(nombres0)
if (titulosP0Esperados.size > 0 && mejores.length > 0) {
  for (let i = mejores.length - 1; i >= 0; i--) {
    const presentes = new Set(mejores[i].map(c => c.titulo))
    const faltantes = [...titulosP0Esperados].filter(t => !presentes.has(t))
    if (faltantes.length > 0) {
      console.warn('[optimizer] descartando horario final sin P0:', faltantes)
      mejores.splice(i, 1)
    }
  }
  if (mejores.length === 0) {
    return {
      horarios: [],
      mensaje: 'No se pudo generar ningún horario que incluya todos los ramos prioritarios (P0). Revisa que cada P0 tenga un NRC con día asignado y sin tope.',
      excluidos: [],
      excluidosDetallados: []
    }
  }
}
```

### Por qué este enfoque

- **Cero riesgo de regresión**: en condiciones normales, ambos bloques
  son inertes (la invariante ya se cumple estructuralmente).
- **Visibilidad ante futuras regresiones**: cualquier mutación futura
  del post-procesamiento que rompa la invariante quedará registrada en
  consola con la lista de P0 faltantes.
- **Alineado con la doc**: implementa literalmente la sugerencia de
  debug de §"Cómo debuggear" y cumple la nota 1 §"Notas para el que
  Arregle" ("los usuarios no deberían ver horarios sin ramos
  obligatorios").

### Lo que queda pendiente

Si en producción se observa el síntoma original (horario mostrado sin
P0), reproducir con un Excel de ejemplo y abrir la consola del
navegador: los `[optimizer]` warnings indicarán exactamente qué P0 se
perdió en qué etapa.

---

## BUG 2 — Conteo de clases incorrecto

### Síntoma original

> SchedulePage dice "17 clases semanales" cuando debería decir 14.

### Causa raíz

`horarioActual.length` cuenta **bloques de tiempo** (cada `ClaseConDia`
es un bloque: TEO lunes + TEO miércoles + LAB viernes de un mismo
curso = 3 bloques), no cursos únicos. La etiqueta "clases semanales"
resultaba ambigua y dependía de la interpretación del usuario.

### Cambio aplicado

Se adoptó la **Opción C** de la doc (§"Solución"), que muestra ambos
conteos y elimina la ambigüedad.

**Antes** (`frontend/src/pages/SchedulePage.tsx`):

```tsx
({horarioActual.length} {horarioActual.length === 1 ? 'clase' : 'clases'} semanales)
```

**Después**:

```tsx
({horarioActual.length} {horarioActual.length === 1 ? 'bloque' : 'bloques'} · {titulosEnHorario.size} {titulosEnHorario.size === 1 ? 'curso' : 'cursos'})
```

`titulosEnHorario` ya estaba disponible (línea 44 del archivo previo
al cambio) como `Set` de títulos presentes, por lo que no requirió
nuevos cómputos.

### Ejemplo del nuevo texto

> Opción **1** de **10** alternativas (17 bloques · 14 cursos)

---

## BUG 3 y BUG 4

Marcados como "Ya implementado" en la doc. Verificados presentes en el
código, sin necesidad de cambios.

---

## Verificación

- `cd frontend && npx tsc -b` → exit 0, sin errores de tipos.
- No hay test runner, linter ni formatter configurados en el proyecto;
  el flujo de verificación definido es typecheck + build
  (`npm run build`).
- Se recomienda abrir la consola del navegador durante pruebas reales
  con Excel para capturar los `[optimizer]` warnings si los hubiera.

---

## Mejora de UX — Autoscroll al cambiar de pestaña

### Motivación

Al avanzar en el wizard (Upload → Categorize → Process → Schedule →
Export), la posición del scroll se quedaba a mitad de camino después de
presionar el botón de continuación. Eso oculta la cabecera de la página
destino, donde normalmente están los criterios, filtros o resúmenes más
importantes.

### Cambio aplicado

Se aplicó una doble estrategia en las cuatro páginas principales del
wizard:

1. **Scroll inmediato al presionar el botón de continuar** (behavior
   `instant`), para evitar que la navegación arrastre la posición
   anterior.
2. **Scroll suave al montar la página** (`useEffect` con behavior
   `smooth`), para cubrir deep links o recargas que no pasen por el
   botón.

### Archivos y botones afectados

- `frontend/src/pages/UploadPage.tsx`
  - Botón: "Continuar: Categorizar ramos" (`continueToCategorize`).
- `frontend/src/pages/CategorizePage.tsx`
  - Botón: "Continuar: Asignar días" (`handleProceed`).
- `frontend/src/pages/ProcessPage.tsx`
  - Botón: "Optimizar horario →" (`optimizar`, antes de
    `navigate('/schedule')`).
- `frontend/src/pages/SchedulePage.tsx`
  - Botón: "Exportar horario" (antes de `navigate('/export')`).

### Fragmento típico

```typescript
// Antes de navegar
window.scrollTo({ top: 0, behavior: 'instant' })
navigate('/ruta-siguiente')

// Al montar el componente
useEffect(() => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}, [])
```

---

## BUG 5 — Clases visibles en detalle pero no en la grilla (renderizado crítico)

### Síntoma reportado por usuario

> Al generar un horario de semestre 8, el header muestra "17 bloques", el
> detalle lateral lista todas las asignaturas, pero en la grilla visual
> aparecen menos bloques. Por ejemplo, una clase del Lunes a las 16:00
> aparece en la leyenda del lado pero no en el calendario.

### Análisis

El problema estaba en `frontend/src/components/ScheduleGrid.tsx:47`, que
usaba slots de tiempo fijos para decidir qué clase se dibujaba en cada
fila:

```typescript
const SLOTS = ['08:00', '09:30', '11:00', '12:30', '13:11', '14:40', '16:00', '17:35', '19:00']
```

La condición de búsqueda era:

```typescript
return hi <= slotMinutes[si] && slotMinutes[si] < hf
```

Esta condición exige que la clase **empiece antes o exactamente en el
horario del slot**. Si una clase empieza unos minutos después (ej:
`16:10` en el slot de las `16:00`), la comparación `970 <= 960` es
`false`, la clase no se encuentra en ningún slot y **desaparece de la
grilla visual** aunque siga estando presente en `horarioActual` (por eso
el conteo y la leyenda lateral sí la mostraban).

### Fix aplicado

Se reemplazó la condición por una de **solapamiento real** entre la
clase y el rango del slot:

```typescript
const slotStart = slotMinutes[si]
const slotEnd = si < SLOTS.length - 1 ? slotMinutes[si + 1] : Infinity
return hi < slotEnd && hf > slotStart
```

Ahora una clase se dibuja en un slot si ocupa algún tiempo dentro de ese
rango, independientemente de si arranca exactamente en el borde. El
cálculo de `rowSpan` y el sistema `placed[]` se mantuvieron sin cambios.

### Consecuencias

- Clases que antes eran invisibles ahora se renderizan.
- Clases levemente desfasadas se muestran en el slot correcto en lugar
de desaparecer.
- Cero regresión: las clases que ya se renderizaban correctamente
siguen cumpliendo la nueva condición (si `hi <= slotStart`, entonces
`hi < slotEnd` también se cumple).

### Archivo modificado

- `frontend/src/components/ScheduleGrid.tsx` — línea de búsqueda por slot.

---

## Archivos modificados

- `frontend/src/lib/optimizer.ts`
  - Logging en filtro `incluyeTodoP0` (~L290).
  - Red de seguridad defensiva antes de calcular excluidos (~L435).
- `frontend/src/pages/SchedulePage.tsx`
  - Texto del header con conteo dual bloques/cursos (~L102).
  - Autoscroll en botón "Exportar horario" y al montar la página.
- `frontend/src/pages/UploadPage.tsx`
  - Autoscroll en botón "Continuar: Categorizar ramos" y al montar la página.
- `frontend/src/pages/CategorizePage.tsx`
  - Autoscroll en botón "Continuar: Asignar días" y al montar la página.
- `frontend/src/pages/ProcessPage.tsx`
  - Autoscroll en botón "Optimizar horario" y al montar la página.

## Archivos no modificados (referencia)

- `frontend/src/lib/optimizer.ts:127-171` — `consolidarOpciones` no se
  tocó: la lógica de matching liga/conector tiene propósito (vincular
  la TEO con su LAB correcta) y modificarla podría emparejar
  secciones incorrectas del mismo ramo.
- `frontend/src/components/ScheduleGrid.tsx` — condición de búsqueda por
  slot corregida para evitar clases invisibles (BUG 5).
- `frontend/src/pages/UploadPage.tsx` — sheet picker multi-hoja ya
  presente (BUG 4).
- `frontend/src/lib/optimizer.ts:342-343` — `layoutCore` con `titulo`
  presente, diversidad de electivos implementada en
  `generarTopHorarios` (BUG 3).
