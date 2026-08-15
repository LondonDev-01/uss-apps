import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Injectable()
export class AprobadosService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(user: AuthenticatedUser) {
    return this.prisma.userCursoAprobado.findMany({
      where: { userId: user.id },
      include: { mallaCurso: true },
      orderBy: { aprobadoEn: 'desc' },
    });
  }

  async upsert(user: AuthenticatedUser, mallaCursoId: string) {
    const curso = await this.prisma.mallaCurso.findUnique({
      where: { id: mallaCursoId },
    });
    if (!curso) {
      throw new NotFoundException('Curso de malla inexistente');
    }
    return this.prisma.userCursoAprobado.upsert({
      where: { userId_mallaCursoId: { userId: user.id, mallaCursoId } },
      update: { aprobadoEn: new Date() },
      create: { userId: user.id, mallaCursoId },
    });
  }

  // Desmarcar es en cascada: si un ramo deja de estar aprobado, todo ramo
  // aprobado que lo tenga como prerrequisito (directo o transitivo) pierde
  // su condición de aprobable y se desmarca también. Sin esto, la malla
  // queda en un estado inconsistente (dependientes marcados sin su base),
  // y el frontend no puede resolverlo solo porque la DB es la fuente de
  // verdad (PLAN_V3 §3).
  async remove(user: AuthenticatedUser, mallaCursoId: string) {
    const curso = await this.prisma.mallaCurso.findUnique({
      where: { id: mallaCursoId },
      select: { id: true, mallaId: true },
    });
    if (!curso) {
      throw new NotFoundException('Curso de malla inexistente');
    }

    const aprobado = await this.prisma.userCursoAprobado.findUnique({
      where: { userId_mallaCursoId: { userId: user.id, mallaCursoId } },
    });
    if (!aprobado) {
      throw new NotFoundException('Curso aprobado de malla inexistente');
    }

    // Cierre transitivo de dependientes dentro de la malla del curso:
    // arista prerequisitoId -> cursoId, BFS desde el curso desmarcado.
    const edges = await this.prisma.mallaPrerrequisito.findMany({
      where: { curso: { mallaId: curso.mallaId } },
      select: { cursoId: true, prerequisitoId: true },
    });
    const dependientes = new Map<string, string[]>();
    for (const edge of edges) {
      const lista = dependientes.get(edge.prerequisitoId) ?? [];
      lista.push(edge.cursoId);
      dependientes.set(edge.prerequisitoId, lista);
    }
    const cierre = new Set<string>([mallaCursoId]);
    const cola: string[] = [mallaCursoId];
    while (cola.length > 0) {
      const actual = cola.shift() as string;
      for (const dep of dependientes.get(actual) ?? []) {
        if (!cierre.has(dep)) {
          cierre.add(dep);
          cola.push(dep);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const afectados = await tx.userCursoAprobado.findMany({
        where: { userId: user.id, mallaCursoId: { in: [...cierre] } },
        include: { mallaCurso: true },
        orderBy: { aprobadoEn: 'desc' },
      });
      await tx.userCursoAprobado.deleteMany({
        where: { userId: user.id, mallaCursoId: { in: [...cierre] } },
      });
      return afectados;
    });
  }

  // Solo actualiza la nota — no toca `aprobadoEn` (a diferencia de
  // `upsert`, que sí lo resetea; acá el ramo ya está aprobado, no se está
  // volviendo a marcar). 404 si el ramo no está aprobado todavía: no tiene
  // sentido calificar algo que no se cursó.
  async setNota(user: AuthenticatedUser, mallaCursoId: string, nota: number) {
    try {
      return await this.prisma.userCursoAprobado.update({
        where: { userId_mallaCursoId: { userId: user.id, mallaCursoId } },
        data: { nota },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Curso aprobado de malla inexistente');
      }
      throw error;
    }
  }
}