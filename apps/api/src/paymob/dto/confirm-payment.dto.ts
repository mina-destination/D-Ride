import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsBoolean()
  @IsNotEmpty()
  success: boolean;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  transactionId?: string;
}
