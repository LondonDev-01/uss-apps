import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './jwt.strategy';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const ACCESS_TOKEN_TTL = '1h';

export const REFRESH_COOKIE = 'uss_refresh';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private buildPayload(user: User): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      mallaId: user.mallaId,
    };
  }

  async issueTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwt.sign(this.buildPayload(user));
    const refreshToken = await this.issueRefreshToken(user);
    return { accessToken, refreshToken };
  }

  // Emite un refresh token y lo persiste (jti) para habilitar rotación/revocación.
  private async issueRefreshToken(user: User): Promise<string> {
    const jti = randomUUID();
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const refreshToken = this.jwt.sign(this.buildPayload(user), {
      secret: refreshSecret,
      jwtid: jti,
      expiresIn: `${REFRESH_TOKEN_TTL_MS / 1000}s`,
    });
    await this.prisma.refreshToken.create({
      data: {
        jti,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return refreshToken;
  }

  // Rota el refresh token: revoca el anterior y emite uno nuevo.
  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload & { jti?: string };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { jti?: string }>(
        refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });
    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException('Refresh token revocado');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Marcar el token usado como revocado (detección de reuso).
    await this.prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario ya no existe');
    }

    const accessToken = this.jwt.sign(this.buildPayload(user));
    const newRefreshToken = await this.issueRefreshToken(user);
    return { accessToken, refreshToken: newRefreshToken };
  }

  me(authUser: AuthenticatedUser): AuthenticatedUser {
    return authUser;
  }

  // Revoca el refresh token de la cookie, si es válido. Deliberadamente
  // silencioso ante cualquier falla (token ausente, inválido, expirado o ya
  // revocado): logout siempre debe "tener éxito" desde la perspectiva del
  // cliente — no hay nada más que hacer del lado del servidor en esos casos.
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload & { jti?: string };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { jti?: string }>(
        refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      return;
    }
    if (!payload.jti) return;

    await this.prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_MS };