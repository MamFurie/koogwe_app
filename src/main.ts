import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // ✅ FIX BUG 5 : CORS ouvert pour Railway + apps mobiles
  // Les apps mobiles (APK) ne sont pas soumises au CORS, mais le web oui
  app.enableCors({
    origin: '*', // Accepte tout — mobile + web + Railway
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // Doit être false si origin est '*'
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); // '0.0.0.0' important pour Railway

  console.log(`🚀 Koogwz Backend démarré sur le port ${port}`);
}
bootstrap();
