# UniHorario USS v2 — Plan de Implementación

> **Estado**: Borrador — sujeto a cambios según feedback del profe Hugo Galaz
> **Última actualización**: 2026-08-03

---

## 1. Visión General

UniHorario USS es una aplicación web que optimiza horarios universitarios para estudiantes de Ingeniería Civil Informática de la Universidad San Sebastián.

### Qué cambia en v2

| v1 (Actual) | v2 (Nuevo) |
|-------------|------------|
| 100% client-side, sin backend | NestJS + PostgreSQL |
| Sin auth | Login Outlook (.uss.cl) |
| Usuario categoriza ramos P0/P1/P2 manualmente | Prioridad **automática** según malla |
| Sin concepto de malla curricular | Malla interactiva visual de 10 semestres |
| Un solo flujo para todos | 2 roles: Estudiante y Admin |
| Excel subido por el usuario | Excel subido por el Admin/Director |

### Flujo de alto nivel

```
Login Outlook → Seleccionar Malla → Marcar Ramos Aprobados
    → (Admin: subir Excel + etiquetar electivos)
    → Asignar Días a bloques
    → Optimizar (prioridad automática)
    → Ver Horario → Exportar
```

---

## 2. Stack Tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | React 19 + TypeScript + Vite + Tailwind | Se mantiene |
| Auth | Microsoft Outlook OAuth 2.0 | Solo dominio `.uss.cl` |
| Backend | NestJS | En VPS de la U o Neon (transitorio) |
| DB | PostgreSQL | Neon si el VPS no está listo |
| ORM | Prisma (recomendado) | Type-safe, migration-friendly |
| Optimizer | Lógica actual en `optimizer.ts` | Adaptada para prioridades automáticas |

---

## 3. Esquema de Base de Datos

### Diagrama de entidades

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   users      │────▶│   mallas     │────▶│  malla_cursos    │
│              │     │              │     │                  │
│ id           │     │ id           │     │ id               │
│ email        │     │ nombre       │     │ malla_id (fk)    │
│ name         │     │ year         │     │ nombre           │
│ role         │     │ activa       │     │ semestre (1-10)  │
│ malla_id(fk) │     └──────────────┘     │ es_electivo      │
└──────┬──────┘                            │ electivo_cat     │
       │                                   │ area             │
       │        ┌──────────────────┐       └────────┬─────────┘
       │        │ user_cursos_     │                │
       │        │ aprobados        │       ┌────────┴─────────┐
       │        │                  │       │malla_prerrequisitos│
       │        │ user_id (fk)     │       │                  │
       │        │ malla_curso_id   │       │ curso_id (fk)    │
       │        │ (fk)             │       │ prerequisito_id  │
       │        └──────────────────┘       │ (fk)             │
       │                                   └──────────────────┘
       │
       │        ┌──────────────────┐       ┌──────────────────┐
       │───────▶│    periodos      │────▶│horarios_disponibles│
       │        │                  │       │                  │
       │        │ id               │       │ id               │
       │        │ nombre           │       │ periodo_id (fk)  │
       │        │ subido_por (fk)  │       │ nrc              │
       │        │ created_at       │       │ titulo           │
       │        │ activo           │       │ tipo (TEO/LAB)   │
       │        └──────────────────┘       │ seccion          │
       │                                   │ dia              │
       │        ┌──────────────────┐       │ hora_inicio      │
       │───────▶│electivo_categorias│      │ hora_fin         │
       │        │                  │       │ instructor       │
       │        │ id               │       │ cupos            │
       │        │ periodo_id (fk)  │       │ liga/conector    │
       │        │ malla_cat_id     │       │ electivo_cat     │
       │        │ nrcs (text[])    │       └──────────────────┘
       │        │ nombre_display   │
       │        └──────────────────┘       ┌──────────────────┐
       │                                   │cursos_equivalentes│
       │                                   │                  │
       │                                   │ malla_origen_id  │
       │                                   │ curso_origen_id  │
       │                                   │ malla_destino_id │
       │                                   │ curso_destino_id │
       │                                   └──────────────────┘
