/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Admin Panel JS (admin.js)
   Autenticação: Kerberos/IIS via /api/me (sem JWT)
   ══════════════════════════════════════════════════════ */

let _currentUser = null;

/* ── Guard: verifica acesso via /api/me ──────────────── */
async function checkAdmin() {
  try {
    const res = await fetch(`${API}/api/me`);
    if (res.status === 401) { redirectToLogin(); return false; }
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
  setTimeout(() => goTo('/'), 2000);
}

/* logout() é compartilhado (api.js): encerra a sessão e vai para /login. */

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
  HOMOLOGADA:      ['Homologada',      'badge-status-homologada'],
  DESCLASSIFICADA: ['Desclassificada', 'badge-status-desclassificada'],
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
    document.getElementById('sk-homologada').textContent      = ps.HOMOLOGADA      ?? 0;
    document.getElementById('sk-desclassificada').textContent = ps.DESCLASSIFICADA ?? 0;

    const barEl = document.getElementById('dimensao-bars');
    barEl.innerHTML = '';
    const dims = data.por_dimensao || {};
    const max  = Math.max(...Object.values(dims), 1);

    Object.entries(dims).forEach(([key, count]) => {
      const label = DIM_MAP[key] || key;
      const pct   = Math.round((count / max) * 100);
      barEl.insertAdjacentHTML('beforeend', `
        <div class="bar-row fade-in">
          <span class="bar-label" title="${label}">${label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>
          <span class="bar-count">${count}</span>
        </div>`);
    });

    // Anima as barras preenchendo após o fade-in dos rows
    requestAnimationFrame(() => {
      Object.values(dims).forEach((count, idx) => {
        const pct  = Math.round((count / max) * 100);
        const fill = barEl.children[idx]?.querySelector('.bar-fill');
        if (fill) fill.style.width = `${pct}%`;
      });
    });

    if (!Object.keys(dims).length) {
      barEl.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Nenhuma iniciativa registrada ainda.</p>';
    }
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
      <tr class="row-clickable fade-in" onclick="abrirDetalhe(${i.id})" title="Ver detalhes">
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
  goTo(`/admin-detalhe?id=${id}`);
}

