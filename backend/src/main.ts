import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as morgan from 'morgan';
import * as express from 'express';

const projectPath = process.env.PROJECT_PATH?.trim();
const remoteUser = process.env.DEV_REMOTE_USER;

// Renderiza o HTML uma única vez no boot, substituindo {{BASE_PATH}} pelo
// prefixo real (ex.: "/inovacao" ou ""). Todos os hrefs/srcs do template já
// saem com o prefixo embutido — nada no cliente precisa descobrir o
// PROJECT_PATH em runtime, então nenhum recurso depende de o reverse proxy
// encaminhar paths fora do prefixo configurado.
function renderTemplate(filePath: string, basePath: string): string {
  return readFileSync(filePath, 'utf-8').split('{{BASE_PATH}}').join(basePath);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Sem isso, app.close() (disparado por enableShutdownHooks no SIGTERM)
    // espera indefinidamente conexões keep-alive existentes fecharem
    // sozinhas — é o que fazia o container precisar de SIGKILL.
    forceCloseConnections: true,
  });

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
  const httpAdapter = app.getHttpAdapter().getInstance();

  // ---- DEBUG TEMPORÁRIO: investigação do serving de static assets ----
  const staticDir = join(frontendPath, 'static');
  console.log('[DEBUG] frontendPath:', frontendPath);
  console.log('[DEBUG] frontendPath/static:', staticDir);
  console.log('[DEBUG] staticDir existe?', existsSync(staticDir));
  console.log('[DEBUG] style.css existe?', existsSync(join(staticDir, 'style.css')));
  console.log('[DEBUG] api.js existe?', existsSync(join(staticDir, 'api.js')));

  app.use((req: any, res: any, next: any) => {
    console.log('[REQ]', req.method, req.url);
    next();
  });
  // ---- FIM DEBUG TEMPORÁRIO ----

  // Único mecanismo de static assets, sempre sob o mesmo prefixo usado
  // pelas páginas e pela API — funciona igual com PROJECT_PATH vazio
  // (basePath === '') ou definido, e nunca depende do proxy encaminhar
  // paths fora desse prefixo.
  // app.useStaticAssets(join(frontendPath, 'static'), { prefix: `${basePath}/static` });

  // ---- DEBUG TEMPORÁRIO: substituindo useStaticAssets por express.static ----
  app.use(`${basePath}/static`, express.static(staticDir));
  // ---- FIM DEBUG TEMPORÁRIO ----

  // ---- DEBUG TEMPORÁRIO: error handler para capturar exceções no serving ----
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[STATIC ERROR]', err);
    next(err);
  });
  // ---- FIM DEBUG TEMPORÁRIO ----

  // Frontend — cada página é renderizada uma vez no boot com o BASE_PATH
  // já embutido nos hrefs/srcs e em window.__BASE_PATH__.
  const pages: Record<string, string> = {
    '/': 'index.html',
    '/admin-panel': 'admin.html',
    '/admin-detalhe': 'admin-detalhe.html',
  };

  for (const [route, file] of Object.entries(pages)) {
    const rendered = renderTemplate(join(frontendPath, 'templates', file), basePath);
    httpAdapter.get(`${basePath}${route}`, (_, res) => {
      res.type('html').send(rendered);
    });
  }

  const port = Number(process.env.PORT) || 8095;

  httpAdapter.get('/teste-css', (_, res) => {
    res.sendFile(join(frontendPath, 'static', 'css', 'style.css'));
  });

  await app.listen(port);

  if (remoteUser) {
    console.log(`[DEV] x-remote-user fallback ativo: ${remoteUser}`);
  }

  console.log(`Aplicação rodando na porta ${port}`);
}

void bootstrap();
