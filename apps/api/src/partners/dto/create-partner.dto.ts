import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  logoUrl: string;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
