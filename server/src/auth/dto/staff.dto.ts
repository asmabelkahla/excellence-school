import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { STAFF_ROLES, StaffRole } from '../../entities/user.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PHONE = /^[+0-9 ().-]{6,30}$/;

export class CreateStaffDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  @MaxLength(120)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(160)
  email: string;

  // Empty string = no phone number.
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @Transform(trim)
  @Matches(PHONE, { message: 'Numéro de téléphone invalide.' })
  phone?: string;

  @IsIn(STAFF_ROLES, { message: 'Rôle invalide.' })
  role: StaffRole;
}

export class UpdateStaffDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet ne peut pas être vide.' })
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(160)
  email?: string;

  // Empty string = no phone number.
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @Transform(trim)
  @Matches(PHONE, { message: 'Numéro de téléphone invalide.' })
  phone?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES, { message: 'Rôle invalide.' })
  role?: StaffRole;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
