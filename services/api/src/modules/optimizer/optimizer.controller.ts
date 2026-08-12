import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { OptimizerService } from './optimizer.service';

@ApiTags('optimizer')
@ApiBearerAuth()
@Controller('optimizer')
export class OptimizerController {
  constructor(private readonly optimizerService: OptimizerService) {}

  @Get('prioridades')
  @ApiQuery({
    name: 'periodoId',
    required: false,
    description: 'Si se omite, usa el período activo más reciente (si existe)',
  })
  @ApiOperation({
    summary: 'Calcula prioridades automáticas de inscripción (PLAN_V2 §5/§10)',
  })
  prioridades(@Req() req: Request, @Query('periodoId') periodoId?: string) {
    const user = req.user as AuthenticatedUser;
    return this.optimizerService.calcularPrioridades(user.id, periodoId);
  }
}
