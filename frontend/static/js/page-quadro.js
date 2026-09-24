/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Quadro (page-quadro.js)
   Quadro kanban com todas as iniciativas: uma coluna por status, um cartão
   por iniciativa. Tramitar é arrastar o cartão até a coluna de destino; o
   clique no cartão abre o detalhe. Helpers em admin-core.js (Admin.*).

   A base vem da mesma chamada da listagem (GET /api/iniciativas) e é
   filtrada aqui. O catálogo de transições espelha o do detalhe
   (detalhe.js / TRANSICOES_STATUS, ADR-004): aqui só se desenha o que o
   usuário pode tentar — a decisão final é sempre do backend.
   ══════════════════════════════════════════════════════ */

const QUADRO_COLUNAS = [
  { status: 'SUBMETIDA',       resumo: 'Aguardando triagem' },
  { status: 'EM_ANALISE',      resumo: 'Em avaliação pela Assessoria' },
  { status: 'HOMOLOGADA',      resumo: 'Decisão terminal' },
  { status: 'DESCLASSIFICADA', resumo: 'Decisão terminal' },
];

const QUADRO_TRANSICOES = {
  SUBMETIDA: [
    { status_destino: 'EM_ANALISE', label: 'Iniciar Análise', justObrig: false },
  ],
  EM_ANALISE: [
    { status_destino: 'HOMOLOGADA',      label: 'Homologar',      justObrig: false },
    { status_destino: 'DESCLASSIFICADA', label: 'Desclassificar', justObrig: true  },
  ],
  HOMOLOGADA: [
    { status_destino: 'EM_ANALISE', label: 'Reverter Homologação', justObrig: true, somenteAdm: true },
  ],
  DESCLASSIFICADA: [
    { status_destino: 'EM_ANALISE', label: 'Reverter Desclassificação', justObrig: true, somenteAdm: true },
  ],
};

/* Homologar/desclassificar — e desfazê-los — são exclusivos de ADM
   (ADR-014 §10, ADR-015 §4). */
const QUADRO_EXCLUSIVAS_ADM = new Set(['HOMOLOGADA', 'DESCLASSIFICADA']);

/* Uma coluna com centenas de cartões trava a rolagem e esconde as demais.
   Cada coluna mostra um lote e cresce sob demanda. */
const QUADRO_LOTE = 40;

const QUADRO_ESTADO_KEY = 'cedae.quadro.estado';

let _qIniciativas = [];
let _qCanal = '';
let _qVisiveis = {};        // status → quantos cartões estão abertos na coluna
let _qArrasto = null;       // iniciativa em trânsito: { id, status }
let _qPendente = null;      // transição aguardando confirmação no modal

async function loadQuadro() {
  try {
    const res = await fetch(`${API}/api/iniciativas/`);
    if (!res.ok) throw new Error(String(res.status));
    _qIniciativas = await res.json();
  } catch {
    document.getElementById('quadro-board').innerHTML =
      '<p class="quadro-vazio">Não foi possível carregar as iniciativas.</p>';
    return;
  }
  renderQuadro();
}

/* ── Filtros ─────────────────────────────────────────── */

function termoQuadro() {
  return (document.getElementById('quadro-busca')?.value || '').trim().toLowerCase();
}

function estagioQuadro() {
  return document.getElementById('quadro-estagio')?.value || '';
}

function setCanalQuadro(btn) {
  _qCanal = btn.dataset.canal || '';
  document.querySelectorAll('#quadro-canais .filter-chip')
    .forEach((c) => c.classList.toggle('is-active', c === btn));
  aplicarFiltrosQuadro();
}

function aplicarFiltrosQuadro() {
  // Filtrar muda o que cada coluna contém: o lote aberto volta ao inicial.
  _qVisiveis = {};
  renderQuadro();
  salvarEstadoQuadro();
}

function listaQuadro() {
  const termo = termoQuadro();
  const estagio = estagioQuadro();
  let lista = _qIniciativas;
  if (_qCanal) lista = lista.filter((i) => (i.canal_codigo || 'VIA_2') === _qCanal);
  if (estagio) lista = lista.filter((i) => i.estagio_desenvolvimento === estagio);
  if (termo) {
    lista = lista.filter((i) =>
      (i.titulo_iniciativa || '').toLowerCase().includes(termo) ||
      (i.nome_colaborador || '').toLowerCase().includes(termo) ||
      (i.area_proponente || '').toLowerCase().includes(termo) ||
      (i.codigo_publico || '').toLowerCase().includes(termo) ||
      (i.organizacao_externa || '').toLowerCase().includes(termo));
  }
  return lista;
}

