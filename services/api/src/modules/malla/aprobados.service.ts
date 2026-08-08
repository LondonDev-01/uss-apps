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

  async remove(user: AuthenticatedUser, mallaCursoId: string) {
    try {
      return await this.prisma.userCursoAprobado.delete({
        where: { userId_mallaCursoId: { userId: user.id, mallaCursoId } },
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