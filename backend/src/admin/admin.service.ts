import { Injectable } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { normalizeLogin } from '../auth/normalize-login';

export class CreateAdminUserDto {
  login: string = '';
  nome?: string;
  email?: string;
  role: 'ADM' | 'CONTRIBUTOR' = 'CONTRIBUTOR';
}

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  private normalize(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      out[key.toLowerCase()] = row[key];
    }
    return out;
  }

  async listarLogs(): Promise<object[]> {
    const sql = `
      SELECT * FROM INOVACAO_LOGS
      ORDER BY CRIADO_EM DESC
      FETCH FIRST 500 ROWS ONLY
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as Record<string, unknown>[]).map((r) => this.normalize(r));
    } finally {
      await conn.close();
    }
  }

  async listarIniciativas(): Promise<object[]> {
    const sql = `
      SELECT ID, TITULO_INICIATIVA, NOME_COLABORADOR, AREA_PROPONENTE,
             ESTAGIO_DESENVOLVIMENTO, MACRODIMENSAO,
             NVL(STATUS, 'SUBMETIDA') AS STATUS, CRIADO_EM
      FROM INOVACAO_INICIATIVAS
      ORDER BY CRIADO_EM DESC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as Record<string, unknown>[]).map((r) => this.normalize(r));
    } finally {
      await conn.close();
    }
  }

  async getKpis(): Promise<object> {
    const iniciativas = await this.listarIniciativas() as Record<string, unknown>[];
    const total = iniciativas.length;

    const por_estagio: Record<string, number> = {};
    const por_dimensao: Record<string, number> = {};
    const por_status: Record<string, number> = {
      SUBMETIDA: 0, EM_ANALISE: 0, EM_OBSERVACAO: 0, APROVADA: 0, REPROVADA: 0,
    };

    for (const i of iniciativas) {
      const estagio = (i['estagio_desenvolvimento'] as string | null) ?? 'Não informado';
      por_estagio[estagio] = (por_estagio[estagio] ?? 0) + 1;

      const dimensao = (i['macrodimensao'] as string | null) ?? 'Não informado';
      por_dimensao[dimensao] = (por_dimensao[dimensao] ?? 0) + 1;

      const status = (i['status'] as string | null) ?? 'SUBMETIDA';
      por_status[status] = (por_status[status] ?? 0) + 1;
    }

    return { total_iniciativas: total, por_estagio, por_dimensao, por_status };
  }

  async getAcessos(): Promise<object[]> {
    const logs = await this.listarLogs() as Record<string, unknown>[];
    return logs.filter((l) => l['acao'] === 'login');
  }

  async listarAdmins(): Promise<object[]> {
    const sql = `
      SELECT id, login, nome, role, ativo, criado_em
      FROM ADMIN_USERS
      ORDER BY id
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((r) => ({
        id: r.ID,
        login: r.LOGIN,
        nome: r.NOME,
        role: r.ROLE,
        ativo: r.ATIVO === 1,
        criado_em: r.CRIADO_EM,
      }));
    } catch (e: any) {
      if (e?.errorNum === 942) return [];
      throw e;
    } finally {
      await conn.close();
    }
  }

  async criarAdmin(data: CreateAdminUserDto): Promise<{ id: number }> {
    const conn = await this.db.getConnection();
    try {
      const idVar = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      const insertResult = await conn.execute(
        `INSERT INTO ADMIN_USERS (login, nome, email, role, ativo, criado_em)
         VALUES (:1, :2, :3, :4, 1, SYSTIMESTAMP) RETURNING id INTO :5`,
        [normalizeLogin(data.login), data.nome ?? null, data.email ?? null, data.role, idVar],
      );
      await conn.commit();
      const id: number = (insertResult.outBinds as any[])[0];
      return { id };
    } finally {
      await conn.close();
    }
  }

  async buscarUsuariosAD(termo: string): Promise<{ nome: string; email: string }[]> {
    const sql = `
      SELECT NAME, MAIL
        FROM CONSCORP.vw_ad_user
       WHERE MAIL IS NOT NULL
         AND ENABLED = 'True'
         AND (UPPER(NAME) LIKE UPPER('%' || :1 || '%') OR UPPER(MAIL) LIKE UPPER('%' || :2 || '%'))
       ORDER BY NAME
       FETCH FIRST 20 ROWS ONLY
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [termo, termo], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((r) => ({ nome: r.NAME as string, email: r.MAIL as string }));
    } finally {
      await conn.close();
    }
  }

  async resolverUsuarioAD(nome: string): Promise<{ email: string; login: string } | null> {
    const sql = `
      SELECT MAIL, SAMACCOUNTNAME
        FROM CONSCORP.vw_ad_user
       WHERE NAME = :1
         AND MAIL IS NOT NULL
         AND ENABLED = 'True'
         AND ROWNUM = 1
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [nome], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = result.rows as any[];
      if (!rows.length) return null;
      return {
        email: rows[0].MAIL as string,
        login: normalizeLogin(rows[0].SAMACCOUNTNAME as string),
      };
    } finally {
      await conn.close();
    }
  }

  async toggleAdmin(id: number, ativo: boolean): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      await conn.execute(
        'UPDATE ADMIN_USERS SET ativo = :1 WHERE id = :2',
        [ativo ? 1 : 0, id],
      );
      await conn.commit();
    } finally {
      await conn.close();
    }
  }

  async atualizarRole(id: number, role: 'ADM' | 'CONTRIBUTOR'): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      await conn.execute(
        'UPDATE ADMIN_USERS SET role = :1 WHERE id = :2',
        [role, id],
      );
      await conn.commit();
    } finally {
      await conn.close();
    }
  }
}
