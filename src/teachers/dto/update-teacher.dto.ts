import { IsEmail, IsOptional, MaxLength, ValidateIf } from 'class-validator';
import { IsPersonName } from '../../common/validators/is-person-name.validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class UpdateTeacherDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsPersonName()
  firstName?: string;

  @IsOptional()
  @IsPersonName()
  lastName?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsStrongPassword()
  temporaryPassword?: string;
}
