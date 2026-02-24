import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import Stripe from 'stripe';

@Injectable()
export class WalletService {
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }

  // FIX BUG 2: Helper pour obtenir ou creer un wallet (securite defensive)
  private async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, balance: 0 },
      });
    }
    return wallet;
  }

  // Obtenir le solde du portefeuille
  async getBalance(userId: string): Promise<{ balance: number }> {
    const wallet = await this.getOrCreateWallet(userId);
    return { balance: wallet.balance };
  }

  // Recharger le portefeuille avec carte bancaire (Stripe)
  // FIX BUG 8: Validation du montant minimum
  async rechargeWithCard(
    userId: string,
    amount: number,
    paymentMethodId: string,
  ): Promise<{ success: boolean; message: string }> {
    // FIX BUG 8: Valider le montant
    if (!amount || amount <= 0) {
      throw new BadRequestException('Le montant doit etre superieur a 0');
    }
    if (amount < 1) {
      throw new BadRequestException('Le montant minimum de recharge est de 1');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      });

      if (paymentIntent.status === 'succeeded') {
        await this.prisma.wallet.update({
          where: { userId },
          data: { balance: { increment: amount } },
        });

        await this.prisma.transaction.create({
          data: {
            userId,
            type: 'RECHARGE',
            amount,
            status: 'COMPLETED',
            paymentMethod: 'CARD',
            stripePaymentId: paymentIntent.id,
          },
        });

        return { success: true, message: 'Recharge reussie' };
      }

      return { success: false, message: 'Paiement refuse' };
    } catch (error) {
      console.error('Erreur de chargement du portefeuille :', error);
      return { success: false, message: 'Erreur lors du processus de paiement' };
    }
  }

  // Payer une course avec le wallet
  // FIX BUG 2: Verifier et creer le wallet du chauffeur si inexistant
  async payRideFromWallet(
    userId: string,
    rideId: string,
    amount: number,
  ): Promise<{ success: boolean; message: string }> {
    // FIX BUG 8: Valider le montant
    if (!amount || amount <= 0) {
      throw new BadRequestException('Le montant doit etre superieur a 0');
    }

    try {
      const wallet = await this.getOrCreateWallet(userId);

      if (wallet.balance < amount) {
        return { success: false, message: 'Solde insuffisant' };
      }

      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: { driver: true },
      });

      if (!ride || !ride.driverId) {
        return { success: false, message: 'Course introuvable' };
      }

      // FIX BUG 2: S'assurer que le chauffeur a un wallet
      await this.getOrCreateWallet(ride.driverId);

      // Transaction atomique avec prisma.$transaction pour eviter les incoeherences
      await this.prisma.$transaction([
        // Debiter le passager
        this.prisma.wallet.update({
          where: { userId },
          data: { balance: { decrement: amount } },
        }),
        // Crediter le chauffeur
        this.prisma.wallet.update({
          where: { userId: ride.driverId },
          data: { balance: { increment: amount } },
        }),
        // Transaction passager
        this.prisma.transaction.create({
          data: {
            userId,
            type: 'PAYMENT',
            amount: -amount,
            status: 'COMPLETED',
            rideId,
            paymentMethod: 'WALLET',
          },
        }),
        // Transaction chauffeur
        this.prisma.transaction.create({
          data: {
            userId: ride.driverId,
            type: 'RECHARGE',
            amount,
            status: 'COMPLETED',
            rideId,
            paymentMethod: 'WALLET',
          },
        }),
        // Marquer la course comme payee
        this.prisma.ride.update({
          where: { id: rideId },
          data: { isPaid: true },
        }),
      ]);

      return { success: true, message: 'Paiement reussi' };
    } catch (error) {
      console.error('Erreur de paiement course :', error);
      return { success: false, message: 'Erreur lors du processus de paiement' };
    }
  }

  // Demander un retrait (chauffeur)
  // FIX BUG 6: Transaction atomique - debiter d'abord, creer la transaction ensuite
  // FIX BUG 8: Validation du montant minimum
  async requestWithdrawal(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; message: string }> {
    // FIX BUG 8: Valider le montant
    if (!amount || amount <= 0) {
      throw new BadRequestException('Le montant doit etre superieur a 0');
    }
    if (amount < 5) {
      throw new BadRequestException('Le montant minimum de retrait est de 5');
    }

    try {
      const wallet = await this.getOrCreateWallet(userId);

      if (wallet.balance < amount) {
        return { success: false, message: 'Solde insuffisant' };
      }

      // FIX BUG 6: Transaction atomique - debiter ET creer la transaction en meme temps
      // Avant: transaction creee AVANT le debit -> incoherence si le debit echoue
      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { userId },
          data: { balance: { decrement: amount } },
        }),
        this.prisma.transaction.create({
          data: {
            userId,
            type: 'WITHDRAWAL',
            amount: -amount,
            status: 'PENDING',
            paymentMethod: 'CARD',
          },
        }),
      ]);

      return { success: true, message: 'Demande de retrait envoyee' };
    } catch (error) {
      console.error('Erreur lors de la demande de retrait :', error);
      return { success: false, message: 'Erreur lors de la demande de retrait' };
    }
  }

  // Obtenir l'historique des transactions
  async getTransactionHistory(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}