import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { Client, InvalidCredentialsError, type Entry } from 'ldapts';
import type { LdapConfig, LdapTlsRequireCert, LdapUser } from './ldap.types';

/** Erro lançado quando as credenciais são inválidas ou o usuário não existe no AD. */
export class LdapAuthError extends Error {
  constructor(message = 'Credenciais inválidas') {
    super(message);
    this.name = 'LdapAuthError';
  }
}

/** Erro lançado quando o AD está inacessível / mal configurado (não é culpa do usuário). */
export class LdapUnavailableError extends Error {
  constructor(message = 'Serviço de diretório indisponível') {
    super(message);
    this.name = 'LdapUnavailableError';
  }
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);

  /**
   * Autentica um usuário no Active Directory via LDAPS.
   *
   * Fluxo: monta a config, faz bind como `DOMINIO\usuario`, pesquisa o usuário
   * pelo sAMAccountName e retorna seus atributos. A senha nunca é registrada.
   *
   * @throws {LdapAuthError}        bind rejeitado (usuário/senha inválidos).
   * @throws {LdapUnavailableError} falha de conexão/TLS/configuração do AD.
   */
  async authenticate(username: string, password: string): Promise<LdapUser> {
    const sam = this.extractSamAccountName(username);
    if (!sam || !password) {
      throw new LdapAuthError();
    }

    const config = this.loadConfig();
    const client = this.createClient(config);
    const bindDn = `${config.domain}\\${sam}`;

    try {
      // Bind com as credenciais do próprio usuário: é a validação da senha.
      await client.bind(bindDn, password);
    } catch (err) {
      await this.safeUnbind(client);
      // Código 49 (InvalidCredentials) = usuário/senha inválidos (inclui conta
      // desabilitada/expirada no AD). Qualquer outra falha (conexão recusada,
      // TLS, timeout) é problema de infraestrutura, não credencial.
      if (err instanceof InvalidCredentialsError) {
        this.logger.warn(`Bind LDAP rejeitado para "${sam}" (credenciais).`);
        throw new LdapAuthError();
      }
      this.logger.error(`Falha ao conectar/bind no AD para "${sam}": ${this.describe(err)}`);
      throw new LdapUnavailableError();
    }

    try {
      const entry = await this.findUser(client, config, sam);
      if (!entry) {
        this.logger.warn(`Usuário "${sam}" autenticou mas não foi encontrado na busca.`);
        throw new LdapAuthError();
      }
      return this.toLdapUser(entry, sam);
    } catch (err) {
      if (err instanceof LdapAuthError) throw err;
      this.logger.error(`Falha ao pesquisar usuário "${sam}": ${this.describe(err)}`);
      throw new LdapUnavailableError();
    } finally {
      await this.safeUnbind(client);
    }
  }

  /** Verifica (case-insensitive) se o usuário pertence a um grupo pelo nome (CN). */
  isMemberOf(user: LdapUser, groupName: string): boolean {
    const target = groupName.trim().toLowerCase();
    if (!target) return false;
    return user.groups.some((g) => g.toLowerCase() === target);
  }

  // ── Infraestrutura ────────────────────────────────────────────────────────

  /** Lê e valida as variáveis de ambiente LDAP_*. */
  private loadConfig(): LdapConfig {
    const url = (process.env.LDAP_HOST ?? '').trim();
    const baseDn = (process.env.LDAP_BASE_DN ?? '').trim();
    const domain = (process.env.LDAP_DOMAIN ?? '').trim();

    if (!url || !baseDn || !domain) {
      this.logger.error('Configuração LDAP incompleta (LDAP_HOST/LDAP_BASE_DN/LDAP_DOMAIN).');
      throw new LdapUnavailableError();
    }

    const port = Number(process.env.LDAP_PORT ?? '636') || 636;
    const networkTimeout = Number(process.env.LDAP_NETWORK_TIMEOUT ?? '8000') || 8000;
    const tlsRequireCert = this.parseRequireCert(process.env.LDAP_TLS_REQUIRE_CERT);
    const caCert = this.loadCaCert(process.env.LDAP_CA_FILE);

    return {
      url,
      port,
      baseDn,
      domain,
      group: (process.env.LDAP_GROUP ?? '').trim(),
      caCert,
      tlsRequireCert,
      networkTimeout,
    };
  }

  private parseRequireCert(raw: string | undefined): LdapTlsRequireCert {
    return (raw ?? '').trim().toLowerCase() === 'demand' ? 'demand' : 'allow';
  }

  private loadCaCert(path: string | undefined): Buffer | undefined {
    const file = (path ?? '').trim();
    if (!file) return undefined;
    if (!existsSync(file)) {
      this.logger.warn(`LDAP_CA_FILE definido mas arquivo não encontrado: ${file}`);
      return undefined;
    }
    try {
      return readFileSync(file);
    } catch (err) {
      this.logger.warn(`Falha ao ler LDAP_CA_FILE (${file}): ${this.describe(err)}`);
      return undefined;
    }
  }

  private createClient(config: LdapConfig): Client {
    const secure = config.url.toLowerCase().startsWith('ldaps://');
    return new Client({
      url: config.url,
      timeout: config.networkTimeout,
      connectTimeout: config.networkTimeout,
      // Bind é feito com `DOMINIO\usuario` (não é um DN RFC-4514 válido); a
      // parse estrita quebraria esse formato aceito pelo AD.
      strictDN: false,
      tlsOptions: secure
        ? {
            rejectUnauthorized: config.tlsRequireCert === 'demand',
            ...(config.caCert ? { ca: config.caCert } : {}),
          }
        : undefined,
    });
  }

  private async findUser(
    client: Client,
    config: LdapConfig,
    sam: string,
  ): Promise<Entry | undefined> {
    const { searchEntries } = await client.search(config.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${this.escapeFilter(sam)}))`,
      attributes: ['displayName', 'mail', 'sAMAccountName', 'memberOf'],
      sizeLimit: 1,
    });
    return searchEntries[0];
  }

  private toLdapUser(entry: Entry, fallbackSam: string): LdapUser {
    return {
      username: this.firstString(entry.sAMAccountName) || fallbackSam,
      displayName: this.firstString(entry.displayName),
      email: this.firstString(entry.mail),
      groups: this.stringArray(entry.memberOf)
        .map((dn) => this.extractCn(dn))
        .filter((cn): cn is string => cn.length > 0),
    };
  }

  private async safeUnbind(client: Client): Promise<void> {
    try {
      await client.unbind();
    } catch {
      // Encerramento do socket não deve mascarar o resultado da autenticação.
    }
  }

  // ── Helpers puros ─────────────────────────────────────────────────────────

  /** Aceita `usuario`, `DOMINIO\usuario` ou `usuario@dominio` e devolve só o sAMAccountName. */
  private extractSamAccountName(raw: string): string {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return '';
    const withoutDomain = trimmed.includes('\\') ? trimmed.split('\\').pop()! : trimmed;
    return withoutDomain.includes('@') ? withoutDomain.split('@')[0] : withoutDomain;
  }

  /** Extrai o CN de um DN de grupo, ex.: `CN=sistemas.dev,OU=Grupos,DC=cedae,DC=corp` → `sistemas.dev`. */
  private extractCn(dn: string): string {
    const match = /^CN=([^,]+)/i.exec(dn.trim());
    return match ? match[1].trim() : '';
  }

  /** Escapa metacaracteres de filtro LDAP (RFC 4515) para evitar injeção. */
  private escapeFilter(value: string): string {
    return value.replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
  }

  private firstString(value: Entry[string] | undefined): string {
    if (value === undefined) return '';
    if (Array.isArray(value)) {
      const first = value[0];
      return first === undefined ? '' : this.firstString(first);
    }
    return Buffer.isBuffer(value) ? value.toString('utf8') : value;
  }

  private stringArray(value: Entry[string] | undefined): string[] {
    if (value === undefined) return [];
    const items = Array.isArray(value) ? value : [value];
    return items.map((v) => (Buffer.isBuffer(v) ? v.toString('utf8') : v));
  }

  private describe(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
