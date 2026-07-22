import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';

export interface CanalUpdate {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
}

@Injectable()
export class CanaisService {
  constructor(private readonly db: DatabaseService) {}

  private normalizeRow(r: any): Record<string, unknown> {
    return {
      codigo: r.CODIGO,
      nome: r.NOME,
      descricao: r.DESCRICAO,
      ativo: r.ATIVO === 1,
    };
  }

  /** Canais ativos — alimenta dropdowns de registro e filtros (RN-11). */
  async listarAtivos(): Promise<object[]> {
    return this.consultar('WHERE ativo = 1');
  }

  /** Todos os canais — tela de gestão (ADM). */
  async listarTodos(): Promise<object[]> {
    return this.consultar('');
  }

  private async consultar(where: string): Promise<object[]> {
    const sql = `
      SELECT codigo, nome, DBMS_LOB.SUBSTR(descricao, 4000, 1) AS descricao, ativo
      FROM CANAIS_CAPTACAO ${where}
      ORDER BY CASE codigo
                 WHEN 'VIA_1' THEN 1
                 WHEN 'VIA_2' THEN 2
                 WHEN 'VIA_3' THEN 3
                 WHEN 'MAPEAMENTO_EXTERNO' THEN 4
                 ELSE 99 END, codigo
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((r) => this.normalizeRow(r));
    } catch (e: any) {
      if (e?.errorNum === 942) return [];
      throw e;
    } finally {
      await conn.close();
    }
  }

  async atualizar(codigo: string, data: CanalUpdate): Promise<void> {
    const sets: string[] = [];
    const binds: unknown[] = [];
    let i = 1;

    if (typeof data.nome === 'string') {
      const nome = data.nome.trim();
      if (!nome) throw new BadRequestException('O nome do canal não pode ser vazio.');
      sets.push(`nome = :${i++}`);
      binds.push(nome);
    }
    if (typeof data.descricao === 'string') {
      sets.push(`descricao = :${i++}`);
      binds.push(data.descricao.trim() || null);
    }
    if (typeof data.ativo === 'boolean') {
      sets.push(`ativo = :${i++}`);
      binds.push(data.ativo ? 1 : 0);
    }

    if (!sets.length) throw new BadRequestException('Nada a atualizar.');

    sets.push('atualizado_em = SYSTIMESTAMP');
    binds.push(codigo);

    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(
        `UPDATE CANAIS_CAPTACAO SET ${sets.join(', ')} WHERE codigo = :${i}`,
        binds,
      );
      if ((result.rowsAffected ?? 0) === 0) {
        throw new NotFoundException(`Canal '${codigo}' não encontrado.`);
      }
      await conn.commit();
    } finally {
      await conn.close();
    }
  }
}
