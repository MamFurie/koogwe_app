import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service';
import { RideStatus } from '@prisma/client';

@WebSocketGateway({
  cors: { origin: '*' }, // ✅ Accepte les connexions depuis partout (mobile + web)
})
export class RidesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  afterInit() {
    console.log('✅ Socket Gateway initialisé');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client déconnecté: ${client.id}`);
  }

  // ---- Rejoindre une room ----
  @SubscribeMessage('join_ride')
  handleJoinRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    const room = `ride_${data.rideId}`;
    client.join(room);
    console.log(`👥 ${client.id} rejoint ${room}`);
  }

  @SubscribeMessage('leave_ride')
  handleLeaveRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    client.leave(`ride_${data.rideId}`);
  }

  // ---- Chauffeur en ligne / hors ligne ----
  @SubscribeMessage('driver_online')
  handleDriverOnline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    client.join('drivers_online');
    console.log(`🟢 Chauffeur ${data.driverId} en ligne`);
  }

  @SubscribeMessage('driver_offline')
  handleDriverOffline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    client.leave('drivers_online');
    console.log(`🔴 Chauffeur ${data.driverId} hors ligne`);
  }

  // ---- Nouvelle course → tous les chauffeurs en ligne ----
  notifyDrivers(rideData: any) {
    this.server.to('drivers_online').emit('new_ride', rideData);
    console.log(`📢 Nouvelle course ${rideData.id} envoyée aux chauffeurs`);
  }

  // ---- Accepter une course ----
  @SubscribeMessage('accept_ride')
  async handleAcceptRide(@MessageBody() data: { rideId: string; driverId: string; driverName?: string }) {
    try {
      const driver = await this.prisma.user.findUnique({
        where: { id: data.driverId },
        include: { driverProfile: true },
      });

      if (!driver) return;

      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: RideStatus.ACCEPTED, driverId: data.driverId },
      });

      const vehicleInfo = driver.driverProfile
        ? `${driver.driverProfile.vehicleMake ?? ''} ${driver.driverProfile.vehicleModel ?? ''} • ${driver.driverProfile.vehicleColor ?? ''}`
        : 'Véhicule non renseigné';

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'ACCEPTED',
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        vehicleInfo,
        licensePlate: driver.driverProfile?.licensePlate ?? 'Non renseigné',
        driverRating: '4.9 ⭐',
      });

      console.log(`✅ Course ${data.rideId} acceptée par ${driver.name}`);
    } catch (e) {
      console.error('Erreur accept_ride:', e);
    }
  }

  // ---- Chauffeur arrivé ----
  @SubscribeMessage('driver_arrived')
  async handleDriverArrived(@MessageBody() data: { rideId: string }) {
    try {
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: RideStatus.ARRIVED },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'ARRIVED',
      });
    } catch (e) {
      console.error('Erreur driver_arrived:', e);
    }
  }

  // ---- Démarrer la course ----
  @SubscribeMessage('start_trip')
  async handleStartTrip(@MessageBody() data: { rideId: string }) {
    try {
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: RideStatus.IN_PROGRESS },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'IN_PROGRESS',
      });
    } catch (e) {
      console.error('Erreur start_trip:', e);
    }
  }

  // ✅ FIX BUG 1 CRITIQUE : Terminer la course émet MAINTENANT 'trip_finished'
  // Avant : seulement 'ride_status_${rideId}' → history/wallet jamais mis à jour
  // Après : émet AUSSI 'trip_finished' avec les données complètes pour les écrans temps réel
  @SubscribeMessage('finish_trip')
  async handleFinishTrip(@MessageBody() data: { rideId: string; price?: number }) {
    try {
      const updatedRide = await this.prisma.ride.update({
        where: { id: data.rideId },
        data: {
          status: RideStatus.COMPLETED,
          ...(data.price && { price: data.price }),
        },
        include: {
          // ✅ On inclut les infos complètes pour les écrans temps réel
          passenger: { select: { id: true, name: true } },
          driver: { select: { id: true, name: true } },
        },
      });

      // 1. Notifier les participants de la course
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'COMPLETED',
        finalPrice: updatedRide.price,
      });

      // ✅ 2. Émettre 'trip_finished' globalement pour history_screen et wallet_screen
      // Contient toutes les infos nécessaires pour la mise à jour temps réel
      this.server.emit('trip_finished', {
        id: updatedRide.id,
        price: updatedRide.price,
        status: 'COMPLETED',
        vehicleType: updatedRide.vehicleType,
        createdAt: updatedRide.createdAt,
        passenger: updatedRide.passenger,
        driver: updatedRide.driver,
      });

      console.log(`✅ Course ${data.rideId} terminée — trip_finished émis`);
    } catch (e) {
      console.error('Erreur finish_trip:', e);
    }
  }

  // ---- GPS du chauffeur ----
  @SubscribeMessage('update_location')
  handleLocationUpdate(@MessageBody() data: { rideId: string; lat: number; lng: number }) {
    // Seulement aux participants de la course (sécurité)
    this.server.to(`ride_${data.rideId}`).emit(`driver_location_${data.rideId}`, {
      lat: data.lat,
      lng: data.lng,
    });
  }

  // ---- Chat ----
  @SubscribeMessage('chat_message')
  handleChatMessage(
    @MessageBody() data: { rideId: string; senderId: string; message: string; timestamp: string },
  ) {
    this.server.to(`ride_${data.rideId}`).emit(`chat_${data.rideId}`, {
      senderId: data.senderId,
      message: data.message,
      timestamp: data.timestamp,
    });
  }
}
