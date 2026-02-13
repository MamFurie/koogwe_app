import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  // ---- Créer une course ----
  @Post()
  @UseGuards(AuthGuard)
  create(@Request() req: any, @Body() createRideDto: CreateRideDto) {
    const passengerId = req.user.sub;
    return this.ridesService.create(createRideDto, passengerId);
  }

  // ---- Historique des courses (passager OU chauffeur) ----
  // ✅ FIX : Cette route n'existait pas, history_screen.dart retournait toujours vide
  @Get('history')
  @UseGuards(AuthGuard)
  getHistory(@Request() req: any) {
    const userId = req.user.sub;
    const role = req.user.role;
    return this.ridesService.getHistory(userId, role);
  }

  // ---- Courses actives pour un chauffeur ----
  @Get('active')
  @UseGuards(AuthGuard)
  getActiveCourses() {
    return this.ridesService.getActiveCourses();
  }
}
