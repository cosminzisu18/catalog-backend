import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class RegisterSchoolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  schoolName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug-ul poate contine doar litere mici, cifre si cratime',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsEmail()
  @MaxLength(180)
  directorEmail: string;

  @IsStrongPassword()
  password: string;
}
