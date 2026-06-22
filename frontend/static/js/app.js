/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Frontend JS (app.js)
   ATENÇÃO: nenhuma chave ou credencial deve estar aqui.
   Toda autenticação é feita via API no backend.
   ══════════════════════════════════════════════════════ */

const API = '';  // mesma origem

/* ── Sessão ─────────────────────────────────────────── */
function getSession() {
  try {
    const raw = sessionStorage.getItem('cedae_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(data) {
  sessionStorage.setItem('cedae_session', JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem('cedae_session');
}

function logout() {
  clearSession();
  location.reload();
}

/* ── UI de sessão ────────────────────────────────────── */
function applySession() {
  const session = getSession();
  const btnAdmin  = document.getElementById('btn-admin');
  const btnLogin  = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  if (!btnAdmin || !btnLogin || !btnLogout) return;

  if (session) {
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    if (session.is_admin) {
      btnAdmin.classList.remove('hidden');
    }
  } else {
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    btnAdmin.classList.add('hidden');
  }
}

/* ── Modal de login ──────────────────────────────────── */
function toggleLoginModal(open) {
  document.getElementById('login-overlay').classList.toggle('hidden', !open);
  document.getElementById('login-modal').classList.toggle('hidden', !open);
  if (open) document.getElementById('login-user').focus();
}

/* ── Modal de Erro ───────────────────────────────────── */
function toggleErrorModal(open, msg) {
  document.getElementById('error-overlay').classList.toggle('hidden', !open);
  document.getElementById('error-modal').classList.toggle('hidden', !open);
  if (open && msg) {
    document.getElementById('error-modal-msg').textContent = msg;
  }
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'Preencha usuário e senha.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      if (res.status >= 500) {
        errEl.textContent = 'Sistema indisponível. Falha de conexão com o servidor (banco de dados).';
      } else {
        errEl.textContent = 'Credenciais inválidas.';
      }
      errEl.classList.remove('hidden');
      return;
    }

    const data = await res.json();
    saveSession({ token: data.access_token, is_admin: data.is_admin, username });
    toggleLoginModal(false);
    applySession();
  } catch {
    errEl.textContent = 'Erro de conexão. Tente novamente.';
    errEl.classList.remove('hidden');
  }
}

/* ── Máscara de moeda BRL ──────────────────────────────── */

/**
 * Converte centavos (inteiro) em string formatada: R$ 1.234,56
 */
function formatBRL(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Handler de input para campos [data-currency].
 * Permite apenas dígitos; reformata a cada tecla.
 */
function currencyInputHandler(e) {
  const el = e.target;
  // Remove tudo que não for dígito
  const digits = el.value.replace(/\D/g, '');
  // Guarda os centavos brutos no dataset para leitura posterior
  el.dataset.cents = digits || '0';
  el.value = digits ? formatBRL(parseInt(digits, 10)) : '';
}

/**
 * Bloqueia teclas não-numéricas (exceto navegação e atalhos).
 */
function currencyKeydownHandler(e) {
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End',
  ];
  if (allowed.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return; // Ctrl+C, Ctrl+V, etc.
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

/**
 * Converte the valor exibido (R$ 1.234,56) de volta para float (1234.56).
 * Retorna null se vazio.
 */
function parseBRL(el) {
  const cents = parseInt(el.dataset.cents || '0', 10);
  return cents ? cents / 100 : null;
}



/**
 * Inicializa as máscaras:
 * - [data-currency]: máscara completa (input exibe R$ formatado)
 * - #retorno_economico: apenas dígitos no input + display formatado no span
 */
function initCurrencyMasks() {
  // Máscara completa para valor_aporte (e demais [data-currency])
  document.querySelectorAll('[data-currency]').forEach((el) => {
    el.addEventListener('keydown', currencyKeydownHandler);
    el.addEventListener('input',   currencyInputHandler);
  });

  // Listener exclusivo para retorno_economico
  const retornoEl = document.getElementById('retorno_economico');
  if (retornoEl) {
    retornoEl.addEventListener('input', function () {
      const digits = this.value.replace(/\D/g, '');
      const num = parseInt(digits || '0', 10);
      this.value = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
      }).format(num / 100);
    });

    retornoEl.addEventListener('focus', function () {
      if (this.value === 'R$ 0,00' || this.value === 'R$\u00A00,00') this.value = '';
    });

    retornoEl.addEventListener('blur', function () {
      if (!this.value) this.value = '';
    });
  }
}

/* ── Mostrar/ocultar campo de valor de aporte ──────────── */
function toggleAporte(show) {
  const wrapper = document.getElementById('valor-aporte-wrapper');
  if (!wrapper) return;
  wrapper.classList.toggle('hidden', !show);
  if (!show) {
    const el = document.getElementById('valor_aporte');
    el.value = '';
    el.dataset.cents = '0';
  }
}

