/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Iniciativas (page-iniciativas.js)
   Listagem completa com busca, filtro por canal e paginação. Somente
   leitura; abre o detalhe em rota própria. Helpers em admin-core.js (Admin.*).

   A base inteira vem em uma única chamada (GET /api/iniciativas) e é
   filtrada e paginada aqui — mesmo caminho que a exportação já usava. O
   recorte é de apresentação: exportar continua levando tudo o que os
   filtros selecionam, não apenas a página em tela.
   ══════════════════════════════════════════════════════ */

const TAMANHOS_PAGINA = [10, 15, 25, 50];
const TAMANHO_PADRAO = 10;

/* Estado da listagem guardado por aba (sessionStorage) e espelhado na URL.
   São os dois caminhos de volta que o usuário tem: clicar em "Iniciativas"
   na sidebar ou na trilha traz uma URL limpa (e o sessionStorage responde);
   o botão voltar do navegador traz a URL com os parâmetros (e ela vence). */
const ESTADO_KEY = 'cedae.iniciativas.estado';

let _iniciativas = [];
let _filtroCanal = '';
let _pagina = 1;
let _porPagina = TAMANHO_PADRAO;
let _focoId = null;         // iniciativa aberta na última saída desta tela
let _scrollPendente = 0;    // altura a devolver depois da primeira pintura

async function loadIniciativas() {
  try {
    const res = await fetch(`${API}/api/iniciativas/`);
    if (!res.ok) return;
    _iniciativas = await res.json();
    renderIniciativas();
    restaurarRolagem();
  } catch { /* silencioso */ }
}

/* ── Estado: leitura, aplicação e gravação ───────────── */

function termoBusca() {
  return (document.getElementById('filtro-busca')?.value || '').trim();
}

function lerEstadoSalvo() {
  const estado = {
    q: '', canal: '', pagina: 1, porPagina: TAMANHO_PADRAO, scroll: 0, foco: null,
  };
  try {
    const salvo = JSON.parse(sessionStorage.getItem(ESTADO_KEY) || 'null');
    if (salvo) Object.assign(estado, salvo);
  } catch { /* storage indisponível */ }

  // A URL é a fonte mais recente quando existe: é ela que o histórico do
  // navegador devolve ao voltar.
  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) estado.q = params.get('q');
  if (params.has('canal')) estado.canal = params.get('canal');
  if (params.has('pagina')) estado.pagina = parseInt(params.get('pagina'), 10) || 1;
  if (params.has('tam')) estado.porPagina = parseInt(params.get('tam'), 10) || TAMANHO_PADRAO;
  return estado;
}

function aplicarEstado(estado) {
  _filtroCanal = estado.canal || '';
  _pagina = Math.max(1, estado.pagina || 1);
  _porPagina = TAMANHOS_PAGINA.includes(estado.porPagina) ? estado.porPagina : TAMANHO_PADRAO;
  _focoId = estado.foco ?? null;
  _scrollPendente = estado.scroll || 0;

  const busca = document.getElementById('filtro-busca');
  if (busca) busca.value = estado.q || '';
  const tamanho = document.getElementById('filtro-tamanho');
  if (tamanho) tamanho.value = String(_porPagina);
  document.querySelectorAll('#filtro-canais .filter-chip').forEach((chip) => {
    chip.classList.toggle('is-active', (chip.dataset.canal || '') === _filtroCanal);
  });
}

