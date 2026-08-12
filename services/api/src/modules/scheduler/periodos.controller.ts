import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { PeriodosService } from './periodos.service';

class CreatePeriodoDto {
  @IsString()
  nombre: string;
}

class UpdatePeriodoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
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

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Actualiza un período (solo admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeriodoDto,
  ) {
    return this.periodosService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Elimina un período (solo admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodosService.remove(id);
  }
}
