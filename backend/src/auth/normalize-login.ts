/**
 * Login canônico do usuário — a chave usada em ADMIN_USERS, TERMOS_ACEITES,
 * INOVACAO_LOGS e REGISTRADO_POR_LOGIN.
 *
 * A identidade chega em formatos diferentes conforme a origem: `CEDAE\gsalviete`
 * ou `gsalviete@cedae.corp` do header que o IIS injeta, `gsalviete` cru do
 * `sAMAccountName` lido do diretório (INFRA.view_ad_user) e do DEV_REMOTE_USER.
 * Quando não vem domínio, ele é acrescentado — e é aí que mora a diferença
 * entre ambientes.
 *
 * O sufixo NÃO é o mesmo nos dois ambientes:
 *
 *   produção .......... `@cedae.corp`   (é o UPN que o AD/IIS devolve)
 *   desenvolvimento ... `@cedae.com.br`
 *
 * Isso não é preferência: em produção, cadastrar um administrador gravava
 * `fulano@cedae.com.br` (montado a partir do sAMAccountName) enquanto o IIS
 * autenticava `fulano@cedae.corp`. Os dois nunca batiam e a base de produção
 * ficou sem nenhum admin reconhecido.
 *
 * NODE_ENV é lido a cada chamada (custo desprezível): o valor é definido pelo
 * Dockerfile e o env.ts pode carregá-lo depois deste módulo ser importado —
 * fixar o domínio em uma constante de topo dependeria da ordem de import.
 */

const DOMINIO_PRODUCAO = 'cedae.corp';
const DOMINIO_DESENVOLVIMENTO = 'cedae.com.br';

/** Sufixo de login do ambiente corrente, sem o `@`. */
export function dominioLogin(): string {
  return (process.env.NODE_ENV ?? '').trim() === 'production'
    ? DOMINIO_PRODUCAO
    : DOMINIO_DESENVOLVIMENTO;
}

export function normalizeLogin(raw: string): string {
  const username = raw.includes('\\') ? raw.split('\\').pop()! : raw;
  return username.includes('@')
    ? username.toLowerCase()
    : `${username.toLowerCase()}@${dominioLogin()}`;
}

/**
 * Parte do login antes do `@` — o `sAMAccountName`. É o que identifica a pessoa
 * independentemente do sufixo de domínio, e por isso é a chave de consulta ao
 * diretório (INFRA.view_ad_user), que guarda a conta sem domínio.
 */
export function contaLogin(login: string): string {
  return normalizeLogin(login).split('@')[0];
}
