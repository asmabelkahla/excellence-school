import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from './password.validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire.' })
  @MaxLength(128)
  currentPassword: string;

  @IsStrongPassword()
  @MaxLength(128)
  newPassword: string;
}
