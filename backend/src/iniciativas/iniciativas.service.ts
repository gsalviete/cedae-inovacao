import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import {
  CLASSIFICACAO_LABEL,
  RELEVANCIA_LABEL,
  RELEVANCIA_PADRAO,
  RELEVANCIA_VIA_1,
  RELEVANCIAS,
  TIPOS_INSTITUICAO as TIPOS_INSTITUICAO_VALIDOS,
} from './dominio-iniciativa';
import { CreateIniciativaDto } from './dto/create-iniciativa.dto';
import { CreateManualIniciativaDto } from './dto/create-manual-iniciativa.dto';
import { UpdateIniciativaDto } from './dto/update-iniciativa.dto';

/** Metadados de origem carimbados pela camada de ingestão (ADR-013 §3.2). */
interface OrigemIngestao {
  canal_codigo: string;
  proponente_tipo: 'INTERNO' | 'EXTERNO';
  organizacao_externa?: string | null;
  tipo_instituicao?: string | null;
  sistema_origem?: string | null;
  codigo_origem?: string | null;
  registrado_por_login?: string | null;
  /** Relevância estratégica definida na ingestão (ADR-015 §2). */
  relevancia_estrategica: string;
}

/** Campos base da iniciativa comuns à Via 2 e às vias manuais. */
type IniciativaCampos = Omit<CreateManualIniciativaDto,
  'canal_codigo' | 'sistema_origem' | 'codigo_origem' | 'organizacao_externa' |
  'tipo_instituicao' | 'data_reuniao' | 'area_reuniao' | 'relevancia_estrategica'>;

/**
 * Colunas que continuam NOT NULL em INOVACAO_INICIATIVAS (V27 liberou
 * SOLUCAO_PROPOSTA; V31, o par proponente). Como o Oracle trata string vazia
 * como NULL, esvaziar qualquer uma delas na edição estouraria ORA-01407 e
 * viraria um 500 opaco — a exigência é validada aqui, com mensagem legível.
 */
const CAMPOS_OBRIGATORIOS: Record<string, string> = {
  titulo_iniciativa: 'o título da iniciativa',
  area_proponente: 'a área proponente',
  local_aplicacao: 'o local de aplicação',
  problema_pratico: 'o problema prático',
};

/**
 * RN-15: proponente é obrigatório em todas as vias, exceto na Captação Externa
 * — mesma regra da ingestão (`criarManual`), aplicada também na edição.
 */
const CAMPOS_PROPONENTE: Record<string, string> = {
  nome_colaborador: 'o nome do proponente',
  canal_contato: 'o canal de contato',
};

const CANAIS_MANUAIS = new Set(['VIA_1', 'VIA_3', 'MAPEAMENTO_EXTERNO']);
const SISTEMAS_ORIGEM = new Set(['SGE', 'SGP']);
const TIPOS_INSTITUICAO = new Set<string>(TIPOS_INSTITUICAO_VALIDOS);
const RELEVANCIAS_VALIDAS = new Set<string>(RELEVANCIAS);

