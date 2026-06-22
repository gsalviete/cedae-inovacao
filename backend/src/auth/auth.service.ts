import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  validateCredentials(username: string, password: string): boolean {
    console.log("recebido");
    console.log("username", username);
    console.log("password", password);

    console.log("esperado");
    console.log("adminUsername", process.env.ADMIN_USERNAME);
    console.log("adminPassword", process.env.ADMIN_PASSWORD);
    console.log("senha", password == process.env.ADMIN_PASSWORD);
    console.log("usuario", username == process.env.ADMIN_USERNAME);

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    return username === adminUsername && password === adminPassword;
  }

  generateToken(username: string): { access_token: string; is_admin: boolean } {
    const adminUsername = process.env.ADMIN_USERNAME;
    const is_admin = username === adminUsername;
    const payload = { sub: username, is_admin };
    const access_token = this.jwtService.sign(payload);
    return { access_token, is_admin };
  }

  async registrarLog(
    username: string,
    acao: string,
    detalhe: string | null = null,
  ): Promise<void> {
    const sql = `
      INSERT INTO INOVACAO_LOGS (USERNAME, ACAO, DETALHE, CRIADO_EM)
      VALUES (:1, :2, :3, SYSDATE)
    `;
    try {
      const conn = await this.db.getConnection();
      try {
        await conn.execute(sql, [username, acao, detalhe]);
        await conn.commit();
      } finally {
        await conn.close();
      }
    } catch (e) {
      console.error('Falha ao registrar auditoria no Oracle (Tabela INOVACAO_LOGS pode estar em falta):', e);
      // Fail silently to not block login
    }
  }
}
