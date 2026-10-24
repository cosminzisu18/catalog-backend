import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { QueryFailedFilter } from './common/filters/query-failed.filter';
import { originCheck } from './common/middleware/origin-check.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendOrigin = config.getOrThrow<string>('CORS_ORIGIN');

  app.use(helmet());
  app.use(cookieParser());
  app.use(originCheck(frontendOrigin));
  app.setGlobalPrefix('api');

  // credentials: the browser sends session cookies only to the
  // frontend origin set here
  app.enableCors({ origin: frontendOrigin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // so "9" is not accepted as a number; query DTOs use @Type instead
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new QueryFailedFilter());
  app.enableShutdownHooks();

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port);
  Logger.log(`API pornit pe http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
