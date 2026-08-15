import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AprobadosService } from './aprobados.service';

export class UpsertAprobadoDto {
  // MallaCurso.id es un string libre (VarChar(50)), no un UUID — ver
  // prisma/schema.prisma. @IsUUID() rechazaba cualquier id real de curso
  // (ej. "2021-1-1"), bug preexistente nunca ejercido hasta el seed real.
  @IsString()
  @MaxLength(50)
  mallaCursoId: string;
}

export class SetNotaDto {
  // Escala chilena 1.0-7.0.
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(7)
  nota: number;
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
  @ApiOperation({
    summary:
      'Quita un curso aprobado y, en cascada, todos los cursos aprobados que dependen de él como prerrequisito',
  })
  remove(@Req() req: Request, @Param('mallaCursoId') mallaCursoId: string) {
    return this.aprobadosService.remove(
      req.user as AuthenticatedUser,
      mallaCursoId,
    );
  }

  @Patch('me/:mallaCursoId/nota')
  @ApiOperation({
    summary: 'Registra o corrige la nota de un curso ya aprobado (para el cálculo de promedio)',
  })
  setNota(
    @Req() req: Request,
    @Param('mallaCursoId') mallaCursoId: string,
    @Body() dto: SetNotaDto,
  ) {
    return this.aprobadosService.setNota(
      req.user as AuthenticatedUser,
      mallaCursoId,
      dto.nota,
    );
  }
}