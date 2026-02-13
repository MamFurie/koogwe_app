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
  cors: { origin: '*' },
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

  // ---- Rejoindre une room de course ----
  @SubscribeMessage('join_ride')
  handleJoinRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    const room = `ride_${data.rideId}`;
    client.join(room);
    console.log(`👥 ${client.id} rejoint la room ${room}`);
  }

  @SubscribeMessage('leave_ride')
  handleLeaveRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    client.leave(`ride_${data.rideId}`);
  }

  // ---- Chauffeur en ligne ----
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

  // ---- Nouvelle course → notifier tous les chauffeurs en ligne ----
  notifyDrivers(rideData: any) {
    // ✅ FIX : On envoie seulement aux chauffeurs en ligne, pas à TOUT LE MONDE
    this.server.to('drivers_online').emit('new_ride', rideData);
    console.log(`📢 Nouvelle course ${rideData.id} broadcastée aux chauffeurs en ligne`);
  }

  // ---- Accepter une course ----
  @SubscribeMessage('accept_ride')
  async handleAcceptRide(@MessageBody() data: { rideId: string; driverId: string }) {
    try {
      const driver = await this.prisma.user.findUnique({
        where: { id: data.driverId },
        include: { driverProfile: true },
      });

      if (!driver) return;

      // ✅ FIX CRITIQUE : On persiste le changement de statut en BDD
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: {
          status: RideStatus.ACCEPTED,
          driverId: data.driverId,
        },
      });

      const vehicleInfo = driver.driverProfile
        ? `${driver.driverProfile.vehicleMake ?? ''} ${driver.driverProfile.vehicleModel ?? ''} • ${driver.driverProfile.vehicleColor ?? ''}`
        : 'Véhicule non renseigné';

      const update = {
        status: 'ACCEPTED',
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        vehicleInfo,
        licensePlate: driver.driverProfile?.licensePlate ?? 'Non renseigné',
        driverRating: '4.9 ⭐',
        driverImage: `https://i.pravatar.cc/150?u=${driver.id}`,
      };

      // ✅ FIX SÉCURITÉ : On envoie SEULEMENT aux membres de la room de cette course
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, update);

      console.log(`✅ Course ${data.rideId} acceptée par ${driver.name}`);
    } catch (error) {
      console.error("Erreur accept_ride:", error);
    }
  }

  // ---- Chauffeur arrivé ----
  @SubscribeMessage('driver_arrived')
  async handleDriverArrived(@MessageBody() data: { rideId: string }) {
    try {
      // ✅ FIX : Persistance en BDD
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: RideStatus.ARRIVED },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'ARRIVED',
      });
    } catch (e) {
      console.error("Erreur driver_arrived:", e);
    }
  }

  // ---- Démarrer la course ----
  @SubscribeMessage('start_trip')
  async handleStartTrip(@MessageBody() data: { rideId: string }) {
    try {
      // ✅ FIX : Persistance en BDD
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: RideStatus.IN_PROGRESS },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'IN_PROGRESS',
      });
    } catch (e) {
      console.error("Erreur start_trip:", e);
    }
  }

  // ---- Terminer la course ----
  @SubscribeMessage('finish_trip')
  async handleFinishTrip(@MessageBody() data: { rideId: string; price?: number }) {
    try {
      // ✅ FIX : Persistance en BDD + update du prix final si fourni
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: {
          status: RideStatus.COMPLETED,
          ...(data.price && { price: data.price }),
        },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'COMPLETED',
        finalPrice: data.price,
      });

      console.log(`✅ Course ${data.rideId} terminée`);
    } catch (e) {
      console.error("Erreur finish_trip:", e);
    }
  }

  // ---- Mise à jour GPS du chauffeur ----
  @SubscribeMessage('update_location')
  handleLocationUpdate(@MessageBody() data: { rideId: string; lat: number; lng: number }) {
    // ✅ FIX SÉCURITÉ : On envoie SEULEMENT à la room de cette course
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
    // ✅ On envoie le message seulement aux participants de la course
    this.server.to(`ride_${data.rideId}`).emit(`chat_${data.rideId}`, {
      senderId: data.senderId,
      message: data.message,
      timestamp: data.timestamp,
    });
  }
}
