import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { MESSAGE_CATEGORIES, MessageCategory } from './entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PostMessageDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le message est vide.' })
  @MaxLength(2000, { message: 'Le message dépasse 2000 caractères.' })
  body: string;

  /** 'note' is reserved to teachers. */
  @IsOptional()
  @IsIn(['message', 'note'])
  kind?: 'message' | 'note';

  @ValidateIf(o => o.kind === 'note')
  @IsIn(MESSAGE_CATEGORIES, { message: 'Catégorie de note invalide.' })
  category?: MessageCategory;
}

export class StartConversationDto extends PostMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  studentId: string;

  /** Required for a parent (which teacher to write to); ignored for a teacher (always themself). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  teacherId?: string;
}
