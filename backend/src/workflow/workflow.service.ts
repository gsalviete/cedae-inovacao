import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';

interface TransitionUser {
  id: string | number;
  login: string;
  perfis: string[];
}

@Injectable()
export class WorkflowService {
  constructor(private readonly db: DatabaseService) {}

  async getTransicoesDisponiveis(statusAtual: string, perfis: string[]): Promise<object[]> {
    const isAdmin = perfis.includes('ADMINISTRADOR');
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
      const rows = result.rows as any[];
      return rows
        .filter((r) => isAdmin || perfis.includes(r.PERFIL_REQUERIDO))
        .map((r) => ({
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
    usuario: TransitionUser,
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
      const isAdmin = usuario.perfis.includes('ADMINISTRADOR');
      if (!isAdmin && !usuario.perfis.includes(trans.PERFIL_REQUERIDO)) {
        throw new ForbiddenException(
          `Perfil '${trans.PERFIL_REQUERIDO}' necessário para esta transição`,
        );
      }

      if (trans.JUSTIFICATIVA_OBRIG === 1 && !justificativa?.trim()) {
        throw new BadRequestException('Justificativa obrigatória para esta transição');
      }

      await conn.execute(
        'UPDATE INOVACAO_INICIATIVAS SET STATUS = :1, ATUALIZADO_EM = SYSDATE WHERE ID = :2',
        [statusDestino, iniciativaId],
      );

      const usuarioId = typeof usuario.id === 'number' ? usuario.id : null;
      await conn.execute(
        `INSERT INTO HISTORICO_STATUS
           (iniciativa_id, status_anterior, status_novo, tipo_evento, usuario_id, justificativa, data_hora)
         VALUES (:1, :2, :3, :4, :5, :6, SYSTIMESTAMP)`,
        [
          iniciativaId,
          statusAtual,
          statusDestino,
          this.mapTipoEvento(statusDestino),
          usuarioId,
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
      SELECT h.id, h.iniciativa_id, h.status_anterior, h.status_novo,
             h.tipo_evento, h.usuario_id, h.data_hora, h.justificativa,
             u.login AS usuario_login, u.nome_completo AS usuario_nome
      FROM HISTORICO_STATUS h
      LEFT JOIN USUARIOS u ON u.id = h.usuario_id
      WHERE h.iniciativa_id = :1
      ORDER BY h.data_hora ASC
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
        usuario_id: r.USUARIO_ID,
        usuario_login: r.USUARIO_LOGIN,
        usuario_nome: r.USUARIO_NOME,
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
