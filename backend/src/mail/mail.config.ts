/**
 * Nomes de variáveis de e-mail — e por que são dois namespaces.
 *
 * `SMTP_*` (sem prefixo): parâmetros de transporte. `SMTP_SERVER` é o mesmo
 * nome que o cron de notificação de deploy da infra usa nos servidores, e com
 * o mesmo valor (`smtp.cedae.corp`) — herdar aqui não muda para onde o e-mail
 * vai. Os demais não existem no ambiente do host.
 *
 * `INOVACAO_MAIL_FROM` / `INOVACAO_MAIL_FROM_NAME`: identidade do remetente.
 * Estas mantêm o prefixo porque `MAIL_FROM` e `MAIL_FROM_NAME` *existem* no
 * ambiente dos servidores (`MAIL_FROM=deploy@cedae.com.br`), e já houve e-mail
 * da Via 2 saindo assinado como deploy@. O prefixo é a única coisa que impede
 * isso — não é estilo.
 *
 * Ler estes nomes e só eles: nenhum fallback silencioso para nome antigo ou
 * para o nome nu do servidor. O que existe é diagnóstico alto (ver
 * `renomeadasPendentes`), para que um deploy com a configuração antiga apareça
 * no log e no /api/health em vez de virar "e-mail parou e ninguém sabe".
 */

/**
 * Transporte — nomes nus. Não há usuário/senha: o relay interno libera por
 * whitelist de IP, então o app nunca autentica no SMTP.
 */
export const CHAVES_SMTP = [
  'SMTP_ENABLED',
  'SMTP_SERVER',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_TLS_REJECT_UNAUTHORIZED',
] as const;

/** Remetente — prefixadas, por colidirem com o ambiente do servidor. */
export const CHAVES_REMETENTE = ['INOVACAO_MAIL_FROM', 'INOVACAO_MAIL_FROM_NAME'] as const;

export const CHAVES_EMAIL: readonly string[] = [...CHAVES_SMTP, ...CHAVES_REMETENTE];

/** Nomes já usados por este app em versões anteriores → nome atual. */
export const RENOMEADAS: Readonly<Record<string, string>> = {
  INOVACAO_MAIL_ENABLED: 'SMTP_ENABLED',
  INOVACAO_SMTP_HOST: 'SMTP_SERVER',
  SMTP_HOST: 'SMTP_SERVER',
  INOVACAO_SMTP_PORT: 'SMTP_PORT',
  INOVACAO_SMTP_SECURE: 'SMTP_SECURE',
  INOVACAO_SMTP_TLS_REJECT_UNAUTHORIZED: 'SMTP_TLS_REJECT_UNAUTHORIZED',
};

/**
 * Valor de uma variável, sem espaços e sem aspas externas.
 *
 * O strip de aspas existe porque o valor pode chegar com as aspas dentro dele
 * (visto em homologação: `MAIL_FROM_NAME="CEDAE Inovação"`), o que produziria
 * um header From inválido.
 */
export function ler(nome: string): string | undefined {
  return process.env[nome]?.trim().replace(/^"(.*)"$/s, '$1').trim() || undefined;
}

export function ligado(): boolean {
  return (ler('SMTP_ENABLED') ?? 'false').toLowerCase() === 'true';
}

/**
 * Configuração num nome que o app não lê mais — `INOVACAO_SMTP_HOST` ou
 * `SMTP_HOST` definida enquanto `SMTP_SERVER` não existe. Sem isso, um
 * Portainer que não foi atualizado desliga o e-mail em silêncio.
 */
export function renomeadasPendentes(): string[] {
  return Object.entries(RENOMEADAS)
    .filter(([antiga, nova]) => process.env[antiga] !== undefined && process.env[nova] === undefined)
    .map(([antiga, nova]) => `${antiga} → ${nova}`);
}

/**
 * Variáveis de remetente sem prefixo presentes no ambiente: são do servidor,
 * e continuam ignoradas. Só interessa avisar quando o app *não* tem a sua.
 */
export function remetenteDoServidorIgnorado(): string[] {
  return ['MAIL_FROM', 'MAIL_FROM_NAME']
    .filter((nome) => process.env[nome] !== undefined && process.env[`INOVACAO_${nome}`] === undefined)
    .map((nome) => `${nome} (use INOVACAO_${nome})`);
}