```

### Tablas detalladas

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,    -- debe terminar en .uss.cl
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student',  -- 'student' | 'admin'
  malla_id VARCHAR(10),                  -- '2021' | '2024'
  outlook_id VARCHAR(255) UNIQUE,        -- ID de Microsoft OAuth
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `mallas`
```sql
CREATE TABLE mallas (
  id VARCHAR(10) PRIMARY KEY,            -- '2021' | '2024'
  nombre VARCHAR(255) NOT NULL,          -- 'Ing. Civil Informática 2021'
  year INT NOT NULL,
  activa BOOLEAN DEFAULT true
);
```

#### `malla_cursos`
```sql
CREATE TABLE malla_cursos (
  id VARCHAR(50) PRIMARY KEY,            -- 'intro-calculo', 'algebra-1'
  malla_id VARCHAR(10) REFERENCES mallas(id),
  nombre VARCHAR(255) NOT NULL,          -- 'Introducción al Cálculo'
  semestre INT NOT NULL,                 -- 1-10
  es_electivo BOOLEAN DEFAULT false,
  electivo_categoria VARCHAR(50),        -- 'profundizacion_1', 'formacion_integral'
  area VARCHAR(100),                     -- 'ciencias_basicas', 'sistemas', etc.
  orden_dentro_semestre INT DEFAULT 0    -- para mantener el orden visual
);
```

#### `malla_prerrequisitos`
```sql
CREATE TABLE malla_prerrequisitos (
  curso_id VARCHAR(50) REFERENCES malla_cursos(id),
  prerequisito_id VARCHAR(50) REFERENCES malla_cursos(id),
  PRIMARY KEY (curso_id, prerequisito_id)
);
```

#### `user_cursos_aprobados`
```sql
CREATE TABLE user_cursos_aprobados (
  user_id UUID REFERENCES users(id),
  malla_curso_id VARCHAR(50) REFERENCES malla_cursos(id),
  aprobado_en TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, malla_curso_id)
);
```

#### `cursos_equivalentes`
```sql
CREATE TABLE cursos_equivalentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  malla_origen_id VARCHAR(10) REFERENCES mallas(id),
  curso_origen_id VARCHAR(50) REFERENCES malla_cursos(id),
  malla_destino_id VARCHAR(10) REFERENCES mallas(id),
  curso_destino_id VARCHAR(50) REFERENCES malla_cursos(id),
  -- Ej: Mecánica (2021) = Física (2024)
  UNIQUE(curso_origen_id, curso_destino_id)
);
```

#### `periodos`
```sql
CREATE TABLE periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL,           -- '2026-2'
  subido_por UUID REFERENCES users(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `horarios_disponibles`
```sql
CREATE TABLE horarios_disponibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID REFERENCES periodos(id),
  nrc VARCHAR(20) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(10) NOT NULL,             -- 'TEO' | 'LAB'
  seccion VARCHAR(20),
  dia VARCHAR(20) NOT NULL,              -- 'Lunes', 'Martes', etc.
  hora_inicio VARCHAR(5) NOT NULL,       -- '08:00'
  hora_fin VARCHAR(5) NOT NULL,          -- '09:20'
  instructor VARCHAR(255),
  cupos INT,
  liga VARCHAR(20),
  conector VARCHAR(20),
  electivo_categoria VARCHAR(50),        -- null si no es electivo
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `electivo_categorias`
```sql
CREATE TABLE electivo_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID REFERENCES periodos(id),
  malla_categoria_id VARCHAR(50) NOT NULL, -- 'profundizacion_1'
  nombre_display VARCHAR(100) NOT NULL,    -- 'Electivo de Profundización I'
  nrcs TEXT[] DEFAULT '{}',                 -- NRCs que pertenecen a esta categoría
  UNIQUE(periodo_id, malla_categoria_id)
);
```

---

## 4. Flujo de Usuario Detallado

### 4.1 Autenticación

```
Usuario hace click "Iniciar sesión con Outlook"
    → Redirect a Microsoft OAuth
    → Callback con code
    → Backend valida:
        1. Email termina en .uss.cl
        2. Si no existe en users → crear cuenta (role='student')
        3. Retornar JWT
    → Frontend almacena JWT
