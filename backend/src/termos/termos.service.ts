import { Injectable, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';

export type TermosAcao = 'ACEITE' | 'RECUSA';

/**
 * Serviço dos Termos e Condições de Uso (ADR-014 §12-bis).
 *
 * Guarda o estado autoritativo (versionado) do aceite/recusa por login em
 * TERMOS_ACEITES. A auditoria em INOVACAO_LOGS é feita pelo controller via
 * AuthService (segunda camada — ADR-008).
 */
@Injectable()
export class TermosService {
  private readonly logger = new Logger(TermosService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Versão vigente dos termos (env TERMOS_VERSAO). */
  get versaoAtual(): string {
    return (process.env.TERMOS_VERSAO ?? '1.0').trim() || '1.0';
  }

  /**
   * Última decisão do usuário para a versão vigente. `aceito` só é verdadeiro
   * quando a ação mais recente for ACEITE — assim uma recusa (ou versão nova)
   * volta a exigir o aceite.
   */
  async status(login: string): Promise<{ aceito: boolean; versaoAtual: string }> {
    const versao = this.versaoAtual;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(
        `SELECT acao
           FROM TERMOS_ACEITES
          WHERE login = :1 AND versao_termos = :2
          ORDER BY registrado_em DESC
          FETCH FIRST 1 ROWS ONLY`,
        [login, versao],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = result.rows as any[];
      const aceito = rows.length > 0 && rows[0].ACAO === 'ACEITE';
      return { aceito, versaoAtual: versao };
    } catch (e: any) {
      // Tabela ausente (ORA-00942) ou falha: trata como "não aceito" (fail-safe).
      if (e?.errorNum !== 942) {
        this.logger.error(`Erro ao consultar status dos termos: ${e?.message ?? e}`);
      }
      return { aceito: false, versaoAtual: versao };
    } finally {
      await conn.close();
    }
  }

  /** Grava a decisão do usuário (aceite/recusa) para a versão vigente. */
  async registrar(
    login: string,
    acao: TermosAcao,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{ versao: string }> {
    const versao = this.versaoAtual;
    const conn = await this.db.getConnection();
    try {
      await conn.execute(
        `INSERT INTO TERMOS_ACEITES (login, versao_termos, acao, ip, user_agent, registrado_em)
         VALUES (:1, :2, :3, :4, :5, SYS_EXTRACT_UTC(SYSTIMESTAMP))`,
        [login, versao, acao, ip, userAgent ? userAgent.slice(0, 400) : null],
      );
      await conn.commit();
      return { versao };
    } finally {
      await conn.close();
    }
  }
}
