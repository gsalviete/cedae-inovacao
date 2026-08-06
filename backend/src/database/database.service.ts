import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';

/** Variáveis sem as quais não há conexão possível. */
const OBRIGATORIAS = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_HOST', 'ORACLE_SERVICE'] as const;

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  onModuleInit() {
    try {
      // Thick mode: só funciona onde há Oracle Client instalado. Sem ele o
      // driver segue em thin mode, que atende Easy Connect normalmente.
      oracledb.initOracleClient();
    } catch {
      // thin mode — sem Oracle Client, ignorar
    }

    const faltando = this.faltando();
    if (faltando.length) {
      // Não derruba o boot de propósito: o container sobe, serve o HTML e o
      // /api/health responde 503 com o nome do que falta (ver HealthController).
      this.logger.error(
        `Conexão Oracle NÃO configurada — faltando: ${faltando.join(', ')}. ` +
          'Nenhuma consulta vai funcionar até essas variáveis existirem.',
      );
      return;
    }
    this.logger.log(`Conexão Oracle: ${this.descreverAlvo()}`);
  }

  /**
   * Retorna uma conexão Oracle.
   *
   * Destino sempre em Easy Connect, montado de ORACLE_HOST/PORT/SERVICE:
   *
   *   bl202.cedae.corp:1521/cedaetst.cedae.corp        (testes)
   *   ora-prod-scan.cedae.corp:1521/cedae              (produção)
   *
   * Em produção o host é o SCAN do RAC (resolve para 10.10.0.182/183/184) e o
   * listener redireciona para o nó vivo — o mesmo failover que o descritor TNS
   * completo dava, sem depender de tnsnames.ora dentro do container.
   */
  async getConnection(): Promise<oracledb.Connection> {
    const faltando = this.faltando();
    if (faltando.length) {
      // Falhar aqui, com o nome da variável, em vez de tentar um destino
      // inventado: o fallback antigo (localhost:1521/XEPDB1) transformava
      // "esqueci de configurar" num erro de rede sem relação com a causa.
      throw new Error(`Conexão Oracle não configurada — faltando: ${faltando.join(', ')}.`);
    }

    return oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: this.connectString(),
    });
  }

  private connectString(): string {
    const host = (process.env.ORACLE_HOST ?? '').trim();
    const port = (process.env.ORACLE_PORT ?? '').trim() || '1521';
    const service = (process.env.ORACLE_SERVICE ?? '').trim();

    return `${host}:${port}/${service}`;
  }

  private faltando(): string[] {
    return OBRIGATORIAS.filter((nome) => !(process.env[nome] ?? '').trim());
  }

  /** Texto para log — nunca inclui senha. */
  private descreverAlvo(): string {
    return `${process.env.ORACLE_USER ?? '?'}@${this.connectString()}`;
  }
}