```

### 4.2 Selección de Malla (primera vez)

```
Si usuario no tiene malla_id:
    → Mostrar pantalla de selección
    → Opciones: "Malla 2021" | "Malla 2024"
    → Guardar en users.malla_id
    → Redirigir a Malla Interactiva
```

### 4.3 Malla Interactiva

```
Usuario ve la malla completa (10 columnas de semestres)
    → Click en un ramo:
        - Si está aprobado → opción "Desmarcar"
        - Si NO está aprobado:
            - ¿Prerrequisitos cumplidos? → Mostrar "Marcar como aprobado"
            - ¿Prerrequisitos NO cumplidos? → Mostrar tooltip "Necesitas aprobar: [lista]"
    → Al marcar/desmarcar → POST /users/me/aprobados
    → La malla se actualiza en tiempo real
```

### 4.4 Asignación de Días (ProcessPage)

```
Solo se muestran los ramos DISPONIBLES (prerrequisitos cumplidos + en el Excel)
    → El sistema ya determinó qué son PRIORIDAD y qué son OPCIONALES
    → Usuario asigna día a cada bloque (igual que el flujo actual)
    → Click "Optimizar"
```

### 4.5 Optimización

```
Backend calcula prioridades:
    → Ramos prioridad = P0 (obligatorios en optimizer)
    → Ramos disponibles no-prioridad = P1 (opcionales)
    → Electivos = P2 (individuales con skip)
    → Optimizer genera top 10 horarios
