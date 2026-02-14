import { IsNumber, IsNotEmpty, IsPositive, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleType } from '@prisma/client';

export class CreateRideDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  originLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  originLng: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  destLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  destLng: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  // ✅ FIX BUG 2 : vehicleType accepté et validé
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;
}
