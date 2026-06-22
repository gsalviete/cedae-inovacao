import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilita CORS
  app.enableCors();

  // Validação global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Mapeia rotas específicas do frontend para os arquivos HTML (substituindo Jinja2)
  const frontendPath = join(__dirname, '..', '..', 'frontend');
  
  app.getHttpAdapter().get('/', (req: Request, res: Response) => {
    res.sendFile(join(frontendPath, 'templates', 'index.html'));
  });

  app.getHttpAdapter().get('/admin-panel', (req: Request, res: Response) => {
    res.sendFile(join(frontendPath, 'templates', 'admin.html'));
  });

  const port = process.env.PORT || 8095;
  await app.listen(port);
  console.log(`Aplicação rodando na porta ${port}`);
}
bootstrap();