```

### 4.6 Ver + Exportar (sin cambios significativos)

```
SchedulePage → ver grid, navegar opciones
ExportPage → exportar .xlsx / .csv / .ics
```

---

## 5. Algoritmo de Prioridad Automática

### Pseudocódigo

```typescript
function calcularPrioridades(
  mallaCursos: MallaCurso[],
  aprobados: string[],           // IDs de cursos aprobados
  horariosDisponibles: Horario[], // Del Excel actual
  equivalencias: Equivalencia[]
): { prioridad: number; opciones: Horario[] }[] {

  // 1. Calcular semestre actual del usuario
  const maxSemestreAprobado = max(
    mallaCursos
      .filter(c => aprobados.includes(c.id))
      .map(c => c.semestre)
  )
  const semestreActual = maxSemestreAprobado + 1

  // 2. Encontrar cursos disponibles
  const disponibles = mallaCursos.filter(curso => {
    // Saltar si ya está aprobado
    if (aprobados.includes(curso.id)) return false

    // Verificar si tiene equivalente aprobado
    const tieneEquivalente = equivalencias.some(eq =>
      (eq.curso_origen_id === curso.id && aprobados.includes(eq.curso_destino_id)) ||
      (eq.curso_destino_id === curso.id && aprobados.includes(eq.curso_origen_id))
    )
    if (tieneEquivalente) return false

    // Verificar prerrequisitos
    const prereqs = mallaCursos.filter(c =>
      esPrerequisitoDe(c.id, curso.id)
    )
    const prereqsCumplidos = prereqs.every(p => aprobados.includes(p.id))
    if (!prereqsCumplidos) return false

    return true
  })

  // 3. Asignar prioridad por semestre (menor semestre = mayor prioridad)
  const resultado = disponibles.map(curso => {
    const opcionesEnExcel = horariosDisponibles.filter(h =>
      matchByNombre(h.titulo, curso.nombre)
    )

    // Determinar si es prioridad (ramos atrasados del semestre más antiguo)
    const esPrioridad = curso.semestre < semestreActual

    return {
      curso,
      prioridad: esPrioridad ? 0 : 1,  // 0=obligatorio, 1=opcional
      opciones: opcionesEnExcel,
      semestre: curso.semestre,
      esElectivo: curso.es_electivo
    }
  })

  // 4. Manejar electivos por separado
  return resultado.filter(r => {
    if (r.esElectivo) {
      r.prioridad = 2  // Los electivos siempre son P2
    }
    return true
  })
}
```

### Reglas de negocio

1. **Ramo atrasado = PRIORIDAD**: Si el semestre del ramo es menor al semestre actual del usuario, es P0 (obligatorio).

2. **Ramo del semestre actual = OPCIONAL**: Si el ramo es del semestre actual o futuro, es P1 (se incluye si hay cupo).

3. **Ramo no está en el Excel**: Se salta este período. Será prioridad el próximo semestre cuando se dicte.

4. **Tope entre atrasado y nuevo**: El atrasado GANA. Los nuevos quedan fuera si hay conflicto.

5. **Electivos**: Siempre P2. Se manejan individualmente con `[...opciones, []]` (skip si no hay cupo).

6. **Ejemplo práctico**:
   ```
   Malla 2024:
   - Sem 1: Algebra 1 [APROBADO], Cálculo 1 [APROBADO]
   - Sem 2: Álgebra Lineal [APROBADO], Cálculo Diferencial [NO APROBADO], Programación [NO APROBADO]
   - Sem 3: Cálculo Multivariable [NO APROBADO], Mecánica [NO APROBADO]

   Semestre actual = 3 (aprobó hasta sem 2 completo)

   Disponibles:
   - Cálculo Diferencial (sem 2) → PRIORIDAD (atrasado)
   - Programación (sem 2) → PRIORIDAD (atrasado)
   - Cálculo Multivariable (sem 3) → OPCIONAL
   - Mecánica (sem 3) → OPCIONAL

   Si Programación choca con Cálculo Multivariable:
   → Programación GANA (es P0, obligatorio)
   → Cálculo Multivariable queda fuera (es P1, opcional)
   ```

---

## 6. Malla Interactiva — Especificación del Componente

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  SEMESTRE 1  │  SEMESTRE 2  │  SEMESTRE 3  │ ... │  SEMESTRE 10  │
├──────────────┼──────────────┼──────────────┼─────┼───────────────┤
│ [✓] Intro    │ [✓] Cálculo  │ [ ] Cálculo  │     │ [ ] Gestión   │
│   Cálculo    │   Diferenc.  │   Multivar.  │     │   de Proyectos│
│              │              │              │     │               │
│ [✓] Álgebra  │ [✓] Álgebra  │ [ ] Mecánica │     │ [ ] Seguridad │
│              │   Lineal     │              │     │   Informática │
│              │              │              │     │               │
│ [✓] Intro a  │ [ ] Química  │ [ ] POO      │     │ [ ] Taller    │
│   Programac. │   General    │              │     │   Empresa II  │
│              │              │              │     │               │
│ [ ] Intro a  │ [ ] Lab      │ [ ] Tec.     │     │               │
│   la Info.   │   Química    │   Digitales  │     │               │
│              │              │              │     │               │
│ [ ] Taller   │ [ ] Taller   │ [ ] Taller   │     │               │
│   Intro Ing. │   Trabajo    │   Liderazgo  │     │               │
│              │   Equipo     │              │     │               │
│              │              │              │     │               │
│ [ ] Estrat.  │ [ ] Inglés I │ [ ] Inglés   │     │               │
│   Aprendiz.  │              │   II         │     │               │
└──────────────┴──────────────┴──────────────┴─────┴───────────────┘
```

### Estados del ramo

