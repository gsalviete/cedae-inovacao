import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';

export interface CreateUserDto {
  login: string;
  nome_completo: string;
  email: string;
  perfis?: string[];
}

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  private normalize(row: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
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
      return (result.rows as any[]).map((r) => this.normalize(r));
    } finally {
      await conn.close();
    }
  }

  async listarIniciativas(): Promise<object[]> {
    const sql = `
      SELECT ID, TITULO_INICIATIVA, NOME_COLABORADOR, AREA_PROPONENTE,
             ESTAGIO_DESENVOLVIMENTO, NVL(STATUS, 'SUBMETIDA') AS STATUS, CRIADO_EM
      FROM INOVACAO_INICIATIVAS
      ORDER BY CRIADO_EM DESC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((r) => this.normalize(r));
    } finally {
      await conn.close();
    }
  }

  async getKpis(): Promise<object> {
    const iniciativas = await this.listarIniciativas() as any[];
    const total = iniciativas.length;

    const por_estagio: Record<string, number> = {};
    const por_dimensao: Record<string, number> = {};
    const por_status: Record<string, number> = {
      SUBMETIDA: 0, EM_ANALISE: 0, APROVADA: 0, REPROVADA: 0,
    };

    for (const i of iniciativas) {
      const estagio = i.estagio_desenvolvimento || 'Não informado';
      por_estagio[estagio] = (por_estagio[estagio] || 0) + 1;

      const dimensao = i.macrodimensao || 'Não informado';
      por_dimensao[dimensao] = (por_dimensao[dimensao] || 0) + 1;

      const status = i.status || 'SUBMETIDA';
      por_status[status] = (por_status[status] || 0) + 1;
    }

    return { total_iniciativas: total, por_estagio, por_dimensao, por_status };
  }

  async getAcessos(): Promise<object[]> {
    const logs = await this.listarLogs() as any[];
    return logs.filter((l) => l.acao === 'login');
  }

  async listarUsuarios(): Promise<object[]> {
    const sql = `
      SELECT u.id, u.login, u.nome_completo, u.email, u.ativo, u.criado_em, u.ultimo_acesso,
             NVL(
               LISTAGG(p.codigo, ',') WITHIN GROUP (ORDER BY p.codigo),
               ''
             ) AS perfis_str
      FROM USUARIOS u
      LEFT JOIN USUARIOS_PERFIS up ON up.usuario_id = u.id AND up.revogado_em IS NULL
      LEFT JOIN PERFIS_ACESSO p    ON p.id = up.perfil_id
      GROUP BY u.id, u.login, u.nome_completo, u.email, u.ativo, u.criado_em, u.ultimo_acesso
      ORDER BY u.id
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((r) => ({
        id: r.ID,
        login: r.LOGIN,
        nome_completo: r.NOME_COMPLETO,
        email: r.EMAIL,
        ativo: r.ATIVO === 1,
        criado_em: r.CRIADO_EM,
        ultimo_acesso: r.ULTIMO_ACESSO,
        perfis: r.PERFIS_STR ? r.PERFIS_STR.split(',').filter(Boolean) : [],
      }));
    } catch (e: any) {
      if (e?.errorNum === 942) return [];
      throw e;
    } finally {
      await conn.close();
    }
  }

  async criarUsuario(data: CreateUserDto, criadoPorId: number): Promise<{ id: number; senha: string }> {
    const senha = crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(senha, 10);

    const conn = await this.db.getConnection();
    try {
      const idVar = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      const insertResult = await conn.execute(
        `INSERT INTO USUARIOS (login, nome_completo, email, senha_hash, ativo, criado_em, criado_por_id, atualizado_em)
         VALUES (:1, :2, :3, :4, 1, SYSTIMESTAMP, :5, SYSTIMESTAMP) RETURNING id INTO :6`,
        [data.login, data.nome_completo, data.email, hash, criadoPorId, idVar],
      );
      await conn.commit();
      const userId: number = (insertResult.outBinds as any[])[0];

      if (data.perfis && data.perfis.length > 0) {
        const perfilSql = `
          SELECT id FROM PERFIS_ACESSO
          WHERE codigo IN (${data.perfis.map(() => '?').join(',')})
        `;
        // Oracle usa :1, :2, ... para binds posicionais
        const perfilBindSql = `
          SELECT id FROM PERFIS_ACESSO
          WHERE codigo IN (${data.perfis.map((_, i) => `:${i + 1}`).join(',')})
        `;
        const perfilResult = await conn.execute(perfilBindSql, data.perfis, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        const perfisRows = perfilResult.rows as any[];

        for (const pr of perfisRows) {
          await conn.execute(
            'INSERT INTO USUARIOS_PERFIS (usuario_id, perfil_id, concedido_em, concedido_por_id) VALUES (:1, :2, SYSTIMESTAMP, :3)',
            [userId, pr.ID, criadoPorId],
          );
        }
        await conn.commit();
      }

      return { id: userId, senha };
    } finally {
      await conn.close();
    }
  }

  async atualizarStatusUsuario(id: number, ativo: boolean): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      await conn.execute(
        'UPDATE USUARIOS SET ativo = :1, atualizado_em = SYSTIMESTAMP WHERE id = :2',
        [ativo ? 1 : 0, id],
      );
      await conn.commit();
    } finally {
      await conn.close();
    }
  }
}
