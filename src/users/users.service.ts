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
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil chauffeur introuvable');

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

  // ✅ Marquer la vérification faciale comme complète
  async markFaceVerified(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil chauffeur introuvable');

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { faceVerified: true, faceVerifiedAt: new Date() },
    });
  }

  // ✅ Marquer les documents comme uploadés
  async markDocumentsUploaded(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil chauffeur introuvable');

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { documentsUploaded: true, documentsUploadedAt: new Date() },
    });
  }

  // ✅ Statut global du chauffeur
  async getDriverStatus(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil chauffeur introuvable');

    return {
      faceVerified: profile.faceVerified,
      documentsUploaded: profile.documentsUploaded,
      adminApproved: profile.adminApproved,
      // Étape courante dans l'onboarding
      currentStep: !profile.faceVerified
        ? 'face_verification'
        : !profile.documentsUploaded
        ? 'document_upload'
        : !profile.adminApproved
        ? 'pending_admin'
        : 'active',
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const { password, verificationToken, ...safeUser } = user;
    return safeUser;
  }
}
