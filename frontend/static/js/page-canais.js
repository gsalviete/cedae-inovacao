/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Canais (page-canais.js)
   Gestão das vias de captação (ADR-013). Alteração é exclusiva de ADM
   (RN-11); demais perfis visualizam em modo leitura.
   ══════════════════════════════════════════════════════ */

let _canaisAdm = false;

async function loadCanais() {
  try {
    const res = await fetch(`${API}/api/admin/canais`);
    if (!res.ok) return;
    const canais = await res.json();
    const tbody = document.getElementById('tbody-canais');
    if (!canais.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Nenhum canal cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = canais.map((c) => {
      const situacao = c.ativo
        ? '<span class="badge badge-status-homologada">Ativo</span>'
        : '<span class="badge badge-status-desclassificada">Inativo</span>';
      // VIA_2 (formulário público) não pode ser desativada — é a via de autosserviço.
      const bloqueado = c.codigo === 'VIA_2';
      let acao = '—';
      if (_canaisAdm) {
        acao = bloqueado
          ? '<button class="btn-action-sm" disabled title="A Via 2 (formulário público) não pode ser desativada.">—</button>'
          : `<button class="${c.ativo ? 'btn-danger-sm' : 'btn-action-sm'}"
                     onclick="toggleCanal('${c.codigo}', ${!c.ativo})">${c.ativo ? 'Desativar' : 'Ativar'}</button>`;
      }
      return `
        <tr class="fade-in">
          <td>${canalBadge(c.codigo)}</td>
          <td>${Admin.escapeHtml(c.nome)}</td>
          <td>${situacao}</td>
          <td>${acao}</td>
        </tr>`;
    }).join('');
  } catch { /* silencioso */ }
}

async function toggleCanal(codigo, ativo) {
  try {
    const res = await fetch(`${API}/api/admin/canais/${codigo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo }),
    });
    if (res.ok) loadCanais();
  } catch { /* silencioso */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  const me = await Admin.guard();
  if (!me) return;
  _canaisAdm = me.role === 'ADM';
  if (!_canaisAdm) document.getElementById('canais-restrito')?.removeAttribute('hidden');
  loadCanais();
});
