import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { AuthGuard } from '../auth/auth.guard';

// FIX BUG 7: On utilise Request pour recuperer l'userId du JWT
// Avant: userId passé en parametre HTTP -> n'importe qui pouvait consulter le wallet d'un autre

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  // FIX BUG 7: userId vient du token JWT, pas du parametre URL
  @Get('balance')
  async getBalance(@Request() req: any) {
    const userId = req.user.sub;
    return this.walletService.getBalance(userId);
  }

  @Post('recharge-card')
  async rechargeWithCard(
    @Request() req: any,
    @Body() dto: { amount: number; paymentMethodId: string },
  ) {
    const userId = req.user.sub;
    return this.walletService.rechargeWithCard(userId, dto.amount, dto.paymentMethodId);
  }

  @Post('pay-ride')
  async payRide(@Request() req: any, @Body() dto: { rideId: string; amount: number }) {
    const userId = req.user.sub;
    return this.walletService.payRideFromWallet(userId, dto.rideId, dto.amount);
  }

  @Post('request-withdrawal')
  async requestWithdrawal(@Request() req: any, @Body() dto: { amount: number }) {
    const userId = req.user.sub;
    return this.walletService.requestWithdrawal(userId, dto.amount);
  }

  // FIX BUG 7: historique transactions seulement du user connecte
  @Get('transactions')
  async getTransactions(@Request() req: any) {
    const userId = req.user.sub;
    return this.walletService.getTransactionHistory(userId);
  }
}