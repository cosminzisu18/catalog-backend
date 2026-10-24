import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGradeEditRequestDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10)
  proposedValue: number;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  teacherReason: string;
}
