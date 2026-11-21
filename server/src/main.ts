import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

function parseCorsOrigins(): string[] {
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, '')) // "https://x.app/" → "https://x.app"
    .filter(Boolean);
  // Render passes the front-end host name (without scheme) through render.yaml.
  const host = process.env.FRONTEND_HOST?.trim();
  if (host) origins.push(`https://${host}`);
  return [...new Set(origins)];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Behind Render's (or any) reverse proxy: use the visitor's real IP from X-Forwarded-For,
  // otherwise the login rate limit would count every visitor as the same address.
  if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.setGlobalPrefix('api');
  app.use(helmet());

  // Only the configured front-end origins may call the API.
  app.enableCors({
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
