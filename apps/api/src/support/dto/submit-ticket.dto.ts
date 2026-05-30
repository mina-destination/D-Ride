import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SubmitTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
