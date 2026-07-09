import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Request, Response } from 'express';
import { normalizeLogin } from './normalize-login';

/** Nome do cookie de sessão emitido após autenticação no AD. */
export const SESSION_COOKIE = 'inovacao_session';

/** Validade da sessão (segundos). Ajustável via SESSION_TTL. */
const DEFAULT_TTL_SECONDS = 8 * 60 * 60; // 8h — uma jornada de trabalho.

interface SessionPayload {
  /** login já normalizado (ex.: `joao.silva@cedae.com.br`) — chave de ADMIN_USERS. */
  readonly sub: string;
  /** displayName, apenas para conveniência de UI. */
  readonly nome?: string;
}

/**
 * Camada de sessão da aplicação.
 *
 * Substitui o header `x-remote-user` (antes injetado pelo IIS/Kerberos) por um
 * JWT assinado, transportado em cookie httpOnly. A resolução de identidade é o
 * ÚNICO ponto que muda: quem consome `readLogin()` (AdminGuard, /api/me) continua
 * usando exatamente a mesma lógica de autorização de antes.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ttlSeconds = Number(process.env.SESSION_TTL ?? '') || DEFAULT_TTL_SECONDS;

  constructor(private readonly jwt: JwtService) {}

  /** Emite o cookie de sessão para um login já normalizado. */
  issue(res: Response, login: string, nome?: string): void {
    const token = this.jwt.sign({ sub: login, nome } satisfies SessionPayload, {
      expiresIn: this.ttlSeconds,
    });
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
  }

  /** Remove o cookie de sessão (logout). */
  clear(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  /**
   * Resolve o login do requisitante, na seguinte ordem de precedência:
   *   1. cookie de sessão JWT (fluxo LDAP novo);
   *   2. header `x-remote-user` (compatibilidade com IIS/Kerberos, se ainda houver);
   *   3. `DEV_REMOTE_USER` (desenvolvimento local).
   * Retorna `null` quando nenhuma fonte identifica o usuário.
   */
  readLogin(req: Request): string | null {
    const fromSession = this.readSessionLogin(req);
    if (fromSession) return fromSession;

    const header = req.headers['x-remote-user'];
    const raw = (typeof header === 'string' ? header : undefined) ?? process.env.DEV_REMOTE_USER;
    return raw ? normalizeLogin(raw) : null;
  }

  private readSessionLogin(req: Request): string | null {
    const token = this.readCookie(req, SESSION_COOKIE);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<SessionPayload>(token);
      return payload.sub || null;
    } catch {
      // Token expirado/adulterado: trata como não autenticado, sem vazar detalhe.
      return null;
    }
  }

  private readCookie(req: Request, name: string): string | undefined {
    // cookie-parser popula req.cookies; fallback defensivo caso não esteja ativo.
    const parsed = (req as Request & { cookies?: Record<string, string> }).cookies;
    return parsed?.[name];
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: (process.env.SESSION_COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
      path: '/',
      maxAge: this.ttlSeconds * 1000,
    };
  }
}
