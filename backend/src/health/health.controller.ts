import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { hostname } from 'os';
import { ligado as envioLigado, renomeadasPendentes } from '../mail/mail.config';

/** Uma variável obrigatória e o motivo de ela ser obrigatória. */
interface Exigencia {
  readonly nome: string;
  readonly presente: boolean;
}

interface HealthResponse {
  status: 'ok' | 'config_incompleta';
  /** Hostname do container — identifica QUAL instância do pool respondeu. */
  instancia: string;
  uptimeSegundos: number;
  basePath: string;
  /** Nomes das variáveis essenciais ausentes. Nunca expõe valores. */
  faltando: string[];
  /** Configuração aceita mas arriscada — não derruba o probe, só avisa. */
  alertas: string[];
}

/**
 * Health check para o balanceador (liveness).
 *
 * Responde em `{PROJECT_PATH}/api/health` — ex.: `/inovacao/api/health`. O
 * middleware de normalização de URL em `main.ts` faz `/api/health` chegar aqui
 * também, então o probe funciona com o proxy repassando ou removendo o prefixo.
 *
 * O que é verificado, e por quê:
 *
 *   - o processo Nest está de pé e roteando (a própria resposta prova isso);
 *   - a CONFIGURAÇÃO essencial está presente — só presença, sem I/O.
 *
 * O que deliberadamente NÃO é verificado: conectividade com o Oracle. Uma
 * indisponibilidade momentânea do banco (failover de nó do RAC, por exemplo)
 * tiraria todas as instâncias do pool ao mesmo tempo, transformando uma
 * degradação parcial em queda total; e, como não há pool de conexões, cada
 * probe abriria uma conexão nova no banco a cada poucos segundos, por
 * container. Para monitoração de dependências, use um endpoint separado de
 * readiness — nunca o probe do balanceador.
 *
 * Sem autenticação por definição: o probe do balanceador não tem sessão.
 * A resposta não expõe nenhum valor de configuração, apenas nomes ausentes.
 */
@Controller('api/health')
export class HealthController {
  @Get()
  check(@Res({ passthrough: true }) res: Response): HealthResponse {
    const faltando = this.exigencias()
      .filter((e) => !e.presente)
      .map((e) => e.nome);

    // 503 faz o balanceador tirar do pool uma instância que sobe, responde
    // HTTP e mesmo assim não consegue atender — o container sem configuração
    // de banco serve todo o HTML com 200 e falha em qualquer consulta.
    if (faltando.length > 0) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: faltando.length === 0 ? 'ok' : 'config_incompleta',
      instancia: hostname(),
      uptimeSegundos: Math.round(process.uptime()),
      basePath: process.env.PROJECT_PATH?.trim() ? `/${process.env.PROJECT_PATH.trim()}` : '',
      faltando,
      alertas: this.alertas(),
    };
  }

  /**
   * Riscos assumidos conscientemente pelo operador: reporta, mas não reprova o
   * probe — do contrário o escape hatch seria inútil (a instância subiria e o
   * balanceador a derrubaria em seguida).
   */
  private alertas(): string[] {
    const alertas: string[] = [];

    // Configuração de e-mail no formato antigo: o app não a lê, então o envio
    // da Via 2 está desligado sem que nada mais denuncie isso.
    const renomeadas = renomeadasPendentes();
    if (renomeadas.length) {
      alertas.push(
        `Variáveis de e-mail no formato antigo, ignoradas — renomeie: ${renomeadas.join(', ')}.`,
      );
    }

    if (envioLigado() && !(process.env.SMTP_HOST ?? '').trim()) {
      alertas.push('SMTP_ENABLED=true sem SMTP_HOST — nenhum e-mail sairá.');
    }

    // A identidade vem do `x-remote-user` injetado pelo IIS. Com esta variável
    // em produção, uma requisição que chegue SEM o header — falando direto com
    // o container, sem passar pelo proxy — é atendida como um usuário fixo, e a
    // auditoria sai no nome dele. O valor não é exposto: a resposta é pública.
    if (
      (process.env.NODE_ENV ?? '').trim() === 'production' &&
      (process.env.DEV_REMOTE_USER ?? '').trim()
    ) {
      alertas.push(
        'DEV_REMOTE_USER definido com NODE_ENV=production — requisições sem x-remote-user ' +
          'são atendidas como um usuário fixo.',
      );
    }

    return alertas;
  }

  /**
   * Configuração sem a qual a instância não tem como atender de verdade.
   *
   * `PROJECT_PATH` fica de fora de propósito: vazio é um valor legítimo
   * (serve na raiz). `ORACLE_PORT` também: 1521 é um padrão seguro. O destino
   * do Oracle é sempre HOST/PORT/SERVICE — ver `DatabaseService`.
   */
  private exigencias(): Exigencia[] {
    const definida = (nome: string): boolean => (process.env[nome] ?? '').trim().length > 0;

    return [
      { nome: 'ORACLE_USER', presente: definida('ORACLE_USER') },
      { nome: 'ORACLE_PASSWORD', presente: definida('ORACLE_PASSWORD') },
      { nome: 'ORACLE_HOST', presente: definida('ORACLE_HOST') },
      { nome: 'ORACLE_SERVICE', presente: definida('ORACLE_SERVICE') },
    ];
  }
}
