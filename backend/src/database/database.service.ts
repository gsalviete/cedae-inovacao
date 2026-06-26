import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  onModuleInit() {
    try {
      oracledb.initOracleClient();
    } catch {
      // thin mode — sem Oracle Client, ignorar
    }
  }

  /**
   * Retorna uma conexão Oracle em thin mode.
   * O DSN é montado como host:port/service a partir das variáveis de ambiente.
   */
  async getConnection(): Promise<oracledb.Connection> {
    const user = process.env.ORACLE_USER;
    const password = process.env.ORACLE_PASSWORD;
    const host = process.env.ORACLE_HOST || 'localhost';
    const port = process.env.ORACLE_PORT || '1521';
    const service = process.env.ORACLE_SERVICE || 'XEPDB1';

    const connectString = `${host}:${port}/${service}`;

    return oracledb.getConnection({
      user,
      password,
      connectString,
    });
  }
}
