/**
 * Carregamento do arquivo de variáveis — precisa ser importado antes de
 * qualquer outro módulo que leia `process.env` no topo (ver main.ts).
 *
 * Um ambiente, um arquivo. Nunca são lidos dois:
 *
 *   ENV_FILE=/caminho/arquivo ... vence tudo (útil para um teste pontual);
 *   NODE_ENV=production ........ `.env`      (imagem/Portainer — o Dockerfile
 *                                             define NODE_ENV, então todo
 *                                             container cai aqui);
 *   qualquer outro caso ........ `.env.dev`, e `.env` só se `.env.dev` não
 *                                existir (desenvolvimento local).
 *
 * Carregar os dois em cascata seria pior que não carregar nenhum: uma variável
 * ausente do `.env.dev` cairia silenciosamente no valor de produção — é assim
 * que uma máquina de desenvolvimento escreve no banco de produção.
 *
 * Dois diretórios são procurados porque os scripts npm rodam de `backend/`
 * enquanto o arquivo vive na raiz do repositório; no container WORKDIR=/app já
 * é o lugar certo.
 *
 * `override: true`: quando o arquivo existe, ele é a fonte única de verdade e
 * vence o que estiver no ambiente do processo. Isso é o que impede uma variável
 * do host (o cron de deploy da infra define MAIL_ e SMTP_) de mudar o
 * comportamento do app pelas costas. Onde o arquivo não é montado — Portainer
 * configurando pela stack — nada é carregado e as variáveis do ambiente valem.
 */
import { config } from 'dotenv';
import { statSync } from 'fs';
import { join, resolve } from 'path';

const producao = (process.env.NODE_ENV ?? '').trim() === 'production';

/** Só arquivo conta: um bind mount para um caminho inexistente vira DIRETÓRIO. */
function ehArquivo(caminho: string): boolean {
  try {
    return statSync(caminho).isFile();
  } catch {
    return false;
  }
}

function candidatos(): string[] {
  const explicito = process.env.ENV_FILE?.trim();
  if (explicito) return [resolve(explicito)];

  // cwd = /app no container, backend/ nos scripts npm; o segundo é a raiz do
  // repositório vista de dist/ (dist → backend → raiz).
  const raizes = [
    ...new Set([resolve(process.cwd()), resolve(join(__dirname, '..', '..'))]),
  ];
  const nomes = producao ? ['.env'] : ['.env.dev', '.env'];

  return nomes.flatMap((nome) => raizes.map((raiz) => join(raiz, nome)));
}

const lista = candidatos();
const escolhido = lista.find(ehArquivo);

if (!escolhido) {
  console.warn(
    `[env] Nenhum arquivo de ambiente encontrado (tentados: ${lista.join(', ')}). ` +
      'Seguindo apenas com as variáveis já presentes no ambiente.',
  );
} else {
  const { error } = config({ path: escolhido, override: true });
  if (error) {
    console.error(`[env] Falha ao ler ${escolhido}: ${error.message}`);
  } else {
    console.log(`[env] Variáveis carregadas de: ${escolhido} (NODE_ENV=${process.env.NODE_ENV ?? '(vazio)'})`);
  }
}
