import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LogHoursDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(12)
  hours: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
