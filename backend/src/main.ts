import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { BullBoardService } from './queue/bull-board.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  // Add body parser only for non-admin routes (AdminJS uses express-formidable)
  const jsonParser = express.json();
  const urlencodedParser = express.urlencoded({ extended: true });
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/admin')) {
      return next();
    }
    jsonParser(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/admin')) {
      return next();
    }
    urlencodedParser(req, res, next);
  });

  // Bull Board UI for queues
  const bullBoard = app.get(BullBoardService);
  app.use('/admin/queues', bullBoard.getRouter());

  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api', {
    exclude: ['/', '/admin/{*path}'],
  });
  const port = parseInt(process.env.PORT || '4000', 10);
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`[Server] Running on port ${port} (${process.env.NODE_ENV})`);
  console.log(`[Bull Board] Available at http://localhost:${port}/admin/queues`);
}

bootstrap();