function salvarEstadoQuadro() {
  try {
    sessionStorage.setItem(QUADRO_ESTADO_KEY, JSON.stringify({
      q: document.getElementById('quadro-busca')?.value || '',
      canal: _qCanal,
      estagio: estagioQuadro(),
    }));
  } catch { /* storage indisponível */ }
}

function restaurarEstadoQuadro() {
  let estado = null;
  try { estado = JSON.parse(sessionStorage.getItem(QUADRO_ESTADO_KEY) || 'null'); }
  catch { /* storage indisponível */ }
  if (!estado) return;
  _qCanal = estado.canal || '';
  const busca = document.getElementById('quadro-busca');
  if (busca) busca.value = estado.q || '';
  const est = document.getElementById('quadro-estagio');
  if (est) est.value = estado.estagio || '';
  document.querySelectorAll('#quadro-canais .filter-chip').forEach((chip) => {
    chip.classList.toggle('is-active', (chip.dataset.canal || '') === _qCanal);
  });
}

/* ── Regras de tramitação ────────────────────────────── */

function rotuloStatusQuadro(val) {
  return (Admin.STATUS_MAP[val] || [])[0] || val || '—';
}

function acoesQuadro(statusAtual) {
  const ehAdm = Admin.me?.role === 'ADM';
  return (QUADRO_TRANSICOES[statusAtual] || []).filter(
    (a) => ehAdm || !(a.somenteAdm || QUADRO_EXCLUSIVAS_ADM.has(a.status_destino)),
  );
}

/* ── Render ──────────────────────────────────────────── */

/* As quatro colunas da esteira, mais uma à frente para cada status presente
   na base que não seja nenhum deles (dado legado ou status fora do
   workflow) — sem ela essas iniciativas sumiriam do quadro. */
function colunasQuadro() {
  const padrao = new Set(QUADRO_COLUNAS.map((c) => c.status));
  const extras = [...new Set(_qIniciativas.map((i) => i.status || 'SUBMETIDA'))]
    .filter((s) => !padrao.has(s))
    .map((s) => ({ status: s, resumo: 'Fora da esteira padrão' }));
  return [...extras, ...QUADRO_COLUNAS];
}

function renderQuadro() {
  const board = document.getElementById('quadro-board');
  if (!board) return;

  const lista = listaQuadro();
  const porStatus = {};
  lista.forEach((i) => {
    const s = i.status || 'SUBMETIDA';
    (porStatus[s] ||= []).push(i);
  });

  renderContagemQuadro(lista.length);

  limparArrastoQuadro(board);
  board.innerHTML = colunasQuadro()
    .map((col) => renderColunaQuadro(col, porStatus[col.status] || []))
    .join('');
  ligarQuadro(board);
}

function renderContagemQuadro(total) {
  const el = document.getElementById('quadro-count');
  if (!el) return;
  if (!_qIniciativas.length) { el.textContent = 'Nenhuma iniciativa registrada ainda.'; return; }
  el.textContent = total === _qIniciativas.length
    ? `${total} iniciativa(s) no quadro.`
    : `${total} de ${_qIniciativas.length} iniciativa(s) correspondem ao filtro.`;
}

function renderColunaQuadro(col, itens) {
  const [titulo, cls] = Admin.STATUS_MAP[col.status] || [col.status, 'badge-default'];
  const limite = _qVisiveis[col.status] || QUADRO_LOTE;
  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;

  const corpo = itens.length
    ? visiveis.map(cartaoQuadro).join('')
    : `<p class="quadro-col-vazio">${col.resumo}</p>`;

  const mais = restantes > 0
    ? `<button type="button" class="quadro-mais" data-mais="${col.status}">
         Mostrar mais ${Math.min(restantes, QUADRO_LOTE)} de ${restantes}
       </button>`
    : '';

  return `
    <div class="quadro-col quadro-col--${col.status.toLowerCase()}" data-status="${col.status}">
      <div class="quadro-col-head">
        <span class="badge ${cls}">${Admin.escapeHtml(titulo)}</span>
        <span class="quadro-col-count">${itens.length}</span>
      </div>
      <div class="quadro-col-body">${corpo}${mais}</div>
    </div>`;
}

