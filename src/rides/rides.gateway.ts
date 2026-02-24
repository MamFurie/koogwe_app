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
    console.log('Socket Gateway initialise');
  }

  handleConnection(client: Socket) {
    console.log(`Client connecte: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client deconnecte: ${client.id}`);
  }

  @SubscribeMessage('join_ride')
  handleJoinRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    client.join(`ride_${data.rideId}`);
  }

  @SubscribeMessage('leave_ride')
  handleLeaveRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    client.leave(`ride_${data.rideId}`);
  }

  @SubscribeMessage('driver_online')
  handleDriverOnline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    client.join('drivers_online');
    console.log(`Chauffeur ${data.driverId} en ligne`);
  }

  @SubscribeMessage('driver_offline')
  handleDriverOffline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    client.leave('drivers_online');
    console.log(`Chauffeur ${data.driverId} hors ligne`);
  }

  notifyDrivers(rideData: any) {
    this.server.to('drivers_online').emit('new_ride', rideData);
    console.log(`Nouvelle course ${rideData.id} envoyee aux chauffeurs`);
  }

  // FIX BUG 3 + 4: Verif chauffeur ACTIVE + race condition via updateMany
  @SubscribeMessage('accept_ride')
  async handleAcceptRide(@MessageBody() data: { rideId: string; driverId: string; driverName?: string }) {
    try {
      const driver = await this.prisma.user.findUnique({
        where: { id: data.driverId },
        include: { driverProfile: true },
      });

      if (!driver) return;

      // FIX BUG 3: string literal au lieu de AccountStatus enum
      if (driver.accountStatus !== 'ACTIVE') {
        console.log(`Chauffeur ${data.driverId} non actif (${driver.accountStatus}) - rejet`);
        return;
      }

      if (driver.driverProfile && !driver.driverProfile.adminApproved) {
        console.log(`Chauffeur ${data.driverId} pas encore approuve - rejet`);
        return;
      }

      // FIX BUG 4: updateMany avec filtre status=REQUESTED -> anti race condition
      const updateResult = await this.prisma.ride.updateMany({
        where: { id: data.rideId, status: 'REQUESTED' as any },
        data: {
          status: 'ACCEPTED' as any,
          driverId: data.driverId,
          acceptedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        console.log(`Course ${data.rideId} deja acceptee`);
        return;
      }

      const vehicleInfo = driver.driverProfile
        ? `${driver.driverProfile.vehicleMake ?? ''} ${driver.driverProfile.vehicleModel ?? ''} - ${driver.driverProfile.vehicleColor ?? ''}`
        : 'Vehicule non renseigne';

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'ACCEPTED',
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        vehicleInfo,
        licensePlate: driver.driverProfile?.licensePlate ?? 'Non renseigne',
        driverRating: '4.9',
      });

      console.log(`Course ${data.rideId} acceptee par ${driver.name}`);
    } catch (e) {
      console.error('Erreur accept_ride:', e);
    }
  }

  @SubscribeMessage('driver_arrived')
  async handleDriverArrived(@MessageBody() data: { rideId: string }) {
    try {
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: 'ARRIVED' as any, arrivedAt: new Date() },
      });
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, { status: 'ARRIVED' });
    } catch (e) {
      console.error('Erreur driver_arrived:', e);
    }
  }

  @SubscribeMessage('start_trip')
  async handleStartTrip(@MessageBody() data: { rideId: string }) {
    try {
      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: 'IN_PROGRESS' as any, startedAt: new Date() },
      });
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, { status: 'IN_PROGRESS' });
    } catch (e) {
      console.error('Erreur start_trip:', e);
    }
  }

  @SubscribeMessage('finish_trip')
  async handleFinishTrip(@MessageBody() data: { rideId: string; price?: number }) {
    try {
      const updatedRide = await this.prisma.ride.update({
        where: { id: data.rideId },
        data: {
          status: 'COMPLETED' as any,
          completedAt: new Date(),
          ...(data.price && { price: data.price }),
        },
        include: {
          passenger: { select: { id: true, name: true } },
          driver: { select: { id: true, name: true } },
        },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'COMPLETED',
        finalPrice: updatedRide.price,
      });

      this.server.emit('trip_finished', {
        id: updatedRide.id,
        price: updatedRide.price,
        status: 'COMPLETED',
        vehicleType: updatedRide.vehicleType,
        requestedAt: updatedRide.requestedAt,
        passenger: updatedRide.passenger,
        driver: updatedRide.driver,
      });

      console.log(`Course ${data.rideId} terminee`);
    } catch (e) {
      console.error('Erreur finish_trip:', e);
    }
  }

  @SubscribeMessage('update_location')
  handleLocationUpdate(@MessageBody() data: { rideId: string; lat: number; lng: number }) {
    this.server.to(`ride_${data.rideId}`).emit(`driver_location_${data.rideId}`, {
      lat: data.lat,
      lng: data.lng,
    });
  }

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

  @SubscribeMessage('cancel_ride')
  async handleCancelRide(@MessageBody() data: { rideId: string; cancelledBy: string }) {
    try {
      const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
      if (!ride) return;

      if (['IN_PROGRESS', 'COMPLETED'].includes(ride.status)) return;

      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: 'CANCELLED' as any, cancelledAt: new Date() },
      });

      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
        status: 'CANCELLED',
        cancelledBy: data.cancelledBy,
      });

      console.log(`Course ${data.rideId} annulee par ${data.cancelledBy}`);
    } catch (e) {
      console.error('Erreur cancel_ride:', e);
    }
  }
}