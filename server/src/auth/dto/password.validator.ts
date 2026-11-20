import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** At least 8 characters, one letter and one digit. */
export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' }),
    MaxLength(128),
    Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
      message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
    }),
  );
}