function cartaoQuadro(i) {
  const esc = Admin.escapeHtml;
  const status = i.status || 'SUBMETIDA';
  const arrastavel = acoesQuadro(status).length > 0;
  const proto = esc(i.codigo_publico || `#${i.id}`);
  const titulo = esc(i.titulo_iniciativa || 'Sem título');
  const quem = i.proponente_tipo === 'EXTERNO' && i.organizacao_externa
    ? i.organizacao_externa
    : i.nome_colaborador;
  const meta = [quem, i.area_proponente].filter(Boolean).map(esc).join(' · ');
  const data = i.criado_em
    ? new Date(i.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '';

  return `
    <article class="quadro-card${arrastavel ? '' : ' is-fixed'}" data-id="${i.id}"
             ${arrastavel ? 'draggable="true"' : ''}
             tabindex="0" role="button"
             aria-label="Abrir detalhes de ${titulo}">
      <div class="quadro-card-top">
        <span class="quadro-card-proto">${proto}</span>
        ${data ? `<span class="quadro-card-data">${data}</span>` : ''}
      </div>
      <h3 class="quadro-card-titulo">${titulo}</h3>
      ${meta ? `<p class="quadro-card-meta">${meta}</p>` : ''}
      <div class="quadro-card-badges">
        ${canalBadge(i.canal_codigo || 'VIA_2')}
        ${i.estagio_desenvolvimento ? Admin.stageBadge(i.estagio_desenvolvimento) : ''}
      </div>
    </article>`;
}

/* ── Interação ───────────────────────────────────────── */

/* Handlers delegados no container: o miolo é reescrito a cada render, o
   container permanece — a ligação acontece uma única vez. */
function ligarQuadro(board) {
  if (board.dataset.ligado === '1') return;
  board.dataset.ligado = '1';

  board.addEventListener('click', (ev) => {
    const mais = ev.target.closest?.('.quadro-mais');
    if (mais) {
      const s = mais.dataset.mais;
      _qVisiveis[s] = (_qVisiveis[s] || QUADRO_LOTE) + QUADRO_LOTE;
      renderQuadro();
      return;
    }
    const card = ev.target.closest?.('.quadro-card');
    if (card) abrirDetalheQuadro(card.dataset.id);
  });

  board.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const card = ev.target.closest?.('.quadro-card');
    if (!card || ev.target !== card) return;
    ev.preventDefault();
    abrirDetalheQuadro(card.dataset.id);
  });

  board.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest?.('.quadro-card[draggable="true"]');
    if (!card) return;
    const item = _qIniciativas.find((i) => String(i.id) === card.dataset.id);
    if (!item) return;
    _qArrasto = { id: item.id, status: item.status || 'SUBMETIDA' };
    ev.dataTransfer.effectAllowed = 'move';
    // O Firefox só inicia o arrasto quando há algum dado no dataTransfer.
    ev.dataTransfer.setData('text/plain', String(item.id));
    card.classList.add('is-grabbed');
    board.classList.add('is-dragging');

    // Os destinos válidos acendem já no início do arrasto: o usuário vê para
    // onde pode ir antes de soltar.
    const destinos = new Set(acoesQuadro(_qArrasto.status).map((a) => a.status_destino));
    board.querySelectorAll('.quadro-col').forEach((col) => {
      const s = col.dataset.status;
      col.classList.toggle('is-origem', s === _qArrasto.status);
      col.classList.toggle('is-target', destinos.has(s));
    });
  });

  board.addEventListener('dragend', () => limparArrastoQuadro(board));

  // Todas as colunas aceitam o dragover, inclusive as bloqueadas: sem isso o
  // `drop` nunca dispara nelas e soltar no lugar errado não diria nada.
  board.addEventListener('dragover', (ev) => {
    if (!_qArrasto) return;
    const col = ev.target.closest?.('.quadro-col');
    if (!col) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (col.classList.contains('is-target')) col.classList.add('is-over');
    else if (!col.classList.contains('is-origem')) col.classList.add('is-barrado');
  });

  board.addEventListener('dragleave', (ev) => {
    const col = ev.target.closest?.('.quadro-col');
    if (col && !col.contains(ev.relatedTarget)) {
      col.classList.remove('is-over', 'is-barrado');
    }
  });

  board.addEventListener('drop', (ev) => {
    const col = ev.target.closest?.('.quadro-col');
    const arrasto = _qArrasto;
    if (!col || !arrasto) return;
    ev.preventDefault();
    limparArrastoQuadro(board);
    soltarEm(arrasto, col.dataset.status);
  });
}

