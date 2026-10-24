import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTimetableSlotDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  classId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Ora de inceput trebuie sa fie in formatul HH:mm',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Ora de sfarsit trebuie sa fie in formatul HH:mm',
  })
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  teacherId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  room?: string | null;
}
