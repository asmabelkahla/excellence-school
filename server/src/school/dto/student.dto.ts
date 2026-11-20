import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const GENDERS = ['F', 'M'] as const;

export class CreateStudentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MaxLength(80)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(80)
  lastName: string;

  @IsIn(GENDERS, { message: 'Genre invalide.' })
  gender: (typeof GENDERS)[number];

  @IsString()
  @IsNotEmpty({ message: 'La classe est obligatoire.' })
  @MaxLength(64)
  classId: string;

  /** Arabic spelling, shown on the bulletin. Empty string clears it. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  firstNameAr?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  lastNameAr?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le prénom ne peut pas être vide.' })
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide.' })
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsIn(GENDERS, { message: 'Genre invalide.' })
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  classId?: string;

  /** Arabic spelling, shown on the bulletin. Empty string clears it. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  firstNameAr?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  lastNameAr?: string;
}
