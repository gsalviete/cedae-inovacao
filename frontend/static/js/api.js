/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Cliente de API centralizado (api.js)
   BASE_PATH vem de window.__BASE_PATH__, embutido pelo servidor
   diretamente no HTML (ver main.ts). É o único ponto de prefixo usado
   tanto pelas chamadas fetch (API) quanto pela navegação entre
   páginas (goTo) — evita recalcular PROJECT_PATH em mais de um lugar.
   ══════════════════════════════════════════════════════ */

const BASE_PATH = window.__BASE_PATH__ || '';
const API = BASE_PATH;

function goTo(path) {
  window.location.href = `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/* ── Saudação do header ──────────────────────────────────
   Compartilhada pelas páginas do painel. Não há login nem logout: a identidade
   vem do header x-remote-user que o IIS injeta em toda requisição. */

/** Bom dia / Boa tarde / Boa noite conforme o horário local do usuário. */
function saudacaoPorHorario(hora = new Date().getHours()) {
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "Gabriel Salviete" → "Gabriel". Cai no login quando não há nome. */
function primeiroNome(me) {
  const nome = (me?.nome || '').trim();
  if (nome) return nome.split(/\s+/)[0];
  return (me?.login || '').split('@')[0];
}

/**
 * Preenche a saudação do header ("Boa tarde, Gabriel!") e a revela.
 * Silenciosamente não faz nada se a página não tiver o elemento.
 */
function renderGreeting(me) {
  const wrapper = document.getElementById('user-greeting');
  const timeEl = document.getElementById('user-greeting-time');
  const nameEl = document.getElementById('user-greeting-name');
  if (!wrapper || !timeEl || !nameEl) return;

  timeEl.textContent = `${saudacaoPorHorario()},`;
  nameEl.textContent = `${primeiroNome(me)}!`;
  wrapper.classList.remove('hidden');
}

/* ── Origem / Canais (ADR-013) ────────────────────────────
   Rótulos e badges estáveis por canal, compartilhados por todas as telas.
   Nunca expor o código cru (MAPEAMENTO_EXTERNO) na UI — sempre o rótulo. */
const CANAL_INFO = {
  VIA_1:              { curto: 'SGE/SGP',    nome: 'Registro de Sistemas Corporativos (SGE/SGP)', cls: 'badge-canal-via_1' },
  VIA_2:              { curto: 'Formulário', nome: 'Formulário Interno de Submissão',             cls: 'badge-canal-via_2' },
  VIA_3:              { curto: 'Reunião',    nome: 'Registro de Reuniões com Áreas',              cls: 'badge-canal-via_3' },
  MAPEAMENTO_EXTERNO: { curto: 'Externa',   nome: 'Captação Externa',                            cls: 'badge-canal-externo' },
};

function canalInfo(codigo) {
  return CANAL_INFO[codigo] || { curto: codigo || '—', nome: codigo || '—', cls: 'badge-default' };
}

/** Badge de origem para listagens. `full=true` usa o rótulo completo. */
function canalBadge(codigo, full = false) {
  const info = canalInfo(codigo);
  return `<span class="badge ${info.cls}" title="${info.nome}">${full ? info.nome : info.curto}</span>`;
}

/* `PARCERIA` saiu do cadastro (ADR-015 §6), mas continua no mapa: há registros
   gravados com esse valor e eles precisam de rótulo na listagem e no detalhe. */
const TIPO_INSTITUICAO_LABEL = {
  ICT:             'ICT',
  UNIVERSIDADE:    'Universidade',
  STARTUP:         'Startup',
  EMPRESA_PRIVADA: 'Empresa Privada',
  EMPRESA_PUBLICA: 'Empresa Pública',
  PARCERIA:        'Parceria (legado)',
  OUTRO:           'Outro',
};

/* ── Relevância estratégica e classificação (ADR-015) ─────
   Espelham os domínios do backend (`dominio-iniciativa.ts`). */
const RELEVANCIA_LABEL = {
  FINANCEIRO:               'Sim, por retorno financeiro',
  PLANEJAMENTO_ESTRATEGICO: 'Sim, por estar presente no Planejamento Estratégico',
  INDETERMINADA:            'Ainda não é possível determinar',
  SEM_RELEVANCIA:           'Não possui relevância estratégica',
};

const CLASSIFICACAO_LABEL = {
  ACAO:    'Ação',
  PROJETO: 'Projeto',
};

/* Opções de "Suporte Necessário" — mesma lista do formulário público (Bloco IV),
   reutilizada pela edição administrativa (ADR-015 §5.2). O valor persistido é a
   concatenação das chaves marcadas, separadas por "|". */
const SUPORTE_OPCOES = [
  { valor: 'instrumentos_juridicos', titulo: 'Modelagem de Instrumentos Técnicos e Jurídicos', desc: 'Estruturar TR ou Acordo de Cooperação Técnica (ACT).' },
  { valor: 'academia',               titulo: 'Conexão com a Academia / Universidades',          desc: 'Buscar laboratórios, patentes ou pesquisadores.' },
  { valor: 'mercado_startups',       titulo: 'Conexão com o Mercado / Startups',                desc: 'Pontes com fornecedores tecnológicos ou soluções comerciais.' },
  { valor: 'sinergia_interna',       titulo: 'Sinergia Interna / Conexão Interdepartamental',   desc: 'Localizar outras gerências que enfrentem a mesma dor.' },
  { valor: 'monitoramento',          titulo: 'Apenas Monitoramento Corporativo',                desc: 'A área tem autonomia; deseja apenas visibilidade institucional.' },
  { valor: 'diagnostico',            titulo: 'Apoio Diagnóstico',                               desc: 'Sabe qual é o problema, mas precisa de orientação técnica.' },
];

/** Rótulo curto de cada opção de suporte, para exibição em listas/detalhe. */
const SUPORTE_LABEL = {
  instrumentos_juridicos: 'Instrumentos Técnicos e Jurídicos',
  academia:               'Conexão com Academia',
  mercado_startups:       'Conexão com Mercado / Startups',
  sinergia_interna:       'Sinergia Interdepartamental',
  monitoramento:          'Monitoramento Corporativo',
  diagnostico:            'Apoio Diagnóstico',
};
