import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class DecideGradeEditRequestDto {
  @IsBoolean()
  approve: boolean;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  directorReason: string;
}
