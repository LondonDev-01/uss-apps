import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  // Selección de malla (PLAN_V2 §4.2, primera vez que el usuario entra a
  // apps/malla). No reemite el JWT — el claim `mallaId` del access token
  // vigente queda desactualizado hasta el próximo login/refresh; el
  // frontend debe usar el valor que él mismo acaba de setear, no esperar
  // a que `/auth/me` lo refleje de inmediato.
  async setMalla(userId: string, mallaId: string): Promise<User> {
    const malla = await this.prisma.malla.findUnique({ where: { id: mallaId } });
    if (!malla) {
      throw new NotFoundException('Malla inexistente');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { mallaId },
    });
  }
}