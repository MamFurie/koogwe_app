import { IsEmail, IsString, IsEnum, MinLength, IsOptional, IsPhoneNumber } from 'class-validator';

export enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export class CreateAuthDto {
  @IsEmail({}, { message: 'Veuillez fournir un email valide' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(UserRole, { message: 'Le rôle doit être PASSENGER, DRIVER ou ADMIN' })
  @IsOptional()
  role?: UserRole;
}
