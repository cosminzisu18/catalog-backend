import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MotivateAbsenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
