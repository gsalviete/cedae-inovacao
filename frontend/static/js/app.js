/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Frontend JS (app.js)
   Autenticação: Kerberos/IIS via x-remote-user (sem senha)
   ══════════════════════════════════════════════════════ */

const EMAIL_REGEX = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

/* ── Header: identifica usuário via /api/me ──────────────
   O formulário é PÚBLICO: sem identidade (401) a página funciona normalmente,
   apenas sem saudação/painel. Não há login nem logout — a identidade vem do
   header x-remote-user que o IIS injeta em toda requisição. */
async function initHeader() {
  try {
    const res = await fetch(`${API}/api/me`);
    if (!res.ok) return; // anônimo — segue usando o formulário
    const me = await res.json();

    renderGreeting(me);

    const btnAdmin = document.getElementById('btn-admin');
    if (btnAdmin && me.admin) {
      btnAdmin.classList.remove('hidden');
    }

    // Usuário autenticado SEM perfil administrativo: exige aceite dos Termos
    // de Uso no primeiro acesso (ADR-014 §12-bis).
    if (me.login && !me.admin && typeof verificarTermos === 'function') {
      verificarTermos();
    }
  } catch {
    // falha de rede não deve travar o formulário
  }
}

/* ── Modal do Aviso de Privacidade (LGPD) ─────────────────
   O aviso mora só na modal: o formulário em etapas é área de preenchimento,
   não de texto informativo. Aberto pelo link do topo e pelo checkbox de
   ciência da última etapa, sem tirar o proponente de onde ele está. */
let _avisoOrigemFoco = null;

