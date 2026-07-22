import { ConflictException, Injectable } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { normalizeLogin } from '../auth/normalize-login';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

/** ORA-00001: violação de constraint UNIQUE (aqui, UQ_AU_LOGIN). */
const ORA_UNIQUE_VIOLATION = 1;

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

  /** Executa um GROUP BY simples e devolve um mapa chave→contagem. */
  private async agrupar(
    conn: oracledb.Connection,
    expr: string,
    where = '',
  ): Promise<Record<string, number>> {
    const sql = `
      SELECT ${expr} AS K, COUNT(*) AS N
      FROM INOVACAO_INICIATIVAS
      ${where}
      GROUP BY ${expr}
    `;
    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const out: Record<string, number> = {};
    for (const r of result.rows as any[]) {
      out[(r.K ?? 'Não informado') as string] = Number(r.N);
    }
    return out;
  }

  /**
   * Indicadores agregados por SQL (ADR-013 §14): dimensões existentes + a nova
   * dimensão transversal de canal/origem. Os estados seguem §9 (sem EM_OBSERVACAO).
   */
  async getKpis(): Promise<object> {
    const conn = await this.db.getConnection();
    try {
      const totalRes = await conn.execute(
        'SELECT COUNT(*) AS N FROM INOVACAO_INICIATIVAS',
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const total = Number((totalRes.rows as any[])[0].N);

      const por_estagio = await this.agrupar(
        conn,
        `NVL(ESTAGIO_DESENVOLVIMENTO, 'Não informado')`,
      );
      const por_dimensao = await this.agrupar(
        conn,
        `NVL(MACRODIMENSAO, 'Não informado')`,
      );
      const por_status_raw = await this.agrupar(conn, `NVL(STATUS, 'SUBMETIDA')`);
      const por_canal = await this.agrupar(conn, `NVL(CANAL_CODIGO, 'VIA_2')`);
      const por_proponente = await this.agrupar(conn, `NVL(PROPONENTE_TIPO, 'INTERNO')`);
      const via1_por_sistema = await this.agrupar(
        conn,
        `SISTEMA_ORIGEM`,
        `WHERE CANAL_CODIGO = 'VIA_1' AND SISTEMA_ORIGEM IS NOT NULL`,
      );
      const externa_por_tipo = await this.agrupar(
        conn,
        `TIPO_INSTITUICAO`,
        `WHERE CANAL_CODIGO = 'MAPEAMENTO_EXTERNO' AND TIPO_INSTITUICAO IS NOT NULL`,
      );

      // Estados reais (§9) — garante presença das chaves esperadas pelo frontend.
      const por_status: Record<string, number> = {
        SUBMETIDA: 0, EM_ANALISE: 0, HOMOLOGADA: 0, DESCLASSIFICADA: 0,
      };
      for (const [k, v] of Object.entries(por_status_raw)) por_status[k] = v;

      // Taxa de homologação por canal: homologadas / total por via.
      const homologRes = await conn.execute(
        `SELECT NVL(CANAL_CODIGO, 'VIA_2') AS CANAL,
                COUNT(*) AS TOTAL,
                SUM(CASE WHEN STATUS = 'HOMOLOGADA' THEN 1 ELSE 0 END) AS HOMOLOGADAS
           FROM INOVACAO_INICIATIVAS
          GROUP BY NVL(CANAL_CODIGO, 'VIA_2')`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const homologacao_por_canal: Record<string, { total: number; homologadas: number; taxa: number }> = {};
      for (const r of homologRes.rows as any[]) {
        const t = Number(r.TOTAL);
        const h = Number(r.HOMOLOGADAS);
        homologacao_por_canal[r.CANAL as string] = {
          total: t,
          homologadas: h,
          taxa: t ? Math.round((h / t) * 100) : 0,
        };
      }

      return {
        total_iniciativas: total,
        por_estagio,
        por_dimensao,
        por_status,
        por_canal,
        por_proponente,
        homologacao_por_canal,
        via1_por_sistema,
        externa_por_tipo,
      };
    } finally {
      await conn.close();
    }
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
    const login = normalizeLogin(data.login);
    const conn = await this.db.getConnection();
    try {
      const idVar = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      const insertResult = await conn.execute(
        `INSERT INTO ADMIN_USERS (login, nome, email, role, ativo, criado_em)
         VALUES (:1, :2, :3, :4, 1, SYSTIMESTAMP) RETURNING id INTO :5`,
        [login, data.nome ?? null, data.email ?? null, data.role, idVar],
      );
      await conn.commit();
      // RETURNING INTO devolve um array de valores (um por linha afetada).
      const id: number = (insertResult.outBinds as number[][])[0][0];
      return { id };
    } catch (e: any) {
      if (e?.errorNum === ORA_UNIQUE_VIOLATION) {
        throw new ConflictException(`O usuário '${login}' já está cadastrado.`);
      }
      throw e;
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