| Estado | Color | Ícono | Acción |
|--------|-------|-------|--------|
| Aprobado | Verde claro + tachado | ✓ | Click → "Desmarcar" |
| Disponible (prereqs ok) | Amarillo/borde dorado | ○ | Click → "Marcar como aprobado" |
| No disponible (prereqs faltan) | Gris oscuro | — | Click → tooltip "Necesitas: [ramos]" |
| Prioridad (atrasado + en Excel) | Rojo/borde rojo | ! | Click → "Marcar como aprobado" |
| No dictado este período | Gris + icono calendario | ⏸ | Sin acción (se dicts cada 2 semestres) |

### Comportamiento

- **Sidebar fijo** o **pantalla completa** (decidir en diseño)
- **Responsive**: En móvil, los 10 semestres se apilan verticalmente o son scroll horizontal
- **Búsqueda**: Barra para filtrar ramos por nombre
- **Progreso**: Barra superior mostrando "15/52 ramos aprobados (29%)"
- **Resumen**: Panel lateral mostrando:
  - Semestre actual estimado
  - Ramos aprobados por semestre
  - Electivos faltantes

---

## 7. Sistema de Electivos

### Categorías de electivos (según malla)

| ID | Nombre | Semestre |
|----|--------|----------|
| `profundizacion_1` | Electivo de Profundización I | 6 |
| `profundizacion_2` | Electivo de Profundización II | 7 |
| `profundizacion_3` | Electivo de Profundización III | 9 |
| `profundizacion_4` | Electivo de Profundización IV | 10 |
| `formacion_integral` | Electivo de Formación Integral | 9 |

### Flujo de etiquetado (Admin)

```
Admin sube Excel de período
    → El sistema parsea los NRCs (igual que el parser actual)
    → Admin ve una tabla de electivos:

    ┌─────────────────────────────┬──────────────────────────────────┐
    │ Categoría                   │ NRCs disponibles                 │
    ├─────────────────────────────┼──────────────────────────────────┤
    │ Electivo Profundización I   │ [☐] 12345 - Inteligencia Art.  │
    │                             │ [☐] 12346 - Minería de Datos   │
    │                             │ [☐] 12347 - Redes Neuronales   │
    ├─────────────────────────────┼──────────────────────────────────┤
    │ Electivo Profundización II  │ [☐] 23456 - Cloud Computing    │
    │                             │ [☐] 23457 - DevOps             │
    ├─────────────────────────────┼──────────────────────────────────┤
    │ Electivo Formación Integral │ [☐] 34567 - Ética Profesional  │
    └─────────────────────────────┴──────────────────────────────────┘

    → Admin marca los NRCs que corresponden a cada categoría
    → Guarda en electivo_categorias
```

### En el optimizer

Los electivos se manejan como P2 individuales:

```typescript
// Cada electivo categoría se convierte en una entrada independiente
const electivos = electivoCategorias.map(cat => ({
  titulo: cat.nombre_display,
  opciones: horarios.filter(h => cat.nrcs.includes(h.nrc)),
  prioridad: 2  // P2 = electivo individual con skip
}))

// En listaFinal del optimizer:
for (const e of electivos) {
  listaFinal.push([...e.opciones, []])  // [] = "skip este electivo"
}
```

---

## 8. Matching de Ramos (Excel ↔ Malla)

### Estrategia de matching

