/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Admin Panel JS (admin.js)
   Autenticação: Kerberos/IIS via /api/me (sem JWT)
   ══════════════════════════════════════════════════════ */

const API = '';
let _currentUser = null;

/* ── Guard: verifica acesso via /api/me ──────────────── */
async function checkAdmin() {
  try {
    const res = await fetch(`${API}/api/me`);
    if (!res.ok) { redirectHome(); return false; }
    const me = await res.json();
    if (!me.admin) { redirectHome(); return false; }
    _currentUser = me;

    // Oculta botão "+ Novo Admin" para CONTRIBUTOR
    const btnNovo = document.getElementById('btn-novo-admin');
    if (btnNovo && me.role !== 'ADM') btnNovo.classList.add('hidden');

    return true;
  } catch {
    redirectHome();
    return false;
  }
}

function redirectHome() {
  document.getElementById('admin-content').classList.add('hidden');
  document.getElementById('admin-guard').classList.remove('hidden');
  setTimeout(() => window.location.href = '/', 2000);
}

function logout() {
  window.location.href = '/';
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
  SUBMETIDA:     ['Submetida',     'badge-status-submetida'],
  EM_ANALISE:    ['Em Análise',    'badge-status-em_analise'],
  EM_OBSERVACAO: ['Em Observação', 'badge-status-em_observacao'],
  APROVADA:      ['Aprovada',      'badge-status-aprovada'],
  REPROVADA:     ['Reprovada',     'badge-status-reprovada'],
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
    const res = await fetch(`${API}/api/admin/kpis`);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('kpi-total').textContent   = data.total_iniciativas ?? '—';
    document.getElementById('kpi-ideacao').textContent = data.por_estagio?.ideacao ?? 0;
    document.getElementById('kpi-piloto').textContent  = data.por_estagio?.piloto  ?? 0;
    document.getElementById('kpi-escala').textContent  = data.por_estagio?.escala  ?? 0;

    const ps = data.por_status || {};
    document.getElementById('sk-submetida').textContent    = ps.SUBMETIDA    ?? 0;
    document.getElementById('sk-em_analise').textContent   = ps.EM_ANALISE   ?? 0;
    document.getElementById('sk-em_observacao').textContent = ps.EM_OBSERVACAO ?? 0;
    document.getElementById('sk-aprovada').textContent     = ps.APROVADA     ?? 0;
    document.getElementById('sk-reprovada').textContent    = ps.REPROVADA    ?? 0;

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
    const res = await fetch(`${API}/api/admin/acessos`);
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
    const res = await fetch(`${API}/api/iniciativas/`);
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

/* ── Usuários Administrativos (ADMIN_USERS) ─────────── */
async function loadUsers() {
  try {
    const res = await fetch(`${API}/api/admin/users`);
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-usuarios');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Nenhum usuário administrativo cadastrado.</td></tr>';
      return;
    }
    const isAdm = _currentUser?.role === 'ADM';
    tbody.innerHTML = data.map(u => {
      const roleLabel = u.role === 'ADM'
        ? '<span class="badge badge-status-aprovada">ADM</span>'
        : '<span class="badge badge-status-em_analise">CONTRIBUTOR</span>';
      const ativoLabel = u.ativo
        ? '<span class="badge badge-status-aprovada">Ativo</span>'
        : '<span class="badge badge-status-reprovada">Inativo</span>';
      const acoes = isAdm ? `
        <button class="${u.ativo ? 'btn-danger-sm' : 'btn-action-sm'}"
                onclick="toggleUser(${u.id}, ${!u.ativo})">${u.ativo ? 'Desativar' : 'Ativar'}</button>
      ` : '—';
      return `
        <tr>
          <td>${u.id}</td>
          <td>${u.login}</td>
          <td>${u.nome || '—'}</td>
          <td>${roleLabel}</td>
          <td>${ativoLabel}</td>
          <td>${fmtDate(u.criado_em)}</td>
          <td>${acoes}</td>
        </tr>`;
    }).join('');
  } catch { /* silencioso */ }
}

async function toggleUser(id, ativo) {
  try {
    const res = await fetch(`${API}/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo }),
    });
    if (res.ok) loadUsers();
  } catch { /* silencioso */ }
}

/* ── Modal Criar Admin ───────────────────────────────── */
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
  const nome  = document.getElementById('cu-nome').value.trim() || undefined;
  const role  = document.getElementById('cu-role').value;

  const resultEl = document.getElementById('cu-result');
  resultEl.classList.add('hidden');

  try {
    const res = await fetch(`${API}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, nome, role }),
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.className = 'cu-result cu-result-ok';
      resultEl.textContent = `Usuário '${login}' adicionado como ${role}.`;
      resultEl.classList.remove('hidden');
      loadUsers();
    } else {
      resultEl.className = 'cu-result cu-result-err';
      resultEl.textContent = data.message || 'Erro ao criar usuário.';
      resultEl.classList.remove('hidden');
    }
  } catch {
    resultEl.className = 'cu-result cu-result-err';
    resultEl.textContent = 'Erro de comunicação com o servidor.';
    resultEl.classList.remove('hidden');
  }
}

/* ── Logs ────────────────────────────────────────────── */
async function loadLogs() {
  try {
    const res = await fetch(`${API}/api/admin/logs`);
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
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await checkAdmin())) return;
  loadKPIs();
  loadAcessos();
  loadIniciativas();
  loadUsers();
  loadLogs();
});
