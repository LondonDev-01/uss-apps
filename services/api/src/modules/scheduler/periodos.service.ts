import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PeriodosService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.periodo.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { horarios: true } } },
    });
  }

  async findOne(id: string) {
    const periodo = await this.prisma.periodo.findUnique({
      where: { id },
      include: { horarios: true },
    });
    if (!periodo) {
      throw new NotFoundException('Periodo no encontrado');
    }
    return periodo;
  }

  create(nombre: string) {
    return this.prisma.periodo.create({ data: { nombre } });
  }

  async update(id: string, data: { nombre?: string; activo?: boolean }) {
    try {
      return await this.prisma.periodo.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Periodo no encontrado');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.periodo.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Periodo no encontrado');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar: el período tiene horarios o categorías electivas asociadas',
        );
      }
      throw error;
    }
  }
}