```typescript
function matchByNombre(
  tituloExcel: string,      // 'Ing.req.aseg. de software'
  nombreMalla: string       // 'Ingeniería de Requerimientos y Aseguramiento de Software'
): boolean {

  // 1. Match exacto (normalizado)
  if (normalizar(tituloExcel) === normalizar(nombreMalla)) return true

  // 2. Match por alias conocidos
  const ALIASES: Record<string, string[]> = {
    'algebra': ['álgebra', 'algebra 1', 'álgebra i'],
    'calculo-1': ['cálculo 1', 'intro al cálculo', 'introducción al cálculo'],
    'prog-req-aseg': ['ing.req.aseg. de software', 'ing. req. aseg', 'prog req aseg'],
    // ... más aliases
  }
  // Verificar si ambos textos matchean contra el mismo alias

  // 3. Fuzzy match (Levenshtein distance < 30% del largo)
  const distancia = levenshtein(normalizar(tituloExcel), normalizar(nombreMalla))
  const umbral = Math.max(normalizar(nombreMalla).length * 0.3, 5)
  return distancia <= umbral
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[^a-z0-9\s]/g, '')  // quitar puntuación
    .replace(/\s+/g, ' ')  // colapsar espacios
    .trim()
}
```

### Matching con equivalentes

```typescript
function encontrarRamoMalla(
  tituloExcel: string,
  mallaCursos: MallaCurso[],
  equivalencias: Equivalencia[]
): MallaCurso | null {

  // 1. Intentar match directo
  for (const curso of mallaCursos) {
    if (matchByNombre(tituloExcel, curso.nombre)) return curso
  }

  // 2. Buscar en equivalentes
  for (const eq of equivalencias) {
    const cursoOrigen = mallaCursos.find(c => c.id === eq.curso_origen_id)
    const cursoDestino = mallaCursos.find(c => c.id === eq.curso_destino_id)

    if (cursoOrigen && matchByNombre(tituloExcel, cursoOrigen.nombre)) return cursoDestino
    if (cursoDestino && matchByNombre(tituloExcel, cursoDestino.nombre)) return cursoOrigen
  }

  return null  // No encontrado → admin debe mapear manualmente
```

### Admin panel: Ramos no matcheados

Después de subir el Excel, el admin ve:

```
⚠️ 3 ramos no se pudieron mapear automáticamente:

| NRC  | Nombre en Excel              | Acción                        |
|------|------------------------------|-------------------------------|
| 45678| Ing.req.aseg. de software    | [Dropdown: seleccionar ramo]  |
| 56789| Taller de Emprendimiento I   | [Dropdown: seleccionar ramo]  |
| 67890| Base de Datos II             | [Dropdown: seleccionar ramo]  |

→ El admin selecciona manualmente el ramo de la malla que corresponde
→ Se guarda como equivalente temporal para ese período
```

---

## 9. Panel de Admin

### Toggle "Modo Estudiante"

En el header del admin, un switch:

```
┌─────────────────────────────────────┐
│  [🔔] [👤 Admin Hugo Galaz] [🔄]   │
│                          [Estudiante]│
└─────────────────────────────────────┘
```

Al activar "Modo Estudiante":
- Se ocultan las funciones de admin
- El admin usa la app como cualquier estudiante
- Puede marcar sus propios aprobados en la malla

### Funciones de Admin

| Función | Descripción |
|---------|-------------|
| **Subir Excel** | Mismo flujo que UploadPage, pero guarda en DB |
| **Etiquetar Electivos** | Combo múltiple para asignar NRCs a categorías |
| **Mapear Equivalentes** | Tabla para vincular ramos entre mallas |
| **Gestionar Períodos** | Ver/eliminar períodos anteriores |
| **Ver Usuarios** | Lista de estudiantes registrados |
| **Asignar Roles** | Cambiar student ↔ admin |

### Flujo de upload de Excel (Admin)

```
1. Admin hace click "Subir nuevo período"
2. Selecciona archivo .xlsx
3. Sistema parsea (usa excelParser.ts actual)
4. Muestra preview: NRCs encontrados, ramos únicos, profes
5. Admin confirma
6. Sistema intenta matchear ramos con la malla
7. Si hay no-matcheados → muestra tabla para mapeo manual
8. Admin etiqueta electivos
9. Guarda en DB (periodos + horarios_disponibles + electivo_categorias)
```

---

## 10. Integración con Optimizer

