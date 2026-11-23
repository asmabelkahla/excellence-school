import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewLinkRequestDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  /**
   * Existing student the declared child is matched to. When omitted on approval,
   * the student is created from the declared names, in `classId` (or the declared class).
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  studentId?: string;

  /** Class for a student created at approval (defaults to the class the parent declared). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  classId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
