import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FaceVerificationController } from './face-verification.controller';
import { FaceVerificationService } from './face-verification.service';
import { AWSRekognitionService } from './aws-rekognition.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FaceVerificationController],
  providers: [FaceVerificationService, AWSRekognitionService, PrismaService],
  exports: [FaceVerificationService],
})
export class FaceVerificationModule {}