import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PARENT_RELATIONSHIPS, ParentRelationship } from '../../entities/link-request.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class DeclareChildDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le prénom de l’enfant est obligatoire.' })
  @MaxLength(80)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de l’enfant est obligatoire.' })
  @MaxLength(80)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  classId?: string;

  @IsIn(PARENT_RELATIONSHIPS, { message: 'Lien de parenté invalide.' })
  relationship: ParentRelationship;
}