function salvarEstado(extra) {
  const estado = {
    q: termoBusca(),
    canal: _filtroCanal,
    pagina: _pagina,
    porPagina: _porPagina,
    scroll: 0,
    // A marca da última iniciativa aberta acompanha o estado: ela sobrevive a
    // uma troca de página ou de filtro, e some quando a aba some.
    foco: _focoId,
    ...(extra || {}),
  };
  try { sessionStorage.setItem(ESTADO_KEY, JSON.stringify(estado)); }
  catch { /* storage indisponível */ }

  const params = new URLSearchParams();
  if (estado.q) params.set('q', estado.q);
  if (estado.canal) params.set('canal', estado.canal);
  if (estado.pagina > 1) params.set('pagina', String(estado.pagina));
  if (estado.porPagina !== TAMANHO_PADRAO) params.set('tam', String(estado.porPagina));
  const qs = params.toString();
  // replaceState, não pushState: filtrar não é navegar. Voltar precisa sair
  // da listagem, e não desfazer letra por letra o que foi digitado na busca.
  history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

/** Devolve a altura de rolagem de onde o usuário saiu, depois da pintura —
    antes dela a página ainda não tem altura suficiente para rolar. */
function restaurarRolagem() {
  const y = _scrollPendente;
  _scrollPendente = 0;
  if (!y) return;
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
}

/* ── Filtros e paginação ─────────────────────────────── */

function setFiltroCanal(btn) {
  _filtroCanal = btn.dataset.canal || '';
  document.querySelectorAll('#filtro-canais .filter-chip')
    .forEach((c) => c.classList.toggle('is-active', c === btn));
  _pagina = 1;
  renderIniciativas();
  salvarEstado();
}

function aplicarFiltros() {
  // Todo filtro recomeça na primeira página: a página 7 de um resultado que
  // agora tem duas não existe mais.
  _pagina = 1;
  renderIniciativas();
  salvarEstado();
}

function setTamanhoPagina(valor) {
  const n = parseInt(valor, 10);
  _porPagina = TAMANHOS_PAGINA.includes(n) ? n : TAMANHO_PADRAO;
  _pagina = 1;
  renderIniciativas();
  salvarEstado();
}

function irParaPagina(n) {
  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada().length / _porPagina));
  const destino = Math.min(Math.max(1, n), totalPaginas);
  if (destino === _pagina) return;
  _pagina = destino;
  renderIniciativas();
  salvarEstado();
  // A tabela inteira trocou de conteúdo: ficar no meio dela deixaria o
  // usuário lendo linhas que não são a continuação do que estava lendo.
  document.getElementById('sec-iniciativas')?.scrollIntoView({ block: 'start' });
}

function listaFiltrada() {
  const termo = termoBusca().toLowerCase();
  let lista = _iniciativas;
  if (_filtroCanal) lista = lista.filter((i) => (i.canal_codigo || 'VIA_2') === _filtroCanal);
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

/* ── Render ──────────────────────────────────────────── */

function renderIniciativas() {
  const tbody = document.getElementById('tbody-iniciativas');
  const lista = listaFiltrada();
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / _porPagina));
  if (_pagina > totalPaginas) _pagina = totalPaginas;

  const inicio = (_pagina - 1) * _porPagina;
  const pagina = lista.slice(inicio, inicio + _porPagina);

  renderContagem(total, inicio, pagina.length);
  renderPaginacao(totalPaginas);

  if (!_iniciativas.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhuma iniciativa registrada ainda.</td></tr>';
    return;
  }
  if (!total) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhuma iniciativa corresponde ao filtro.</td></tr>';
    return;
  }

  const esc = Admin.escapeHtml;
  // A origem tem uma única identificação visual: o badge do canal. O antigo
  // selo "Externo" era redundante — proponente externo só existe na Captação
  // Externa (RN-02), cujo badge já diz "Externa" (ADR-015 §7.2).
  //
  // A linha é clicável e precisa existir para o teclado: `tabindex` a coloca
  // na ordem de tabulação, `role="button"` diz o que ela faz e o Enter/Espaço
  // é tratado no handler delegado de ui.js. O `aria-label` evita que o leitor
  // de tela anuncie a linha inteira como rótulo do botão.
  tbody.innerHTML = pagina.map((i) => {
    const rotulo = esc(i.titulo_iniciativa || i.codigo_publico || 'iniciativa');
    // A linha de onde o usuário saiu volta marcada: depois de ler o detalhe,
    // ele precisa reencontrar o próprio lugar na tabela sem procurar.
    const visitada = _focoId && i.id === _focoId ? ' is-visitada' : '';
    return `
      <tr class="row-clickable fade-in${visitada}" onclick="abrirDetalhe(${i.id})" title="Ver detalhes"
          tabindex="0" role="button" aria-label="Abrir detalhes de ${rotulo}">
        <td class="cell-protocol">${i.codigo_publico || '—'}</td>
        <td>${esc(i.titulo_iniciativa) || '—'}</td>
        <td>${canalBadge(i.canal_codigo || 'VIA_2')}</td>
        <td>${esc(i.nome_colaborador) || '—'}</td>
        <td>${esc(i.area_proponente) || '—'}</td>
        <td>${Admin.stageBadge(i.estagio_desenvolvimento)}</td>
        <td>${Admin.statusBadge(i.status)}</td>
        <td>${Admin.fmtDate(i.criado_em)}</td>
      </tr>`;
  }).join('');
}

