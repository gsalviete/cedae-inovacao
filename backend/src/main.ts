import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const frontendPath = join(__dirname, '..', '..', 'frontend');

  app.getHttpAdapter().get('/', (req: Request, res: Response) => {
    res.sendFile(join(frontendPath, 'templates', 'index.html'));
  });

  app.getHttpAdapter().get('/admin-panel', (req: Request, res: Response) => {
    res.sendFile(join(frontendPath, 'templates', 'admin.html'));
  });

  app.getHttpAdapter().get('/admin-detalhe', (req: Request, res: Response) => {
    res.sendFile(join(frontendPath, 'templates', 'admin-detalhe.html'));
  });

  const port = process.env.PORT || 8095;
  await app.listen(port);

  if (process.env.DEV_REMOTE_USER) {
    console.log(`[DEV] x-remote-user fallback ativo: ${process.env.DEV_REMOTE_USER}`);
  }
  console.log(`Aplicação rodando na porta ${port}`);
}
bootstrap();
