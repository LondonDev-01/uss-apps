import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

class SetMallaDto {
  @IsString()
  @MaxLength(10)
  mallaId: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Lista todos los usuarios (solo admin)' })
  list() {
    return this.usersService.list();
  }

  @Patch('me')
  @ApiOperation({ summary: 'Selecciona la malla del usuario autenticado (PLAN_V2 §4.2)' })
  setMyMalla(@Req() req: Request, @Body() dto: SetMallaDto) {
    const user = req.user as AuthenticatedUser;
    return this.usersService.setMalla(user.id, dto.mallaId);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Detalle de un usuario por id (solo admin)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }
}