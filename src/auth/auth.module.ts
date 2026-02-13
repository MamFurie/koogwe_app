import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail.service';

@Module({
  imports: [
    // ✅ FIX SÉCURITÉ : La clé JWT vient de .env, plus hardcodée dans le code
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
  expiresIn: config.get('JWT_EXPIRES_IN', '1d') as any,
},
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, MailService],
  exports: [AuthService],
})
export class AuthModule {}
