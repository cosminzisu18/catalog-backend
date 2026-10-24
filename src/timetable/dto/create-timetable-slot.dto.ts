import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTimetableSlotDto {
  @IsInt()
  @Min(1)
  classId: number;

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Ora de inceput trebuie sa fie in formatul HH:mm',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Ora de sfarsit trebuie sa fie in formatul HH:mm',
  })
  endTime: string;

  @IsInt()
  @Min(1)
  subjectId: number;

  // required when more than one teacher teaches this subject
  @IsOptional()
  @IsInt()
  @Min(1)
  teacherId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  room?: string;
}
