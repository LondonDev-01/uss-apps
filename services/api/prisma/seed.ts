import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed MÍNIMO de Fase B: mallas placeholder para poder probar los endpoints.
 * La validación completa de mallas 2021/2024 es parte de Fase D (profe Hugo).
 * Idempotente: usa upserts.
 */
async function main() {
  const mallas = [
    { id: '2021', nombre: 'Ingeniería Civil Informática 2021', year: 2021 },
    { id: '2024', nombre: 'Ingeniería Civil Informática 2024', year: 2024 },
  ] as const;

  for (const malla of mallas) {
    await prisma.malla.upsert({
      where: { id: malla.id },
      update: {},
      create: malla,
    });
  }

  const cursos2024 = [
    { id: '2024-ING100', mallaId: '2024', nombre: 'Introducción a la Ingeniería', semestre: 1 },
    { id: '2024-MAT101', mallaId: '2024', nombre: 'Cálculo I', semestre: 1 },
    { id: '2024-PRG101', mallaId: '2024', nombre: 'Programación I', semestre: 1 },
  ] as const;

  for (const curso of cursos2024) {
    await prisma.mallaCurso.upsert({
      where: { id: curso.id },
      update: {},
      create: curso,
    });
  }

  console.log('Seed mínimo completado: mallas 2021/2024 + cursos base.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());