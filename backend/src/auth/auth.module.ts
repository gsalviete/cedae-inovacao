import { randomBytes } from 'crypto';
import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard } from './admin.guard';
import { LdapModule } from './ldap/ldap.module';
import { MeController } from './me.controller';
import { SessionService } from './session.service';

/**
 * Segredo de assinatura do JWT de sessão. Em produção defina SESSION_SECRET;
 * na ausência, gera um segredo efêmero (as sessões caem a cada restart).
 */
function resolveSessionSecret(): string {
  const secret = (process.env.SESSION_SECRET ?? '').trim();
  if (secret) return secret;
  new Logger('AuthModule').warn(
    'SESSION_SECRET não definido — usando segredo efêmero. Sessões expiram a cada reinício.',
  );
  return randomBytes(48).toString('hex');
}

@Module({
  imports: [
    LdapModule,
    JwtModule.register({
      secret: resolveSessionSecret(),
    }),
  ],
  controllers: [MeController, AuthController],
  providers: [AuthService, AdminGuard, SessionService],
  exports: [AuthService, AdminGuard, SessionService],
})
export class AuthModule {}
