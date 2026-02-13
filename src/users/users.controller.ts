import { Controller, Patch, Get, Body, UseGuards, Request } from '@nestjs/common';
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
    // ✅ FIX : Cohérence avec le JWT qui stocke l'ID dans 'sub'
    const userId = req.user.sub;
    return this.usersService.updateVehicle(userId, body);
  }
}
