import { IsOptional } from 'class-validator';
import { IsPersonName } from '../../common/validators/is-person-name.validator';

export class UpdateDirectorDto {
  @IsOptional()
  @IsPersonName()
  firstName?: string;

  @IsOptional()
  @IsPersonName()
  lastName?: string;
}