/* ── Usuários Administrativos (ADMIN_USERS) ─────────── */
async function loadUsers() {
  try {
    const res = await fetch(`${API}/api/admin/users`);
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('tbody-usuarios');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhum usuário administrativo cadastrado.</td></tr>';
      return;
    }
    const isAdm = _currentUser?.role === 'ADM';
    tbody.innerHTML = data.map(u => {
      const roleLabel = u.role === 'ADM'
        ? '<span class="badge badge-status-homologada">Administrador</span>'
        : '<span class="badge badge-status-em_analise">Colaborador</span>';
      const ativoLabel = u.ativo
        ? '<span class="badge badge-status-homologada">Ativo</span>'
        : '<span class="badge badge-status-desclassificada">Inativo</span>';
      const protegerAdm = u.role === 'ADM' && u.ativo;
      const acoes = isAdm ? (
        protegerAdm
          ? `<button class="btn-danger-sm" disabled
                     title="Administradores não podem ser desativados.">Desativar</button>`
          : `<button class="${u.ativo ? 'btn-danger-sm' : 'btn-action-sm'}"
                     onclick="toggleUser(${u.id}, ${!u.ativo})">${u.ativo ? 'Desativar' : 'Ativar'}</button>`
      ) : '—';
      return `
        <tr class="fade-in">
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
let _adSelected = null;
let _adSearchTimer = null;

function openCreateUser() {
  document.getElementById('modal-create-user').classList.remove('hidden');
  document.getElementById('form-create-user').reset();
  document.getElementById('cu-result').classList.add('hidden');
  clearAdSelection();
}

function closeCreateUser() {
  document.getElementById('modal-create-user').classList.add('hidden');
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-create-user')) closeCreateUser();
}

function clearAdSelection() {
  _adSelected = null;
  document.getElementById('cu-nome').value = '';
  document.getElementById('cu-email').value = '';
  document.getElementById('cu-login').value = '';
  document.getElementById('cu-submit').disabled = true;
  hideAdDropdown();
}

function hideAdDropdown() {
  document.getElementById('cu-ad-dropdown').classList.add('hidden');
}

async function onAdSearchInput() {
  clearAdSelection();
  const termo = document.getElementById('cu-ad-search').value.trim();
  clearTimeout(_adSearchTimer);
  if (termo.length < 2) { hideAdDropdown(); return; }
  _adSearchTimer = setTimeout(() => buscarUsuariosAD(termo), 300);
}

async function buscarUsuariosAD(termo) {
  const dropdown = document.getElementById('cu-ad-dropdown');
  dropdown.innerHTML = '<div class="ad-lov-empty">Buscando...</div>';
  dropdown.classList.remove('hidden');
  try {
    const res = await fetch(`${API}/api/admin/ad-users?q=${encodeURIComponent(termo)}`);
    if (!res.ok) {
      let msg = `Erro ao buscar (HTTP ${res.status}).`;
      try { const err = await res.json(); if (err.message) msg = err.message; } catch { /* corpo não é JSON */ }
      dropdown.innerHTML = `<div class="ad-lov-empty">${msg}</div>`;
      return;
    }
    const data = await res.json();

    if (!data.length) {
      dropdown.innerHTML = '<div class="ad-lov-empty">Nenhum usuário encontrado.</div>';
    } else {
      dropdown.innerHTML = data.map(u => `
        <div class="ad-lov-item" onclick="selecionarUsuarioAD('${u.nome.replace(/'/g, "\\'")}')">
          ${u.nome}
          <span class="ad-lov-item-email">${u.email}</span>
        </div>`).join('');
    }
  } catch {
    dropdown.innerHTML = '<div class="ad-lov-empty">Erro de comunicação com o servidor.</div>';
  }
}

async function selecionarUsuarioAD(nome) {
  document.getElementById('cu-ad-search').value = nome;
  hideAdDropdown();

  const resultEl = document.getElementById('cu-result');
  resultEl.classList.add('hidden');

  try {
    const res = await fetch(`${API}/api/admin/ad-users/resolve?nome=${encodeURIComponent(nome)}`);
    const data = await res.json();
    if (!res.ok || !data.login || !data.email) {
      resultEl.className = 'cu-result cu-result-err';
      resultEl.textContent = 'Não foi possível resolver e-mail/login para esse usuário.';
      resultEl.classList.remove('hidden');
      return;
    }
    _adSelected = { nome, email: data.email, login: data.login };
    document.getElementById('cu-nome').value = nome;
    document.getElementById('cu-email').value = data.email;
    document.getElementById('cu-login').value = data.login;
    document.getElementById('cu-submit').disabled = false;
  } catch {
    resultEl.className = 'cu-result cu-result-err';
    resultEl.textContent = 'Erro de comunicação com o servidor.';
    resultEl.classList.remove('hidden');
  }
}

document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.ad-lov-wrapper');
  if (wrapper && !wrapper.contains(e.target)) hideAdDropdown();
});

async function submitCreateUser(e) {
  e.preventDefault();
  if (!_adSelected) return;
  const { nome, email, login } = _adSelected;
  const role = document.getElementById('cu-role').value;

  const resultEl = document.getElementById('cu-result');
  resultEl.classList.add('hidden');

  try {
    const res = await fetch(`${API}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, nome, email, role }),
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.className = 'cu-result cu-result-ok';
      resultEl.textContent = `Usuário '${nome}' adicionado como ${role}.`;
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

/* ── Logs (lazy load no primeiro toggle) ─────────────── */
let _logsLoaded = false;

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
    tbody.innerHTML = data.map(l => `
      <tr class="fade-in">
        <td>${l.username || '—'}</td>
        <td>${l.acao || '—'}</td>
        <td>${l.detalhe || '—'}</td>
        <td>${fmtDate(l.criado_em)}</td>
      </tr>`).join('');
  } catch { /* silencioso */ }
}

function toggleLogs() {
  const body   = document.getElementById('logs-body');
  const toggle = document.getElementById('logs-toggle');
  const open   = body.classList.toggle('hidden');
  toggle.setAttribute('aria-expanded', String(!open));
  toggle.classList.toggle('is-open', !open);
  if (!open && !_logsLoaded) {
    _logsLoaded = true;
    loadLogs();
  }
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await checkAdmin())) return;
  loadKPIs();
  loadIniciativas();
  loadUsers();
});