/** "Mostrando 1–10 de 42 iniciativas filtradas (137 no total)". */
function renderContagem(total, inicio, exibidas) {
  const el = document.getElementById('filtro-count');
  if (!el) return;
  if (!_iniciativas.length) { el.textContent = ''; return; }
  if (!total) { el.textContent = `Nenhuma de ${_iniciativas.length} iniciativa(s) corresponde ao filtro.`; return; }

  const faixa = `${inicio + 1}–${inicio + exibidas}`;
  el.textContent = total === _iniciativas.length
    ? `Mostrando ${faixa} de ${total} iniciativa(s).`
    : `Mostrando ${faixa} de ${total} iniciativa(s) filtrada(s) — ${_iniciativas.length} no total.`;
}

/* Janela de páginas: primeira, última, a atual e suas vizinhas. Com 40
   páginas ninguém quer 40 botões, e quem está na 20 precisa enxergar a 19 e
   a 21 tanto quanto o começo e o fim da lista. */
function janelaDePaginas(atual, total) {
  const marcos = [...new Set([1, atual - 1, atual, atual + 1, total])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const saida = [];
  marcos.forEach((p, i) => {
    if (i && p - marcos[i - 1] > 1) saida.push('…');
    saida.push(p);
  });
  return saida;
}

function renderPaginacao(totalPaginas) {
  const host = document.getElementById('paginacao');
  if (!host) return;
  // Uma página só: a barra não tem o que oferecer e sai da tela.
  if (totalPaginas <= 1) { host.innerHTML = ''; host.classList.add('hidden'); return; }
  host.classList.remove('hidden');

  const ico = window.CedaeUI.icon;
  const numeros = janelaDePaginas(_pagina, totalPaginas).map((p) => (p === '…'
    ? '<span class="page-gap" aria-hidden="true">…</span>'
    : `<button type="button" class="page-num${p === _pagina ? ' is-active' : ''}"
               ${p === _pagina ? 'aria-current="page"' : ''}
               aria-label="Página ${p}" onclick="irParaPagina(${p})">${p}</button>`)).join('');

  host.innerHTML = `
    <button type="button" class="page-step" onclick="irParaPagina(${_pagina - 1})"
            ${_pagina === 1 ? 'disabled' : ''} aria-label="Página anterior">
      ${ico('chevron-left')}<span>Anterior</span>
    </button>
    <div class="page-nums">${numeros}</div>
    <button type="button" class="page-step" onclick="irParaPagina(${_pagina + 1})"
            ${_pagina === totalPaginas ? 'disabled' : ''} aria-label="Próxima página">
      <span>Próxima</span>${ico('chevron-right')}
    </button>`;
}

function abrirDetalhe(id) {
  // Guarda onde o usuário estava antes de sair: ao voltar — pela sidebar,
  // pela trilha do cabeçalho ou pelo botão do navegador — a listagem reabre
  // nos mesmos filtros, na mesma página e na mesma altura de rolagem.
  _focoId = id;
  salvarEstado({ scroll: Math.round(window.scrollY) });
  goTo(`/admin/iniciativa?id=${id}`);
}

/* Exporta a base respeitando os filtros vigentes (canal + busca livre) — a
   base inteira que eles selecionam, não a página em tela. O backend gera o
   arquivo; aqui apenas montamos a URL e disparamos o download. O arquivo
   demora a chegar e o navegador não dá sinal nenhum nesse intervalo — o
   toast confirma que o pedido saiu. */
function exportarIniciativas(format) {
  const termo = termoBusca();
  const params = new URLSearchParams({ format });
  if (_filtroCanal) params.set('canal', _filtroCanal);
  if (termo) params.set('q', termo);
  window.CedaeUI?.toast(`Gerando o arquivo ${format.toUpperCase()}…`, 'ok');
  window.location.href = `${API}/api/iniciativas/export?${params.toString()}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Admin.guard())) return;
  // A devolução da rolagem é nossa: o navegador tentaria restaurá-la antes
  // de a lista existir e pousaria no topo de qualquer jeito.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  aplicarEstado(lerEstadoSalvo());
  loadIniciativas();
});

// Sair por qualquer outro caminho (recarregar, link externo) também guarda a
// posição — voltar depois cai exatamente onde estava.
window.addEventListener('pagehide', () => {
  salvarEstado({ scroll: Math.round(window.scrollY) });
});
