/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Admin Panel JS (admin.js)
   ══════════════════════════════════════════════════════ */

const API = '';

function getSession() {
  try {
    const raw = sessionStorage.getItem('cedae_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function logout() {
  sessionStorage.removeItem('cedae_session');
  window.location.href = '/';
}

function authHeaders() {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

/* ── Guard ───────────────────────────────────────────── */
function checkAdmin() {
  const session = getSession();
  if (!session || !session.is_admin) {
    document.getElementById('admin-content').classList.add('hidden');
    document.getElementById('admin-guard').classList.remove('hidden');
    setTimeout(() => window.location.href = '/', 2000);
    return false;
  }
  return true;
}

/* ── Formatar data ───────────────────────────────────── */
function fmtDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return val; }
}

/* ── Badge de estágio ────────────────────────────────── */
const ESTAGIO_MAP = {
  ideacao: ['Ideação',  'badge-ideacao'],
  piloto:  ['Piloto',   'badge-piloto'],
  escala:  ['Escala',   'badge-escala'],
};

function stageBadge(val) {
  const [label, cls] = ESTAGIO_MAP[val] || ['—', 'badge-default'];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ── Dimensão label ──────────────────────────────────── */
const DIM_MAP = {
  tecnologica:     'Tecnológica',
  operacional:     'Operacional',
  gerencial:       'Gerencial / Adm.',
  social_ambiental:'Social e Ambiental',
  outros:          'Outros',
};

/* ── KPIs ────────────────────────────────────────────── */
async function loadKPIs() {
  try {
    const res = await fetch(`${API}/api/admin/kpis`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('kpi-total').textContent   = data.total_iniciativas ?? '—';
    document.getElementById('kpi-ideacao').textContent = data.por_estagio?.ideacao ?? 0;
    document.getElementById('kpi-piloto').textContent  = data.por_estagio?.piloto  ?? 0;
    document.getElementById('kpi-escala').textContent  = data.por_estagio?.escala  ?? 0;

    // Bar chart de dimensões
    const barEl = document.getElementById('dimensao-bars');
    barEl.innerHTML = '';
    const dims = data.por_dimensao || {};
    const max  = Math.max(...Object.values(dims), 1);

    Object.entries(dims).forEach(([key, count]) => {
      const label = DIM_MAP[key] || key;
      const pct   = Math.round((count / max) * 100);
      barEl.innerHTML += `
        <div class="bar-row">
          <span class="bar-label" title="${label}">${label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-count">${count}</span>
        </div>`;
    });

    if (!Object.keys(dims).length) {
      barEl.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Nenhuma iniciativa registrada ainda.</p>';
    }
  } catch { /* silencioso */ }
}

/* ── Acessos ─────────────────────────────────────────── */
async function loadAcessos() {
  try {
    const res = await fetch(`${API}/api/admin/acessos`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-acessos');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="table-loading">Nenhum acesso registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(l => `
      <tr>
        <td>${l.username || '—'}</td>
        <td>${fmtDate(l.criado_em)}</td>
        <td>${l.detalhe || '—'}</td>
      </tr>`).join('');
  } catch { /* silencioso */ }
}

/* ── Iniciativas ─────────────────────────────────────── */
async function loadIniciativas() {
  try {
    const res = await fetch(`${API}/api/iniciativas/`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-iniciativas');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhuma iniciativa registrada ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(i => `
      <tr>
        <td>${i.id}</td>
        <td>${i.titulo_iniciativa || '—'}</td>
        <td>${i.nome_colaborador || '—'}</td>
        <td>${i.area_proponente || '—'}</td>
        <td>${stageBadge(i.estagio_desenvolvimento)}</td>
        <td>${fmtDate(i.criado_em)}</td>
      </tr>`).join('');
  } catch { /* silencioso */ }
}

/* ── Logs ────────────────────────────────────────────── */
async function loadLogs() {
  try {
    const res = await fetch(`${API}/api/admin/logs`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-logs');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Nenhum log registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(l => `
      <tr>
        <td>${l.id}</td>
        <td>${l.username || '—'}</td>
        <td>${l.acao || '—'}</td>
        <td>${l.detalhe || '—'}</td>
        <td>${fmtDate(l.criado_em)}</td>
      </tr>`).join('');
  } catch { /* silencioso */ }
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAdmin()) return;
  loadKPIs();
  loadAcessos();
  loadIniciativas();
  loadLogs();
});
