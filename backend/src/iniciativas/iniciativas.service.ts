import { Injectable } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { CreateIniciativaDto } from './dto/create-iniciativa.dto';

@Injectable()
export class IniciativasService {
  constructor(private readonly db: DatabaseService) {}

  async criar(data: CreateIniciativaDto): Promise<number> {
    const sql = `
      INSERT INTO INOVACAO_INICIATIVAS (
        NOME_COLABORADOR, CANAL_CONTATO, EMAIL_PROPONENTE, TITULO_INICIATIVA,
        AREA_PROPONENTE, LOCAL_APLICACAO, PROBLEMA_PRATICO,
        SOLUCAO_PROPOSTA, RISCO_MITIGADO, ESTAGIO_DESENVOLVIMENTO,
        MACRODIMENSAO, PERFIL_IMPACTO, APORTE_FINANCEIRO,
        VALOR_APORTE, RETORNO_ECONOMICO, SUPORTE_NECESSARIO,
        DIAGNOSTICO_OBSERVACAO, COMENTARIOS_ADICIONAIS, STATUS, CRIADO_EM, ATUALIZADO_EM
      ) VALUES (
        :1, :2, :3, :4, :5, :6, :7, :8, :9, :10,
        :11, :12, :13, :14, :15, :16, :17, :18, 'SUBMETIDA', SYSDATE, SYSDATE
      ) RETURNING ID INTO :19
    `;

    const conn = await this.db.getConnection();
    try {
      const idVar = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      const result = await conn.execute(sql, [
        data.nome_colaborador,
        data.canal_contato,
        data.email_proponente,
        data.titulo_iniciativa,
        data.area_proponente,
        data.local_aplicacao,
        data.problema_pratico,
        data.solucao_proposta,
        data.risco_mitigado ?? null,
        data.estagio_desenvolvimento ?? null,
        data.macrodimensao ?? null,
        data.perfil_impacto ?? null,
        data.aporte_financeiro ?? null,
        data.valor_aporte ?? null,
        data.retorno_economico ?? null,
        data.suporte_necessario ?? null,
        data.diagnostico_observacao ?? null,
        data.comentarios_adicionais ?? null,
        idVar,
      ]);
      await conn.commit();
      const outBinds = result.outBinds as any[];
      const iniciativaId: number = outBinds[0];

      this.registrarSubmissao(iniciativaId).catch(() => {});

      return iniciativaId;
    } finally {
      await conn.close();
    }
  }

  private async registrarSubmissao(iniciativaId: number): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      await conn.execute(
        `INSERT INTO HISTORICO_STATUS
           (iniciativa_id, status_anterior, status_novo, tipo_evento, usuario_login, data_hora)
         VALUES (:1, NULL, 'SUBMETIDA', 'SUBMISSAO', NULL, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
        [iniciativaId],
      );
      await conn.commit();
    } finally {
      await conn.close();
    }
  }

  async listar(): Promise<object[]> {
    const sql = `
      SELECT ID, TITULO_INICIATIVA, NOME_COLABORADOR, AREA_PROPONENTE,
             ESTAGIO_DESENVOLVIMENTO, NVL(STATUS, 'SUBMETIDA') AS STATUS, CRIADO_EM
      FROM INOVACAO_INICIATIVAS
      ORDER BY CRIADO_EM DESC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((row) => {
        const normalized: Record<string, unknown> = {};
        for (const key of Object.keys(row)) {
          normalized[key.toLowerCase()] = row[key];
        }
        return normalized;
      });
    } finally {
      await conn.close();
    }
  }

  async getById(id: number): Promise<object | null> {
    const sql = `
      SELECT ID, NOME_COLABORADOR, CANAL_CONTATO, EMAIL_PROPONENTE,
             TITULO_INICIATIVA, AREA_PROPONENTE, LOCAL_APLICACAO,
             DBMS_LOB.SUBSTR(PROBLEMA_PRATICO,       32767, 1) AS PROBLEMA_PRATICO,
             DBMS_LOB.SUBSTR(SOLUCAO_PROPOSTA,       32767, 1) AS SOLUCAO_PROPOSTA,
             DBMS_LOB.SUBSTR(RISCO_MITIGADO,         32767, 1) AS RISCO_MITIGADO,
             ESTAGIO_DESENVOLVIMENTO, MACRODIMENSAO, PERFIL_IMPACTO,
             APORTE_FINANCEIRO, VALOR_APORTE, RETORNO_ECONOMICO,
             SUPORTE_NECESSARIO, DIAGNOSTICO_OBSERVACAO,
             DBMS_LOB.SUBSTR(COMENTARIOS_ADICIONAIS, 32767, 1) AS COMENTARIOS_ADICIONAIS,
             CRIADO_EM, NVL(STATUS, 'SUBMETIDA') AS STATUS, ATUALIZADO_EM
      FROM INOVACAO_INICIATIVAS
      WHERE ID = :1
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [id], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = result.rows as any[];
      if (!rows.length) return null;
      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(rows[0])) {
        normalized[key.toLowerCase()] = rows[0][key];
      }
      return normalized;
    } finally {
      await conn.close();
    }
  }
}
