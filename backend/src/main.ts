import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { readFileSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as morgan from 'morgan';
import * as cookieParser from 'cookie-parser';

const projectPath = process.env.PROJECT_PATH?.trim();
const basePath = projectPath ? `/${projectPath}` : '';
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

  // Necessário para ler o cookie de sessão (inovacao_session) — ver SessionService.
  app.use(cookieParser());

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Normaliza a URL de entrada para sempre incluir o basePath internamente,
  // independente de o IIS repassar o path completo (/inovacao/...) ou já
  // remover o prefixo antes de encaminhar pro container — não há garantia
  // de qual dos dois comportamentos o proxy de produção usa, então a app
  // funciona nos dois casos sem precisar acertar essa configuração de antemão.
  if (basePath) {
    app.use((req: any, _res: any, next: any) => {
      if (!req.url.startsWith(basePath)) {
        req.url = `${basePath}${req.url}`;
      }
      next();
    });
  }

  // Prefixo das rotas da API
  if (projectPath) {
    app.setGlobalPrefix(projectPath);
  }

  const frontendPath = join(__dirname, '..', '..', 'frontend');
  const httpAdapter = app.getHttpAdapter().getInstance();
  const staticDir = join(frontendPath, 'static');

  // Único mecanismo de static assets, sempre sob o mesmo prefixo usado
  // pelas páginas e pela API — funciona igual com PROJECT_PATH vazio
  // (basePath === '') ou definido, e nunca depende do proxy encaminhar
  // paths fora desse prefixo.
  app.useStaticAssets(staticDir, { prefix: `${basePath}/static` });

  // Frontend — cada página é renderizada uma vez no boot com o BASE_PATH
  // já embutido nos hrefs/srcs e em window.__BASE_PATH__.
  const pages: Record<string, string> = {
    '/': 'index.html',
    '/login': 'login.html',
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

  await app.listen(port);

  if (remoteUser) {
    console.log(`[DEV] x-remote-user fallback ativo: ${remoteUser}`);
  }

  console.log(`Aplicação rodando na porta ${port}`);
}

void bootstrap();
