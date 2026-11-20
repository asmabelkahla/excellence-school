import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateClassDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la classe est obligatoire.' })
  @MaxLength(40)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Le niveau est obligatoire.' })
  @MaxLength(64)
  levelId: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ArrayUnique()
  @IsString({ each: true })
  teacherIds?: string[];
}

export class UpdateClassDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la classe ne peut pas être vide.' })
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  levelId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ArrayUnique()
  @IsString({ each: true })
  teacherIds?: string[];
}
