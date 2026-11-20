import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateHomeworkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  classSubjectId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le titre est obligatoire.' })
  @MaxLength(150)
  title: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsDateString({ strict: true }, { message: 'Date de remise invalide.' })
  dueDate: string;
}

export class UpdateHomeworkDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le titre ne peut pas être vide.' })
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Date de remise invalide.' })
  dueDate?: string;
}

export class HomeworkDoneDto {
  @IsBoolean()
  done: boolean;
}
