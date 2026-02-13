import { IsNumber, IsNotEmpty, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

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
}
