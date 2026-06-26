import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error(
      'FATAL: JWT_SECRET não definido ou tem menos de 32 caracteres.\n' +
        'Gere um valor com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
    process.exit(1);
  }

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

  app.getHttpAdapter().get('/admin-detalhe', (req: Request, res: Response) => {
    res.sendFile(join(frontendPath, 'templates', 'admin-detalhe.html'));
  });

  const port = process.env.PORT || 8095;
  await app.listen(port);
  console.log(`Aplicação rodando na porta ${port}`);
}
bootstrap();
