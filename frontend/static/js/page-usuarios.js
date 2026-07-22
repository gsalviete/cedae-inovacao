/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Usuários (page-usuarios.js)
   Lista administradores e permite criar/ativar/desativar (ADM).
   A criação resolve login/e-mail no Active Directory. Admin.* de core.
   ══════════════════════════════════════════════════════ */

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
    const isAdm = Admin.me?.role === 'ADM';
    tbody.innerHTML = data.map((u) => {
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
          <td>${Admin.fmtDate(u.criado_em)}</td>
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
      dropdown.innerHTML = data.map((u) => `
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

document.addEventListener('DOMContentLoaded', async () => {
  const me = await Admin.guard();
  if (!me) return;
  // "Novo Admin" é exclusivo de ADM.
  if (me.role !== 'ADM') document.getElementById('btn-novo-admin')?.classList.add('hidden');
  loadUsers();
});
