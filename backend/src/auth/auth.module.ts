import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminGuard } from './admin.guard';
import { IdentidadeService } from './identidade.service';
import { MeController } from './me.controller';

/**
 * Identidade e autorização.
 *
 * Não há login nem sessão: o IIS autentica no AD (Kerberos) e injeta
 * `x-remote-user`. Este módulo só resolve quem é o requisitante
 * (IdentidadeService) e o que ele pode fazer (AuthService/ADMIN_USERS).
 */
@Module({
  controllers: [MeController],
  providers: [AuthService, AdminGuard, IdentidadeService],
  exports: [AuthService, AdminGuard, IdentidadeService],
})
export class AuthModule {}