@Injectable()
export class IniciativasService {
  private readonly logger = new Logger(IniciativasService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  /**
   * Via 2 (formulário público). Grava sempre CANAL_CODIGO='VIA_2' e
   * PROPONENTE_TIPO='INTERNO' (ADR-013 §4.1) — sem autoria autenticada.
   * A relevância estratégica nasce como "ainda não é possível determinar": é uma
   * avaliação da Assessoria, não do proponente (ADR-015 §2.2), e o ADM a define
   * na edição administrativa.
   * Dispara o e-mail de confirmação ao proponente (ADR-014 §12), best-effort:
   * uma falha no envio nunca invalida a submissão. O aviso à Assessoria sai em
   * paralelo, disparado por `ingerir` como em toda via — por isso a Via 2 gera
   * dois e-mails independentes.
   */
  async criar(data: CreateIniciativaDto): Promise<{ id: number; codigo_publico: string }> {
    const resultado = await this.ingerir(data, {
      canal_codigo: 'VIA_2',
      proponente_tipo: 'INTERNO',
      relevancia_estrategica: RELEVANCIA_PADRAO,
    });

    void this.mail
      .sendConfirmacaoVia2({
        nome: data.nome_colaborador,
        email: data.email_proponente,
        protocolo: resultado.codigo_publico,
      })
      .catch((e) => {
        this.logger.error(`Falha inesperada ao tentar enviar o e-mail de confirmação: ${e?.message ?? e}`);
      });

    return resultado;
  }

  /**
   * Vias 1, 3 e Captação Externa (cadastro manual autenticado — ADR-013 §4.2-4.4).
   * As três vias compartilham este mesmo endpoint de ingestão, diferindo apenas
   * nos campos de procedência e no tipo de proponente. `registradoPorLogin` é o
   * login do analista autenticado (RN-05).
   */
  async criarManual(
    data: CreateManualIniciativaDto,
    registradoPorLogin: string,
  ): Promise<{ id: number; codigo_publico: string }> {
    const canal = data.canal_codigo;
    if (!CANAIS_MANUAIS.has(canal)) {
      throw new BadRequestException(
        'Canal inválido para registro manual. Use VIA_1, VIA_3 ou MAPEAMENTO_EXTERNO.',
      );
    }

    // RN-02: o canal define o tipo de proponente.
    const proponenteTipo: 'INTERNO' | 'EXTERNO' =
      canal === 'MAPEAMENTO_EXTERNO' ? 'EXTERNO' : 'INTERNO';

    // RN-15: proponente é obrigatório em todas as vias, EXCETO na Captação
    // Externa — lá a iniciativa é identificada antes do contato formal
    // (ADR-015 §6). O DTO aceita ausência; a exigência por canal é aqui.
    if (canal !== 'MAPEAMENTO_EXTERNO') {
      if (!(data.nome_colaborador ?? '').trim()) {
        throw new BadRequestException('Informe o nome do proponente.');
      }
      if (!(data.canal_contato ?? '').trim()) {
        throw new BadRequestException('Informe o canal de contato do proponente.');
      }
    }

    // RN-14: a Via 1 (SGE/SGP) sempre nasce como "presente no Planejamento
    // Estratégico" — carimbo do sistema, sem intervenção do usuário. Nas demais
    // vias o analista escolhe; sem escolha, fica "ainda não é possível determinar".
    const relevancia = canal === 'VIA_1'
      ? RELEVANCIA_VIA_1
      : this.normalizarRelevancia(data.relevancia_estrategica);

    // RN-04: Via 1 exige sistema de origem (SGE/SGP); código de origem é opcional.
    let sistemaOrigem: string | null = null;
    let codigoOrigem: string | null = null;
    if (canal === 'VIA_1') {
      sistemaOrigem = (data.sistema_origem ?? '').trim().toUpperCase() || null;
      if (!sistemaOrigem || !SISTEMAS_ORIGEM.has(sistemaOrigem)) {
        throw new BadRequestException(
          'Para a Via 1 (SGE/SGP), informe o Sistema de Origem (SGE ou SGP).',
        );
      }
      codigoOrigem = (data.codigo_origem ?? '').trim() || null;
    }

    // RN-03: proponente externo exige instituição e tipo.
    let organizacaoExterna: string | null = null;
    let tipoInstituicao: string | null = null;
    if (canal === 'MAPEAMENTO_EXTERNO') {
      organizacaoExterna = (data.organizacao_externa ?? '').trim() || null;
      tipoInstituicao = (data.tipo_instituicao ?? '').trim().toUpperCase() || null;
      if (!organizacaoExterna) {
        throw new BadRequestException(
          'Para a Captação Externa, informe a instituição de origem.',
        );
      }
      if (!tipoInstituicao || !TIPOS_INSTITUICAO.has(tipoInstituicao)) {
        throw new BadRequestException(
          'Para a Captação Externa, informe um tipo de instituição válido.',
        );
      }
    }

    // RN-13: contexto da reunião (Via 3) preservado como observação inicial.
    const reuniaoContexto =
      canal === 'VIA_3' ? this.montarContextoReuniao(data) : null;

    return this.ingerir(
      data,
      {
        canal_codigo: canal,
        proponente_tipo: proponenteTipo,
        organizacao_externa: organizacaoExterna,
        tipo_instituicao: tipoInstituicao,
        sistema_origem: sistemaOrigem,
        codigo_origem: codigoOrigem,
        registrado_por_login: registradoPorLogin,
        relevancia_estrategica: relevancia,
      },
      { reuniaoContexto, autorObservacao: registradoPorLogin },
    );
  }

  /** Relevância enviada pelo analista, ou o padrão quando ausente/inválida. */
  private normalizarRelevancia(valor?: string | null): string {
    const v = (valor ?? '').trim().toUpperCase();
    return RELEVANCIAS_VALIDAS.has(v) ? v : RELEVANCIA_PADRAO;
  }

  private montarContextoReuniao(data: CreateManualIniciativaDto): string | null {
    const partes: string[] = [];
    if (data.data_reuniao) partes.push(`Data da reunião: ${data.data_reuniao}`);
    if (data.area_reuniao) partes.push(`Área participante: ${data.area_reuniao.trim()}`);
    if (!partes.length) return null;
    return `Contexto da reunião (Via 3) — ${partes.join(' · ')}`;
  }

  /**
   * Camada de ingestão comum (ADR-013 §3.2): normaliza, carimba a origem, gera o
   * protocolo CODIGO_PUBLICO e cria o evento inicial SUBMISSAO — tudo numa única
   * transação, garantindo o contrato invariante de toda via.
   */
  private async ingerir(
    data: IniciativaCampos,
    origem: OrigemIngestao,
    extras?: { reuniaoContexto?: string | null; autorObservacao?: string | null },
  ): Promise<{ id: number; codigo_publico: string }> {
    const conn = await this.db.getConnection();
    try {
      const codigoPublico = await this.gerarCodigoPublico(conn);

      const sql = `
        INSERT INTO INOVACAO_INICIATIVAS (
          NOME_COLABORADOR, CANAL_CONTATO, EMAIL_PROPONENTE, TITULO_INICIATIVA,
          AREA_PROPONENTE, LOCAL_APLICACAO, PROBLEMA_PRATICO,
          SOLUCAO_PROPOSTA, RISCO_MITIGADO, ESTAGIO_DESENVOLVIMENTO,
          MACRODIMENSAO, MACRODIMENSAO_OBSERVACAO, PERFIL_IMPACTO, APORTE_FINANCEIRO,
          VALOR_APORTE, RETORNO_ECONOMICO, SUPORTE_NECESSARIO,
          DIAGNOSTICO_OBSERVACAO, COMENTARIOS_ADICIONAIS,
          CODIGO_PUBLICO, CANAL_CODIGO, PROPONENTE_TIPO, ORGANIZACAO_EXTERNA,
          TIPO_INSTITUICAO, SISTEMA_ORIGEM, CODIGO_ORIGEM, REGISTRADO_POR_LOGIN,
          RELEVANCIA_ESTRATEGICA,
          STATUS, CRIADO_EM, ATUALIZADO_EM
        ) VALUES (
          :1, :2, :3, :4, :5, :6, :7, :8, :9, :10,
          :11, :12, :13, :14, :15, :16, :17, :18, :19,
          :20, :21, :22, :23, :24, :25, :26, :27, :28,
          'SUBMETIDA', SYSDATE, SYSDATE
        ) RETURNING ID INTO :29
      `;

      const idVar = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      const result = await conn.execute(sql, [
        data.nome_colaborador ?? null,
        data.canal_contato ?? null,
        data.email_proponente ?? null,
        data.titulo_iniciativa,
        data.area_proponente,
        data.local_aplicacao,
        data.problema_pratico,
        data.solucao_proposta ?? null,
        data.risco_mitigado ?? null,
        data.estagio_desenvolvimento ?? null,
        data.macrodimensao ?? null,
        data.macrodimensao_observacao ?? null,
        data.perfil_impacto ?? null,
        data.aporte_financeiro ?? null,
        data.valor_aporte ?? null,
        data.retorno_economico ?? null,
        data.suporte_necessario ?? null,
        data.diagnostico_observacao ?? null,
        data.comentarios_adicionais ?? null,
        codigoPublico,
        origem.canal_codigo,
        origem.proponente_tipo,
        origem.organizacao_externa ?? null,
        origem.tipo_instituicao ?? null,
        origem.sistema_origem ?? null,
        origem.codigo_origem ?? null,
        origem.registrado_por_login ?? null,
        origem.relevancia_estrategica,
        idVar,
      ]);

      // RETURNING INTO com binds posicionais devolve um array de linhas por bind
      // OUT (mesmo padrão de AdminService.criarAdmin): outBinds[0] === [id].
      const iniciativaId: number = (result.outBinds as number[][])[0][0];

      // RN-08: evento inicial obrigatório, com o login de quem cadastrou.
      await conn.execute(
        `INSERT INTO HISTORICO_STATUS
           (iniciativa_id, status_anterior, status_novo, tipo_evento, usuario_login, data_hora)
         VALUES (:1, NULL, 'SUBMETIDA', 'SUBMISSAO', :2, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
        [iniciativaId, origem.registrado_por_login ?? null],
      );

      // RN-13: contexto extra (ex.: reunião) preservado como observação inicial.
      if (extras?.reuniaoContexto) {
        await conn.execute(
          `INSERT INTO INICIATIVA_OBSERVACOES (iniciativa_id, usuario_login, texto, criado_em)
           VALUES (:1, :2, :3, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
          [iniciativaId, extras.autorObservacao ?? null, extras.reuniaoContexto],
        );
      }

      await conn.commit();

      // Só depois do commit: um aviso de iniciativa que a transação ainda podia
      // desfazer mandaria a Assessoria procurar um protocolo inexistente.
      this.avisarAssessoria({
        protocolo: codigoPublico,
        titulo: data.titulo_iniciativa,
        canal: origem.canal_codigo,
        proponente: data.nome_colaborador,
        area: data.area_proponente,
        organizacaoExterna: origem.organizacao_externa,
        registradoPor: origem.registrado_por_login,
      });

      return { id: iniciativaId, codigo_publico: codigoPublico };
    } finally {
      await conn.close();
    }
  }

  /**
   * Notificação à caixa institucional a cada cadastro, em qualquer via — o
   * gatilho fica na ingestão justamente para não depender de cada via lembrar
   * de chamá-lo. Best-effort: falha de e-mail nunca invalida o cadastro.
   */
  private avisarAssessoria(dados: {
    protocolo: string;
    titulo: string;
    canal: string;
    proponente?: string | null;
    area?: string | null;
    organizacaoExterna?: string | null;
    registradoPor?: string | null;
  }): void {
    void this.mail.sendAvisoNovaIniciativa(dados).catch((e) => {
      this.logger.error(
        `Falha inesperada ao tentar enviar o aviso interno de nova iniciativa: ${e?.message ?? e}`,
      );
    });
  }

  /** Gera o próximo protocolo INOV-AAAA-NNN dentro da conexão/transação corrente. */
  private async gerarCodigoPublico(conn: oracledb.Connection): Promise<string> {
    const result = await conn.execute(
      `SELECT 'INOV-' || TO_CHAR(SYSDATE, 'YYYY') || '-' ||
              LPAD(NVL(MAX(TO_NUMBER(SUBSTR(CODIGO_PUBLICO, 11))), 0) + 1, 3, '0') AS CODIGO
         FROM INOVACAO_INICIATIVAS
        WHERE CODIGO_PUBLICO LIKE 'INOV-' || TO_CHAR(SYSDATE, 'YYYY') || '-%'
          AND REGEXP_LIKE(CODIGO_PUBLICO, '^INOV-[0-9]{4}-[0-9]+$')`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as any[];
    return rows[0].CODIGO as string;
  }

  async listar(): Promise<object[]> {
    const sql = `
      SELECT ID, CODIGO_PUBLICO, TITULO_INICIATIVA, NOME_COLABORADOR, AREA_PROPONENTE,
             ESTAGIO_DESENVOLVIMENTO, NVL(STATUS, 'SUBMETIDA') AS STATUS,
             NVL(CANAL_CODIGO, 'VIA_2') AS CANAL_CODIGO,
             NVL(PROPONENTE_TIPO, 'INTERNO') AS PROPONENTE_TIPO,
             ORGANIZACAO_EXTERNA,
             NVL(RELEVANCIA_ESTRATEGICA, 'INDETERMINADA') AS RELEVANCIA_ESTRATEGICA,
             CLASSIFICACAO_INICIATIVA, CRIADO_EM
      FROM INOVACAO_INICIATIVAS
      ORDER BY CRIADO_EM DESC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((row) => this.normalize(row));
    } finally {
      await conn.close();
    }
  }

  /**
   * Base completa para exportação (ADR-014 §11.4).
   *
   * A listagem do painel devolve só as colunas da tabela em tela; o arquivo
   * exportado precisa do registro inteiro — as mesmas colunas do detalhe, para
   * todas as iniciativas. O ID interno fica de fora de propósito: é chave
   * técnica, e quem identifica a iniciativa fora do sistema é o protocolo
   * (CODIGO_PUBLICO).
   */
  async listarParaExport(): Promise<Record<string, unknown>[]> {
    const sql = `
      SELECT CODIGO_PUBLICO, NOME_COLABORADOR, CANAL_CONTATO, EMAIL_PROPONENTE,
             TITULO_INICIATIVA, AREA_PROPONENTE, LOCAL_APLICACAO,
             DBMS_LOB.SUBSTR(PROBLEMA_PRATICO,       32767, 1) AS PROBLEMA_PRATICO,
             DBMS_LOB.SUBSTR(SOLUCAO_PROPOSTA,       32767, 1) AS SOLUCAO_PROPOSTA,
             DBMS_LOB.SUBSTR(RISCO_MITIGADO,         32767, 1) AS RISCO_MITIGADO,
             ESTAGIO_DESENVOLVIMENTO, MACRODIMENSAO, MACRODIMENSAO_OBSERVACAO,
             PERFIL_IMPACTO, APORTE_FINANCEIRO, VALOR_APORTE, RETORNO_ECONOMICO,
             SUPORTE_NECESSARIO, DIAGNOSTICO_OBSERVACAO,
             DBMS_LOB.SUBSTR(COMENTARIOS_ADICIONAIS, 32767, 1) AS COMENTARIOS_ADICIONAIS,
             NVL(CANAL_CODIGO, 'VIA_2') AS CANAL_CODIGO,
             NVL(PROPONENTE_TIPO, 'INTERNO') AS PROPONENTE_TIPO,
             ORGANIZACAO_EXTERNA, TIPO_INSTITUICAO, SISTEMA_ORIGEM, CODIGO_ORIGEM,
             REGISTRADO_POR_LOGIN,
             NVL(RELEVANCIA_ESTRATEGICA, 'INDETERMINADA') AS RELEVANCIA_ESTRATEGICA,
             CLASSIFICACAO_INICIATIVA,
             CRIADO_EM, NVL(STATUS, 'SUBMETIDA') AS STATUS, ATUALIZADO_EM
      FROM INOVACAO_INICIATIVAS
      ORDER BY CRIADO_EM DESC
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as any[]).map((row) => this.normalize(row));
    } finally {
      await conn.close();
    }
  }

