import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { normalizeLogin } from './normalize-login';

/**
 * Identidade do requisitante.
 *
 * A aplicação não tem login: em produção o IIS autentica por Kerberos/AD e
 * injeta `x-remote-user` em toda requisição. Aqui a identidade é só lida e
 * normalizada — toda a autorização (ADMIN_USERS, roles) continua no
 * AuthService, exatamente como antes.
 *
 * `DEV_REMOTE_USER` cobre a máquina do desenvolvedor, onde não há IIS na
 * frente. Em produção ela não deve existir: com ela, uma requisição que
 * chegasse sem o header — alguém falando direto com o container, sem passar
 * pelo proxy — seria atendida como esse usuário.
 */
@Injectable()
export class IdentidadeService {
  /** Login normalizado do requisitante, ou null quando não há identidade. */
  readLogin(req: Request): string | null {
    const header = req.headers['x-remote-user'];
    const raw = (typeof header === 'string' ? header : undefined) ?? process.env.DEV_REMOTE_USER;
    return raw?.trim() ? normalizeLogin(raw) : null;
  }
}
