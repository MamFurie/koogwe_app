import { Controller, Patch, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Request() req: any) {
    const userId = req.user.sub;
    return this.usersService.getProfile(userId);
  }

  @Patch('update-vehicle')
  @UseGuards(AuthGuard)
  async updateVehicle(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    return this.usersService.updateVehicle(userId, body);
  }

  // ✅ NEW: Vérification faciale validée
  @Post('verify-face')
  @UseGuards(AuthGuard)
  async verifyFace(@Request() req: any) {
    const userId = req.user.sub;
    return this.usersService.markFaceVerified(userId);
  }

  // ✅ NEW: Documents uploadés
  @Post('upload-documents')
  @UseGuards(AuthGuard)
  async uploadDocuments(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    return this.usersService.markDocumentsUploaded(userId);
  }

  // ✅ NEW: Statut d'approbation chauffeur
  @Get('driver-status')
  @UseGuards(AuthGuard)
  async driverStatus(@Request() req: any) {
    const userId = req.user.sub;
    return this.usersService.getDriverStatus(userId);
  }
}