function abrirAvisoPrivacidade() {
  const modal = document.getElementById('aviso-modal');
  if (!modal) return;

  _avisoOrigemFoco = document.activeElement;
  document.getElementById('aviso-overlay').classList.remove('hidden');
  document.getElementById('aviso-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('aviso-modal-fechar')?.focus();
}

function fecharAvisoPrivacidade() {
  document.getElementById('aviso-overlay')?.classList.add('hidden');
  document.getElementById('aviso-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
  // Devolve o foco a quem abriu (o link dentro do checkbox de ciência).
  if (_avisoOrigemFoco && document.contains(_avisoOrigemFoco)) _avisoOrigemFoco.focus();
  _avisoOrigemFoco = null;
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
/* A implementação vive em ui.js (window.CedaeMoney): mesma máscara, mesmo
   bloqueio de teclas e mesmo parse usados pelo cadastro manual e pela edição
   administrativa (ADR-015 §5.4). Aqui ficam só os atalhos usados pelo form. */
function parseBRL(el) {
  return window.CedaeMoney.value(el);
}

function initCurrencyMasks() {
  window.CedaeMoney.initAll();
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

/* ── Mostrar/ocultar descrição da Macrodimensão ─────────
   Aparece só em "Outros / Multidimensionais", mesmo padrão do Apoio Diagnóstico. */
function toggleMacrodimensaoObservacao() {
  const outros = document.getElementById('radio_macro_outros');
  const wrapper = document.getElementById('macrodimensao-observacao-wrapper');
  if (!outros || !wrapper) return;
  const show = outros.checked;
  wrapper.classList.toggle('hidden', !show);
  if (!show) {
    document.getElementById('macrodimensao_observacao').value = '';
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

  // Ciência do aviso de privacidade (LGPD): sem ela não há envio. O backend
  // repete a exigência — esta validação é só para o usuário não perder o envio.
  const ciencia    = document.getElementById('ciencia_privacidade');
  const errCiencia = document.getElementById('err-ciencia');
  if (ciencia && errCiencia) {
    if (!ciencia.checked) {
      errCiencia.textContent =
        'É necessário confirmar a ciência do aviso de privacidade para enviar a proposta.';
      valid = false;
    } else {
      errCiencia.textContent = '';
    }
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
  const macroOutros = r('macrodimensao') === 'outros';

  return {
    nome_colaborador:        g('nome_colaborador'),
    canal_contato:           g('canal_contato'),
    email_proponente:        g('email_proponente'),
    titulo_iniciativa:       g('titulo_iniciativa'),
    area_proponente:         g('area_proponente'),
    local_aplicacao:         g('local_aplicacao'),
    problema_pratico:        g('problema_pratico'),
    solucao_proposta:        g('solucao_proposta') || null,
    risco_mitigado:          g('risco_mitigado') || null,
    estagio_desenvolvimento: r('estagio_desenvolvimento'),
    macrodimensao:           r('macrodimensao'),
    macrodimensao_observacao: macroOutros ? (g('macrodimensao_observacao') || null) : null,
    perfil_impacto:          r('perfil_impacto'),
    aporte_financeiro:       r('aporte_financeiro'),
    valor_aporte:      parseBRL(document.getElementById('valor_aporte'))?.toString() || null,
    retorno_economico: parseBRL(document.getElementById('retorno_economico')),
    suporte_necessario:      checks || null,
    diagnostico_observacao:  diagSelecionado ? (g('diagnostico_observacao') || null) : null,
    comentarios_adicionais:  g('comentarios_adicionais') || null,
    // Ciência do aviso de privacidade (LGPD) — registrada na auditoria.
    ciencia_privacidade: !!document.getElementById('ciencia_privacidade')?.checked,
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

    // Exibe o protocolo gerado (INOV-AAAA-NNN) na tela de sucesso.
    let codigo = null;
    try { codigo = (await res.json())?.codigo_publico ?? null; } catch { /* sem corpo */ }
    const protoWrap = document.getElementById('success-protocol');
    const protoCode = document.getElementById('success-protocol-code');
    if (protoWrap && protoCode && codigo) {
      protoCode.textContent = codigo;
      protoWrap.classList.remove('hidden');
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
  document.getElementById('success-protocol')?.classList.add('hidden');
  document.getElementById('valor-aporte-wrapper').classList.add('hidden');
  document.getElementById('diagnostico-observacao-wrapper').classList.add('hidden');
  document.getElementById('macrodimensao-observacao-wrapper').classList.add('hidden');
  // form.reset() já desmarca a ciência; o erro precisa sumir junto.
  const errCiencia = document.getElementById('err-ciencia');
  if (errCiencia) errCiencia.textContent = '';
  // Volta o wizard para a primeira etapa (quando presente).
  window.CedaeWizard?.reset();
}

/* ── Init ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initCurrencyMasks();
  const form = document.getElementById('inovacao-form');
  if (form) form.addEventListener('submit', submitForm);

  const chkDiag = document.getElementById('chk_diagnostico');
  if (chkDiag) chkDiag.addEventListener('change', toggleDiagnosticoObservacao);

  // Marcar a ciência limpa o erro na hora, sem esperar novo envio.
  const chkCiencia = document.getElementById('ciencia_privacidade');
  if (chkCiencia) {
    chkCiencia.addEventListener('change', () => {
      if (chkCiencia.checked) document.getElementById('err-ciencia').textContent = '';
    });
  }

  // Links que abrem o aviso: o do topo da página e o embutido na frase do
  // checkbox de ciência. Este último vive dentro do <label>, então o clique
  // precisa ser contido — sem isso, ler o aviso marcaria a caixa sozinho.
  ['link-aviso-hero', 'link-aviso-privacidade'].forEach((id) => {
    const link = document.getElementById(id);
    if (!link) return;
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      abrirAvisoPrivacidade();
    });
  });

  // Esc fecha a modal do aviso (o modal de Termos tem fluxo próprio e não é
  // dispensável por Esc — ali a decisão é obrigatória).
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!document.getElementById('aviso-modal')?.classList.contains('hidden')) {
      fecharAvisoPrivacidade();
    }
  });

  // Qualquer troca no grupo dispara o toggle — inclusive sair de "outros"
  // para outra opção, que precisa esconder e limpar o campo.
  document.querySelectorAll('input[name="macrodimensao"]').forEach((el) => {
    el.addEventListener('change', toggleMacrodimensaoObservacao);
  });

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