function limparArrastoQuadro(board) {
  _qArrasto = null;
  board.classList.remove('is-dragging');
  board.querySelectorAll('.is-over, .is-barrado, .is-grabbed, .is-target, .is-origem')
    .forEach((el) => el.classList.remove('is-over', 'is-barrado', 'is-grabbed', 'is-target', 'is-origem'));
}

function soltarEm(arrasto, statusDestino) {
  if (statusDestino === arrasto.status) return;
  const acao = acoesQuadro(arrasto.status).find((a) => a.status_destino === statusDestino);
  if (acao) { abrirModalQuadro(arrasto.id, acao); return; }

  // Destino inválido: diz se a transição não existe ou se é de outro perfil.
  const previsto = (QUADRO_TRANSICOES[arrasto.status] || [])
    .some((a) => a.status_destino === statusDestino);
  window.CedaeUI.toast(
    previsto
      ? `"${rotuloStatusQuadro(statusDestino)}" é uma decisão exclusiva de administradores.`
      : `Não há tramitação de "${rotuloStatusQuadro(arrasto.status)}" para "${rotuloStatusQuadro(statusDestino)}".`,
    'erro',
  );
}

function abrirDetalheQuadro(id) {
  if (!id) return;
  goTo(`/admin/iniciativa?id=${encodeURIComponent(id)}`);
}

/* ── Modal de tramitação ─────────────────────────────── */

function abrirModalQuadro(id, acao) {
  const item = _qIniciativas.find((i) => i.id === id);
  _qPendente = { id, statusDestino: acao.status_destino, justObrig: acao.justObrig };

  document.getElementById('quadro-just-title').textContent = acao.label;
  document.getElementById('quadro-just-alvo').textContent = item
    ? `${item.codigo_publico || `#${item.id}`} — ${item.titulo_iniciativa || 'Sem título'}`
    : '';
  const txt = document.getElementById('quadro-just-text');
  txt.value = '';
  txt.placeholder = acao.justObrig ? 'Justificativa obrigatória...' : 'Justificativa (opcional)...';
  document.getElementById('quadro-lbl-just').innerHTML = acao.justObrig
    ? 'Justificativa <span class="required">*</span>'
    : 'Justificativa';
  document.getElementById('quadro-just-error').classList.add('hidden');

  window.CedaeUI.modal.open('modal-quadro-just', {
    focus: '#quadro-just-text',
    onClose: fecharModalQuadro,
  });
}

function fecharModalQuadro() {
  window.CedaeUI.modal.close('modal-quadro-just');
  _qPendente = null;
}

function fecharModalQuadroOverlay(e) {
  if (e.target === document.getElementById('modal-quadro-just')) fecharModalQuadro();
}

async function confirmarTransicaoQuadro(btn) {
  if (!_qPendente) return;
  const pendente = _qPendente;
  const justificativa = document.getElementById('quadro-just-text').value.trim();
  const errEl = document.getElementById('quadro-just-error');

  if (pendente.justObrig && !justificativa) {
    errEl.textContent = 'Justificativa obrigatória para esta transição.';
    errEl.classList.remove('hidden');
    return;
  }

  window.CedaeUI.busy(btn, true, 'Registrando…');
  try {
    const res = await fetch(`${API}/api/iniciativas/${pendente.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: pendente.statusDestino, justificativa: justificativa || undefined }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      fecharModalQuadro();
      // O cartão só muda de coluna depois da confirmação do backend — nunca
      // de forma otimista: uma tramitação recusada não pode parecer feita.
      const item = _qIniciativas.find((i) => i.id === pendente.id);
      if (item) item.status = data.status_novo || pendente.statusDestino;
      renderQuadro();
      window.CedaeUI.toast('Tramitação registrada.', 'ok');
    } else {
      errEl.textContent = data.message || 'Erro ao realizar transição.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
  } finally {
    window.CedaeUI.busy(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Admin.guard())) return;
  restaurarEstadoQuadro();
  loadQuadro();
});
