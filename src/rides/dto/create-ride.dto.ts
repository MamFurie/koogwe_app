import { IsNumber, IsNotEmpty, IsPositive, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

// FIX: VehicleType defini localement au lieu de @prisma/client (non disponible au runtime)
enum VehicleType {
  MOTO = 'MOTO',
  ECO = 'ECO',
  CONFORT = 'CONFORT',
}

export class CreateRideDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  originLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  originLng: number;

  @IsString()
  @IsOptional()
  originAddress?: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  destLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  destLng: number;

  @IsString()
  @IsOptional()
  destAddress?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: string;
}