// Ingeniería Civil Informática — Malla 2021 (actualizada para admisión 2022)
// Fuente de ramos/semestre/área: assets/Malla_Vieja.pdf
//
// Fuente de prerrequisitos (actualizado 2026-08-08): assets/Malla_Vieja_con
// requisitos.pdf — el diagrama OFICIAL de flechas de la carrera, provisto
// por el usuario ("son los oficiales"). Reemplaza la heurística conservadora
// anterior (que solo enlazaba continuaciones numeradas obvias, ej. "Inglés
// I" -> "Inglés II"). `PRERREQUISITOS_2021` abajo es mi mejor lectura
// completa de ese diagrama — la gran mayoría son cadenas lineales sin
// ambigüedad dentro de la misma fila/color. Un puñado de cruces con varias
// flechas convergiendo (marcados "NO INCLUIDO" en los comentarios) no los
// pude leer con confianza suficiente para tratarlos como reales — quedan
// sin prerrequisito hasta que el usuario los confirme, en vez de adivinar.
// Los conectores hacia las barras "PRÁCTICA INDUSTRIAL"/"PRÁCTICA
// PROFESIONAL" no se modelan: esas barras no son ramos con crédito en este
// seed, son hitos del programa.

import type { SeedCurso } from './types';

export const MALLA_2021_ID = '2021';