  async getById(id: number): Promise<object | null> {
    const sql = `
      SELECT ID, CODIGO_PUBLICO, NOME_COLABORADOR, CANAL_CONTATO, EMAIL_PROPONENTE,
             TITULO_INICIATIVA, AREA_PROPONENTE, LOCAL_APLICACAO,
             DBMS_LOB.SUBSTR(PROBLEMA_PRATICO,       32767, 1) AS PROBLEMA_PRATICO,
             DBMS_LOB.SUBSTR(SOLUCAO_PROPOSTA,       32767, 1) AS SOLUCAO_PROPOSTA,
             DBMS_LOB.SUBSTR(RISCO_MITIGADO,         32767, 1) AS RISCO_MITIGADO,
             ESTAGIO_DESENVOLVIMENTO, MACRODIMENSAO, MACRODIMENSAO_OBSERVACAO,
             PERFIL_IMPACTO, APORTE_FINANCEIRO, VALOR_APORTE, RETORNO_ECONOMICO,
             SUPORTE_NECESSARIO, DIAGNOSTICO_OBSERVACAO,
             DBMS_LOB.SUBSTR(COMENTARIOS_ADICIONAIS, 32767, 1) AS COMENTARIOS_ADICIONAIS,
             NVL(CANAL_CODIGO, 'VIA_2') AS CANAL_CODIGO,
             NVL(PROPONENTE_TIPO, 'INTERNO') AS PROPONENTE_TIPO,
             ORGANIZACAO_EXTERNA, TIPO_INSTITUICAO, SISTEMA_ORIGEM, CODIGO_ORIGEM,
             REGISTRADO_POR_LOGIN,
             NVL(RELEVANCIA_ESTRATEGICA, 'INDETERMINADA') AS RELEVANCIA_ESTRATEGICA,
             CLASSIFICACAO_INICIATIVA,
             CRIADO_EM, NVL(STATUS, 'SUBMETIDA') AS STATUS, ATUALIZADO_EM
      FROM INOVACAO_INICIATIVAS
      WHERE ID = :1
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [id], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = result.rows as any[];
      if (!rows.length) return null;
      return this.normalize(rows[0]);
    } finally {
      await conn.close();
    }
  }

  /**
   * Edição administrativa (ADM) de uma iniciativa persistida. Atualiza apenas
   * os campos de conteúdo enviados (os demais permanecem intactos). Não altera
   * status, protocolo, canal nem tipo de proponente.
   *
   * Devolve a descrição legível das alterações de campos sensíveis (relevância
   * estratégica e classificação Ação/Projeto) para que o controller as registre
   * individualmente em INOVACAO_LOGS (ADR-008 / ADR-015 §9).
   */
  async atualizar(id: number, dto: UpdateIniciativaDto): Promise<string[]> {
    const conn = await this.db.getConnection();
    try {
      // O "antes" é lido na mesma conexão da escrita: dá o canal (para a regra
      // de proponente) e os valores auditados exatamente como estão ao gravar.
      const atual = await this.carregarEstadoAtual(conn, id);
      if (!atual) {
        throw new NotFoundException(`Iniciativa #${id} não encontrada`);
      }

