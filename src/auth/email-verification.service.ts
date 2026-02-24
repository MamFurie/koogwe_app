import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailVerificationService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Générer code 6 chiffres
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Envoyer le code par email
  async sendVerificationCode(
    email: string,
    name?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const code = this.generateVerificationCode();
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + 15); // Code valide 15 minutes

      // Sauvegarder le code en BDD
      await this.prisma.user.update({
        where: { email },
        data: {
          verificationToken: code,
          emailCodeExpiry: expiry,
        },
      });

      // Envoyer l'email
      const mailOptions = {
        from: `"KOOGWE" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Code de vérification KOOGWE',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .logo { text-align: center; margin-bottom: 30px; }
              .logo h1 { color: #FF6B6B; font-size: 32px; margin: 0; }
              .code-box { background: #FF6B6B; color: white; text-align: center; padding: 20px; border-radius: 10px; margin: 20px 0; }
              .code { font-size: 36px; font-weight: bold; letter-spacing: 5px; }
              .info { color: #666; font-size: 14px; line-height: 1.6; }
              .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <h1>🚗 KOOGWE</h1>
              </div>
              <h2>Bonjour ${name || 'Utilisateur'} !</h2>
              <p class="info">Merci de vous inscrire à KOOGWE. Votre code de vérification est :</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p class="info">
                Ce code est valable pendant <strong>15 minutes</strong>.<br>
                Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email.
              </p>
              
              <div class="footer">
                © ${new Date().getFullYear()} KOOGWE - Votre compagnon de voyage de confiance
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);

      return { success: true, message: 'Code envoyé avec succès' };
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email :", error);
      return { success: false, message: "Erreur lors de l'envoi du code" };
    }
  }

  // Vérifier le code
  async verifyCode(
    email: string,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return { success: false, message: 'Utilisateur introuvable' };
      }

      if (!user.verificationToken) {
        return { success: false, message: 'Code non généré' };
      }

      // Vérifier l'expiration
      if (user.emailCodeExpiry && new Date() > user.emailCodeExpiry) {
        return { success: false, message: 'Code expiré' };
      }

      // Vérifier le code
      if (user.verificationToken !== code) {
        return { success: false, message: 'Code incorrect' };
      }

      // Marquer l'email comme vérifié
      await this.prisma.user.update({
        where: { email },
        data: {
          isVerified: true,
          verificationToken: null,
          emailCodeExpiry: null,
          accountStatus:
            user.role === 'PASSENGER'
              ? 'EMAIL_VERIFIED'
              : 'FACE_VERIFICATION_PENDING',
        },
      });

      // Créer un wallet pour l'utilisateur
      await this.prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
        },
      });

      return { success: true, message: 'Email vérifié avec succès' };
    } catch (error) {
      console.error('Erreur de vérification du code :', error);
      return { success: false, message: 'Erreur lors de la vérification du code' };
    }
  }

  // Renvoyer le code
  async resendCode(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return { success: false, message: 'Utilisateur introuvable' };
      }

      if (user.isVerified) {
        return { success: false, message: 'Email déjà vérifié' };
      }

      return await this.sendVerificationCode(email, user.name ?? undefined);
    } catch (error) {
      console.error('Erreur de renvoi du code :', error);
      return { success: false, message: 'Erreur lors du renvoi du code' };
    }
  }
}