import { IsNumber, Min, IsOptional, IsString, IsEnum } from 'class-validator';

export class WalletTopupDto {
  @IsNumber()
  @Min(10, { message: 'Minimum topup amount is 10 EGP' })
  amountEGP: number;

  @IsOptional()
  @IsEnum(['CARD', 'WALLET'])
  paymentMethod?: 'CARD' | 'WALLET';

  @IsOptional()
  @IsString()
  walletNumber?: string;
}
