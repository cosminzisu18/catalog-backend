import { IsEmail, MaxLength } from 'class-validator';
import { IsPersonName } from '../../common/validators/is-person-name.validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class CreateTeacherDto {
  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsPersonName()
  firstName: string;

  @IsPersonName()
  lastName: string;

  @IsStrongPassword()
  temporaryPassword: string;
}
