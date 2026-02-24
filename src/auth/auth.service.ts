import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail.service';
import { CreateAuthDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  // ---- INSCRIPTION ----
  async create(createAuthDto: CreateAuthDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createAuthDto.email },
    });
    if (existing) throw new ConflictException('Cet email est deja utilise');

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 12);
    // FIX BUG 12: code 6 chiffres coherent avec EmailVerificationService
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = await this.prisma.user.create({
      data: {
        email: createAuthDto.email,
        name: createAuthDto.name,
        password: hashedPassword,
        phone: createAuthDto.phone,
        role: createAuthDto.role ?? 'PASSENGER',
        isVerified: true,
        // FIX BUG 1+12: accountStatus ACTIVE en mode dev
        accountStatus: 'ACTIVE',
        verificationToken: verificationCode,
        // Creer le profil chauffeur automatiquement si DRIVER
        driverProfile:
          createAuthDto.role === 'DRIVER'
            ? { create: {} }
            : undefined,
        // FIX BUG 1 CRITIQUE: Wallet cree automatiquement a l'inscription
        // Avant: le wallet n'existait que si verifyCode() etait appele -> plantage paiement
        wallet: { create: { balance: 0 } },
      },
    });

    // En prod, decommmenter:
    // await this.mailService.sendVerificationCode(newUser.email, verificationCode);

    return { message: 'Compte cree avec succes', email: newUser.email };
  }

  // ---- VERIFICATION EMAIL ----
  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Email introuvable');
    if (user.isVerified) return { message: 'Compte deja verifie' };
    if (user.verificationToken !== code) throw new BadRequestException('Code invalide');

    await this.prisma.user.update({
      where: { email },
      data: { isVerified: true, verificationToken: null },
    });
    return { message: 'Compte verifie avec succes !' };
  }

  // ---- CONNEXION ----
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Email incorrect');
    if (!user.isVerified)
      throw new UnauthorizedException('Veuillez verifier votre email avant de vous connecter.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Mot de passe incorrect');

    // FIX: Verifier que le compte n'est pas suspendu/rejete
    if (user.accountStatus === 'SUSPENDED') {
      throw new UnauthorizedException('Votre compte a ete suspendu. Contactez le support.');
    }
    if (user.accountStatus === 'REJECTED') {
      throw new UnauthorizedException('Votre compte a ete rejete. Contactez le support.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    };
  }
}