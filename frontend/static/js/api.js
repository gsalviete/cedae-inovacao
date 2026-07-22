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

/* Redireciona para a tela de login (autenticação AD). */
function redirectToLogin() {
  goTo('/login');
}

/* ── Saudação do header ──────────────────────────────────
   Compartilhada pelas três páginas autenticadas. Não há logout: a identidade
   vem do AD e o usuário não se desloga da aplicação. */

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

const TIPO_INSTITUICAO_LABEL = {
  ICT:             'ICT',
  UNIVERSIDADE:    'Universidade',
  EMPRESA_PUBLICA: 'Empresa Pública',
  PARCERIA:        'Parceria',
  OUTRO:           'Outro',
};
