import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AprobadosService } from './aprobados.service';

export class UpsertAprobadoDto {
  @IsString()
  @IsUUID()
  mallaCursoId: string;
}

@ApiTags('malla')
@ApiBearerAuth()
@Controller('aprobados')
export class AprobadosController {
  constructor(private readonly aprobadosService: AprobadosService) {}

  @Get('me')
  @ApiOperation({ summary: 'Cursos aprobados del usuario autenticado' })
  listMine(@Req() req: Request) {
    return this.aprobadosService.listMine(req.user as AuthenticatedUser);
  }

  @Post('me')
  @ApiOperation({ summary: 'Marca un curso como aprobado' })
  upsert(@Req() req: Request, @Body() dto: UpsertAprobadoDto) {
    return this.aprobadosService.upsert(
      req.user as AuthenticatedUser,
      dto.mallaCursoId,
    );
  }

  @Delete('me/:mallaCursoId')
  @ApiOperation({ summary: 'Quita un curso aprobado' })
  remove(@Req() req: Request, @Param('mallaCursoId') mallaCursoId: string) {
    return this.aprobadosService.remove(
      req.user as AuthenticatedUser,
      mallaCursoId,
    );
  }
}