import { IsString, IsNotEmpty } from 'class-validator';

export class AddCrmNoteDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  adminName: string;
}