export const CURSOS_2021: SeedCurso[] = [
  // Semestre 1
  { id: '2021-1-1', nombre: 'Introducción al Cálculo', semestre: 1, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 0 },
  { id: '2021-1-2', nombre: 'Álgebra', semestre: 1, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 1 },
  { id: '2021-1-3', nombre: 'Química General', semestre: 1, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 2 },
  { id: '2021-1-4', nombre: 'Laboratorio de Química General', semestre: 1, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 3 },
  { id: '2021-1-5', nombre: 'Introducción a la Informática', semestre: 1, area: 'Sistemas de Información', ordenDentroSemestre: 4 },
  { id: '2021-1-6', nombre: 'Taller de Introducción a la Ingeniería', semestre: 1, area: 'Habilidades para la Ingeniería', ordenDentroSemestre: 5 },
  { id: '2021-1-7', nombre: 'Estrategias para el Aprendizaje', semestre: 1, area: 'Formación Integral', ordenDentroSemestre: 6 },

  // Semestre 2
  { id: '2021-2-1', nombre: 'Cálculo Diferencial e Integral', semestre: 2, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 0 },
  { id: '2021-2-2', nombre: 'Álgebra Lineal', semestre: 2, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 1 },
  { id: '2021-2-3', nombre: 'Introducción a la Programación', semestre: 2, area: 'Sistemas de Información', ordenDentroSemestre: 2 },
  { id: '2021-2-4', nombre: 'Taller de Trabajo en Equipo', semestre: 2, area: 'Habilidades para la Ingeniería', ordenDentroSemestre: 3 },

  // Semestre 3
  { id: '2021-3-1', nombre: 'Cálculo Multivariable', semestre: 3, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 0 },
  { id: '2021-3-2', nombre: 'Mecánica', semestre: 3, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 1 },
  { id: '2021-3-3', nombre: 'Laboratorio de Mecánica', semestre: 3, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 2 },
  { id: '2021-3-4', nombre: 'Tecnologías Digitales para la Ingeniería', semestre: 3, area: 'Sistemas de Información', ordenDentroSemestre: 3 },
  { id: '2021-3-5', nombre: 'Programación Orientada a Objetos', semestre: 3, area: 'Sistemas de Información', ordenDentroSemestre: 4 },
  { id: '2021-3-6', nombre: 'Taller de Liderazgo y Negociación', semestre: 3, area: 'Habilidades para la Ingeniería', ordenDentroSemestre: 5 },
  { id: '2021-3-7', nombre: 'Inglés I', semestre: 3, area: 'Inglés', ordenDentroSemestre: 6 },

  // Semestre 4
  { id: '2021-4-1', nombre: 'Ecuaciones Diferenciales', semestre: 4, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 0 },
  { id: '2021-4-2', nombre: 'Electricidad y Magnetismo', semestre: 4, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 1 },
  { id: '2021-4-3', nombre: 'Laboratorio de Electricidad y Magnetismo', semestre: 4, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 2 },
  { id: '2021-4-4', nombre: 'Probabilidades para Ingeniería', semestre: 4, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 3 },
  { id: '2021-4-5', nombre: 'Taller de Programación Aplicada', semestre: 4, area: 'Sistemas de Información', ordenDentroSemestre: 4 },
  { id: '2021-4-6', nombre: 'Taller de Ingeniería y Sustentabilidad', semestre: 4, area: 'Habilidades para la Ingeniería', ordenDentroSemestre: 5 },
  { id: '2021-4-7', nombre: 'Inglés II', semestre: 4, area: 'Inglés', ordenDentroSemestre: 6 },

  // Semestre 5
  { id: '2021-5-1', nombre: 'Optimización', semestre: 5, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 0 },
  { id: '2021-5-2', nombre: 'Termofluidos', semestre: 5, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 1 },
  { id: '2021-5-3', nombre: 'Matemáticas Discretas', semestre: 5, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 2 },
  { id: '2021-5-4', nombre: 'Estadística para Ingeniería', semestre: 5, area: 'Ciencias Básicas y de la Ingeniería', ordenDentroSemestre: 3 },
  { id: '2021-5-5', nombre: 'Estructura de Datos y Algoritmos', semestre: 5, area: 'Sistemas de Información', ordenDentroSemestre: 4 },
  { id: '2021-5-6', nombre: 'Taller de Emprendimiento e Innovación I', semestre: 5, area: 'Habilidades para la Ingeniería', ordenDentroSemestre: 5 },
  { id: '2021-5-7', nombre: 'Inglés III', semestre: 5, area: 'Inglés', ordenDentroSemestre: 6 },

  // Semestre 6
  { id: '2021-6-1', nombre: 'Economía Financiera', semestre: 6, area: 'Proyectos TI', ordenDentroSemestre: 0 },
  { id: '2021-6-2', nombre: 'Arquitectura de Computadores', semestre: 6, area: 'Infraestructura TI', ordenDentroSemestre: 1 },
  { id: '2021-6-3', nombre: 'Redes de Computadores', semestre: 6, area: 'Infraestructura TI', ordenDentroSemestre: 2 },
  { id: '2021-6-4', nombre: 'Programación Avanzada', semestre: 6, area: 'Sistemas de Información', ordenDentroSemestre: 3 },
  { id: '2021-6-5', nombre: 'Base de Datos', semestre: 6, area: 'Sistemas de Información', ordenDentroSemestre: 4 },
  { id: '2021-6-6', nombre: 'Taller de Emprendimiento e Innovación II', semestre: 6, area: 'Habilidades para la Ingeniería', ordenDentroSemestre: 5 },
  { id: '2021-6-7', nombre: 'Inglés Técnico', semestre: 6, area: 'Inglés', ordenDentroSemestre: 6 },

  // Semestre 7 (después de Práctica Industrial)
  { id: '2021-7-1', nombre: 'Sistemas Operativos', semestre: 7, area: 'Infraestructura TI', ordenDentroSemestre: 0 },
  { id: '2021-7-2', nombre: 'Aplicaciones y Tecnologías de la Web', semestre: 7, area: 'Sistemas de Información', ordenDentroSemestre: 1 },
  { id: '2021-7-3', nombre: 'Taller de Interfaces y Diseño de Software', semestre: 7, area: 'Sistemas de Información', ordenDentroSemestre: 2 },
  { id: '2021-7-4', nombre: 'Electivo de Profundización I', semestre: 7, area: 'Electivos de Profundización', ordenDentroSemestre: 3, esElectivo: true, electivoCategoria: 'profundizacion' },
  { id: '2021-7-5', nombre: 'Antropología', semestre: 7, area: 'Formación Integral', ordenDentroSemestre: 4 },
  { id: '2021-7-6', nombre: 'Inglés de Especialidad', semestre: 7, area: 'Inglés', ordenDentroSemestre: 5 },

  // Semestre 8
  { id: '2021-8-1', nombre: 'Formulación y Evaluación de Proyectos', semestre: 8, area: 'Proyectos TI', ordenDentroSemestre: 0 },
  { id: '2021-8-2', nombre: 'Inteligencia Artificial', semestre: 8, area: 'Sistemas de Información', ordenDentroSemestre: 1 },
  { id: '2021-8-3', nombre: 'Ing. Requerimientos y Aseguramiento de Calidad', semestre: 8, area: 'Sistemas de Información', ordenDentroSemestre: 2 },
  { id: '2021-8-4', nombre: 'Taller de Ingeniería de Software', semestre: 8, area: 'Sistemas de Información', ordenDentroSemestre: 3 },
  { id: '2021-8-5', nombre: 'Electivo de Profundización II', semestre: 8, area: 'Electivos de Profundización', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'profundizacion' },
  { id: '2021-8-6', nombre: 'Ética', semestre: 8, area: 'Formación Integral', ordenDentroSemestre: 5 },

  // Semestre 9 (después de Práctica Profesional)
  { id: '2021-9-1', nombre: 'Gestión de Proyectos', semestre: 9, area: 'Proyectos TI', ordenDentroSemestre: 0 },
  { id: '2021-9-2', nombre: 'Gestión de Operaciones TI', semestre: 9, area: 'Proyectos TI', ordenDentroSemestre: 1 },
  { id: '2021-9-3', nombre: 'Taller en Empresa I', semestre: 9, area: 'Proyectos en Empresa', ordenDentroSemestre: 2 },
  { id: '2021-9-4', nombre: 'Minería de Datos y Big Data', semestre: 9, area: 'Sistemas de Información', ordenDentroSemestre: 3 },
  { id: '2021-9-5', nombre: 'Electivo de Formación Integral', semestre: 9, area: 'Formación Integral', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'formacion_integral' },

  // Semestre 10
  { id: '2021-10-1', nombre: 'Seguridad Informática', semestre: 10, area: 'Infraestructura TI', ordenDentroSemestre: 0 },
  { id: '2021-10-2', nombre: 'Gestión Estratégica', semestre: 10, area: 'Proyectos TI', ordenDentroSemestre: 1 },
  { id: '2021-10-3', nombre: 'Taller en Empresa II', semestre: 10, area: 'Proyectos en Empresa', ordenDentroSemestre: 2 },
  { id: '2021-10-4', nombre: 'Electivo de Profundización III', semestre: 10, area: 'Electivos de Profundización', ordenDentroSemestre: 3, esElectivo: true, electivoCategoria: 'profundizacion' },
  { id: '2021-10-5', nombre: 'Electivo de Profundización IV', semestre: 10, area: 'Electivos de Profundización', ordenDentroSemestre: 4, esElectivo: true, electivoCategoria: 'profundizacion' },
  { id: '2021-10-6', nombre: 'Proyecto de Título', semestre: 10, area: 'Proyectos TI', ordenDentroSemestre: 5 },
];

