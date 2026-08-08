import { PrismaClient } from '@prisma/client';
import { CURSOS_2021, MALLA_2021_ID, PRERREQUISITOS_2021 } from './seed-data/malla-2021';
import { CURSOS_2024, MALLA_2024_ID, PRERREQUISITOS_2024 } from './seed-data/malla-2024';
import type { SeedCurso } from './seed-data/types';

const prisma = new PrismaClient();

/**
 * Seed de Fase D: mallas 2021 y 2024 con datos reales extraídos de
 * assets/Malla_Vieja.pdf y assets/Malla_Nueva.pdf (ver seed-data/*.ts).
 *
 * Prerrequisitos 2021: leídos del diagrama OFICIAL de flechas
 * (assets/Malla_Vieja_con requisitos.pdf, provisto por el usuario) — ya no
 * son una heurística. Un puñado de cruces con flechas convergentes quedaron
 * sin incluir por incertidumbre en la lectura, documentados en
 * seed-data/malla-2021.ts. Prerrequisitos 2024: siguen siendo la heurística
 * conservadora original (sin diagrama oficial todavía).
 *
 * Idempotente: usa upserts.
 */
async function main() {
  const mallas = [
    { id: MALLA_2021_ID, nombre: 'Ingeniería Civil Informática 2021', year: 2021 },
    { id: MALLA_2024_ID, nombre: 'Ingeniería Civil Informática 2024', year: 2024 },
  ] as const;

  for (const malla of mallas) {
    await prisma.malla.upsert({
      where: { id: malla.id },
      update: {},
      create: malla,
    });
  }

  await seedCursos(CURSOS_2021, MALLA_2021_ID);
  await seedCursos(CURSOS_2024, MALLA_2024_ID);

  const prerrequisitos = [...PRERREQUISITOS_2021, ...PRERREQUISITOS_2024];
  assertSinCiclos(prerrequisitos);

  for (const [cursoId, prerequisitoId] of prerrequisitos) {
    await prisma.mallaPrerrequisito.upsert({
      where: { cursoId_prerequisitoId: { cursoId, prerequisitoId } },
      update: {},
      create: { cursoId, prerequisitoId },
    });
  }

  // Equivalencias cruzadas entre mallas: un ramo de la malla antigua que ya
  // no se dicta, cubierto por un ramo "convalidable" de la malla nueva.
  // A diferencia de los prerrequisitos, esta entrada NO es una heurística
  // mía — el usuario confirmó este caso puntual directamente (2026-08-08):
  // "Mecánica" (2021) ya no se dicta; "Física" (2024) es su reemplazo real.
  // No se agregaron más filas por analogía — cada una necesita la misma
  // confirmación real antes de sembrarse.
  await prisma.cursoEquivalente.upsert({
    where: { cursoOrigenId_cursoDestinoId: { cursoOrigenId: '2021-3-2', cursoDestinoId: '2024-3-2' } },
    update: {},
    create: {
      mallaOrigenId: MALLA_2021_ID,
      cursoOrigenId: '2021-3-2', // Mecánica (2021)
      mallaDestinoId: MALLA_2024_ID,
      cursoDestinoId: '2024-3-2', // Física (2024)
    },
  });

  console.log(
    `Seed completado: 2 mallas, ${CURSOS_2021.length + CURSOS_2024.length} ramos, ` +
      `${prerrequisitos.length} prerrequisitos (borrador, sin validar con profe Hugo), ` +
      `1 equivalencia cruzada confirmada.`,
  );
}

async function seedCursos(cursos: SeedCurso[], mallaId: string) {
  for (const curso of cursos) {
    await prisma.mallaCurso.upsert({
      where: { id: curso.id },
      update: {},
      create: { ...curso, mallaId },
    });
  }
}

// Verificación de Fase 0 ("el grafo de prerrequisitos es válido, sin
// ciclos") vía DFS. Lanza si encuentra un ciclo — mejor romper el seed
// temprano que persistir un grafo inválido.
function assertSinCiclos(edges: [string, string][]) {
  const deps = new Map<string, string[]>();
  for (const [cursoId, prerequisitoId] of edges) {
    if (!deps.has(cursoId)) deps.set(cursoId, []);
    deps.get(cursoId)!.push(prerequisitoId);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  function visit(node: string, path: string[]) {
    color.set(node, GRAY);
    for (const dep of deps.get(node) ?? []) {
      const state = color.get(dep) ?? WHITE;
      if (state === GRAY) {
        throw new Error(
          `Ciclo de prerrequisitos detectado: ${[...path, node, dep].join(' -> ')}`,
        );
      }
      if (state === WHITE) visit(dep, [...path, node]);
    }
    color.set(node, BLACK);
  }

  for (const node of deps.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) visit(node, []);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
