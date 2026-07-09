/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Tela de Login (login.js)
   Autenticação direta no Active Directory via /api/auth/login.
   Em caso de sucesso, o backend emite o cookie de sessão e
   redirecionamos para a aplicação.
   ══════════════════════════════════════════════════════ */

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.add('show');
}

function clearLoginError() {
  const el = document.getElementById('login-error');
  el.textContent = '';
  el.classList.remove('show');
}

function setLoading(loading) {
  document.getElementById('btn-login').disabled = loading;
  document.getElementById('btn-login-text').classList.toggle('hidden', loading);
  document.getElementById('btn-login-loader').classList.toggle('hidden', !loading);
}

async function submitLogin(e) {
  e.preventDefault();
  clearLoginError();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showLoginError('Informe usuário e senha.');
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      // Sessão criada (cookie httpOnly). Segue para a aplicação.
      goTo('/');
      return;
    }

    let msg = 'Usuário ou senha inválidos.';
    if (res.status === 403) {
      msg = 'Usuário sem permissão de acesso ao sistema.';
    } else if (res.status >= 500) {
      msg = 'Serviço indisponível no momento. Tente novamente em instantes.';
    } else {
      try {
        const data = await res.json();
        if (data && data.message) {
          msg = Array.isArray(data.message) ? data.message.join(' ') : data.message;
        }
      } catch { /* corpo não é JSON — mantém a mensagem padrão */ }
    }
    showLoginError(msg);
  } catch {
    showLoginError('Erro de conexão. Verifique sua rede e tente novamente.');
  } finally {
    setLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', submitLogin);
  document.getElementById('username')?.focus();
});
