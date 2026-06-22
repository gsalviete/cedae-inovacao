import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async listarLogs(): Promise<any[]> {
    const sql = `
      SELECT * FROM INOVACAO_LOGS
      ORDER BY CRIADO_EM DESC
      FETCH FIRST 500 ROWS ONLY
    `;
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], {
        outFormat: require('oracledb').OUT_FORMAT_OBJECT,
      });
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

  async listarIniciativas(): Promise<any[]> {
    const sql = 'SELECT * FROM INOVACAO_INICIATIVAS ORDER BY CRIADO_EM DESC';
    const conn = await this.db.getConnection();
    try {
      const result = await conn.execute(sql, [], {
        outFormat: require('oracledb').OUT_FORMAT_OBJECT,
      });
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

  async getKpis(): Promise<any> {
    const iniciativas = await this.listarIniciativas();
    const total = iniciativas.length;

    const por_estagio: Record<string, number> = {};
    const por_dimensao: Record<string, number> = {};

    for (const i of iniciativas) {
      const estagio = i.estagio_desenvolvimento || 'Não informado';
      por_estagio[estagio] = (por_estagio[estagio] || 0) + 1;

      const dimensao = i.macrodimensao || 'Não informado';
      por_dimensao[dimensao] = (por_dimensao[dimensao] || 0) + 1;
    }

    return { total_iniciativas: total, por_estagio, por_dimensao };
  }

  async getAcessos(): Promise<any[]> {
    const logs = await this.listarLogs();
    return logs.filter((l) => l.acao === 'login');
  }
}
