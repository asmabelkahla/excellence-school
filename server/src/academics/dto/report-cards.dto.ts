import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ClassTrimesterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  classId: string;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3], { message: 'Trimestre invalide.' })
  trimester: 1 | 2 | 3;
}

export class UpdateReportCardDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(600)
  behaviorRemarks?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  mention?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(600)
  headmasterRemarks?: string;
}
