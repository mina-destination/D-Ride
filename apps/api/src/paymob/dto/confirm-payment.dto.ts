import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  ArrayMinSize,
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMinSize(1)
  linkedBookingIds?: string[];
}