      this.validarCamposObrigatorios(dto, atual.CANAL_CODIGO);

      const { sql, binds } = this.montarUpdate(id, dto);
      const alteracoes = this.diffCamposAuditados(atual, dto);

      const result = await conn.execute(sql, binds);
      if (!result.rowsAffected) {
        throw new NotFoundException(`Iniciativa #${id} não encontrada`);
      }
      await conn.commit();
      return alteracoes;
    } finally {
      await conn.close();
    }
  }

  /**
   * Impede que a edição esvazie campos que o banco exige (ORA-01407) ou que a
   * regra de negócio exige (RN-15). Só os campos efetivamente enviados são
   * verificados — o PATCH continua parcial.
   */
  private validarCamposObrigatorios(dto: UpdateIniciativaDto, canal: string | null): void {
    const exigidos = canal === 'MAPEAMENTO_EXTERNO'
      ? CAMPOS_OBRIGATORIOS
      : { ...CAMPOS_OBRIGATORIOS, ...CAMPOS_PROPONENTE };

    for (const [campo, rotulo] of Object.entries(exigidos)) {
      const valor = (dto as Record<string, unknown>)[campo];
      if (valor === undefined) continue;
      if (typeof valor !== 'string' || !valor.trim()) {
        throw new BadRequestException(`Não é possível deixar ${rotulo} em branco.`);
      }
    }
  }

  /** Monta o UPDATE parcial: só os campos enviados entram no SET. */
  private montarUpdate(
    id: number,
    dto: UpdateIniciativaDto,
  ): { sql: string; binds: unknown[] } {
    // Mapa coluna → valor, na ordem de bind. `undefined` = campo não enviado.
    const campos: Record<string, unknown> = {
      NOME_COLABORADOR: dto.nome_colaborador,
      CANAL_CONTATO: dto.canal_contato,
      EMAIL_PROPONENTE: dto.email_proponente,
      TITULO_INICIATIVA: dto.titulo_iniciativa,
      AREA_PROPONENTE: dto.area_proponente,
      LOCAL_APLICACAO: dto.local_aplicacao,
      PROBLEMA_PRATICO: dto.problema_pratico,
      SOLUCAO_PROPOSTA: dto.solucao_proposta,
      RISCO_MITIGADO: dto.risco_mitigado,
      ESTAGIO_DESENVOLVIMENTO: dto.estagio_desenvolvimento,
      MACRODIMENSAO: dto.macrodimensao,
      MACRODIMENSAO_OBSERVACAO: dto.macrodimensao_observacao,
      PERFIL_IMPACTO: dto.perfil_impacto,
      APORTE_FINANCEIRO: dto.aporte_financeiro,
      VALOR_APORTE: dto.valor_aporte,
      RETORNO_ECONOMICO: dto.retorno_economico,
      SUPORTE_NECESSARIO: dto.suporte_necessario,
      DIAGNOSTICO_OBSERVACAO: dto.diagnostico_observacao,
      COMENTARIOS_ADICIONAIS: dto.comentarios_adicionais,
      RELEVANCIA_ESTRATEGICA: dto.relevancia_estrategica,
      CLASSIFICACAO_INICIATIVA: dto.classificacao_iniciativa,
    };

    const sets: string[] = [];
    const binds: unknown[] = [];
    let i = 1;
    for (const [coluna, valor] of Object.entries(campos)) {
      if (valor !== undefined) {
        sets.push(`${coluna} = :${i}`);
        // Texto sem conteúdo vira NULL (campos opcionais); os obrigatórios já
        // foram barrados antes. Demais valores seguem como vieram.
        const normalizado = typeof valor === 'string' ? valor.trim() : valor;
        binds.push(normalizado === '' ? null : normalizado);
        i++;
      }
    }

    if (!sets.length) {
      throw new BadRequestException('Nenhum campo para atualizar.');
    }

    sets.push('ATUALIZADO_EM = SYSDATE');
    binds.push(id); // WHERE ID = :i

    return {
      sql: `UPDATE INOVACAO_INICIATIVAS SET ${sets.join(', ')} WHERE ID = :${i}`,
      binds,
    };
  }

  /** Estado persistido necessário à validação e à auditoria da edição. */
  private async carregarEstadoAtual(
    conn: oracledb.Connection,
    id: number,
  ): Promise<Record<string, string | null> | null> {
    const result = await conn.execute(
      `SELECT CANAL_CODIGO, RELEVANCIA_ESTRATEGICA, CLASSIFICACAO_INICIATIVA
         FROM INOVACAO_INICIATIVAS WHERE ID = :1`,
      [id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as Record<string, string | null>[];
    return rows.length ? rows[0] : null;
  }

  /**
   * Compara os campos sensíveis enviados com o valor persistido e descreve as
   * mudanças reais ("Relevância estratégica: X → Y"). Campos não enviados ou
   * sem alteração efetiva não geram entrada de auditoria.
   */
  private diffCamposAuditados(
    atual: Record<string, string | null>,
    dto: UpdateIniciativaDto,
  ): string[] {
    const auditados: Array<{
      coluna: string;
      rotulo: string;
      labels: Record<string, string>;
      novo?: string | null;
    }> = [
      {
        coluna: 'RELEVANCIA_ESTRATEGICA',
        rotulo: 'Relevância estratégica',
        labels: RELEVANCIA_LABEL,
        novo: dto.relevancia_estrategica,
      },
      {
        coluna: 'CLASSIFICACAO_INICIATIVA',
        rotulo: 'Classificação',
        labels: CLASSIFICACAO_LABEL,
        novo: dto.classificacao_iniciativa,
      },
    ];

    const pendentes = auditados.filter((c) => c.novo !== undefined);
    if (!pendentes.length) return [];

    const rotular = (labels: Record<string, string>, valor: unknown): string => {
      const v = (valor ?? '') === '' ? null : String(valor);
      return v ? labels[v] ?? v : 'não definido';
    };

    return pendentes
      .map((c) => {
        const antes = atual[c.coluna] ?? null;
        const depois = (c.novo ?? '') === '' ? null : c.novo;
        if (antes === depois) return null;
        return `${c.rotulo}: ${rotular(c.labels, antes)} → ${rotular(c.labels, depois)}`;
      })
      .filter((d): d is string => d !== null);
  }

  private normalize(row: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      normalized[key.toLowerCase()] = row[key];
    }
    return normalized;
  }
}
