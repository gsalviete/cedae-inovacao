import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LdapAuthError, LdapService, LdapUnavailableError } from './ldap/ldap.service';
import { normalizeLogin } from './normalize-login';
import { SessionService } from './session.service';

interface LoginResponse {
  login: string;
  nome: string | null;
  email: string | null;
  grupos: string[];
  role: RequestUser['role'];
  admin: boolean;
}

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly ldap: LdapService,
    private readonly authService: AuthService,
    private readonly session: SessionService,
  ) {}

  /**
   * Autentica no Active Directory e, em caso de sucesso, abre a sessão da
   * aplicação. Toda a autorização (ADMIN_USERS, roles) permanece na lógica
   * existente — aqui apenas identificamos o usuário via AD em vez do header.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const ldapUser = await this.bindOrThrow(dto);

    // Gate opcional por grupo — só se LDAP_GROUP estiver configurado.
    const requiredGroup = (process.env.LDAP_GROUP ?? '').trim();
    if (requiredGroup && !this.ldap.isMemberOf(ldapUser, requiredGroup)) {
      this.logger.warn(`Acesso negado a "${ldapUser.username}": fora do grupo "${requiredGroup}".`);
      throw new ForbiddenException('Usuário sem permissão de acesso ao sistema.');
    }

    // Mesma normalização usada pelo resto do sistema — mantém ADMIN_USERS intacto.
    const login = normalizeLogin(ldapUser.username);
    const appUser = await this.authService.resolveUser(login);

    this.session.issue(res, login, ldapUser.displayName || appUser.nome || undefined);
    this.authService
      .registrarLog(login, 'login', ldapUser.displayName || null)
      .catch(() => {});

    return {
      login,
      nome: ldapUser.displayName || appUser.nome,
      email: ldapUser.email || null,
      grupos: ldapUser.groups,
      role: appUser.role,
      admin: appUser.admin,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    this.session.clear(res);
    return { message: 'Sessão encerrada.' };
  }

  private async bindOrThrow(dto: LoginDto) {
    try {
      return await this.ldap.authenticate(dto.username, dto.password);
    } catch (err) {
      if (err instanceof LdapAuthError) {
        throw new UnauthorizedException('Usuário ou senha inválidos.');
      }
      if (err instanceof LdapUnavailableError) {
        // 503: problema de infraestrutura, não credencial. Detalhe fica no log do serviço.
        throw new ServiceUnavailableException(
          'Não foi possível validar suas credenciais no momento. Tente novamente.',
        );
      }
      this.logger.error(`Erro inesperado no login: ${err instanceof Error ? err.message : err}`);
      throw new UnauthorizedException('Falha na autenticação.');
    }
  }
}
