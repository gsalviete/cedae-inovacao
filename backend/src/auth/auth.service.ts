import { Injectable, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { contaLogin } from './normalize-login';

/**
 * Erros que dizem "esta base não enxerga o diretório", e não "falhou agora":
 * tabela/view inexistente, objeto interno ausente e falta de privilégio. É o
 * caso do banco de testes, onde INFRA.view_ad_user não existe.
 */
const DIRETORIO_AUSENTE = new Set([942, 6564, 1031]);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Liga uma única vez quando o diretório não existe nesta base. Sem isso,
   * cada carregamento de página gastaria uma consulta condenada e despejaria o
   * mesmo aviso no log. Volta ao normal no próximo start.
   */
  private diretorioIndisponivel = false;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Quem é o requisitante e o que ele pode fazer.
   *
   * A autorização é e continua sendo ADMIN_USERS. O nome, não: ele existe para
   * todo mundo do domínio, não só para quem tem perfil no painel. Sem a busca
   * no diretório, quem preenche o formulário público sem ser admin era saudado
   * pelo login da máquina ("Bom dia, gsalviete!") — o nome só aparecia para
   * administradores, que são os únicos com NOME gravado em ADMIN_USERS.
   */
  async resolveUser(login: string): Promise<RequestUser> {
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(
        'SELECT login, nome, role FROM ADMIN_USERS WHERE login = :1 AND ativo = 1',
        [login],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = result.rows as any[];
      if (!rows.length) {
        return { login, nome: await this.nomeNoDiretorio(conn, login), role: null, admin: false };
      }
      const r = rows[0];
      return {
        login: r.LOGIN as string,
        nome: (r.NOME as string | null) ?? (await this.nomeNoDiretorio(conn, login)),
        role: (r.ROLE as 'ADM' | 'CONTRIBUTOR') ?? null,
        admin: true,
      };
    } catch (e: any) {
      if (e?.errorNum === 942) {
        return { login, nome: null, role: null, admin: false };
      }
      this.logger.error('Erro ao resolver usuário:', e?.message);
      return { login, nome: null, role: null, admin: false };
    } finally {
      await conn.close();
    }
  }

  /**
   * Nome do usuário no Active Directory (INFRA.view_ad_user), a mesma view que
   * o cadastro de administradores consulta. A busca é pelo `sAMAccountName` —
   * a parte antes do `@` —, porque o sufixo do login varia entre ambientes
   * (`@cedae.corp` em produção, `@cedae.com.br` em desenvolvimento) enquanto a
   * conta é sempre a mesma.
   *
   * Nunca interrompe a resolução: sem nome, a saudação cai no login, que é o
   * comportamento que já existia. Vale para conta de serviço, usuário fora do
   * diretório ou view indisponível — este último é o caso do banco de testes,
   * que não tem a view; lá a saudação continua pelo login.
   */
  private async nomeNoDiretorio(
    conn: oracledb.Connection,
    login: string,
  ): Promise<string | null> {
    if (this.diretorioIndisponivel) return null;
    try {
      const result = await conn.execute(
        `SELECT NAME
           FROM INFRA.view_ad_user
          WHERE UPPER(SAMACCOUNTNAME) = UPPER(:1)
            AND ROWNUM = 1`,
        [contaLogin(login)],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = result.rows as any[];
      const nome = rows.length ? ((rows[0].NAME as string | null) ?? '').trim() : '';
      return nome || null;
    } catch (e: any) {
      if (DIRETORIO_AUSENTE.has(e?.errorNum)) {
        this.diretorioIndisponivel = true;
        this.logger.warn(
          'INFRA.view_ad_user indisponível nesta base: o nome do usuário não ' +
            'será resolvido e a saudação usará o login.',
        );
        return null;
      }
      this.logger.warn(`Nome não resolvido no diretório para '${login}': ${e?.message}`);
      return null;
    }
  }

  async registrarLog(login: string, acao: string, detalhe: string | null = null): Promise<void> {
    const sql = `INSERT INTO INOVACAO_LOGS (USERNAME, ACAO, DETALHE, CRIADO_EM) VALUES (:1, :2, :3, SYSDATE)`;
    try {
      const conn = await this.db.getConnection();
      try {
        await conn.execute(sql, [login, acao, detalhe]);
        await conn.commit();
      } finally {
        await conn.close();
      }
    } catch {
      // Log nunca interrompe operação principal
    }
  }
}
