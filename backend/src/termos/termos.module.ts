import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TermosController } from './termos.controller';
import { TermosService } from './termos.service';

/**
 * Módulo dos Termos e Condições de Uso (ADR-014 §12-bis).
 * Reutiliza IdentidadeService/AuthService do AuthModule para identidade e auditoria.
 */
@Module({
  imports: [AuthModule],
  controllers: [TermosController],
  providers: [TermosService],
})
export class TermosModule {}