### Cambios en el flujo actual

| Paso | v1 (Actual) | v2 (Nuevo) |
|------|-------------|------------|
| Upload Excel | Usuario sube | Admin sube, se guarda en DB |
| Categorizar | Usuario asigna P0/P1/P2 | **Eliminado** — prioridad automática |
| Asignar días | Usuario asigna día por bloque | Sin cambios |
| Preferencias | Usuario elige criterios | Sin cambios |
| Optimizar | Recibe prioridades manuales | Recibe prioridades calculadas del backend |

### Nuevo endpoint: `GET /optimizer/prioridades`

```typescript
// Request
GET /optimizer/prioridades?periodo_id=xxx

// Response
{
  prioridades: {
    "12345": 0,  // NRC → prioridad (0=P0, 1=P1, 2=P2)
    "12346": 0,
    "23456": 1,
    "34567": 2,
  },
  metadatos: {
    semestreActual: 4,
    ramosAprobados: 22,
    ramosDisponibles: 8,
    ramosPrioridad: 2,
    ramosOpcionales: 4,
    electivos: 2
  }
}
```

### Cambios en `optimizer.ts`

```typescript
// ANTES: El usuario asignaba prioridad manualmente
const prioridad = horario.prioridad  // 0, 1, o 2

// DESPUÉS: La prioridad viene del backend
const prioridadesMap = await fetchPrioridades(periodoId)
const prioridad = prioridadesMap[horario.nrc]  // Calculado automáticamente
```

### Cambios en el CategorizePage

- **Se renombra** a `MallaPage` o `ProgresoPage`
- **Ya no muestra** la lista de NRCs con dropdowns de P0/P1/P2
- **Muestra** la malla interactiva donde el usuario marca aprobados
- **Muestra** un resumen: "2 ramos prioridad este período, 4 opcionales, 2 electivos"

---

## 11. Fases de Implementación

### Fase 0: Seed de Mallas (Bloqueador) — ~2-3 días

**Dependencias**: PDFs de ambas mallas
**Entregable**: Script SQL o JSON con la estructura de ambas mallas

- [ ] Extraer estructura de Malla 2021 del PDF
- [ ] Extraer estructura de Malla 2024 del PDF
- [ ] Definir prerrequisitos para cada ramo
- [ ] Definir áreas y categorías de electivos
- [ ] Crear script de seed para PostgreSQL
- [ ] Verificar que el grafo de prerrequisitos es válido (sin ciclos)

### Fase 1: Backend + Auth — ~5-7 días

**Dependencias**: Fase 0
**Entregable**: API funcional con auth y CRUD básico

- [ ] Setup NestJS + Prisma + PostgreSQL
- [ ] Implementar OAuth con Microsoft Azure AD
- [ ] Validación de dominio `.uss.cl`
- [ ] CRUD de users, mallas, malla_cursos
- [ ] CRUD de user_cursos_aprobados
- [ ] CRUD de periodos + horarios_disponibles
- [ ] Endpoint de login/registro
- [ ] Guards de autenticación y roles

### Fase 2: Malla Interactiva (Frontend) — ~5-7 días

**Dependencias**: Fase 1 (API de mallas + aprobados)
**Entregable**: Componente visual de malla clickable

- [ ] Componente `MallaGrid` con layout de 10 columnas
- [ ] Estados visuales (aprobado, disponible, no disponible, prioridad)
- [ ] Interacción: click → modal de acción
- [ ] Validación de prerrequisitos (client-side + server-side)
- [ ] Barra de progreso
- [ ] Responsive (mobile: scroll horizontal o apilado)
- [ ] Conexión con API de aprobados

### Fase 3: Lógica de Prioridad (Backend) — ~3-4 días

**Dependencias**: Fase 1 + Fase 0
**Entregable**: Endpoint que calcula prioridades automáticamente

