import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
