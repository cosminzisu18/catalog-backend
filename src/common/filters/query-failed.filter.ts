import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const KNOWN_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  ER_DUP_ENTRY: {
    status: HttpStatus.CONFLICT,
    message: 'Inregistrarea exista deja',
  },
  ER_NO_REFERENCED_ROW_2: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Inregistrarea referita nu exista',
  },
  ER_ROW_IS_REFERENCED_2: {
    status: HttpStatus.CONFLICT,
    message: 'Inregistrarea este folosita in alte date',
  },
};

// without this filter a unique key error would reach the client as a 500
@Catch(QueryFailedError)
export class QueryFailedFilter implements ExceptionFilter {
  private readonly logger = new Logger(QueryFailedFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const code = (exception.driverError as { code?: string } | undefined)?.code;
    const known = code ? KNOWN_ERRORS[code] : undefined;

    if (!known) {
      this.logger.error(exception.message, exception.stack);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Eroare interna',
      });
      return;
    }

    response.status(known.status).json({
      statusCode: known.status,
      message: known.message,
    });
  }
}