/* ── Validação do formulário ─────────────────────────── */
function validateForm(payload) {
  let valid = true;

  const required = [
    ['nome_colaborador', 'err-nome',     'Informe seu nome completo.'],
    ['canal_contato',    'err-contato',  'Informe um canal de contato.'],
    ['titulo_iniciativa','err-titulo',   'Informe o título da iniciativa.'],
    ['area_proponente',  'err-area',     'Informe a área proponente.'],
    ['local_aplicacao',  'err-local',    'Informe o local de aplicação.'],
    ['problema_pratico', 'err-problema', 'Descreva o problema prático.'],
    ['solucao_proposta', 'err-solucao',  'Descreva a solução proposta.'],
  ];

  required.forEach(([field, errId, msg]) => {
    const el  = document.getElementById(field);
    const err = document.getElementById(errId);
    if (!el || !err) return;
    if (!el.value.trim()) {
      err.textContent = msg;
      valid = false;
    } else {
      err.textContent = '';
    }
  });

  const suportes = document.querySelectorAll('input[name="suporte"]:checked');
  const errSup   = document.getElementById('err-suporte');
  if (suportes.length === 0) {
    errSup.textContent = 'Selecione ao menos um tipo de suporte.';
    valid = false;
  } else {
    errSup.textContent = '';
  }

  return valid;
}

/* ── Coleta de dados do formulário ───────────────────── */
function collectFormData() {
  const g = (id) => (document.getElementById(id)?.value || '').trim();
  const r = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || null;
  const checks = [...document.querySelectorAll('input[name="suporte"]:checked')]
    .map(el => el.value).join('|');

  return {
    nome_colaborador:        g('nome_colaborador'),
    canal_contato:           g('canal_contato'),
    titulo_iniciativa:       g('titulo_iniciativa'),
    area_proponente:         g('area_proponente'),
    local_aplicacao:         g('local_aplicacao'),
    problema_pratico:        g('problema_pratico'),
    solucao_proposta:        g('solucao_proposta'),
    risco_mitigado:          g('risco_mitigado') || null,
    estagio_desenvolvimento: r('estagio_desenvolvimento'),
    macrodimensao:           r('macrodimensao'),
    perfil_impacto:          r('perfil_impacto'),
    aporte_financeiro:       r('aporte_financeiro'),
    // Campos monetários: envia o valor numérico bruto ao backend (como string ou float conforme contrato)
    valor_aporte:      parseBRL(document.getElementById('valor_aporte'))?.toString() || null,
    retorno_economico: parseFloat(
      (document.getElementById('retorno_economico').value || '')
        .replace(/[R$\s\u00A0.]/g, '')
        .replace(',', '.')
    ) || null,
    suporte_necessario:      checks || null,
    comentarios_adicionais:  g('comentarios_adicionais') || null,
  };
}

/* ── Submit ──────────────────────────────────────────── */
async function submitForm(e) {
  e.preventDefault();
  const payload = collectFormData();
  
  if (!validateForm(payload)) {
    toggleErrorModal(true, "Por favor, preencha todos os campos obrigatórios sinalizados em vermelho antes de prosseguir.");
    return;
  }

  const btnText   = document.getElementById('btn-submit-text');
  const btnLoader = document.getElementById('btn-submit-loader');
  const btn       = document.getElementById('btn-submit');
  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');

  try {
    const res = await fetch(`${API}/api/iniciativas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Erro Técnico (oculto ao usuário):', errText);

      let friendlyMsg = 'Não foi possível registrar a sua iniciativa devido a uma falha na comunicação com nossos servidores. Por favor, tente novamente mais tarde.';
      
      if (res.status === 400) {
        friendlyMsg = 'Alguns dados fornecidos são inválidos ou estão formatados incorretamente. Por favor, revise os campos do formulário e tente novamente.';
      }

      toggleErrorModal(true, friendlyMsg);
      return;
    }

    document.getElementById('inovacao-form').classList.add('hidden');
    document.getElementById('form-success').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    alert('Erro de conexão. Verifique sua rede e tente novamente.');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
}

function resetForm() {
  document.getElementById('inovacao-form').reset();
  document.getElementById('inovacao-form').classList.remove('hidden');
  document.getElementById('form-success').classList.add('hidden');
  document.getElementById('valor-aporte-wrapper').classList.add('hidden');
}

/* ── Atalho Enter no modal de login ──────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const modal = document.getElementById('login-modal');
    if (modal && !modal.classList.contains('hidden')) doLogin();
  }
});

/* ── Init ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applySession();
  initCurrencyMasks();
  const form = document.getElementById('inovacao-form');
  if (form) form.addEventListener('submit', submitForm);
});
