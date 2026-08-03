import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { RegistrarTermosDto } from './dto/registrar-termos.dto';
import { TermosService } from './termos.service';

/**
 * Termos e Condições de Uso (ADR-014 §12-bis).
 *
 * Aplica-se ao usuário autenticado no AD que não possui perfil administrativo.
 * A identidade vem da sessão (SessionService). Aceite/recusa são auditados em
 * duas camadas: TERMOS_ACEITES (estado) + INOVACAO_LOGS (trilha geral).
 */
@Controller('api/termos')
export class TermosController {
  constructor(
    private readonly termos: TermosService,
    private readonly session: SessionService,
    private readonly authService: AuthService,
  ) {}

  private loginOrThrow(req: Request): string {
    const login = this.session.readLogin(req);
    if (!login) throw new UnauthorizedException('Usuário não autenticado.');
    return login;
  }

  /** IP de origem (respeita x-forwarded-for atrás do IIS). */
  private extrairIp(req: Request): string | null {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
    return req.ip || req.socket?.remoteAddress || null;
  }

  @Get('status')
  async status(@Req() req: Request): Promise<{ aceito: boolean; versaoAtual: string }> {
    const login = this.loginOrThrow(req);
    return this.termos.status(login);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async registrar(
    @Body() dto: RegistrarTermosDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ acao: string; versao: string; sessaoEncerrada: boolean }> {
    const login = this.loginOrThrow(req);
    const ip = this.extrairIp(req);
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;

    const { versao } = await this.termos.registrar(login, dto.acao, ip, userAgent);

    // Auditoria — segunda camada (INOVACAO_LOGS). Best-effort.
    this.authService
      .registrarLog(
        login,
        dto.acao === 'ACEITE' ? 'termos_aceite' : 'termos_recusa',
        `versao=${versao}; ip=${ip ?? 'não disponível'}`,
      )
      .catch(() => {});

    // Recusa encerra a sessão (ADR-014 §12-bis.3): sem aceite não há uso.
    let sessaoEncerrada = false;
    if (dto.acao === 'RECUSA') {
      this.session.clear(res);
      sessaoEncerrada = true;
    }

    return { acao: dto.acao, versao, sessaoEncerrada };
  }
}
