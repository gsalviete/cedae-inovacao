/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Quadro (page-quadro.js)
   Quadro kanban com todas as iniciativas: uma coluna por ETAPA de trabalho
   (catálogo ETAPAS_KANBAN, V32), um cartão por iniciativa. Mover é arrastar
   o cartão até outra coluna (ou até o número da etapa no navegador); o
   clique no cartão abre o detalhe. Helpers em admin-core.js (Admin.*).

   Cada etapa pertence a um status (SUBMETIDA / EM_ANALISE / HOMOLOGADA /
   DESCLASSIFICADA). Entre etapas do mesmo status a movimentação é direta;
   para uma etapa de outro status ela é também uma tramitação e passa pelo
   modal de justificativa. O catálogo de transições espelha o do detalhe
   (detalhe.js / TRANSICOES_STATUS, ADR-004): aqui só se desenha o que o
   usuário pode tentar — a decisão final é sempre do backend.

   Navegação lateral: o quadro não exige a barra de rolagem horizontal. A
   roda do mouse (para cima/baixo) desloca o quadro para os lados — exceto
   sobre uma coluna que ainda tem cartões para rolar naquele sentido: aí a
   coluna rola primeiro e, ao chegar no fim dela, o quadro segue de lado.
   ══════════════════════════════════════════════════════ */

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

/* Fase visual de cada status: agrupa as etapas no navegador e dá a cor da
   coluna. */
const QUADRO_FASES = {
  SUBMETIDA:       { chave: 'entrada',   rotulo: 'Entrada' },
  EM_ANALISE:      { chave: 'analise',   rotulo: 'Triagem e análise' },
  HOMOLOGADA:      { chave: 'homologada', rotulo: 'Pós-homologação' },
  DESCLASSIFICADA: { chave: 'encerrada', rotulo: 'Encerradas' },
};

/* Uma coluna com centenas de cartões trava a rolagem e esconde as demais.
   Cada coluna mostra um lote e cresce sob demanda. */
const QUADRO_LOTE = 40;

const QUADRO_ESTADO_KEY = 'cedae.quadro.estado';

let _qIniciativas = [];
let _qEtapas = [];          // catálogo: { codigo, rotulo, status_vinculado, ordem }
let _qCanal = '';
let _qVisiveis = {};        // coluna → quantos cartões estão abertos
let _qArrasto = null;       // iniciativa em trânsito: { id, status, coluna }
let _qPendente = null;      // movimentação aguardando confirmação no modal
let _qMovendo = new Set();  // ids com gravação em andamento

