import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PARENT_RELATIONSHIPS, ParentRelationship } from '../../entities/link-request.entity';
import { ParentChildDto } from './register-parent.dto';

/** The ID token ("credential") returned by Google's sign-in button. */
export class GoogleCredentialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  credential: string;
}

/** Second step for a new parent: what Google does not provide. */
export class GoogleRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  registrationToken: string;

  @IsString()
  @IsNotEmpty({ message: 'Le téléphone est obligatoire.' })
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsIn(PARENT_RELATIONSHIPS)
  relationship?: ParentRelationship;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ParentChildDto)
  children?: ParentChildDto[];
}
