import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas versionadas bajo /api/v1 (PLAN_V3 §4.2)
  app.setGlobalPrefix('api/v1');

  // Dev: permisivo. En Fase F se restringe a los dominios del ecosistema.
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // El documento OpenAPI es el contrato del ecosistema (ADR-2)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('USS Apps API')
    .setDescription('Contrato OpenAPI del ecosistema uss-apps (PLAN_V3, ADR-2)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
