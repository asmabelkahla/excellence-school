import { IsIn, IsOptional, IsString, MaxLength, ValidateIf, IsNotEmpty } from 'class-validator';

export class ReviewLinkRequestDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  /** Existing student the admin matched the declared child to (required on approval). */
  @ValidateIf(o => o.decision === 'approved')
  @IsString()
  @IsNotEmpty()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
