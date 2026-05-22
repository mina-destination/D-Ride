import { IsString, IsNotEmpty } from 'class-validator';

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  adminName: string;
}
