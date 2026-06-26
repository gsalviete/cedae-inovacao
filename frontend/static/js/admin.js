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
  const s = getSession();
  return s ? { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
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

/* ── Formatters ──────────────────────────────────────── */
function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return val; }
}

const ESTAGIO_MAP = {
  ideacao: ['Ideação',  'badge-ideacao'],
  piloto:  ['Piloto',   'badge-piloto'],
  escala:  ['Escala',   'badge-escala'],
};

function stageBadge(val) {
  const [label, cls] = ESTAGIO_MAP[val] || ['—', 'badge-default'];
  return `<span class="badge ${cls}">${label}</span>`;
}

const STATUS_MAP = {
  SUBMETIDA:   ['Submetida',   'badge-status-submetida'],
  EM_ANALISE:  ['Em Análise',  'badge-status-em_analise'],
  APROVADA:    ['Aprovada',    'badge-status-aprovada'],
  REPROVADA:   ['Reprovada',   'badge-status-reprovada'],
};

function statusBadge(val) {
  const [label, cls] = STATUS_MAP[val] || [val || '—', 'badge-default'];
  return `<span class="badge ${cls}">${label}</span>`;
}

const DIM_MAP = {
  tecnologica:      'Tecnológica',
  operacional:      'Operacional',
  gerencial:        'Gerencial / Adm.',
  social_ambiental: 'Social e Ambiental',
  outros:           'Outros',
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

    const ps = data.por_status || {};
    document.getElementById('sk-submetida').textContent  = ps.SUBMETIDA  ?? 0;
    document.getElementById('sk-em_analise').textContent = ps.EM_ANALISE ?? 0;
    document.getElementById('sk-aprovada').textContent   = ps.APROVADA   ?? 0;
    document.getElementById('sk-reprovada').textContent  = ps.REPROVADA  ?? 0;

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
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Nenhuma iniciativa registrada ainda.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(i => `
      <tr class="row-clickable" onclick="abrirDetalhe(${i.id})" title="Ver detalhes">
        <td>${i.id}</td>
        <td>${i.titulo_iniciativa || '—'}</td>
        <td>${i.nome_colaborador || '—'}</td>
        <td>${i.area_proponente || '—'}</td>
        <td>${stageBadge(i.estagio_desenvolvimento)}</td>
        <td>${statusBadge(i.status)}</td>
        <td>${fmtDate(i.criado_em)}</td>
      </tr>`).join('');
  } catch { /* silencioso */ }
}

function abrirDetalhe(id) {
  window.location.href = `/admin-detalhe?id=${id}`;
}

/* ── Usuários ────────────────────────────────────────── */
async function loadUsers() {
  try {
    const res = await fetch(`${API}/api/admin/users`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-usuarios');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Nenhum usuário cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(u => {
      const perfisStr = (u.perfis || []).join(', ') || '—';
      const ativoLabel = u.ativo
        ? `<span class="badge badge-status-aprovada">Ativo</span>`
        : `<span class="badge badge-status-reprovada">Inativo</span>`;
      const btnLabel = u.ativo ? 'Desativar' : 'Ativar';
      const btnClass = u.ativo ? 'btn-danger-sm' : 'btn-action-sm';
      return `
        <tr>
          <td>${u.id}</td>
          <td>${u.login}</td>
          <td>${u.nome_completo}</td>
          <td style="font-size:11px;">${perfisStr}</td>
          <td>${ativoLabel}</td>
          <td>${fmtDate(u.ultimo_acesso)}</td>
          <td>
            <button class="${btnClass}" onclick="toggleUser(${u.id}, ${!u.ativo})">${btnLabel}</button>
          </td>
        </tr>`;
    }).join('');
  } catch { /* silencioso */ }
}

async function toggleUser(id, ativo) {
  try {
    const res = await fetch(`${API}/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ ativo }),
    });
    if (res.ok) loadUsers();
  } catch { /* silencioso */ }
}

/* ── Modal Criar Usuário ─────────────────────────────── */
function openCreateUser() {
  document.getElementById('modal-create-user').classList.remove('hidden');
  document.getElementById('form-create-user').reset();
  document.getElementById('cu-result').classList.add('hidden');
}

function closeCreateUser() {
  document.getElementById('modal-create-user').classList.add('hidden');
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-create-user')) closeCreateUser();
}

async function submitCreateUser(e) {
  e.preventDefault();
  const login = document.getElementById('cu-login').value.trim();
  const nome  = document.getElementById('cu-nome').value.trim();
  const email = document.getElementById('cu-email').value.trim();
  const perfis = Array.from(document.querySelectorAll('[name="perfil"]:checked')).map(cb => cb.value);

  const resultEl = document.getElementById('cu-result');
  resultEl.classList.add('hidden');

  try {
    const res = await fetch(`${API}/api/admin/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ login, nome_completo: nome, email, perfis }),
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.className = 'cu-result cu-result-ok';
      resultEl.textContent = `Usuário criado! Senha temporária: ${data.senha_temporaria}`;
      resultEl.classList.remove('hidden');
      loadUsers();
    } else {
      resultEl.className = 'cu-result cu-result-err';
      resultEl.textContent = data.message || 'Erro ao criar usuário.';
      resultEl.classList.remove('hidden');
    }
  } catch {
    const resultEl2 = document.getElementById('cu-result');
    resultEl2.className = 'cu-result cu-result-err';
    resultEl2.textContent = 'Erro de comunicação com o servidor.';
    resultEl2.classList.remove('hidden');
  }
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
  loadUsers();
  loadLogs();
});
