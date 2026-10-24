import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { GradeType } from '../../common/enums/grade-type.enum';

export class CreateGradeDto {
  @IsInt()
  @Min(1)
  studentId: number;

  @IsInt()
  @Min(1)
  subjectId: number;

  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Nota trebuie sa fie un numar cu cel mult doua zecimale' },
  )
  @Min(1, { message: 'Nota minima este 1' })
  @Max(10, { message: 'Nota maxima este 10' })
  value: number;

  @IsOptional()
  @IsEnum(GradeType, { message: 'Tipul notei nu este valid' })
  type?: GradeType;

  // dd-mm-yyyy, like in the paper register
  @IsString()
  @Matches(/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/, {
    message: 'Data notei trebuie sa fie in formatul zz-ll-aaaa',
  })
  gradedOn: string;
}
