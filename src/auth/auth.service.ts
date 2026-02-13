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
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 12);
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const newUser = await this.prisma.user.create({
      data: {
        email: createAuthDto.email,
        name: createAuthDto.name,
        password: hashedPassword,
        phone: createAuthDto.phone,
        role: createAuthDto.role ?? 'PASSENGER',
        // En dev : compte activé directement. En prod, mettre false et envoyer l'email.
        isVerified: true,
        verificationToken: verificationCode,
        // Créer le profil chauffeur automatiquement si DRIVER
        driverProfile:
          createAuthDto.role === 'DRIVER'
            ? { create: {} }
            : undefined,
      },
    });

    // En prod, décommenter :
    // await this.mailService.sendVerificationCode(newUser.email, verificationCode);

    return { message: 'Compte créé avec succès', email: newUser.email };
  }

  // ---- VÉRIFICATION EMAIL ----
  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Email introuvable');
    if (user.isVerified) return { message: 'Compte déjà vérifié' };
    if (user.verificationToken !== code) throw new BadRequestException('Code invalide');

    await this.prisma.user.update({
      where: { email },
      data: { isVerified: true, verificationToken: null },
    });
    return { message: 'Compte vérifié avec succès !' };
  }

  // ---- CONNEXION ----
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Email incorrect');
    if (!user.isVerified)
      throw new UnauthorizedException('Veuillez vérifier votre email avant de vous connecter.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Mot de passe incorrect');

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