// [cursoId, prerequisitoId][] — ver nota de cabecera sobre el alcance de
// esta heurística.
export const PRERREQUISITOS_2021: [string, string][] = [
  // --- Track Cálculo -> Proyectos ---
  ['2021-2-1', '2021-1-1'], // Cálculo Diferencial e Integral <- Introducción al Cálculo
  ['2021-3-1', '2021-2-1'], // Cálculo Multivariable <- Cálculo Diferencial e Integral
  ['2021-4-1', '2021-3-1'], // Ecuaciones Diferenciales <- Cálculo Multivariable
  ['2021-5-1', '2021-4-1'], // Optimización <- Ecuaciones Diferenciales
  ['2021-6-1', '2021-5-1'], // Economía Financiera <- Optimización
  ['2021-8-1', '2021-6-1'], // Formulación y Evaluación de Proyectos <- Economía Financiera
  ['2021-9-1', '2021-8-1'], // Gestión de Proyectos <- Formulación y Evaluación de Proyectos

  // --- Track Álgebra -> Mecánica -> Termofluidos -> Infraestructura TI ---
  ['2021-2-2', '2021-1-2'], // Álgebra Lineal <- Álgebra
  ['2021-3-2', '2021-2-2'], // Mecánica <- Álgebra Lineal
  ['2021-3-3', '2021-2-2'], // Laboratorio de Mecánica <- Álgebra Lineal
  ['2021-4-2', '2021-3-2'], // Electricidad y Magnetismo <- Mecánica
  ['2021-4-3', '2021-3-3'], // Laboratorio de Electricidad y Magnetismo <- Laboratorio de Mecánica
  ['2021-5-2', '2021-4-2'], // Termofluidos <- Electricidad y Magnetismo
  ['2021-6-2', '2021-5-2'], // Arquitectura de Computadores <- Termofluidos
  ['2021-7-1', '2021-6-2'], // Sistemas Operativos <- Arquitectura de Computadores
  ['2021-10-1', '2021-7-1'], // Seguridad Informática <- Sistemas Operativos

  // --- Track Química -> Matemáticas Discretas -> Redes ---
  ['2021-5-3', '2021-1-3'], // Matemáticas Discretas <- Química General
  ['2021-6-3', '2021-5-3'], // Redes de Computadores <- Matemáticas Discretas
  ['2021-5-4', '2021-4-4'], // Estadística para Ingeniería <- Probabilidades para Ingeniería

  // --- Track Programación -> Sistemas de Información ---
  ['2021-2-3', '2021-1-5'], // Introducción a la Programación <- Introducción a la Informática
  ['2021-3-4', '2021-2-3'], // Tecnologías Digitales para la Ingeniería <- Introducción a la Programación
  ['2021-3-5', '2021-2-3'], // Programación Orientada a Objetos <- Introducción a la Programación
  ['2021-4-5', '2021-3-4'], // Taller de Programación Aplicada <- Tecnologías Digitales para la Ingeniería
  ['2021-4-5', '2021-3-5'], // Taller de Programación Aplicada <- Programación Orientada a Objetos
  ['2021-5-5', '2021-4-5'], // Estructura de Datos y Algoritmos <- Taller de Programación Aplicada
  ['2021-6-4', '2021-5-5'], // Programación Avanzada <- Estructura de Datos y Algoritmos
  ['2021-6-5', '2021-5-5'], // Base de Datos <- Estructura de Datos y Algoritmos
  ['2021-7-2', '2021-6-4'], // Aplicaciones y Tecnologías de la Web <- Programación Avanzada
  ['2021-7-3', '2021-6-5'], // Taller de Interfaces y Diseño de Software <- Base de Datos
  ['2021-8-4', '2021-7-3'], // Taller de Ingeniería de Software <- Taller de Interfaces y Diseño de Software

  // --- Track Talleres / Habilidades para la Ingeniería ---
  ['2021-2-4', '2021-1-6'], // Taller de Trabajo en Equipo <- Taller de Introducción a la Ingeniería
  ['2021-3-6', '2021-2-4'], // Taller de Liderazgo y Negociación <- Taller de Trabajo en Equipo
  ['2021-4-6', '2021-3-6'], // Taller de Ingeniería y Sustentabilidad <- Taller de Liderazgo y Negociación
  ['2021-5-6', '2021-4-6'], // Taller de Emprendimiento e Innovación I <- Taller de Ingeniería y Sustentabilidad
  ['2021-6-6', '2021-5-6'], // Taller de Emprendimiento e Innovación II <- Taller de Emprendimiento e Innovación I

  // --- Track Inglés ---
  ['2021-4-7', '2021-3-7'], // Inglés II <- Inglés I
  ['2021-5-7', '2021-4-7'], // Inglés III <- Inglés II
  ['2021-6-7', '2021-5-7'], // Inglés Técnico <- Inglés III
  ['2021-7-6', '2021-6-7'], // Inglés de Especialidad <- Inglés Técnico

  // NO INCLUIDO — cruces con varias flechas convergentes en el diagrama que
  // no pude leer con confianza suficiente. Confirmame estos y los agrego:
  //   - Ing. Requerimientos y Aseguramiento de Calidad (2021-8-3): ¿de qué ramo?
  //   - Inteligencia Artificial (2021-8-2): ¿Redes de Computadores, o el
  //     track de Programación Avanzada?
  //   - Minería de Datos y Big Data (2021-9-4): ¿de qué ramo?
  //   - Gestión de Operaciones TI (2021-9-2) y Gestión Estratégica
  //     (2021-10-2): ¿siguen el track de Redes/IA, o son independientes?
];
