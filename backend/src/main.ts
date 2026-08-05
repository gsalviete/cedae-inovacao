import './env';
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

  const templatesPath = join(frontendPath, 'templates');

  // Páginas públicas — renderizadas uma vez no boot com o BASE_PATH embutido.
  const simplePages: Record<string, string> = {
    '/': 'index.html',
    '/login': 'login.html',
  };
  for (const [route, file] of Object.entries(simplePages)) {
    const rendered = renderTemplate(join(templatesPath, file), basePath);
    httpAdapter.get(`${basePath}${route}`, (_, res) => {
      res.type('html').send(rendered);
    });
  }

  // ── Painel administrativo — cada módulo é uma página própria ──────────
  // O shell (sidebar + topbar) fica num layout único; cada rota injeta apenas
  // seu conteúdo e metadados (título, subtítulo, breadcrumb, script). Assim a
  // navegação deixa de ser por âncoras e passa a ter uma URL por módulo.
  const adminLayout = readFileSync(join(templatesPath, 'admin', '_layout.html'), 'utf-8');

  interface AdminMeta {
    active: string;
    title: string;
    subtitle?: string;
    breadcrumb?: string;
    script: string;
  }

  function renderAdmin(contentFile: string, meta: AdminMeta): string {
    const content = readFileSync(join(templatesPath, 'admin', contentFile), 'utf-8');
    const composed = adminLayout
      .split('{{CONTENT}}').join(content)
      .split('{{NAV_ACTIVE}}').join(meta.active)
      .split('{{PAGE_TITLE}}').join(meta.title)
      .split('{{PAGE_SUBTITLE}}').join(meta.subtitle ?? '')
      .split('{{BREADCRUMB}}').join(meta.breadcrumb ?? '')
      .split('{{PAGE_SCRIPT}}').join(meta.script);
    return composed.split('{{BASE_PATH}}').join(basePath);
  }

  const crumb = (...parts: string[]): string =>
    parts.join(' <span class="crumb-sep">/</span> ');
  const crumbLink = (label: string, route: string): string =>
    `<a href="{{BASE_PATH}}${route}">${label}</a>`;

  const adminPages: Array<{ route: string; content: string; meta: AdminMeta }> = [
    {
      route: '/admin/dashboard', content: 'dashboard.html',
      meta: { active: 'dashboard', title: 'Dashboard',
        subtitle: 'Acompanhe a esteira da inovação, da ideação à escala, em tempo real.',
        breadcrumb: crumb('Painel'), script: 'page-dashboard.js' },
    },
    {
      route: '/admin/iniciativas', content: 'iniciativas.html',
      meta: { active: 'iniciativas', title: 'Iniciativas',
        subtitle: 'Toda a base consolidada — busque, filtre e abra os detalhes.',
        breadcrumb: crumb('Painel', 'Iniciativas'), script: 'page-iniciativas.js' },
    },
    {
      route: '/admin/iniciativa', content: 'iniciativa.html',
      meta: { active: 'iniciativas', title: 'Detalhes da Iniciativa',
        subtitle: '',
        breadcrumb: crumb(crumbLink('Painel', '/admin/dashboard'), crumbLink('Iniciativas', '/admin/iniciativas'), 'Detalhe'),
        script: 'detalhe.js' },
    },
    {
      route: '/admin/usuarios', content: 'usuarios.html',
      meta: { active: 'usuarios', title: 'Usuários administrativos',
        subtitle: 'Usuários habilitados no painel administrativo.',
        breadcrumb: crumb('Painel', 'Usuários'), script: 'page-usuarios.js' },
    },
    {
      route: '/admin/canais', content: 'canais.html',
      meta: { active: 'canais', title: 'Canais de captação',
        subtitle: 'Ative ou desative as vias de entrada de iniciativas.',
        breadcrumb: crumb('Painel', 'Canais'), script: 'page-canais.js' },
    },
    {
      route: '/admin/logs', content: 'logs.html',
      meta: { active: 'logs', title: 'Log de sistema',
        subtitle: 'Auditoria das ações administrativas.',
        breadcrumb: crumb('Painel', 'Logs'), script: 'page-logs.js' },
    },
    {
      route: '/admin/registrar', content: 'registrar.html',
      meta: { active: 'registrar', title: 'Registrar iniciativa',
        subtitle: 'Cadastre manualmente uma iniciativa captada fora do formulário público.',
        breadcrumb: crumb('Painel', 'Registrar'), script: 'captacao.js' },
    },
  ];

  for (const page of adminPages) {
    const rendered = renderAdmin(page.content, page.meta);
    httpAdapter.get(`${basePath}${page.route}`, (_, res) => {
      res.type('html').send(rendered);
    });
  }

  // Compatibilidade com as rotas anteriores (preserva a query string).
  const legacyRedirects: Record<string, string> = {
    '/admin': '/admin/dashboard',
    '/admin-panel': '/admin/dashboard',
    '/admin-captacao': '/admin/registrar',
    '/admin-detalhe': '/admin/iniciativa',
  };
  for (const [from, to] of Object.entries(legacyRedirects)) {
    httpAdapter.get(`${basePath}${from}`, (req: any, res: any) => {
      const q = req.url.indexOf('?');
      const qs = q >= 0 ? req.url.slice(q) : '';
      res.redirect(`${basePath}${to}${qs}`);
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
