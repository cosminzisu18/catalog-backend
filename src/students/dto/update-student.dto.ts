import {
  IsEmail,
  IsInt,
  IsOptional,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsPersonName } from '../../common/validators/is-person-name.validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class UpdateStudentDto {
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

  @IsOptional()
  @IsInt()
  @Min(1)
  classId?: number;

  @IsOptional()
  @Matches(/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/, {
    message: 'Data nasterii trebuie sa fie in formatul zz-ll-aaaa',
  })
  birthDate?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsStrongPassword()
  temporaryPassword?: string;
}
