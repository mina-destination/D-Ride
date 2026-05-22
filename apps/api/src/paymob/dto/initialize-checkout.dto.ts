import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';

export class InitializeCheckoutDto {
  @IsMongoId()
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
  paymentMethod?: 'CARD' | 'WALLET' | 'CASH';

  @IsString()
  @IsOptional()
  walletNumber?: string;
}
