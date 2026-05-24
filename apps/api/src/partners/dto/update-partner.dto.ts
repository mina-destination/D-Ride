import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdatePartnerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
