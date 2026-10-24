import {
  IsEmail,
  IsInt,
  IsOptional,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { IsPersonName } from '../../common/validators/is-person-name.validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class CreateStudentDto {
  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsPersonName()
  firstName: string;

  @IsPersonName()
  lastName: string;

  @IsInt()
  @Min(1)
  classId: number;

  @IsOptional()
  @Matches(/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/, {
    message: 'Data nasterii trebuie sa fie in formatul zz-ll-aaaa',
  })
  birthDate?: string;

  @IsStrongPassword()
  temporaryPassword: string;
}
