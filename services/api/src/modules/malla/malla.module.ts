import { Module } from '@nestjs/common';
import { AprobadosController } from './aprobados.controller';
import { AprobadosService } from './aprobados.service';
import { MallaController } from './malla.controller';
import { MallaService } from './malla.service';

@Module({
  controllers: [MallaController, AprobadosController],
  providers: [MallaService, AprobadosService],
})
export class MallaModule {}