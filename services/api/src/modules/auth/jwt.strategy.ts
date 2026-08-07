import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';
import { USS_DOMAIN_REGEX } from '../../common/domain';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  name: string;
  mallaId?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  mallaId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Validación de dominio en CADA request (PLAN_V3 §4.3)
    if (!payload.email || !USS_DOMAIN_REGEX.test(payload.email)) {
      throw new UnauthorizedException('Dominio de correo no permitido');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      mallaId: payload.mallaId,
    };
  }
}