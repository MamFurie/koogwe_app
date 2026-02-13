import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // ✅ FIX SÉCURITÉ : Les credentials viennent du .env
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('GMAIL_USER'),
        pass: this.configService.get<string>('GMAIL_PASS'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Koogwz Security" <${this.configService.get('GMAIL_USER')}>`,
        to: email,
        subject: 'Vérifiez votre compte Koogwz',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f5f3ff; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #6C3CE1; font-size: 28px;">Koogwz 🚗</h2>
            </div>
            <div style="background: white; border-radius: 12px; padding: 24px; text-align: center;">
              <p style="color: #6B7280; font-size: 15px; margin-bottom: 16px;">Voici votre code de validation :</p>
              <h1 style="font-size: 40px; letter-spacing: 8px; color: #6C3CE1; background: #F0EDFB; padding: 16px 24px; display: inline-block; border-radius: 12px; margin: 0;">
                ${code}
              </h1>
              <p style="color: #9CA3AF; font-size: 13px; margin-top: 16px;">Ce code expire dans 10 minutes.</p>
            </div>
          </div>
        `,
      });
    } catch (error) {
      console.error('Erreur envoi email:', error);
      // On ne throw pas pour ne pas bloquer l'inscription
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Koogwz" <${this.configService.get('GMAIL_USER')}>`,
        to: email,
        subject: 'Bienvenue sur Koogwz !',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #6C3CE1;">Bienvenue, ${name} ! 🎉</h2>
            <p>Votre compte Koogwz est prêt. Vous pouvez maintenant commander votre première course.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Erreur envoi email welcome:', error);
    }
  }
}
