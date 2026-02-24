import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { FaceVerificationService } from './face-verification.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('face-verification')
@UseGuards(AuthGuard)
export class FaceVerificationController {
  constructor(private faceVerificationService: FaceVerificationService) {}

  @Post('verify-live')
  async verifyLiveFace(
    @Request() req: any,
    @Body() body: { imageBase64: string },
  ) {
    const userId = req.user.sub;
    return this.faceVerificationService.verifyLiveFace(userId, body.imageBase64);
  }

  @Post('verify-movements')
  async verifyHeadMovements(
    @Request() req: any,
    @Body()
    body: {
      leftImage: string;
      rightImage: string;
      upImage: string;
      downImage: string;
    },
  ) {
    const userId = req.user.sub;
    return this.faceVerificationService.verifyHeadMovements(
      userId,
      body.leftImage,
      body.rightImage,
      body.upImage,
      body.downImage,
    );
  }
}