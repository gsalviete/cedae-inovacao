import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { IdentidadeService } from '../auth/identidade.service';
import { RegistrarTermosDto } from './dto/registrar-termos.dto';
import { TermosService } from './termos.service';

/**
 * Termos e Condições de Uso (ADR-014 §12-bis).
 *
 * Aplica-se ao usuário identificado pelo IIS que não possui perfil
 * administrativo. A identidade vem do header `x-remote-user`
 * (IdentidadeService). Aceite/recusa são auditados em duas camadas:
 * TERMOS_ACEITES (estado) + INOVACAO_LOGS (trilha geral).
 */
@Controller('api/termos')
export class TermosController {
  constructor(
    private readonly termos: TermosService,
    private readonly identidade: IdentidadeService,
    private readonly authService: AuthService,
  ) {}

  private loginOrThrow(req: Request): string {
    const login = this.identidade.readLogin(req);
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
  ): Promise<{ acao: string; versao: string }> {
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

    // Sem aceite não há uso (ADR-014 §12-bis.3). Não existe sessão para
    // encerrar: a identidade vem do IIS a cada requisição, então a recusa fica
    // registrada em TERMOS_ACEITES e os termos voltam a ser exigidos no
    // próximo acesso — o front devolve o usuário à página pública.
    return { acao: dto.acao, versao };
  }
}