async function loadQuadro() {
  try {
    const [resIni, resEtapas] = await Promise.all([
      fetch(`${API}/api/iniciativas/`),
      fetch(`${API}/api/iniciativas/etapas`),
    ]);
    if (!resIni.ok) throw new Error(String(resIni.status));
    if (!resEtapas.ok) throw new Error(String(resEtapas.status));
    _qIniciativas = await resIni.json();
    _qEtapas = await resEtapas.json();
  } catch {
    document.getElementById('quadro-board').innerHTML =
      '<p class="quadro-vazio">Não foi possível carregar o quadro.</p>';
    return;
  }
  if (!_qEtapas.length) {
    document.getElementById('quadro-board').innerHTML =
      '<p class="quadro-vazio">Nenhuma etapa configurada para o quadro.</p>';
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

/* ── Colunas ─────────────────────────────────────────── */

function etapaPorCodigo(codigo) {
  return _qEtapas.find((e) => e.codigo === codigo) || null;
}

/* Coluna em que o cartão aparece: a etapa gravada; sem ela (ou com uma etapa
   que já não pertence ao status), a primeira etapa do status; e, para status
   fora da esteira, uma coluna própria `status:<STATUS>` — sem ela essas
   iniciativas sumiriam do quadro. */
function colunaDe(i) {
  const status = i.status || 'SUBMETIDA';
  const etapa = etapaPorCodigo(i.etapa_codigo);
  if (etapa && etapa.status_vinculado === status) return etapa.codigo;
  const primeira = _qEtapas.find((e) => e.status_vinculado === status);
  return primeira ? primeira.codigo : `status:${status}`;
}

function colunasQuadro() {
  const extras = [...new Set(_qIniciativas.map(colunaDe))]
    .filter((c) => c.startsWith('status:'))
    .map((c) => ({ codigo: c, rotulo: rotuloStatusQuadro(c.slice(7)), status_vinculado: c.slice(7), extra: true }));
  return [...extras, ..._qEtapas];
}

function faseDe(status) {
  return QUADRO_FASES[status] || { chave: 'extra', rotulo: 'Fora da esteira' };
}

function rotuloStatusQuadro(val) {
  return (Admin.STATUS_MAP[val] || [])[0] || val || '—';
}

/* ── Regras de movimentação ──────────────────────────── */

function ehAdmQuadro() {
  return Admin.me?.role === 'ADM';
}

/* Tramitações de status que este perfil pode tentar a partir de `status`. */
function acoesQuadro(status) {
  const adm = ehAdmQuadro();
  return (QUADRO_TRANSICOES[status] || []).filter(
    (a) => adm || !(a.somenteAdm || QUADRO_EXCLUSIVAS_ADM.has(a.status_destino)),
  );
}

/* Colunas para onde um cartão pode ir: toda etapa do mesmo status e as
   etapas dos status alcançáveis por tramitação. */
function destinosQuadro(status, colunaAtual) {
  const statusAlcancaveis = new Set([status, ...acoesQuadro(status).map((a) => a.status_destino)]);
  return new Set(_qEtapas
    .filter((e) => e.codigo !== colunaAtual && statusAlcancaveis.has(e.status_vinculado))
    .map((e) => e.codigo));
}

function arrastavelQuadro(i) {
  return destinosQuadro(i.status || 'SUBMETIDA', colunaDe(i)).size > 0;
}

/* ── Render ──────────────────────────────────────────── */

function renderQuadro() {
  const board = document.getElementById('quadro-board');
  if (!board) return;

  const lista = listaQuadro();
  const porColuna = {};
  lista.forEach((i) => { (porColuna[colunaDe(i)] ||= []).push(i); });

  renderContagemQuadro(lista.length);

  limparArrastoQuadro(board);
  const colunas = colunasQuadro();
  board.innerHTML = colunas
    .map((col) => renderColunaQuadro(col, porColuna[col.codigo] || []))
    .join('');
  renderNavQuadro(colunas, porColuna);
  ligarQuadro(board);
  atualizarNavAtivo();
}

function renderContagemQuadro(total) {
  const el = document.getElementById('quadro-count');
  if (!el) return;
  if (!_qIniciativas.length) { el.textContent = 'Nenhuma iniciativa registrada ainda.'; return; }
  el.textContent = total === _qIniciativas.length
    ? `${total} iniciativa(s) no quadro.`
    : `${total} de ${_qIniciativas.length} iniciativa(s) correspondem ao filtro.`;
}

function numeroEtapa(col) {
  return col.extra ? '!' : String(col.ordem).padStart(2, '0');
}

/* Navegador: as etapas em sequência, agrupadas por fase. Clicar leva o
   quadro até a coluna; soltar um cartão sobre o número move para ela. */
function renderNavQuadro(colunas, porColuna) {
  const nav = document.getElementById('quadro-nav');
  if (!nav) return;
  const esc = Admin.escapeHtml;

  const grupos = [];
  colunas.forEach((col) => {
    const fase = col.extra ? { chave: 'extra', rotulo: 'Fora da esteira' } : faseDe(col.status_vinculado);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fase.chave === fase.chave) ultimo.cols.push(col);
    else grupos.push({ fase, cols: [col] });
  });

  nav.innerHTML = grupos.map((g) => `
    <div class="quadro-nav-grupo quadro-fase--${g.fase.chave}" style="flex-grow:${g.cols.length}">
      <span class="quadro-nav-fase">${esc(g.fase.rotulo)}</span>
      <div class="quadro-nav-itens">
        ${g.cols.map((col) => {
          const n = (porColuna[col.codigo] || []).length;
          return `
          <button type="button" class="quadro-nav-item${n ? '' : ' is-vazia'}"
                  data-ir="${esc(col.codigo)}" data-coluna="${esc(col.codigo)}"
                  title="${esc(col.rotulo)} — ${n} iniciativa(s)"
                  aria-label="Ir para a etapa ${esc(col.rotulo)} (${n})">
            <span class="quadro-nav-num">${numeroEtapa(col)}</span>
            <span class="quadro-nav-nome">${esc(col.rotulo)}</span>
            <span class="quadro-nav-count">${n}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function renderColunaQuadro(col, itens) {
  const esc = Admin.escapeHtml;
  const fase = col.extra ? { chave: 'extra', rotulo: 'Fora da esteira' } : faseDe(col.status_vinculado);
  const limite = _qVisiveis[col.codigo] || QUADRO_LOTE;
  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;

  const corpo = itens.length
    ? visiveis.map(cartaoQuadro).join('')
    : '<p class="quadro-col-vazio">Nenhuma iniciativa nesta etapa</p>';

  const mais = restantes > 0
    ? `<button type="button" class="quadro-mais" data-mais="${esc(col.codigo)}">
         Mostrar mais ${Math.min(restantes, QUADRO_LOTE)} de ${restantes}
       </button>`
    : '';

  const sub = col.extra
    ? 'Status fora da esteira'
    : `${esc(fase.rotulo)} · ${esc(rotuloStatusQuadro(col.status_vinculado))}`;

  return `
    <section class="quadro-col quadro-fase--${fase.chave}" data-coluna="${esc(col.codigo)}"
             aria-label="${esc(col.rotulo)}">
      <header class="quadro-col-head">
        <span class="quadro-col-num">${numeroEtapa(col)}</span>
        <div class="quadro-col-tit">
          <h2 class="quadro-col-nome" title="${esc(col.rotulo)}">${esc(col.rotulo)}</h2>
          <span class="quadro-col-sub">${sub}</span>
        </div>
        <span class="quadro-col-count">${itens.length}</span>
      </header>
      <div class="quadro-col-body">${corpo}${mais}</div>
    </section>`;
}

function cartaoQuadro(i) {
  const esc = Admin.escapeHtml;
  const arrastavel = !_qMovendo.has(i.id) && arrastavelQuadro(i);
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
    <article class="quadro-card${arrastavel ? '' : ' is-fixed'}${_qMovendo.has(i.id) ? ' is-saving' : ''}"
             data-id="${i.id}" ${arrastavel ? 'draggable="true"' : ''}
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

/* ── Navegação lateral ───────────────────────────────── */

function rolagemSuave() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function irParaColuna(codigo) {
  const board = document.getElementById('quadro-board');
  const col = board?.querySelector(`.quadro-col[data-coluna="${CSS.escape(codigo)}"]`);
  if (!col) return;
  // Centraliza a coluna quando possível; nas pontas, o navegador limita.
  const alvo = col.offsetLeft - (board.clientWidth - col.offsetWidth) / 2;
  board.scrollTo({ left: Math.max(0, alvo), behavior: rolagemSuave() ? 'smooth' : 'auto' });
  col.classList.remove('is-destaque');
  void col.offsetWidth;   // reinicia a animação de destaque
  col.classList.add('is-destaque');
}

/* Marca no navegador as etapas visíveis no quadro. */
function atualizarNavAtivo() {
  const board = document.getElementById('quadro-board');
  const nav = document.getElementById('quadro-nav');
  if (!board || !nav) return;
  const esq = board.scrollLeft;
  const dir = esq + board.clientWidth;
  const visiveis = new Set();
  board.querySelectorAll('.quadro-col').forEach((col) => {
    const meio = col.offsetLeft + col.offsetWidth / 2;
    if (meio >= esq && meio <= dir) visiveis.add(col.dataset.coluna);
  });
  nav.querySelectorAll('.quadro-nav-item').forEach((b) => {
    b.classList.toggle('is-visivel', visiveis.has(b.dataset.ir));
  });
  const prev = document.getElementById('quadro-prev');
  const next = document.getElementById('quadro-next');
  if (prev) prev.disabled = esq <= 1;
  if (next) next.disabled = dir >= board.scrollWidth - 1;
}

/* Setas: avançam uma "página" de colunas. */
function paginarQuadro(sentido) {
  const board = document.getElementById('quadro-board');
  if (!board) return;
  const passo = Math.max(board.clientWidth * 0.8, 300);
  board.scrollBy({ left: sentido * passo, behavior: rolagemSuave() ? 'smooth' : 'auto' });
}

/* Roda do mouse → deslocamento lateral. Deixa passar: zoom (Ctrl), gestos
   horizontais de trackpad e a rolagem de uma coluna que ainda tem cartões
   naquele sentido. */
function rodaQuadro(ev) {
  const board = ev.currentTarget;
  if (ev.ctrlKey || board.scrollWidth <= board.clientWidth) return;
  if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;

  const corpo = ev.target.closest?.('.quadro-col-body');
  if (corpo && corpo.scrollHeight > corpo.clientHeight + 1) {
    const noTopo = corpo.scrollTop <= 0;
    const noFim = corpo.scrollTop + corpo.clientHeight >= corpo.scrollHeight - 1;
    if ((ev.deltaY < 0 && !noTopo) || (ev.deltaY > 0 && !noFim)) return;
  }

  // deltaMode 1 = linhas (Firefox), 2 = páginas.
  const fator = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? board.clientWidth : 1;
  const delta = ev.deltaY * fator;
  const antes = board.scrollLeft;
  board.scrollLeft += delta;
  // Só consome o evento se o quadro de fato andou: no início/fim do quadro a
  // roda volta a rolar a página normalmente.
  if (board.scrollLeft !== antes) ev.preventDefault();
}

/* Durante o arrasto, encostar o cartão na borda do quadro o faz andar. */
function autoRolagemArrasto(board, clientX) {
  const r = board.getBoundingClientRect();
  const zona = Math.min(90, r.width / 6);
  if (clientX < r.left + zona) board.scrollLeft -= Math.ceil((r.left + zona - clientX) / 4);
  else if (clientX > r.right - zona) board.scrollLeft += Math.ceil((clientX - (r.right - zona)) / 4);
}

/* ── Interação ───────────────────────────────────────── */

/* Handlers delegados nos containers: o miolo é reescrito a cada render, os
   containers permanecem — a ligação acontece uma única vez. */
function ligarQuadro(board) {
  if (board.dataset.ligado === '1') return;
  board.dataset.ligado = '1';

  board.addEventListener('wheel', rodaQuadro, { passive: false });

  let quadroPendente = false;
  board.addEventListener('scroll', () => {
    if (quadroPendente) return;
    quadroPendente = true;
    requestAnimationFrame(() => { quadroPendente = false; atualizarNavAtivo(); });
  }, { passive: true });
  window.addEventListener('resize', atualizarNavAtivo);

  board.addEventListener('click', (ev) => {
    const mais = ev.target.closest?.('.quadro-mais');
    if (mais) {
      const c = mais.dataset.mais;
      _qVisiveis[c] = (_qVisiveis[c] || QUADRO_LOTE) + QUADRO_LOTE;
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
    _qArrasto = { id: item.id, status: item.status || 'SUBMETIDA', coluna: colunaDe(item) };
    ev.dataTransfer.effectAllowed = 'move';
    // O Firefox só inicia o arrasto quando há algum dado no dataTransfer.
    ev.dataTransfer.setData('text/plain', String(item.id));
    card.classList.add('is-grabbed');
    board.classList.add('is-dragging');
    document.getElementById('quadro-nav')?.classList.add('is-dragging');

    // Os destinos válidos acendem já no início do arrasto: o usuário vê para
    // onde pode ir antes de soltar.
    const destinos = destinosQuadro(_qArrasto.status, _qArrasto.coluna);
    document.querySelectorAll('#quadro-board .quadro-col, #quadro-nav .quadro-nav-item').forEach((el) => {
      const c = el.dataset.coluna;
      el.classList.toggle('is-origem', c === _qArrasto.coluna);
      el.classList.toggle('is-target', destinos.has(c));
    });
  });

  // Colunas do quadro e números do navegador são alvos de soltura.
  const alvos = [board, document.getElementById('quadro-nav')].filter(Boolean);
  const alvoDe = (ev) => ev.target.closest?.('.quadro-col, .quadro-nav-item');

  alvos.forEach((cont) => {
    cont.addEventListener('dragend', () => limparArrastoQuadro(board));

    // Todos os alvos aceitam o dragover, inclusive os bloqueados: sem isso o
    // `drop` nunca dispara neles e soltar no lugar errado não diria nada.
    cont.addEventListener('dragover', (ev) => {
      if (!_qArrasto) return;
      if (cont === board) autoRolagemArrasto(board, ev.clientX);
      const alvo = alvoDe(ev);
      if (!alvo) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      if (alvo.classList.contains('is-target')) alvo.classList.add('is-over');
      else if (!alvo.classList.contains('is-origem')) alvo.classList.add('is-barrado');
    });

    cont.addEventListener('dragleave', (ev) => {
      const alvo = alvoDe(ev);
      if (alvo && !alvo.contains(ev.relatedTarget)) {
        alvo.classList.remove('is-over', 'is-barrado');
      }
    });

    cont.addEventListener('drop', (ev) => {
      const alvo = alvoDe(ev);
      const arrasto = _qArrasto;
      if (!alvo || !arrasto) return;
      ev.preventDefault();
      limparArrastoQuadro(board);
      soltarEm(arrasto, alvo.dataset.coluna);
    });
  });

  const nav = document.getElementById('quadro-nav');
  nav?.addEventListener('click', (ev) => {
    const item = ev.target.closest?.('.quadro-nav-item');
    if (item) irParaColuna(item.dataset.ir);
  });
}

function limparArrastoQuadro(board) {
  _qArrasto = null;
  board.classList.remove('is-dragging');
  document.getElementById('quadro-nav')?.classList.remove('is-dragging');
  document.querySelectorAll('#quadro-board .is-over, #quadro-board .is-barrado, #quadro-board .is-grabbed,' +
    '#quadro-board .is-target, #quadro-board .is-origem, #quadro-nav .is-over, #quadro-nav .is-barrado,' +
    '#quadro-nav .is-target, #quadro-nav .is-origem')
    .forEach((el) => el.classList.remove('is-over', 'is-barrado', 'is-grabbed', 'is-target', 'is-origem'));
}

function soltarEm(arrasto, colunaDestino) {
  if (!colunaDestino || colunaDestino === arrasto.coluna) return;
  const etapa = etapaPorCodigo(colunaDestino);
  if (!etapa) {
    window.CedaeUI.toast('Esta coluna não recebe cartões.', 'erro');
    return;
  }

  // Mesmo status: só troca de etapa, sem modal.
  if (etapa.status_vinculado === arrasto.status) {
    moverEtapaQuadro(arrasto.id, etapa);
    return;
  }

  const acao = acoesQuadro(arrasto.status).find((a) => a.status_destino === etapa.status_vinculado);
  if (acao) { abrirModalQuadro(arrasto.id, acao, etapa); return; }

  // Destino inválido: diz se a transição não existe ou se é de outro perfil.
  const previsto = (QUADRO_TRANSICOES[arrasto.status] || [])
    .some((a) => a.status_destino === etapa.status_vinculado);
  window.CedaeUI.toast(
    previsto
      ? `Levar para "${etapa.rotulo}" é uma decisão exclusiva de administradores.`
      : `Não há tramitação de "${rotuloStatusQuadro(arrasto.status)}" para "${etapa.rotulo}".`,
    'erro',
  );
}

function abrirDetalheQuadro(id) {
  if (!id) return;
  goTo(`/admin/iniciativa?id=${encodeURIComponent(id)}`);
}

/* ── Gravação ────────────────────────────────────────── */

async function enviarEtapaQuadro(id, etapa, justificativa) {
  const res = await fetch(`${API}/api/iniciativas/${id}/etapa`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa: etapa.codigo, justificativa: justificativa || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/* O cartão só muda de coluna depois da confirmação do backend — nunca de
   forma otimista: uma movimentação recusada não pode parecer feita. */
function aplicarResultadoQuadro(id, etapa, data) {
  const item = _qIniciativas.find((i) => i.id === id);
  if (item) {
    item.status = data.status_novo || etapa.status_vinculado;
    item.etapa_codigo = data.etapa_nova || etapa.codigo;
  }
}

async function moverEtapaQuadro(id, etapa) {
  _qMovendo.add(id);
  renderQuadro();
  try {
    const { ok, data } = await enviarEtapaQuadro(id, etapa);
    if (ok) {
      aplicarResultadoQuadro(id, etapa, data);
      window.CedaeUI.toast(`Movida para "${etapa.rotulo}".`, 'ok');
    } else {
      window.CedaeUI.toast(data.message || 'Não foi possível mover a iniciativa.', 'erro');
    }
  } catch {
    window.CedaeUI.toast('Erro de comunicação com o servidor.', 'erro');
  } finally {
    _qMovendo.delete(id);
    renderQuadro();
  }
}

/* ── Modal de tramitação ─────────────────────────────── */

function abrirModalQuadro(id, acao, etapa) {
  const item = _qIniciativas.find((i) => i.id === id);
  _qPendente = { id, etapa, justObrig: acao.justObrig };

  document.getElementById('quadro-just-title').textContent = acao.label;
  document.getElementById('quadro-just-alvo').textContent = item
    ? `${item.codigo_publico || `#${item.id}`} — ${item.titulo_iniciativa || 'Sem título'}`
    : '';
  document.getElementById('quadro-just-destino').innerHTML =
    `Destino: <strong>${Admin.escapeHtml(etapa.rotulo)}</strong> · status passa a ` +
    `<strong>${Admin.escapeHtml(rotuloStatusQuadro(etapa.status_vinculado))}</strong>`;
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
    const { ok, data } = await enviarEtapaQuadro(pendente.id, pendente.etapa, justificativa);
    if (ok) {
      fecharModalQuadro();
      aplicarResultadoQuadro(pendente.id, pendente.etapa, data);
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
