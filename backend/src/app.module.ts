import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { IniciativasModule } from './iniciativas/iniciativas.module';
import { AdminModule } from './admin/admin.module';
import { WorkflowModule } from './workflow/workflow.module';

const projectPath = process.env.PROJECT_PATH?.trim();
// Exclui as rotas de API do fallback estático (que serve index.html para
// qualquer GET não encontrado) — precisa refletir o mesmo prefixo aplicado
// via setGlobalPrefix em main.ts, senão requisições de API sem match caem
// no fallback e retornam index.html (200) em vez de 404.
const apiExcludePath = projectPath ? `/${projectPath}/api/(.*)` : '/api/(.*)';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000,
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    }]),
    DatabaseModule,
    WorkflowModule,
    IniciativasModule,
    AdminModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend'),
      serveRoot: '/',
      exclude: [apiExcludePath],
    }),
  ],
})
export class AppModule {}
