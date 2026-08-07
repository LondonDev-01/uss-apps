import { Injectable, NotFoundException } from '@nestjs/common';
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
}