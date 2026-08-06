import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { hostname } from 'os';

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
    // HTTP e mesmo assim não consegue atender — exatamente o cenário que
    // passou despercebido: sem SESSION_SECRET o container serve todo o HTML
    // com 200 enquanto rejeita qualquer sessão emitida por outra instância.
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
    if (!this.temSegredoFixo() && this.efemeroPermitido()) {
      alertas.push(
        'Rodando com segredo de sessão efêmero (ALLOW_EPHEMERAL_SESSION_SECRET). ' +
          'Válido apenas para UMA instância: com duas ou mais, as sessões não sobrevivem ao balanceamento.',
      );
    }
    return alertas;
  }

  private temSegredoFixo(): boolean {
    return (process.env.SESSION_SECRET ?? '').trim().length > 0;
  }

  private efemeroPermitido(): boolean {
    return (process.env.ALLOW_EPHEMERAL_SESSION_SECRET ?? '').trim().toLowerCase() === 'true';
  }

  /**
   * Configuração sem a qual a instância não tem como atender de verdade.
   *
   * `PROJECT_PATH` fica de fora de propósito: vazio é um valor legítimo
   * (serve na raiz). O destino do Oracle aceita as duas formas suportadas
   * por `DatabaseService.resolverConnectString()`.
   */
  private exigencias(): Exigencia[] {
    const definida = (nome: string): boolean => (process.env[nome] ?? '').trim().length > 0;

    return [
      // Sem segredo fixo e igual em todas as instâncias, nenhuma sessão
      // sobrevive ao balanceamento. Ver AuthModule.resolveSessionSecret().
      // O escape hatch satisfaz a exigência aqui e vira alerta — quem o ligou
      // aceitou rodar em instância única.
      {
        nome: 'SESSION_SECRET',
        presente: this.temSegredoFixo() || this.efemeroPermitido(),
      },
      { nome: 'ORACLE_USER', presente: definida('ORACLE_USER') },
      { nome: 'ORACLE_PASSWORD', presente: definida('ORACLE_PASSWORD') },
      {
        nome: 'ORACLE_CONNECT_STRING (ou ORACLE_HOST + ORACLE_SERVICE)',
        presente:
          definida('ORACLE_CONNECT_STRING') || (definida('ORACLE_HOST') && definida('ORACLE_SERVICE')),
      },
    ];
  }
}
