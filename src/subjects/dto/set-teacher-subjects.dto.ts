import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class SetTeacherSubjectsDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  subjectIds: number[];
}
