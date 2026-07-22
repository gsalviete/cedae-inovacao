/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Log de Sistema (page-logs.js)
   Auditoria das ações administrativas (somente leitura).
   ══════════════════════════════════════════════════════ */

async function loadLogs() {
  try {
    const res = await fetch(`${API}/api/admin/logs`);
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-logs');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Nenhum log registrado.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((l) => `
      <tr class="fade-in">
        <td>${l.username || '—'}</td>
        <td>${l.acao || '—'}</td>
        <td>${l.detalhe || '—'}</td>
        <td>${Admin.fmtDate(l.criado_em)}</td>
      </tr>`).join('');
  } catch { /* silencioso */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Admin.guard())) return;
  loadLogs();
});
