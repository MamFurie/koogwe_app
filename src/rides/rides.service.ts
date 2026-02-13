import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RidesGateway } from './rides.gateway';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideStatus } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(
    private prisma: PrismaService,
    private ridesGateway: RidesGateway,
  ) {}

  // ---- Créer une course ----
  async create(createRideDto: CreateRideDto, passengerId: string) {
    const newRide = await this.prisma.ride.create({
      data: {
        passengerId,
        originLat: Number(createRideDto.originLat),
        originLng: Number(createRideDto.originLng),
        destLat: Number(createRideDto.destLat),
        destLng: Number(createRideDto.destLng),
        price: Number(createRideDto.price),
        status: RideStatus.REQUESTED,
      },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    // Notifier les chauffeurs en ligne
    this.ridesGateway.notifyDrivers(newRide);

    return newRide;
  }

  // ---- Historique des courses ----
  async getHistory(userId: string, role: string) {
    const where =
      role === 'DRIVER'
        ? { driverId: userId, status: RideStatus.COMPLETED }
        : { passengerId: userId };

    const rides = await this.prisma.ride.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        passenger: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    });

    // Enrichir les données pour l'affichage dans l'historique
    return rides.map((ride) => ({
      id: ride.id,
      name: role === 'DRIVER' ? (ride.passenger?.name ?? 'Passager') : (ride.driver?.name ?? 'Chauffeur'),
      price: ride.price,
      status: ride.status,
      type: 'Moto',
      dist: '—',
      time: '—',
      rating: '5.0',
      date: ride.createdAt.toLocaleDateString('fr-FR'),
      originLat: ride.originLat,
      originLng: ride.originLng,
      destLat: ride.destLat,
      destLng: ride.destLng,
    }));
  }

  // ---- Courses actives (pour affichage chauffeur) ----
  async getActiveCourses() {
    return this.prisma.ride.findMany({
      where: {
        status: { in: [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS] },
      },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
