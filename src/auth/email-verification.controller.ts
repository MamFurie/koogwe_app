import { Controller, Post, Body } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';

class SendCodeDto {
  email: string;
  name?: string;
}

class VerifyCodeDto {
  email: string;
  code: string;
}

@Controller('auth/email')
export class EmailVerificationController {
  constructor(private emailVerificationService: EmailVerificationService) {}

  @Post('send-code')
  async sendCode(@Body() dto: SendCodeDto) {
    return this.emailVerificationService.sendVerificationCode(dto.email, dto.name);
  }

  @Post('verify-code')
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.emailVerificationService.verifyCode(dto.email, dto.code);
  }

  @Post('resend-code')
  async resendCode(@Body() dto: { email: string }) {
    return this.emailVerificationService.resendCode(dto.email);
  }
}