import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateIniciativaDto } from './dto/create-iniciativa.dto';

@Injectable()
export class IniciativasService {
  constructor(private readonly db: DatabaseService) {}

  async criar(data: CreateIniciativaDto): Promise<number> {
    const sql = `
      INSERT INTO INOVACAO_INICIATIVAS (
        NOME_COLABORADOR, CANAL_CONTATO, TITULO_INICIATIVA,
        AREA_PROPONENTE, LOCAL_APLICACAO, PROBLEMA_PRATICO,
        SOLUCAO_PROPOSTA, RISCO_MITIGADO, ESTAGIO_DESENVOLVIMENTO,
        MACRODIMENSAO, PERFIL_IMPACTO, APORTE_FINANCEIRO,
        VALOR_APORTE, RETORNO_ECONOMICO, SUPORTE_NECESSARIO,
        COMENTARIOS_ADICIONAIS, CRIADO_EM
      ) VALUES (
        :1, :2, :3, :4, :5, :6, :7, :8, :9, :10,
        :11, :12, :13, :14, :15, :16, SYSDATE
      ) RETURNING ID INTO :17
    `;

    const conn = await this.db.getConnection();
    try {
      const idVar = { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER };
      const result = await conn.execute(sql, [
        data.nome_colaborador,
        data.canal_contato,
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
        data.comentarios_adicionais ?? null,
        idVar,
      ]);
      await conn.commit();
      const outBinds = result.outBinds as any[];
      return outBinds[0];
    } finally {
      await conn.close();
    }
  }

  async listar(): Promise<any[]> {
    const sql = 'SELECT * FROM INOVACAO_INICIATIVAS ORDER BY CRIADO_EM DESC';
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((row) => {
        const normalized: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          normalized[key.toLowerCase()] = row[key];
        }
        return normalized;
      });
    } finally {
      await conn.close();
    }
  }
}
