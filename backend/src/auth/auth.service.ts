import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';
import * as oracledb from 'oracledb';

export interface AuthUser {
  id: string | number;
  login: string;
  perfis: string[];
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdminIfEmpty();
  }

  async validateCredentials(username: string, password: string): Promise<AuthUser | null> {
    // 1. Tenta autenticação via USUARIOS (banco)
    const dbUser = await this.findUserByLogin(username);
    if (dbUser !== null) {
      if (!dbUser.ativo) return null;
      const valid = dbUser.senha_hash
        ? await bcrypt.compare(password, dbUser.senha_hash)
        : false;
      if (valid) {
        return { id: dbUser.id, login: dbUser.login, perfis: dbUser.perfis };
      }
      // Usuário encontrado mas senha errada — não cai no fallback
      return null;
    }

    // 2. Fallback para credenciais de ambiente (TEMPORÁRIO — remover em E3-S05)
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (adminUser && adminPass && username === adminUser && password === adminPass) {
      this.logger.warn('[WARN] Autenticação via credencial legada (env var) — migrar para conta DB');
      return { id: adminUser, login: adminUser, perfis: ['ADMINISTRADOR'] };
    }

    return null;
  }

  private async findUserByLogin(login: string): Promise<{
    id: number; login: string; senha_hash: string | null;
    ativo: boolean; perfis: string[];
  } | null> {
    const sql = `
      SELECT u.id, u.login, u.senha_hash, u.ativo,
             NVL(
               LISTAGG(p.codigo, ',') WITHIN GROUP (ORDER BY p.codigo),
               ''
             ) AS perfis_str
      FROM USUARIOS u
      LEFT JOIN USUARIOS_PERFIS up ON up.usuario_id = u.id AND up.revogado_em IS NULL
      LEFT JOIN PERFIS_ACESSO p    ON p.id = up.perfil_id
      WHERE u.login = :1
      GROUP BY u.id, u.login, u.senha_hash, u.ativo
    `;
    try {
      const conn = await this.db.getConnection();
      try {
        const result = await conn.execute(sql, [login], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        const rows = result.rows as any[];
        if (!rows || rows.length === 0) return null;
        const r = rows[0];
        return {
          id: r.ID,
          login: r.LOGIN,
          senha_hash: r.SENHA_HASH,
          ativo: r.ATIVO === 1,
          perfis: r.PERFIS_STR ? r.PERFIS_STR.split(',').filter(Boolean) : [],
        };
      } finally {
        await conn.close();
      }
    } catch (e: any) {
      if (e?.errorNum === 942) return null; // ORA-00942: tabela não existe ainda
      this.logger.error('Erro ao buscar usuário:', e?.message);
      return null;
    }
  }

  generateToken(user: AuthUser): string {
    const is_admin = user.perfis.includes('ADMINISTRADOR');
    const payload = { sub: user.id, login: user.login, perfis: user.perfis, is_admin };
    return this.jwtService.sign(payload);
  }

  private async seedAdminIfEmpty(): Promise<void> {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminUsername || !adminPassword) return;

    try {
      const conn = await this.db.getConnection();
      try {
        // Verifica se USUARIOS existe
        const tblCheck = await conn.execute(
          "SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = 'USUARIOS'",
          [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        if ((tblCheck.rows as any[])[0].CNT === 0) return;

        // Verifica se já existe algum usuário admin
        const userCheck = await conn.execute(
          'SELECT COUNT(*) AS CNT FROM USUARIOS WHERE login = :1',
          [adminUsername], { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        if ((userCheck.rows as any[])[0].CNT > 0) return;

        const hash = await bcrypt.hash(adminPassword, 10);
        const idVar = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
        const insertResult = await conn.execute(
          `INSERT INTO USUARIOS (login, nome_completo, email, senha_hash, ativo, criado_em, atualizado_em)
           VALUES (:1, :2, :3, :4, 1, SYSTIMESTAMP, SYSTIMESTAMP) RETURNING id INTO :5`,
          [adminUsername, 'Administrador do Sistema', adminUsername + '@cedae.rj.gov.br', hash, idVar],
        );
        await conn.commit();
        const adminId = (insertResult.outBinds as any[])[0];

        // Verifica PERFIS_ACESSO e USUARIOS_PERFIS
        const perfilCheck = await conn.execute(
          "SELECT id FROM PERFIS_ACESSO WHERE codigo = 'ADMINISTRADOR' AND ROWNUM = 1",
          [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        const perfilRows = perfilCheck.rows as any[];
        if (!perfilRows.length) return;

        const upTbl = await conn.execute(
          "SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = 'USUARIOS_PERFIS'",
          [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        if ((upTbl.rows as any[])[0].CNT === 0) return;

        await conn.execute(
          'INSERT INTO USUARIOS_PERFIS (usuario_id, perfil_id, concedido_em, concedido_por_id) VALUES (:1, :2, SYSTIMESTAMP, :3)',
          [adminId, perfilRows[0].ID, adminId],
        );
        await conn.commit();
        this.logger.log(`Usuário admin '${adminUsername}' criado no banco com perfil ADMINISTRADOR`);
      } finally {
        await conn.close();
      }
    } catch (e: any) {
      this.logger.error('Erro ao criar usuário admin inicial:', e?.message);
    }
  }

  async registrarLog(username: string, acao: string, detalhe: string | null = null): Promise<void> {
    const sql = `INSERT INTO INOVACAO_LOGS (USERNAME, ACAO, DETALHE, CRIADO_EM) VALUES (:1, :2, :3, SYSDATE)`;
    try {
      const conn = await this.db.getConnection();
      try {
        await conn.execute(sql, [username, acao, detalhe]);
        await conn.commit();
      } finally {
        await conn.close();
      }
    } catch {
      // Log de auditoria nunca deve quebrar operação principal
    }
  }
}
