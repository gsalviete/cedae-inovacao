import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  /** Diretório com tnsnames.ora/sqlnet.ora, quando a conexão usa alias. */
  private get configDir(): string | undefined {
    return process.env.ORACLE_TNS_ADMIN || process.env.TNS_ADMIN || undefined;
  }

  onModuleInit() {
    try {
      // Thick mode: só funciona onde há Oracle Client instalado. Quando há
      // tnsnames.ora, o cliente precisa saber onde ele está.
      oracledb.initOracleClient(
        this.configDir ? { configDir: this.configDir } : {},
      );
    } catch {
      // thin mode — sem Oracle Client, ignorar
    }
    this.logger.log(`Conexão Oracle: ${this.descreverAlvo()}`);
  }

  /**
   * Retorna uma conexão Oracle.
   *
   * O destino vem de ORACLE_CONNECT_STRING quando definida, e aí aceita
   * qualquer forma que o Oracle entenda:
   *
   *   - Easy Connect ......... bl202.cedae.corp:1521/ORCLPDB1
   *   - descritor completo ... (DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=…)…)
   *   - alias do tnsnames .... PROD_CEDAE   (exige ORACLE_TNS_ADMIN)
   *
   * Sem ela, cai no trio ORACLE_HOST/PORT/SERVICE (o banco de testes).
   */
  async getConnection(): Promise<oracledb.Connection> {
    const user = process.env.ORACLE_USER;
    const password = process.env.ORACLE_PASSWORD;

    return oracledb.getConnection({
      user,
      password,
      connectString: this.resolverConnectString(),
      // Ignorado quando o connectString não é um alias; em thin mode é o único
      // jeito de achar o tnsnames.ora.
      ...(this.configDir ? { configDir: this.configDir } : {}),
    });
  }

  private resolverConnectString(): string {
    const explicita = process.env.ORACLE_CONNECT_STRING?.trim();
    if (explicita) return explicita;

    const host = process.env.ORACLE_HOST || 'localhost';
    const port = process.env.ORACLE_PORT || '1521';
    const service = process.env.ORACLE_SERVICE || 'XEPDB1';

    return `${host}:${port}/${service}`;
  }

  /** Texto para log — nunca inclui senha. */
  private descreverAlvo(): string {
    const alvo = this.resolverConnectString();
    const origem = process.env.ORACLE_CONNECT_STRING?.trim()
      ? 'ORACLE_CONNECT_STRING'
      : 'ORACLE_HOST/PORT/SERVICE';
    const tns = this.configDir ? ` (TNS_ADMIN=${this.configDir})` : '';

    return `${process.env.ORACLE_USER ?? '?'}@${alvo} [${origem}]${tns}`;
  }
}
