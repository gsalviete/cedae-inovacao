/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Usuários (page-usuarios.js)
   Lista administradores e permite criar/ativar/desativar (ADM).
   A criação resolve login/e-mail no Active Directory. Admin.* de core.
   ══════════════════════════════════════════════════════ */

/* Cache dos usuários carregados — usado pela modal de visualização. */
let _users = [];

async function loadUsers() {
  try {
    const res = await fetch(`${API}/api/admin/users`);
    if (!res.ok) return;
    const data = await res.json();
    _users = data;
    const tbody = document.getElementById('tbody-usuarios');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Nenhum usuário cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((u) => {
      const roleLabel = u.role === 'ADM'
        ? '<span class="badge badge-status-homologada">Administrador</span>'
        : '<span class="badge badge-status-em_analise">Colaborador</span>';
      const ativoLabel = u.ativo
        ? '<span class="badge badge-status-homologada">Ativo</span>'
        : '<span class="badge badge-status-desclassificada">Inativo</span>';
      // tabindex/role: a linha é clicável e precisa existir para o teclado.
      // Enter/Espaço são tratados pelo handler delegado de ui.js.
      return `
        <tr class="fade-in row-clickable" onclick="verUsuario(${u.id})" title="Ver detalhes"
            tabindex="0" role="button" aria-label="Ver detalhes de ${Admin.escapeHtml(u.nome || u.login)}">
          <td>${u.nome || '—'}</td>
          <td>${roleLabel}</td>
          <td>${ativoLabel}</td>
          <td>${Admin.fmtDate(u.criado_em)}</td>
        </tr>`;
    }).join('');
  } catch { /* silencioso */ }
}

/* ── Visualização de usuário ─────────────────────────────
   A linha inteira abre esta modal. A gestão (promover / ativar-desativar)
   fica aqui e só aparece para ADM em usuários que não sejam ele mesmo.
   Ninguém rebaixa ninguém — apenas promoção (ADR-014 §10). */
let _vuId = null;

function verUsuario(id) {
  const u = _users.find((x) => x.id === id);
  if (!u) return;
  _vuId = id;
  Admin.setText('vu-login', u.login);
  Admin.setText('vu-nome', u.nome || '—');
  Admin.setText('vu-role', u.role === 'ADM' ? 'Administrador' : 'Colaborador');
  Admin.setText('vu-ativo', u.ativo ? 'Ativo' : 'Inativo');
  Admin.setText('vu-desde', Admin.fmtDate(u.criado_em));
  renderGestaoUsuario(u);
  // Abre pelo helper compartilhado: role/aria, Escape, armadilha de foco,
  // trava de rolagem e devolução do foco à linha de origem (ui.js).
  CedaeUI.modal.open('modal-view-user', { onClose: closeViewUser });
}

function renderGestaoUsuario(u) {
  const el = document.getElementById('vu-gestao');
  if (!el) return;
  const isAdm = Admin.me?.role === 'ADM';
  const ehProprio = u.login === Admin.me?.login;

  if (!isAdm) { el.innerHTML = ''; return; }
  if (ehProprio) {
    el.innerHTML = '<p class="vu-gestao-hint">Você não pode editar o seu próprio usuário.</p>';
    return;
  }

  const botoes = [];
  // `this` vai junto para que o botão possa entrar em estado de carregamento
  // no clique — toda ação que altera dado confirma na hora que foi recebida.
  // Promoção a administrador (não há rebaixamento).
  if (u.role !== 'ADM') {
    botoes.push(`<button class="btn-action-sm" onclick="promoverUsuario(${u.id}, this)">Promover a Administrador</button>`);
  }
  // Ativar / desativar.
  botoes.push(u.ativo
    ? `<button class="btn-danger-sm" onclick="alterarStatusUsuario(${u.id}, false, this)">Desativar</button>`
    : `<button class="btn-action-sm" onclick="alterarStatusUsuario(${u.id}, true, this)">Ativar</button>`);

  el.innerHTML = `<span class="vu-gestao-label">Gestão</span><div class="vu-gestao-acoes">${botoes.join(' ')}</div>`;
}

function closeViewUser() {
  CedaeUI.modal.close('modal-view-user');
  _vuId = null;
}

function closeViewUserOnOverlay(e) {
  if (e.target === document.getElementById('modal-view-user')) closeViewUser();
}

/* ── Promoção a administrador — só ADM (sem rebaixamento) ── */
async function promoverUsuario(id, btn) {
  CedaeUI.busy(btn, true, 'Promovendo…');
  try {
    const res = await fetch(`${API}/api/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADM' }),
    });
    if (res.ok) {
      closeViewUser();
      CedaeUI.toast('Usuário promovido a Administrador.', 'ok');
      loadUsers();
      return;
    }
    const data = await res.json().catch(() => ({}));
    CedaeUI.toast(data.message || 'Não foi possível promover o usuário.', 'erro');
  } catch {
    CedaeUI.toast('Erro de comunicação com o servidor.', 'erro');
  } finally {
    CedaeUI.busy(btn, false);
  }
}

async function alterarStatusUsuario(id, ativo, btn) {
  CedaeUI.busy(btn, true, ativo ? 'Ativando…' : 'Desativando…');
  try {
    const res = await fetch(`${API}/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo }),
    });
    if (res.ok) {
      closeViewUser();
      CedaeUI.toast(ativo ? 'Usuário ativado.' : 'Usuário desativado.', 'ok');
      loadUsers();
      return;
    }
    const data = await res.json().catch(() => ({}));
    CedaeUI.toast(data.message || 'Não foi possível atualizar o status.', 'erro');
  } catch {
    CedaeUI.toast('Erro de comunicação com o servidor.', 'erro');
  } finally {
    CedaeUI.busy(btn, false);
  }
}

/* ── Modal Criar Admin ───────────────────────────────── */
let _adSelected = null;
let _adSearchTimer = null;

function openCreateUser() {
  document.getElementById('form-create-user').reset();
  document.getElementById('cu-result').classList.add('hidden');
  clearAdSelection();
  // O foco vai direto para a busca do AD: é o primeiro (e único) campo que
  // o usuário precisa preencher — os demais são resolvidos a partir dele.
  CedaeUI.modal.open('modal-create-user', {
    focus: '#cu-ad-search',
    onClose: closeCreateUser,
  });
}

function closeCreateUser() {
  CedaeUI.modal.close('modal-create-user');
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
  const btnSubmit = document.getElementById('cu-submit');
  CedaeUI.busy(btnSubmit, true, 'Adicionando…');

  try {
    const res = await fetch(`${API}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, nome, email, role }),
    });
    const data = await res.json();
    if (res.ok) {
      // Fecha a modal, atualiza a listagem e dá feedback fora da modal.
      closeCreateUser();
      const perfilLabel = role === 'ADM' ? 'Administrador' : 'Colaborador';
      CedaeUI.toast(`Usuário '${nome}' adicionado como ${perfilLabel}.`, 'ok');
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
  } finally {
    CedaeUI.busy(btnSubmit, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const me = await Admin.guard();
  if (!me) return;
  // "Novo Admin" é exclusivo de ADM.
  if (me.role !== 'ADM') document.getElementById('btn-novo-admin')?.classList.add('hidden');
  loadUsers();
});
