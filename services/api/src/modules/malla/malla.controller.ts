import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MallaService } from './malla.service';

@ApiTags('malla')
@ApiBearerAuth()
@Controller('mallas')
export class MallaController {
  constructor(private readonly mallaService: MallaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las mallas curriculares' })
  list() {
    return this.mallaService.listMallas();
  }

  @Get(':mallaId')
  @ApiOperation({ summary: 'Detalle de una malla con cursos, prerrequisitos y equivalencias' })
  detalle(@Param('mallaId') mallaId: string) {
    return this.mallaService.getMallaDetalle(mallaId);
  }

  @Get(':mallaId/cursos/:cursoId')
  @ApiOperation({ summary: 'Detalle de un curso dentro de una malla' })
  curso(@Param('mallaId') mallaId: string, @Param('cursoId') cursoId: string) {
    return this.mallaService.getCurso(mallaId, cursoId);
  }
}