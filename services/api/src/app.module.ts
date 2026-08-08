import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MallaModule } from './modules/malla/malla.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { OptimizerModule } from './modules/optimizer/optimizer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MallaModule,
    SchedulerModule,
    OptimizerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
