import { Injectable, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly db: DatabaseService) {}

  async resolveUser(login: string): Promise<RequestUser> {
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(
        'SELECT login, nome, role FROM ADMIN_USERS WHERE login = :1 AND ativo = 1',
        [login],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = result.rows as any[];
      if (!rows.length) {
        return { login, nome: null, role: null, admin: false };
      }
      const r = rows[0];
      return {
        login: r.LOGIN as string,
        nome: (r.NOME as string | null) ?? null,
        role: (r.ROLE as 'ADM' | 'CONTRIBUTOR') ?? null,
        admin: true,
      };
    } catch (e: any) {
      if (e?.errorNum === 942) {
        return { login, nome: null, role: null, admin: false };
      }
      this.logger.error('Erro ao resolver usuário:', e?.message);
      return { login, nome: null, role: null, admin: false };
    } finally {
      await conn.close();
    }
  }

  async registrarLog(login: string, acao: string, detalhe: string | null = null): Promise<void> {
    const sql = `INSERT INTO INOVACAO_LOGS (USERNAME, ACAO, DETALHE, CRIADO_EM) VALUES (:1, :2, :3, SYSDATE)`;
    try {
      const conn = await this.db.getConnection();
      try {
        await conn.execute(sql, [login, acao, detalhe]);
        await conn.commit();
      } finally {
        await conn.close();
      }
    } catch {
      // Log nunca interrompe operação principal
    }
  }
}
