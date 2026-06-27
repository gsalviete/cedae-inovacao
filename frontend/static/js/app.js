/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Frontend JS (app.js)
   Autenticação: Kerberos/IIS via x-remote-user (sem senha)
   ══════════════════════════════════════════════════════ */

const API = '';
const EMAIL_REGEX = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

/* ── Header: identifica usuário via /api/me ──────────── */
async function initHeader() {
  try {
    const res = await fetch(`${API}/api/me`);
    if (!res.ok) return;
    const me = await res.json();

    const greeting = document.getElementById('user-greeting');
    if (greeting) {
      greeting.textContent = me.nome || me.login;
      greeting.classList.remove('hidden');
    }

    const btnAdmin = document.getElementById('btn-admin');
    if (btnAdmin && me.admin) {
      btnAdmin.classList.remove('hidden');
    }
  } catch { /* silencioso — sem IIS em dev, header pode estar ausente */ }
}

/* ── Modal de Erro ───────────────────────────────────── */
function toggleErrorModal(open, msg) {
  document.getElementById('error-overlay').classList.toggle('hidden', !open);
  document.getElementById('error-modal').classList.toggle('hidden', !open);
  if (open && msg) {
    document.getElementById('error-modal-msg').textContent = msg;
  }
}

/* ── Máscara de moeda BRL ──────────────────────────────── */

function formatBRL(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function currencyInputHandler(e) {
  const el = e.target;
  const digits = el.value.replace(/\D/g, '');
  el.dataset.cents = digits || '0';
  el.value = digits ? formatBRL(parseInt(digits, 10)) : '';
}

function currencyKeydownHandler(e) {
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End',
  ];
  if (allowed.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

function parseBRL(el) {
  const cents = parseInt(el.dataset.cents || '0', 10);
  return cents ? cents / 100 : null;
}

function initCurrencyMasks() {
  document.querySelectorAll('[data-currency]').forEach((el) => {
    el.addEventListener('keydown', currencyKeydownHandler);
    el.addEventListener('input',   currencyInputHandler);
  });

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
      if (this.value === 'R$ 0,00' || this.value === 'R$ 0,00') this.value = '';
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

/* ── Máscara condicional de Canal de Contato (ramal/celular) ──
   Até 6 dígitos: tratado como ramal (sem formatação).
   7+ dígitos: formatado como celular (xx) xxxxx-xxxx, limitado a 11 dígitos. */
function formatCanalContato(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 6) return digits;
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function canalContatoInputHandler(e) {
  e.target.value = formatCanalContato(e.target.value);
}

/* ── Mostrar/ocultar observação de Apoio Diagnóstico ───── */
function toggleDiagnosticoObservacao() {
  const chk = document.getElementById('chk_diagnostico');
  const wrapper = document.getElementById('diagnostico-observacao-wrapper');
  if (!chk || !wrapper) return;
  const show = chk.checked;
  wrapper.classList.toggle('hidden', !show);
  if (!show) {
    document.getElementById('diagnostico_observacao').value = '';
  }
}

/* ── Validação do formulário ─────────────────────────── */
function validateForm(payload) {
  let valid = true;

  const required = [
    ['nome_colaborador', 'err-nome',     'Informe seu nome completo.'],
    ['canal_contato',    'err-contato',  'Informe um canal de contato.'],
    ['email_proponente', 'err-email',    'Informe seu e-mail.'],
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

  const emailEl  = document.getElementById('email_proponente');
  const emailErr = document.getElementById('err-email');
  if (emailEl && emailErr && emailEl.value.trim()) {
    if (!EMAIL_REGEX.test(emailEl.value.trim())) {
      emailErr.textContent = 'Informe um e-mail válido (ex.: nome@dominio.com).';
      valid = false;
    }
  }

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
  const diagSelecionado = checks.split('|').includes('diagnostico');

  return {
    nome_colaborador:        g('nome_colaborador'),
    canal_contato:           g('canal_contato'),
    email_proponente:        g('email_proponente'),
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
    valor_aporte:      parseBRL(document.getElementById('valor_aporte'))?.toString() || null,
    retorno_economico: parseFloat(
      (document.getElementById('retorno_economico').value || '')
        .replace(/[R$\s .]/g, '')
        .replace(',', '.')
    ) || null,
    suporte_necessario:      checks || null,
    diagnostico_observacao:  diagSelecionado ? (g('diagnostico_observacao') || null) : null,
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
  document.getElementById('diagnostico-observacao-wrapper').classList.add('hidden');
}

/* ── Init ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initCurrencyMasks();
  const form = document.getElementById('inovacao-form');
  if (form) form.addEventListener('submit', submitForm);

  const chkDiag = document.getElementById('chk_diagnostico');
  if (chkDiag) chkDiag.addEventListener('change', toggleDiagnosticoObservacao);

  const canalEl = document.getElementById('canal_contato');
  if (canalEl) canalEl.addEventListener('input', canalContatoInputHandler);

  const emailEl  = document.getElementById('email_proponente');
  const emailErr = document.getElementById('err-email');
  if (emailEl && emailErr) {
    emailEl.addEventListener('blur', () => {
      const v = emailEl.value.trim();
      if (!v) { emailErr.textContent = ''; return; }
      emailErr.textContent = EMAIL_REGEX.test(v)
        ? ''
        : 'Informe um e-mail válido (ex.: nome@dominio.com).';
    });
    emailEl.addEventListener('input', () => {
      if (emailErr.textContent) emailErr.textContent = '';
    });
  }
});
