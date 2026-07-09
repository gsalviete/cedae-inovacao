/**
 * Tipos do módulo de autenticação LDAP (Active Directory via LDAPS).
 *
 * Estes contratos isolam o restante da aplicação dos detalhes da biblioteca
 * `ldapts`: o AuthController só conhece `LdapUser`, nunca a `Entry` crua do AD.
 */

/**
 * Como o certificado do servidor LDAPS é validado.
 * - `allow`  → conecta mesmo com certificado não confiável (rejectUnauthorized = false)
 * - `demand` → exige certificado válido/confiável (rejectUnauthorized = true)
 */
export type LdapTlsRequireCert = 'allow' | 'demand';

/**
 * Configuração resolvida a partir das variáveis de ambiente (ver LdapService).
 */
export interface LdapConfig {
  /** URL do servidor, ex.: `ldaps://dns3.cedae.corp` */
  readonly url: string;
  /** Porta do LDAPS (default 636). */
  readonly port: number;
  /** Base de busca, ex.: `DC=cedae,DC=corp` */
  readonly baseDn: string;
  /** Domínio NetBIOS usado no bind, ex.: `CEDAE`. */
  readonly domain: string;
  /** Grupo padrão autorizado (opcional). Vazio = qualquer usuário autenticado. */
  readonly group: string;
  /** Conteúdo do certificado da CA, quando LDAP_CA_FILE aponta para um arquivo válido. */
  readonly caCert?: Buffer;
  /** Política de validação do certificado TLS. */
  readonly tlsRequireCert: LdapTlsRequireCert;
  /** Timeout de rede em milissegundos (conexão e operações). */
  readonly networkTimeout: number;
}

/**
 * Usuário autenticado no AD, com os atributos relevantes já normalizados.
 * Nunca contém a senha.
 */
export interface LdapUser {
  /** sAMAccountName, ex.: `joao.silva`. */
  readonly username: string;
  /** displayName, ex.: `João da Silva`. */
  readonly displayName: string;
  /** mail, ex.: `joao.silva@cedae.com.br`. */
  readonly email: string;
  /** Nomes (CN) dos grupos extraídos de `memberOf`. */
  readonly groups: string[];
}
