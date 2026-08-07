import { Module } from '@nestjs/common';
import { PeriodosController } from './periodos.controller';
import { PeriodosService } from './periodos.service';

@Module({
  controllers: [PeriodosController],
  providers: [PeriodosService],
})
export class SchedulerModule {}