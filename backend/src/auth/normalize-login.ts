export function normalizeLogin(raw: string): string {
  const username = raw.includes('\\') ? raw.split('\\').pop()! : raw;
  return username.includes('@')
    ? username.toLowerCase()
    : `${username.toLowerCase()}@cedae.com.br`;
}
