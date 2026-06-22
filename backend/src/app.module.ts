import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { IniciativasModule } from './iniciativas/iniciativas.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    IniciativasModule,
    AdminModule,
    ServeStaticModule.forRoot({
      // O diretório frontend ficará na raiz da aplicação no container Docker
      rootPath: join(__dirname, '..', '..', 'frontend'),
      serveRoot: '/',
      exclude: ['/api/(.*)'], // Não tenta servir arquivos estáticos nas rotas de API
    }),
  ],
})
export class AppModule {}
