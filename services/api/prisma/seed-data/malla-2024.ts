// Ingeniería Civil Informática — Malla 2024
// Fuente: assets/Malla_Nueva.pdf, página 2 (imagen del diagrama curricular)
//
// Misma salvedad que malla-2021.ts: los prerrequisitos son una heurística
// conservadora sin validar con el profe Hugo — el PDF no trae las líneas de
// conexión reales, solo semestre/área. "(*) Vía de Titulación" del semestre
// 10 se modela como un único curso placeholder: el PDF ofrece 4 modalidades
// distintas (Proyecto en Empresa, Proyecto de Título, Proyecto de
// Emprendimiento, Proyecto Trainee) que no están desglosadas — hay que
// resolver esto con el profe Hugo antes de tratarlo como un ramo real.

import type { SeedCurso } from './types';

export const MALLA_2024_ID = '2024';

export const CURSOS_2024: SeedCurso[] = [
  // Semestre 1
  { id: '2024-1-1', nombre: 'Introducción al Cálculo', semestre: 1, area: 'Formación Disciplinar', ordenDentroSemestre: 0 },
  { id: '2024-1-2', nombre: 'Álgebra', semestre: 1, area: 'Formación Disciplinar', ordenDentroSemestre: 1 },
  { id: '2024-1-3', nombre: 'Taller de Aptitudes Lógicas y Matemáticas', semestre: 1, area: 'Formación Disciplinar', ordenDentroSemestre: 2 },
  { id: '2024-1-4', nombre: 'Taller de Programación I', semestre: 1, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-1-5', nombre: 'Introducción a la Ingeniería Informática', semestre: 1, area: 'Formación Profesional', ordenDentroSemestre: 4 },

  // Semestre 2
  { id: '2024-2-1', nombre: 'Cálculo Diferencial e Integral', semestre: 2, area: 'Formación Disciplinar', ordenDentroSemestre: 0 },
  { id: '2024-2-2', nombre: 'Álgebra Lineal', semestre: 2, area: 'Formación Disciplinar', ordenDentroSemestre: 1 },
  { id: '2024-2-3', nombre: 'Química General', semestre: 2, area: 'Formación Disciplinar', ordenDentroSemestre: 2 },
  { id: '2024-2-4', nombre: 'Taller de Programación II', semestre: 2, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-2-5', nombre: 'Antropología', semestre: 2, area: 'Formación Integral', ordenDentroSemestre: 4 },

  // Semestre 3
  { id: '2024-3-1', nombre: 'Cálculo Multivariable', semestre: 3, area: 'Formación Disciplinar', ordenDentroSemestre: 0 },
  { id: '2024-3-2', nombre: 'Física', semestre: 3, area: 'Formación Disciplinar', ordenDentroSemestre: 1 },
  { id: '2024-3-3', nombre: 'Taller de Tecnologías Digitales', semestre: 3, area: 'Formación Profesional', ordenDentroSemestre: 2 },
  { id: '2024-3-4', nombre: 'Paradigmas de Programación', semestre: 3, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-3-5', nombre: 'Ética', semestre: 3, area: 'Formación Integral', ordenDentroSemestre: 4 },

  // Semestre 4 (después: Hito Evaluativo Integrativo)
  { id: '2024-4-1', nombre: 'Ecuaciones Diferenciales', semestre: 4, area: 'Formación Disciplinar', ordenDentroSemestre: 0 },
  { id: '2024-4-2', nombre: 'Electricidad y Magnetismo', semestre: 4, area: 'Formación Disciplinar', ordenDentroSemestre: 1 },
  { id: '2024-4-3', nombre: 'Probabilidades y Estadísticas', semestre: 4, area: 'Formación Disciplinar', ordenDentroSemestre: 2 },
  { id: '2024-4-4', nombre: 'Matemática Discreta', semestre: 4, area: 'Formación Disciplinar', ordenDentroSemestre: 3 },
  { id: '2024-4-5', nombre: 'Taller de Sustentabilidad', semestre: 4, area: 'Formación Profesional', ordenDentroSemestre: 4 },
  { id: '2024-4-6', nombre: 'Gestión Personal y Habilidades para la Vida', semestre: 4, area: 'Gestión para la Empleabilidad', ordenDentroSemestre: 5 },

  // Semestre 5
  { id: '2024-5-1', nombre: 'Estadística Avanzada', semestre: 5, area: 'Formación Disciplinar', ordenDentroSemestre: 0 },
  { id: '2024-5-2', nombre: 'Optimización', semestre: 5, area: 'Formación Disciplinar', ordenDentroSemestre: 1 },
  { id: '2024-5-3', nombre: 'Algoritmos y Estructura de Datos', semestre: 5, area: 'Formación Profesional', ordenDentroSemestre: 2 },
  { id: '2024-5-4', nombre: 'Taller de Innovación', semestre: 5, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-5-5', nombre: 'Infraestructura TI', semestre: 5, area: 'Formación Profesional', ordenDentroSemestre: 4 },
  { id: '2024-5-6', nombre: 'Persona y Sociedad', semestre: 5, area: 'Formación Integral', ordenDentroSemestre: 5 },

  // Semestre 6 (después: Práctica Industrial)
  { id: '2024-6-1', nombre: 'Taller de Emprendimiento', semestre: 6, area: 'Formación Profesional', ordenDentroSemestre: 0 },
  { id: '2024-6-2', nombre: 'Sistemas Operativos', semestre: 6, area: 'Formación Profesional', ordenDentroSemestre: 1 },
  { id: '2024-6-3', nombre: 'Bases de Datos', semestre: 6, area: 'Formación Profesional', ordenDentroSemestre: 2 },
  { id: '2024-6-4', nombre: 'Introducción a la Ciencia de Datos', semestre: 6, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-6-5', nombre: 'Electivo I: Formación e Identidad', semestre: 6, area: 'Formación Integral', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'formacion_identidad' },
  { id: '2024-6-6', nombre: 'Gestión en Equipos para el Alto Desempeño', semestre: 6, area: 'Gestión para la Empleabilidad', ordenDentroSemestre: 5 },

  // Semestre 7
  { id: '2024-7-1', nombre: 'Inteligencia Artificial', semestre: 7, area: 'Formación Profesional', ordenDentroSemestre: 0 },
  { id: '2024-7-2', nombre: 'Big Data', semestre: 7, area: 'Formación Profesional', ordenDentroSemestre: 1 },
  { id: '2024-7-3', nombre: 'Aplicaciones y Tecnologías de la Web', semestre: 7, area: 'Formación Profesional', ordenDentroSemestre: 2 },
  { id: '2024-7-4', nombre: 'Programación Avanzada', semestre: 7, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-7-5', nombre: 'Electivo II: Formación e Identidad', semestre: 7, area: 'Formación Integral', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'formacion_identidad' },

  // Semestre 8 (después: Hito Evaluativo Integrativo + Práctica Profesional)
  { id: '2024-8-1', nombre: 'Taller de Interfaces y Diseño de Software', semestre: 8, area: 'Formación Profesional', ordenDentroSemestre: 0 },
  { id: '2024-8-2', nombre: 'Ingeniería de Software y Aseguramiento de la Calidad', semestre: 8, area: 'Formación Profesional', ordenDentroSemestre: 1 },
  { id: '2024-8-3', nombre: 'Formulación y Evaluación de Proyectos', semestre: 8, area: 'Formación Profesional', ordenDentroSemestre: 2 },
  { id: '2024-8-4', nombre: 'Gestión para el Desarrollo Sostenible', semestre: 8, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-8-5', nombre: 'Electivo III: Formación e Identidad', semestre: 8, area: 'Formación Integral', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'formacion_identidad' },

  // Semestre 9
  { id: '2024-9-1', nombre: 'Ciberseguridad', semestre: 9, area: 'Formación Profesional', ordenDentroSemestre: 0 },
  { id: '2024-9-2', nombre: 'Taller de Integración de Software', semestre: 9, area: 'Formación Profesional', ordenDentroSemestre: 1 },
  { id: '2024-9-3', nombre: 'Gestión de Proyectos TI', semestre: 9, area: 'Formación Profesional', ordenDentroSemestre: 2 },
  { id: '2024-9-4', nombre: 'Taller en Empresa I', semestre: 9, area: 'Formación Profesional', ordenDentroSemestre: 3 },
  { id: '2024-9-5', nombre: 'Electivo de Profundización I', semestre: 9, area: 'Formación Profesional', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'profundizacion' },
  { id: '2024-9-6', nombre: 'Electivo de Profundización II', semestre: 9, area: 'Formación Profesional', ordenDentroSemestre: 5, esElectivo: true, electivoCategoria: 'profundizacion' },

  // Semestre 10
  { id: '2024-10-1', nombre: 'Transformación Digital y Gobierno TI', semestre: 10, area: 'Formación Profesional', ordenDentroSemestre: 0 },
  { id: '2024-10-2', nombre: 'Vía de Titulación', semestre: 10, area: 'Formación Profesional', ordenDentroSemestre: 1 },
  { id: '2024-10-3', nombre: 'Gestión de Carrera y Desarrollo Profesional', semestre: 10, area: 'Gestión para la Empleabilidad', ordenDentroSemestre: 2 },
];

// [cursoId, prerequisitoId][] — ver nota de cabecera.
export const PRERREQUISITOS_2024: [string, string][] = [
  ['2024-2-1', '2024-1-1'], // Cálculo Diferencial e Integral <- Introducción al Cálculo
  ['2024-3-1', '2024-2-1'], // Cálculo Multivariable <- Cálculo Diferencial e Integral
  ['2024-4-1', '2024-3-1'], // Ecuaciones Diferenciales <- Cálculo Multivariable
  ['2024-2-2', '2024-1-2'], // Álgebra Lineal <- Álgebra
  ['2024-2-4', '2024-1-4'], // Taller de Programación II <- Taller de Programación I
  ['2024-3-4', '2024-2-4'], // Paradigmas de Programación <- Taller de Programación II
  ['2024-5-3', '2024-3-4'], // Algoritmos y Estructura de Datos <- Paradigmas de Programación
  ['2024-7-4', '2024-5-3'], // Programación Avanzada <- Algoritmos y Estructura de Datos
  ['2024-7-5', '2024-6-5'], // Electivo II: Formación e Identidad <- Electivo I
  ['2024-8-5', '2024-7-5'], // Electivo III: Formación e Identidad <- Electivo II
];
