/**
 * Carregamento do .env — precisa ser importado antes de qualquer outro módulo
 * que leia `process.env` no topo (ver main.ts).
 *
 * `dotenv/config` sozinho lê apenas `process.cwd()/.env`. No container isso
 * basta (WORKDIR=/app e o compose monta ./.env em /app/.env), mas os scripts
 * npm rodam de `backend/` enquanto o arquivo vive na raiz do repositório — daí
 * `pnpm start` local subir sem nenhuma variável e o e-mail virar no-op sem
 * explicação. Tentamos os dois caminhos e registramos qual venceu.
 *
 * Variáveis já presentes no ambiente (as que o compose injeta) têm precedência:
 * dotenv nunca sobrescreve o que já está definido.
 */
import { config } from 'dotenv';
import { join, resolve } from 'path';

// `resolve` + Set porque os dois candidatos apontam para o mesmo arquivo quando
// o processo já roda da raiz — sem isso o .env aparece duplicado no log.
const candidatos = [
  ...new Set([
    resolve(process.cwd(), '.env'),
    // dist/ → raiz do repositório (dev local, rodando de backend/).
    resolve(join(__dirname, '..', '..', '.env')),
  ]),
];

const carregados = candidatos.filter((p) => !config({ path: p }).error);

if (carregados.length === 0) {
  console.warn(
    `[env] Nenhum .env encontrado (tentados: ${candidatos.join(', ')}). ` +
      'Seguindo apenas com as variáveis já presentes no ambiente.',
  );
} else {
  console.log(`[env] Variáveis carregadas de: ${carregados.join(', ')}`);
}
