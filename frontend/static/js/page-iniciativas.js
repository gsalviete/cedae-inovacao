/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Iniciativas (page-iniciativas.js)
   Listagem completa com busca e filtro por canal. Somente leitura;
   abre o detalhe em rota própria. Helpers em admin-core.js (Admin.*).
   ══════════════════════════════════════════════════════ */

let _iniciativas = [];
let _filtroCanal = '';

async function loadIniciativas() {
  try {
    const res = await fetch(`${API}/api/iniciativas/`);
    if (!res.ok) return;
    _iniciativas = await res.json();
    renderIniciativas();
  } catch { /* silencioso */ }
}

function setFiltroCanal(btn) {
  _filtroCanal = btn.dataset.canal || '';
  document.querySelectorAll('#filtro-canais .filter-chip')
    .forEach((c) => c.classList.toggle('is-active', c === btn));
  renderIniciativas();
}

function aplicarFiltros() { renderIniciativas(); }

function renderIniciativas() {
  const tbody = document.getElementById('tbody-iniciativas');
  const countEl = document.getElementById('filtro-count');
  const termo = (document.getElementById('filtro-busca')?.value || '').trim().toLowerCase();

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

  if (countEl) {
    countEl.textContent = _iniciativas.length
      ? `${lista.length} de ${_iniciativas.length} iniciativa(s)`
      : '';
  }

  if (!_iniciativas.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhuma iniciativa registrada ainda.</td></tr>';
    return;
  }
  if (!lista.length) {
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
  tbody.innerHTML = lista.map((i) => {
    const rotulo = esc(i.titulo_iniciativa || i.codigo_publico || 'iniciativa');
    return `
      <tr class="row-clickable fade-in" onclick="abrirDetalhe(${i.id})" title="Ver detalhes"
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

function abrirDetalhe(id) {
  goTo(`/admin/iniciativa?id=${id}`);
}

/* Exporta a base respeitando os filtros vigentes (canal + busca livre).
   O backend gera o arquivo; aqui apenas montamos a URL e disparamos o
   download. O arquivo demora a chegar e o navegador não dá sinal nenhum
   nesse intervalo — o toast confirma que o pedido saiu. */
function exportarIniciativas(format) {
  const termo = (document.getElementById('filtro-busca')?.value || '').trim();
  const params = new URLSearchParams({ format });
  if (_filtroCanal) params.set('canal', _filtroCanal);
  if (termo) params.set('q', termo);
  window.CedaeUI?.toast(`Gerando o arquivo ${format.toUpperCase()}…`, 'ok');
  window.location.href = `${API}/api/iniciativas/export?${params.toString()}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Admin.guard())) return;
  loadIniciativas();
});
