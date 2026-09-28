import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { RequestUser } from '../common/interfaces/request-user.interface';

/** Resultado de uma tramitação. `reversao` marca o desfazimento de uma
 *  decisão terminal (homologação/desclassificação) — ADR-015 §4. */
export interface TransicaoResultado {
  iniciativa_id: number;
  status_anterior: string;
  status_novo: string;
  etapa_anterior: string | null;
  etapa_nova: string | null;
  reversao: boolean;
}

/** Etapa do quadro kanban (ETAPAS_KANBAN, V32). Cada etapa pertence a um status. */
export interface EtapaKanban {
  codigo: string;
  rotulo: string;
  status_vinculado: string;
  ordem: number;
}

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
  ): Promise<TransicaoResultado> {
    const conn = await this.db.getConnection();
    try {
      const atual = await this.lerPosicao(conn, iniciativaId);
      const ehReversao = await this.aplicarTransicao(
        conn, iniciativaId, atual.status, statusDestino, justificativa, usuario,
      );

      // A etapa do quadro acompanha o status: se a etapa atual não pertence ao
      // novo status, a iniciativa vai para a primeira etapa dele.
      const etapas = await this.lerEtapas(conn);
      const etapaAtual = etapas.find((e) => e.codigo === atual.etapa);
      let etapaNova = atual.etapa;
      if (etapaAtual?.status_vinculado !== statusDestino) {
        etapaNova = etapas.find((e) => e.status_vinculado === statusDestino)?.codigo ?? null;
        await this.gravarEtapa(conn, iniciativaId, atual.etapa, etapaNova, null, usuario);
      }

      await conn.commit();
      return {
        iniciativa_id: iniciativaId,
        status_anterior: atual.status,
        status_novo: statusDestino,
        etapa_anterior: atual.etapa,
        etapa_nova: etapaNova,
        reversao: ehReversao,
      };
    } finally {
      await conn.close().catch(() => {});
    }
  }

  /** Catálogo de etapas do quadro kanban, na ordem de exibição (V32). */
  async listarEtapas(): Promise<EtapaKanban[]> {
    const conn = await this.db.getConnection();
    try {
      return await this.lerEtapas(conn);
    } finally {
      await conn.close();
    }
  }

  /**
   * Move a iniciativa para outra etapa do quadro. Dentro do mesmo status é só
   * uma mudança de etapa; para uma etapa de outro status é também uma
   * tramitação, com todas as regras de `transicionar` (catálogo
   * TRANSICOES_STATUS, perfil ADM nas decisões terminais, justificativa).
   * Tudo numa transação só: ou mudam status e etapa, ou nada muda.
   */
  async moverEtapa(
    iniciativaId: number,
    etapaDestino: string,
    justificativa: string | undefined,
    usuario: RequestUser,
  ): Promise<TransicaoResultado> {
    if (usuario.role !== 'ADM' && usuario.role !== 'CONTRIBUTOR') {
      throw new ForbiddenException('Sem permissão para movimentar iniciativas');
    }

    const conn = await this.db.getConnection();
    try {
      const destino = (await this.lerEtapas(conn)).find((e) => e.codigo === etapaDestino);
      if (!destino) {
        throw new BadRequestException(`Etapa '${etapaDestino}' inexistente ou inativa`);
      }

      const atual = await this.lerPosicao(conn, iniciativaId);
      let ehReversao = false;
      if (destino.status_vinculado !== atual.status) {
        ehReversao = await this.aplicarTransicao(
          conn, iniciativaId, atual.status, destino.status_vinculado, justificativa, usuario,
        );
      }
      await this.gravarEtapa(
        conn, iniciativaId, atual.etapa, destino.codigo, justificativa, usuario,
      );

      await conn.commit();
      return {
        iniciativa_id: iniciativaId,
        status_anterior: atual.status,
        status_novo: destino.status_vinculado,
        etapa_anterior: atual.etapa,
        etapa_nova: destino.codigo,
        reversao: ehReversao,
      };
    } finally {
      await conn.close().catch(() => {});
    }
  }

  private async lerEtapas(conn: oracledb.Connection): Promise<EtapaKanban[]> {
    const result = await conn.execute(
      `SELECT codigo, rotulo_pt, status_vinculado, ordem
         FROM ETAPAS_KANBAN
        WHERE ativo = 1
        ORDER BY ordem, id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows as any[]).map((r) => ({
      codigo: r.CODIGO,
      rotulo: r.ROTULO_PT,
      status_vinculado: r.STATUS_VINCULADO,
      ordem: r.ORDEM,
    }));
  }

  /** Status e etapa atuais; a linha fica bloqueada até o commit, para que duas
   *  movimentações simultâneas não se atropelem. */
  private async lerPosicao(
    conn: oracledb.Connection,
    iniciativaId: number,
  ): Promise<{ status: string; etapa: string | null }> {
    const result = await conn.execute(
      'SELECT STATUS, ETAPA_CODIGO FROM INOVACAO_INICIATIVAS WHERE ID = :1 FOR UPDATE',
      [iniciativaId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as any[];
    if (!rows.length) {
      throw new NotFoundException(`Iniciativa #${iniciativaId} não encontrada`);
    }
    return { status: rows[0].STATUS || 'SUBMETIDA', etapa: rows[0].ETAPA_CODIGO ?? null };
  }

  /** Grava a etapa atual e o evento em HISTORICO_ETAPA (sem commit). */
  private async gravarEtapa(
    conn: oracledb.Connection,
    iniciativaId: number,
    etapaAnterior: string | null,
    etapaNova: string | null,
    justificativa: string | undefined | null,
    usuario: RequestUser,
  ): Promise<void> {
    if (etapaNova === etapaAnterior) return;
    await conn.execute(
      'UPDATE INOVACAO_INICIATIVAS SET ETAPA_CODIGO = :1, ATUALIZADO_EM = SYSDATE WHERE ID = :2',
      [etapaNova, iniciativaId],
    );
    if (!etapaNova) return;
    await conn.execute(
      `INSERT INTO HISTORICO_ETAPA
         (iniciativa_id, etapa_anterior, etapa_nova, usuario_login, justificativa, data_hora)
       VALUES (:1, :2, :3, :4, :5, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
      [iniciativaId, etapaAnterior, etapaNova, usuario.login, justificativa?.trim() || null],
    );
  }

  /**
   * Valida e grava uma tramitação de status (sem commit). Devolve se ela é a
   * reversão de uma decisão terminal.
   */
  private async aplicarTransicao(
    conn: oracledb.Connection,
    iniciativaId: number,
    statusAtual: string,
    statusDestino: string,
    justificativa: string | undefined,
    usuario: RequestUser,
  ): Promise<boolean> {
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
    // Qualquer usuário do painel (ADM ou CONTRIBUTOR) pode tramitar a esteira.
    const ehUsuarioPainel = usuario.role === 'ADM' || usuario.role === 'CONTRIBUTOR';
    if (!ehUsuarioPainel) {
      throw new ForbiddenException('Sem permissão para realizar esta transição');
    }

    // Homologar e desclassificar são atos exclusivos de ADM (ADR-014 §10).
    // O colaborador (CONTRIBUTOR) faz tudo na esteira, exceto estas duas
    // decisões terminais. Validação primária no backend — a UI apenas oculta.
    if (this.STATUS_EXCLUSIVOS_ADM.has(statusDestino) && usuario.role !== 'ADM') {
      throw new ForbiddenException(
        'Apenas administradores podem homologar ou desclassificar iniciativas.',
      );
    }

    // Desfazer a decisão também é exclusivo de ADM (ADR-015 §4): quem não pode
    // homologar/desclassificar tampouco pode reverter.
    const ehReversao = this.STATUS_EXCLUSIVOS_ADM.has(statusAtual);
    if (ehReversao && usuario.role !== 'ADM') {
      throw new ForbiddenException(
        'Apenas administradores podem reverter uma homologação ou desclassificação.',
      );
    }

    // Reverter exige justificativa por regra de negócio, não por configuração:
    // a checagem não depende de o catálogo trazer justificativa_obrig = 1.
    const exigeJustificativa = trans.JUSTIFICATIVA_OBRIG === 1 || ehReversao;
    if (exigeJustificativa && !justificativa?.trim()) {
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
        ehReversao ? 'REVERSAO' : this.mapTipoEvento(statusDestino),
        usuario.login,
        justificativa || null,
      ],
    );

    return ehReversao;
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

  /** Tipo de evento pelo destino. Reversões não passam por aqui: têm tipo próprio. */
  private mapTipoEvento(statusDestino: string): string {
    const mapa: Record<string, string> = {
      SUBMETIDA:       'SUBMISSAO',
      EM_ANALISE:      'TRIAGEM',
      HOMOLOGADA:      'HOMOLOGACAO',
      DESCLASSIFICADA: 'DESCLASSIFICACAO',
    };
    return mapa[statusDestino] ?? 'ANALISE';
  }

  // Status terminais: entrar neles é restrito a ADM (ADR-014 §10) e sair deles
  // (reversão) também (ADR-015 §4).
  private readonly STATUS_EXCLUSIVOS_ADM = new Set(['HOMOLOGADA', 'DESCLASSIFICADA']);

  // Tipos de evento que o autor pode editar dentro da janela de 2h
  private readonly EVENTOS_EDITAVEIS = new Set([
    'TRIAGEM',
    'HOMOLOGACAO',
    'DESCLASSIFICACAO',
  ]);
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
      if (ev.TIPO_EVENTO === 'DESCLASSIFICACAO' && !justificativa?.trim()) {
        throw new BadRequestException(
          'Justificativa obrigatória para desclassificação.',
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
