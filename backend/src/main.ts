import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as morgan from 'morgan';

const projectPath = process.env.PROJECT_PATH?.trim();
const remoteUser = process.env.DEV_REMOTE_USER;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Permite que o Nest finalize corretamente ao receber SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Access log para stdout (docker/podman logs)
  app.use(morgan('combined'));

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Prefixo das rotas da API
  if (projectPath) {
    app.setGlobalPrefix(projectPath);
  }

  const frontendPath = join(__dirname, '..', '..', 'frontend');
  const basePath = projectPath ? `/${projectPath}` : '';

  // Frontend
  app.getHttpAdapter().get(`${basePath}/`, (_, res) => {
    res.sendFile(join(frontendPath, 'templates', 'index.html'));
  });

  app.getHttpAdapter().get(`${basePath}/admin-panel`, (_, res) => {
    res.sendFile(join(frontendPath, 'templates', 'admin.html'));
  });

  app.getHttpAdapter().get(`${basePath}/admin-detalhe`, (_, res) => {
    res.sendFile(join(frontendPath, 'templates', 'admin-detalhe.html'));
  });

  const port = Number(process.env.PORT) || 8095;

  await app.listen(port);

  if (remoteUser) {
    console.log(`[DEV] x-remote-user fallback ativo: ${remoteUser}`);
  }

  console.log(
    `Aplicação rodando na porta ${port}}`,
  );
}

void bootstrap();