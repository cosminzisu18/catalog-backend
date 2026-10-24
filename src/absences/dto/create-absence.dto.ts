import { IsInt, Min } from 'class-validator';

// the absence is always for today's lesson, so there is no date field
export class CreateAbsenceDto {
  @IsInt()
  @Min(1)
  studentId: number;

  @IsInt()
  @Min(1)
  subjectId: number;
}
