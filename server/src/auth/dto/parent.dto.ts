import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PARENT_RELATIONSHIPS, ParentRelationship } from '../../entities/link-request.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PHONE = /^[+0-9 ().-]{6,30}$/;

export class ChildLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Choisissez un élève.' })
  @MaxLength(64)
  studentId: string;

  @IsIn(PARENT_RELATIONSHIPS, { message: 'Lien de parenté invalide.' })
  relationship: ParentRelationship;
}

export class CreateParentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  @MaxLength(120)
  fullName: string;

  @Transform(lower)
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(160)
  email: string;

  // Empty string = no phone number.
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @Transform(trim)
  @Matches(PHONE, { message: 'Numéro de téléphone invalide.' })
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChildLinkDto)
  children?: ChildLinkDto[];
}

export class UpdateParentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet ne peut pas être vide.' })
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(lower)
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(160)
  email?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @Transform(trim)
  @Matches(PHONE, { message: 'Numéro de téléphone invalide.' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
