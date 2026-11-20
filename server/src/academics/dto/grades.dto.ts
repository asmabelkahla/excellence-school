import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SheetRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  studentId: string;

  /** componentId ('' for a subject without components) → score, or null to erase. */
  @IsObject()
  scores: Record<string, number | null>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class SaveSheetDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3], { message: 'Trimestre invalide.' })
  trimester: 1 | 2 | 3;

  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => SheetRowDto)
  rows: SheetRowDto[];
}
