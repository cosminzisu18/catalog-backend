import { IsString, Length } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class ResetPasswordDto {
  @IsString()
  @Length(32, 128)
  token: string;

  @IsStrongPassword()
  newPassword: string;
}
