// Script de verificación manual (no es parte del build ni de un runner de
// tests — el proyecto no tiene Jest configurado todavía). Corre el ejemplo
// práctico exacto de docs/PLAN_V2.md §5 contra calcularPrioridadesPuro y
// falla con exit code 1 si el resultado no matchea lo esperado.
//
// Uso: pnpm exec tsx scripts/verify-optimizer.ts

import { calcularPrioridadesPuro } from '../src/modules/optimizer/optimizer.service';

// Malla 2024 (recorte del ejemplo del plan):
// - Sem 1: Algebra 1 [APROBADO], Cálculo 1 [APROBADO]
// - Sem 2: Álgebra Lineal [APROBADO], Cálculo Diferencial [NO], Programación [NO]
// - Sem 3: Cálculo Multivariable [NO], Mecánica [NO]
const cursos = [
  { id: 'algebra-1', nombre: 'Algebra 1', semestre: 1, area: null, esElectivo: false, prerrequisitos: [] },
  { id: 'calculo-1', nombre: 'Cálculo 1', semestre: 1, area: null, esElectivo: false, prerrequisitos: [] },
  { id: 'algebra-lineal', nombre: 'Álgebra Lineal', semestre: 2, area: null, esElectivo: false, prerrequisitos: [{ prerequisitoId: 'algebra-1' }] },
  { id: 'calculo-dif', nombre: 'Cálculo Diferencial', semestre: 2, area: null, esElectivo: false, prerrequisitos: [{ prerequisitoId: 'calculo-1' }] },
  { id: 'programacion', nombre: 'Programación', semestre: 2, area: null, esElectivo: false, prerrequisitos: [] },
  // El plan (PLAN_V2 §5, "Ejemplo práctico") no define el prerrequisito de
  // este ramo explícitamente y lo lista como disponible pese a que
  // "Cálculo Diferencial" (semestre anterior) no está aprobado — es un
  // ejemplo simplificado centrado en ilustrar la prioridad por semestre,
  // no una malla real. Se replica sin prerrequisito para matchear el
  // resultado esperado documentado.
  { id: 'calculo-multi', nombre: 'Cálculo Multivariable', semestre: 3, area: null, esElectivo: false, prerrequisitos: [] },
  { id: 'mecanica', nombre: 'Mecánica', semestre: 3, area: null, esElectivo: false, prerrequisitos: [] },
];

const aprobados = new Set(['algebra-1', 'calculo-1', 'algebra-lineal']);

const horarios = [
  { nrc: '100', titulo: 'Calculo Diferencial' },
  { nrc: '101', titulo: 'Programacion' },
  { nrc: '102', titulo: 'Calculo Multivariable' },
  { nrc: '103', titulo: 'Mecanica' },
];

const resultado = calcularPrioridadesPuro(cursos, aprobados, [], horarios);

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: esperado=${JSON.stringify(expected)} obtenido=${JSON.stringify(actual)}`);
  if (!ok) process.exitCode = 1;
}

// Semestre actual = 3 (aprobó hasta sem 2 completo -> maxSemestreAprobado=2)
assertEqual('semestreActual', resultado.metadatos.semestreActual, 3);

const porNombre = Object.fromEntries(resultado.cursosDisponibles.map((c) => [c.nombre, c.prioridad]));
assertEqual('Cálculo Diferencial (atrasado) -> P0', porNombre['Cálculo Diferencial'], 0);
assertEqual('Programación (atrasado) -> P0', porNombre['Programación'], 0);
assertEqual('Cálculo Multivariable (semestre actual) -> P1', porNombre['Cálculo Multivariable'], 1);
assertEqual('Mecánica (semestre actual) -> P1', porNombre['Mecánica'], 1);

assertEqual('ramosPrioridad', resultado.metadatos.ramosPrioridad, 2);
assertEqual('ramosOpcionales', resultado.metadatos.ramosOpcionales, 2);

// El regla 4 ("el atrasado gana") es responsabilidad del optimizer.ts que
// consume este mapa (Fase 5 / PLAN_V3 Fase E) — acá solo se verifica que
// el NRC de cada ramo quedó con la prioridad correcta para que el
// optimizer decida.
assertEqual('NRC 100 (Cálculo Diferencial) -> P0', resultado.prioridades['100'], 0);
assertEqual('NRC 102 (Cálculo Multivariable) -> P1', resultado.prioridades['102'], 1);

if (process.exitCode === 1) {
  console.error('\nVerificación FALLÓ.');
} else {
  console.log('\nVerificación OK: calcularPrioridadesPuro matchea el ejemplo de PLAN_V2 §5.');
}
