import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { matchByNombre } from './matching';

export type Prioridad = 0 | 1 | 2; // 0=obligatorio(atrasado) 1=opcional 2=electivo

export interface OpcionHorario {
  nrc: string;
  titulo: string;
}

export interface CursoDisponible {
  cursoId: string;
  nombre: string;
  semestre: number;
  area: string;
  esElectivo: boolean;
  prioridad: Prioridad;
  opciones: OpcionHorario[];
}

export interface PrioridadesMetadatos {
  semestreActual: number;
  ramosAprobados: number;
  ramosDisponibles: number;
  ramosPrioridad: number;
  ramosOpcionales: number;
  electivos: number;
}

export interface PrioridadesResponse {
  // NRC -> prioridad (0/1/2), forma exacta de PLAN_V2 S10.
  prioridades: Record<string, Prioridad>;
  metadatos: PrioridadesMetadatos;
  // Campo aditivo (no rompe el contrato v1, PLAN_V3 S4.2): breakdown por
  // curso, no solo por NRC. Lo necesita el resumen de la malla interactiva
  // (PLAN_V2 S6 "Resumen").
  cursosDisponibles: CursoDisponible[];
}

@Injectable()
export class OptimizerService {
  constructor(private readonly prisma: PrismaService) {}

  async calcularPrioridades(userId: string, periodoId?: string): Promise<PrioridadesResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!user.mallaId) {
      throw new BadRequestException(
        'El usuario todavía no seleccionó una malla (PATCH /users/me)',
      );
    }

    const cursos = await this.prisma.mallaCurso.findMany({
      where: { mallaId: user.mallaId },
      include: { prerrequisitos: true },
    });

    const aprobadosRows = await this.prisma.userCursoAprobado.findMany({
      where: { userId },
      select: { mallaCursoId: true },
    });
    const aprobados = new Set(aprobadosRows.map((a) => a.mallaCursoId));

    const equivalencias = await this.prisma.cursoEquivalente.findMany({
      where: {
        OR: [{ mallaOrigenId: user.mallaId }, { mallaDestinoId: user.mallaId }],
      },
    });

    // Sin periodoId: usa el período activo más reciente si existe. Sin
    // período disponible (o sin horarios cargados para él, Fase E), el
    // cálculo sigue siendo válido — cada curso queda con `opciones: []`
    // (regla de negocio "ramo no está en el Excel", PLAN_V2 S5 regla 3).
    let horarios: { nrc: string; titulo: string }[] = [];
    if (periodoId) {
      const periodo = await this.prisma.periodo.findUnique({ where: { id: periodoId } });
      if (!periodo) {
        throw new NotFoundException('Periodo no encontrado');
      }
      horarios = await this.prisma.horarioDisponible.findMany({
        where: { periodoId },
        select: { nrc: true, titulo: true },
      });
    } else {
      const periodoActivo = await this.prisma.periodo.findFirst({
        where: { activo: true },
        orderBy: { createdAt: 'desc' },
      });
      if (periodoActivo) {
        horarios = await this.prisma.horarioDisponible.findMany({
          where: { periodoId: periodoActivo.id },
          select: { nrc: true, titulo: true },
        });
      }
    }

    return calcularPrioridadesPuro(cursos, aprobados, equivalencias, horarios);
  }
}

// ---------------------------------------------------------------------------
// Núcleo puro del algoritmo (PLAN_V2 S5). Sin I/O — así se puede probar
// (services/api/scripts/verify-optimizer.ts) sin levantar la DB.
// ---------------------------------------------------------------------------

interface CursoConPrereqs {
  id: string;
  nombre: string;
  semestre: number;
  area: string | null;
  esElectivo: boolean;
  prerrequisitos: { prerequisitoId: string }[];
}

interface Equivalencia {
  cursoOrigenId: string;
  cursoDestinoId: string;
}

export function calcularPrioridadesPuro(
  cursos: CursoConPrereqs[],
  aprobados: Set<string>,
  equivalencias: Equivalencia[],
  horarios: OpcionHorario[],
): PrioridadesResponse {
  // 1. Semestre actual = 1 + el semestre más alto ya aprobado (0 si no
  // aprobó nada todavía -> semestreActual = 1).
  const semestresAprobados = cursos
    .filter((c) => aprobados.has(c.id))
    .map((c) => c.semestre);
  const maxSemestreAprobado = semestresAprobados.length ? Math.max(...semestresAprobados) : 0;
  const semestreActual = maxSemestreAprobado + 1;

  // 2. Disponibles: no aprobados, sin equivalente ya aprobado, con
  // prerrequisitos cumplidos.
  const disponibles = cursos.filter((curso) => {
    if (aprobados.has(curso.id)) return false;

    const tieneEquivalenteAprobado = equivalencias.some(
      (eq) =>
        (eq.cursoOrigenId === curso.id && aprobados.has(eq.cursoDestinoId)) ||
        (eq.cursoDestinoId === curso.id && aprobados.has(eq.cursoOrigenId)),
    );
    if (tieneEquivalenteAprobado) return false;

    const prereqsCumplidos = curso.prerrequisitos.every((p) => aprobados.has(p.prerequisitoId));
    if (!prereqsCumplidos) return false;

    return true;
  });

  // 3-4. Prioridad + matching con el Excel del período.
  const cursosDisponibles: CursoDisponible[] = disponibles.map((curso) => {
    const opciones = horarios
      .filter((h) => matchByNombre(h.titulo, curso.nombre))
      .map((h) => ({ nrc: h.nrc, titulo: h.titulo }));

    let prioridad: Prioridad;
    if (curso.esElectivo) {
      prioridad = 2; // regla 5: electivos siempre P2
    } else if (curso.semestre < semestreActual) {
      prioridad = 0; // regla 1: atrasado = obligatorio
    } else {
      prioridad = 1; // regla 2: semestre actual/futuro = opcional
    }

    return {
      cursoId: curso.id,
      nombre: curso.nombre,
      semestre: curso.semestre,
      area: curso.area ?? '',
      esElectivo: curso.esElectivo,
      prioridad,
      opciones,
    };
  });

  const prioridades: Record<string, Prioridad> = {};
  for (const c of cursosDisponibles) {
    for (const opcion of c.opciones) {
      prioridades[opcion.nrc] = c.prioridad;
    }
  }

  const metadatos: PrioridadesMetadatos = {
    semestreActual,
    ramosAprobados: aprobados.size,
    ramosDisponibles: cursosDisponibles.length,
    ramosPrioridad: cursosDisponibles.filter((c) => c.prioridad === 0).length,
    ramosOpcionales: cursosDisponibles.filter((c) => c.prioridad === 1).length,
    electivos: cursosDisponibles.filter((c) => c.prioridad === 2).length,
  };

  return { prioridades, metadatos, cursosDisponibles };
}
