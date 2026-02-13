import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface UpdateVehicleDto {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateVehicle(userId: string, data: UpdateVehicleDto) {
    // Vérifier que le profil chauffeur existe
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profil chauffeur introuvable pour cet utilisateur');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: {
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehicleColor: data.vehicleColor,
        licensePlate: data.licensePlate,
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
      // Ne jamais retourner le mot de passe
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const { password, verificationToken, ...safeUser } = user;
    return safeUser;
  }
}
