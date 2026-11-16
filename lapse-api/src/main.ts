import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DatabaseExceptionFilter } from './database/database-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new DatabaseExceptionFilter());
  if (process.env.CORS_ORIGINS)
    app.enableCors({
      origin: process.env.CORS_ORIGINS.split(','),
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Timezone'],
    });
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
