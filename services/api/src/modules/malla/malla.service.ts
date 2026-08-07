import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MallaService {
  constructor(private readonly prisma: PrismaService) {}

  listMallas() {
    return this.prisma.malla.findMany({
      orderBy: [{ year: 'asc' }],
      select: {
        id: true,
        nombre: true,
        year: true,
        activa: true,
      },
    });
  }

  async getMallaDetalle(mallaId: string) {
    const malla = await this.prisma.malla.findUnique({
      where: { id: mallaId },
      include: {
        cursos: {
          orderBy: [{ semestre: 'asc' }, { ordenDentroSemestre: 'asc' }],
          include: {
            prerrequisitos: { include: { prerequisito: true } },
            equivalenciasOrigen: {
              include: {
                mallaDestino: true,
                cursoDestino: true,
              },
            },
          },
        },
      },
    });
    if (!malla) {
      throw new NotFoundException('Malla no encontrada');
    }
    return malla;
  }

  async getCurso(mallaId: string, cursoId: string) {
    const curso = await this.prisma.mallaCurso.findFirst({
      where: { id: cursoId, mallaId },
      include: {
        prerrequisitos: { include: { prerequisito: true } },
        equivalenciasOrigen: {
          include: { mallaDestino: true, cursoDestino: true },
        },
      },
    });
    if (!curso) {
      throw new NotFoundException('Curso no encontrado en la malla');
    }
    return curso;
  }
}