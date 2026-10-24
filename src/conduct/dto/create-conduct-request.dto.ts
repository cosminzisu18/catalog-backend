import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateConductRequestDto {
  @IsInt()
  @Min(1)
  studentId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10)
  proposedGrade: number;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  teacherReason: string;
}
