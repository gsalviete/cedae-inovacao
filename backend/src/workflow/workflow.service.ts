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
         VALUES (:1, :2, :3, :4, :5, :6, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
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
             tipo_evento, usuario_login, data_hora, editado_em,
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
        editado_em: r.EDITADO_EM,
        justificativa: r.JUSTIFICATIVA,
      }));
    } finally {
      await conn.close();
    }
  }

  async registrarObservacao(
    iniciativaId: number,
    texto: string,
    usuario: RequestUser,
  ): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      const check = await conn.execute(
        'SELECT ID FROM INOVACAO_INICIATIVAS WHERE ID = :1',
        [iniciativaId],
      );
      if (!(check.rows as any[]).length)
        throw new NotFoundException(`Iniciativa #${iniciativaId} não encontrada`);

      await conn.execute(
        `INSERT INTO INICIATIVA_OBSERVACOES (iniciativa_id, usuario_login, texto, criado_em)
         VALUES (:1, :2, :3, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
        [iniciativaId, usuario.login, texto],
      );
      await conn.commit();
    } finally {
      await conn.close();
    }
  }

  async getObservacoes(iniciativaId: number): Promise<object[]> {
    const sql = `
      SELECT id, usuario_login,
             DBMS_LOB.SUBSTR(texto, 32767, 1) AS texto, criado_em, editado_em
      FROM INICIATIVA_OBSERVACOES
      WHERE iniciativa_id = :1
      ORDER BY criado_em ASC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [iniciativaId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows as any[]).map((r) => ({
        id: r.ID,
        usuario_login: r.USUARIO_LOGIN,
        texto: r.TEXTO,
        criado_em: r.CRIADO_EM,
        editado_em: r.EDITADO_EM,
      }));
    } finally {
      await conn.close();
    }
  }

  private mapTipoEvento(statusDestino: string): string {
    const mapa: Record<string, string> = {
      SUBMETIDA:  'SUBMISSAO',
      EM_ANALISE: 'TRIAGEM',
      APROVADA:   'APROVACAO',
      REPROVADA:  'REPROVACAO',
    };
    return mapa[statusDestino] ?? 'ANALISE';
  }

  // Tipos de evento que o autor pode editar dentro da janela de 2h
  private readonly EVENTOS_EDITAVEIS = new Set(['TRIAGEM', 'APROVACAO', 'REPROVACAO']);
  private readonly JANELA_EDICAO_MS = 2 * 60 * 60 * 1000;

  private dentroDaJanela(criadoEm: Date | string): boolean {
    const criado = new Date(criadoEm).getTime();
    return Number.isFinite(criado) && Date.now() - criado <= this.JANELA_EDICAO_MS;
  }

  async editarObservacao(
    iniciativaId: number,
    observacaoId: number,
    texto: string,
    usuario: RequestUser,
  ): Promise<void> {
    if (!texto?.trim()) {
      throw new BadRequestException('Texto da observação não pode ser vazio.');
    }

    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(
        `SELECT usuario_login, criado_em
         FROM INICIATIVA_OBSERVACOES
         WHERE id = :1 AND iniciativa_id = :2`,
        [observacaoId, iniciativaId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = result.rows as any[];
      if (!rows.length) {
        throw new NotFoundException(`Observação #${observacaoId} não encontrada.`);
      }
      const obs = rows[0];
      if (obs.USUARIO_LOGIN !== usuario.login) {
        throw new ForbiddenException('Apenas o autor pode editar esta observação.');
      }
      if (!this.dentroDaJanela(obs.CRIADO_EM)) {
        throw new ForbiddenException(
          'Janela de edição expirada (2h após o registro).',
        );
      }

      await conn.execute(
        `UPDATE INICIATIVA_OBSERVACOES
         SET texto = :1, editado_em = SYS_EXTRACT_UTC(SYSTIMESTAMP)
         WHERE id = :2`,
        [texto.trim(), observacaoId],
      );
      await conn.commit();
    } finally {
      await conn.close().catch(() => {});
    }
  }

  async editarEventoHistorico(
    iniciativaId: number,
    eventoId: number,
    justificativa: string | undefined,
    usuario: RequestUser,
  ): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(
        `SELECT usuario_login, data_hora, tipo_evento
         FROM HISTORICO_STATUS
         WHERE id = :1 AND iniciativa_id = :2`,
        [eventoId, iniciativaId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = result.rows as any[];
      if (!rows.length) {
        throw new NotFoundException(`Evento #${eventoId} não encontrado.`);
      }
      const ev = rows[0];
      if (!this.EVENTOS_EDITAVEIS.has(ev.TIPO_EVENTO)) {
        throw new ForbiddenException(
          `Eventos do tipo '${ev.TIPO_EVENTO}' não são editáveis.`,
        );
      }
      if (ev.USUARIO_LOGIN !== usuario.login) {
        throw new ForbiddenException('Apenas o autor pode editar este evento.');
      }
      if (!this.dentroDaJanela(ev.DATA_HORA)) {
        throw new ForbiddenException(
          'Janela de edição expirada (2h após o registro).',
        );
      }
      if (ev.TIPO_EVENTO === 'REPROVACAO' && !justificativa?.trim()) {
        throw new BadRequestException(
          'Justificativa obrigatória para reprovação.',
        );
      }

      await conn.execute(
        `UPDATE HISTORICO_STATUS
         SET justificativa = :1, editado_em = SYS_EXTRACT_UTC(SYSTIMESTAMP)
         WHERE id = :2`,
        [justificativa?.trim() || null, eventoId],
      );
      await conn.commit();
    } finally {
      await conn.close().catch(() => {});
    }
  }
}
