import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ FIX CRITIQUE : Sans ça, les décorateurs @IsEmail(), @IsNumber() etc.
  // dans les DTOs ne font RIEN. Toutes les données passaient sans validation.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: false,
      transform: true,       // Transforme automatiquement les types (string → number)
    }),
  );

  // ✅ FIX CORS : En dev, on accepte localhost:5000 (Flutter Web) et 3001 (tests)
  // En prod, remplace '*' par ton domaine réel
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://ton-domaine.com']
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Koogwz Backend démarré sur http://localhost:${port}`);
}
bootstrap();
