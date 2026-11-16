import {
  ArgumentsHost,
  Catch,
  HttpException,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(
          typeof body === 'string'
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : 'internal';
    // Only the error category is logged; never SQL, credentials or request bodies.
    this.logger.error(`Request failed (${code})`);
    const status =
      code === '23505' ? 409 : code === '23503' || code === '23514' ? 400 : 500;
    response.status(status).json({
      statusCode: status,
      message:
        status === 409
          ? 'This record already exists'
          : status === 400
            ? 'The supplied configuration is invalid'
            : 'Unable to complete the request. Please try again.',
    });
  }
}
