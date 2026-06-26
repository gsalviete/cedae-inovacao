import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Injectable()
export class WorkflowService {
  constructor(private readonly db: DatabaseService) {}

  async getTransicoesDisponiveis(statusAtual: string): Promise<object[]> {
    const sql = `
      SELECT id, status_origem, status_destino, perfil_requerido,
             justificativa_obrig, descricao
      FROM TRANSICOES_STATUS
      WHERE status_origem = :1
      ORDER BY id
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [statusAtual], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows as any[]).map((r) => ({
        id: r.ID,
        status_destino: r.STATUS_DESTINO,
        perfil_requerido: r.PERFIL_REQUERIDO,
        justificativa_obrig: r.JUSTIFICATIVA_OBRIG === 1,
        descricao: r.DESCRICAO,
      }));
    } finally {
      await conn.close();
    }
  }

  async transicionar(
    iniciativaId: number,
    statusDestino: string,
    justificativa: string | undefined,
    usuario: RequestUser,
  ): Promise<object> {
    const conn = await this.db.getConnection();
    try {
      const iniResult = await conn.execute(
        'SELECT STATUS FROM INOVACAO_INICIATIVAS WHERE ID = :1',
        [iniciativaId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const iniRows = iniResult.rows as any[];
      if (!iniRows.length) {
        throw new NotFoundException(`Iniciativa #${iniciativaId} não encontrada`);
      }
      const statusAtual: string = iniRows[0].STATUS || 'SUBMETIDA';

      const transResult = await conn.execute(
        'SELECT * FROM TRANSICOES_STATUS WHERE status_origem = :1 AND status_destino = :2',
        [statusAtual, statusDestino],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const transRows = transResult.rows as any[];
      if (!transRows.length) {
        throw new BadRequestException(
          `Transição de '${statusAtual}' para '${statusDestino}' não permitida`,
        );
      }

      const trans = transRows[0];
      const isAdmin = usuario.role === 'ADM' || usuario.role === 'CONTRIBUTOR';
      if (!isAdmin) {
        throw new ForbiddenException('Sem permissão para realizar esta transição');
      }

      if (trans.JUSTIFICATIVA_OBRIG === 1 && !justificativa?.trim()) {
        throw new BadRequestException('Justificativa obrigatória para esta transição');
      }

      await conn.execute(
        'UPDATE INOVACAO_INICIATIVAS SET STATUS = :1, ATUALIZADO_EM = SYSDATE WHERE ID = :2',
        [statusDestino, iniciativaId],
      );

      await conn.execute(
        `INSERT INTO HISTORICO_STATUS
           (iniciativa_id, status_anterior, status_novo, tipo_evento, usuario_login, justificativa, data_hora)
         VALUES (:1, :2, :3, :4, :5, :6, SYSTIMESTAMP)`,
        [
          iniciativaId,
          statusAtual,
          statusDestino,
          this.mapTipoEvento(statusDestino),
          usuario.login,
          justificativa || null,
        ],
      );

      await conn.commit();
      return { iniciativa_id: iniciativaId, status_anterior: statusAtual, status_novo: statusDestino };
    } finally {
      await conn.close().catch(() => {});
    }
  }

  async getHistorico(iniciativaId: number): Promise<object[]> {
    const sql = `
      SELECT id, iniciativa_id, status_anterior, status_novo,
             tipo_evento, usuario_login, data_hora,
             DBMS_LOB.SUBSTR(justificativa, 4000, 1) AS justificativa
      FROM HISTORICO_STATUS
      WHERE iniciativa_id = :1
      ORDER BY data_hora ASC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [iniciativaId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows as any[]).map((r) => ({
        id: r.ID,
        status_anterior: r.STATUS_ANTERIOR,
        status_novo: r.STATUS_NOVO,
        tipo_evento: r.TIPO_EVENTO,
        usuario_login: r.USUARIO_LOGIN,
        data_hora: r.DATA_HORA,
        justificativa: r.JUSTIFICATIVA,
      }));
    } finally {
      await conn.close();
    }
  }

  private mapTipoEvento(statusDestino: string): string {
    const mapa: Record<string, string> = {
      SUBMETIDA: 'SUBMISSAO',
      EM_ANALISE: 'TRIAGEM',
      APROVADA: 'APROVACAO',
      REPROVADA: 'REPROVACAO',
    };
    return mapa[statusDestino] ?? 'ANALISE';
  }
}