- [ ] Implementar `calcularPrioridades()`
- [ ] Matching de ramos (Excel ↔ Malla)
- [ ] Manejo de equivalentes
- [ ] Manejo de electivos
- [ ] Endpoint GET `/optimizer/prioridades`
- [ ] Tests con diferentes escenarios

### Fase 4: Admin Panel — ~4-5 días

**Dependencias**: Fase 1
**Entregable**: Panel de admin funcional

- [ ] Toggle "Modo Estudiante" en header
- [ ] Upload de Excel (reutilizar lógica de UploadPage)
- [ ] Guardar Excel en DB (no solo en store)
- [ ] Etiquetado de electivos con combo múltiple
- [ ] Tabla de mapeo de no-matcheados
- [ ] Gestión de períodos
- [ ] Gestión de usuarios

### Fase 5: Integración Optimizer — ~3-4 días

**Dependencias**: Fase 2 + Fase 3
**Entregable**: Flujo completo funcionando

- [ ] Adaptar ProcessPage para usar prioridades del backend
- [ ] Eliminar CategorizePage (reemplazar por MallaPage)
- [ ] Conectar optimizer con nuevas prioridades
- [ ] Tests end-to-end del flujo completo
- [ ] Verificar que P0 obligatorios siempre aparecen

### Fase 6: Extras (v2+) — Futuro

- [ ] Soporte para 2 mallas (importar aprobados de otra)
- [ ] Comparación de mallas
- [ ] Pool de electivos rotativos
- [ ] Notificaciones de nuevos períodos
- [ ] Dashboard de estadísticas para admin

---

## 12. Preguntas Abiertas (pendientes con profe Hugo)

| # | Pregunta | Impacto |
|---|----------|---------|
| 1 | ¿El Excel de horarios cambiará de formato en el futuro? | Define cuánto invertir en el parser actual |
| 2 | ¿Cómo manejar estudiantes que toman ramos de ambas mallas? | Decide si necesitamos sistema de "malla dual" |
| 3 | ¿Los electivos de Formación Integral se tratan igual que Profundización? | Define la UI de etiquetado |
| 4 | ¿Se necesita historial de períodos anteriores? | Define si guardamos Excel viejos en DB |
| 5 | ¿El admin puede ver el progreso de los estudiantes? | Funcionalidad extra de admin |
| 6 | ¿Se necesita notificar cuando hay un nuevo período disponible? | Feature de push/email |
| 7 | ¿La malla 2024 tiene los mismos prerrequisitos que la 2021 o cambiaron? | Afecta el seed de prerrequisitos |

---

## 13. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Matching Excel↔Malla falla mucho | Alta | Alto | Tabla de aliases + fallback manual para admin |
| Estructura de malla no extraída correctamente | Media | Crítico | Validar con el profe Hugo antes de implementar |
| OAuth con Outlook complejo | Media | Alto | Usar librería `@azure/msal-node` o Passport |
| Performance del optimizer con prioridades dinámicas | Baja | Medio | Benchmark con 50+ ramos |
| Cambios de último minuto en el Excel del profe | Alta | Medio | Diseñar parser flexible, no hardcodear |

---

## 14. Decisiones Técnicas Pendientes

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| ORM | Prisma vs TypeORM vs Knex | **Prisma** — type-safe, migraciones automáticas |
| State management (frontend) | Context (actual) vs Zustand vs Redux | **Context** — se mantiene, no hay necesidad de cambio |
| Malla storage | JSON en DB vs DB relacional | **DB relacional** — ya tenemos prerrequisitos como tabla |
| PDF parsing | Manual (seed script) vs OCR vs librería | **Manual** — más confiable, el profe puede validar |
| Deploy | Vercel (frontend) + Railway/Fly.io (backend) | Definir según disponibilidad del VPS de la U |

---

*Este documento es vivo. Se actualiza conforme se tomen decisiones con el profe Hugo Galaz y el equipo.*
