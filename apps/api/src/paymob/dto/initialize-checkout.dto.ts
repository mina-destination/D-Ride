import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';

export class InitializeCheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @IsNumber()
  @Min(1)
  amountCents: number;

  @IsObject()
  @IsOptional()
  billingData?: any;

  @IsString()
  @IsOptional()
  paymentMethod?: 'CARD' | 'WALLET';

  @IsString()
  @IsOptional()
  walletNumber?: string;
}
