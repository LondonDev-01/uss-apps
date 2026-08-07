import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { PeriodosService } from './periodos.service';

class CreatePeriodoDto {
  @IsString()
  nombre: string;
}

@ApiTags('scheduler')
@Controller('periodos')
export class PeriodosController {
  constructor(private readonly periodosService: PeriodosService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista los períodos' })
  list() {
    return this.periodosService.list();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalle de un período con sus horarios' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodosService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Crea un período (solo admin)' })
  create(@Body() dto: CreatePeriodoDto) {
    return this.periodosService.create(dto.nombre);
  }
}