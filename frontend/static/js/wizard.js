/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Wizard do formulário público (wizard.js)
   Converte os blocos do #inovacao-form em etapas guiadas, sem
   alterar campos, ids ou a submissão. A validação final continua
   sendo a de app.js (validateForm/submitForm); aqui há apenas uma
   verificação leve por etapa para melhorar a experiência.
   ══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const form = document.getElementById('inovacao-form');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.form-block'));
  if (steps.length < 2) return;   // sem blocos suficientes, mantém o formulário linear

  const footer = form.querySelector('.form-footer');
  const btnSubmit = document.getElementById('btn-submit');

  // Rótulos curtos e ícones por etapa (fallback: título do bloco).
  const LABELS = ['Proponente', 'Iniciativa', 'Escopo', 'Classificação', 'Suporte'];
  const ICONS  = ['users', 'file-text', 'lightbulb', 'layers', 'badge-check'];
  const ic = (name) => (window.CedaeUI && window.CedaeUI.icon ? window.CedaeUI.icon(name) : '');
  const label = (i) => LABELS[i] || (steps[i].querySelector('.block-title')?.textContent || `Etapa ${i + 1}`);

  let current = 0;
  let maxReached = 0;

  /* ── Monta o indicador de progresso ────────────────── */
  const progress = document.createElement('div');
  progress.className = 'wizard-progress';
  progress.innerHTML = `
    <div class="wizard-progress-top">
      <b id="wizard-title">${label(0)}</b>
      <span class="wizard-progress-count">Etapa <b id="wizard-cur">1</b> de ${steps.length}</span>
    </div>
    <div class="wizard-steps" id="wizard-steps">
      ${steps.map((_, i) => `
        <button type="button" class="wizard-step-pill" data-step="${i}" aria-label="${label(i)}">
          <span class="wizard-step-dot" data-num="${i + 1}">${i + 1}</span>
          <span class="wizard-step-label">${label(i)}</span>
        </button>`).join('')}
    </div>
    <div class="wizard-progress-bar"><i id="wizard-bar"></i></div>`;
  // Dentro do form: assim o progresso some junto na tela de sucesso e reaparece no reset.
  form.insertBefore(progress, form.firstChild);

  steps.forEach((s, i) => {
    s.classList.add('wizard-step');
    s.setAttribute('data-step', i);
  });

  /* ── Navegação ─────────────────────────────────────── */
  const nav = document.createElement('div');
  nav.className = 'wizard-nav';
  nav.innerHTML = `
    <button type="button" class="btn-ghost" id="wizard-prev">${ic('arrow-left')} Voltar</button>
    <div class="wizard-spacer"></div>
    <button type="button" class="btn-primary btn-next" id="wizard-next">Próximo ${ic('arrow-right')}</button>`;
  form.appendChild(nav);

  // Alerta de etapa
  const alert = document.createElement('div');
  alert.className = 'wizard-alert';
  alert.id = 'wizard-alert';
  alert.innerHTML = `${ic('alert-triangle')} <span>Preencha os campos obrigatórios desta etapa para continuar.</span>`;
  nav.parentNode.insertBefore(alert, nav.nextSibling);

  // Move o botão de submit (mantém id e binding) para a navegação; some com o footer.
  const navRight = nav; // o submit fica ao lado do "Próximo"
  if (btnSubmit) navRight.appendChild(btnSubmit);
  if (footer) footer.style.display = 'none';

  const prevBtn = document.getElementById('wizard-prev');
  const nextBtn = document.getElementById('wizard-next');
  const pills = Array.from(progress.querySelectorAll('.wizard-step-pill'));

  /* ── Validação leve da etapa atual ─────────────────── */
  const EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

  function validateStep(i) {
    const step = steps[i];
    const campos = step.querySelectorAll('input[required], textarea[required]');
    let ok = true;
    let primeiro = null;
    campos.forEach((el) => {
      const vazio = !el.value.trim();
      const emailRuim = el.type === 'email' && el.value.trim() && !EMAIL.test(el.value.trim());
      if (vazio || emailRuim) {
        el.classList.add('is-invalid');
        if (!primeiro) primeiro = el;
        ok = false;
      } else {
        el.classList.remove('is-invalid');
      }
    });
    if (!ok && primeiro) primeiro.focus();
    return ok;
  }

  // Limpa o estado inválido ao digitar
  form.addEventListener('input', (e) => {
    if (e.target.classList && e.target.classList.contains('is-invalid')) {
      e.target.classList.remove('is-invalid');
      hideAlert();
    }
  });

  function showAlert() { alert.classList.add('show'); }
  function hideAlert() { alert.classList.remove('show'); }

  /* ── Render de uma etapa ───────────────────────────── */
  function render() {
    const last = current === steps.length - 1;

    steps.forEach((s, i) => s.classList.toggle('is-active', i === current));

    pills.forEach((p, i) => {
      // done se já passou, active se é a etapa atual, senão pendente
      const st = i < current ? 'done' : (i === current ? 'active' : 'todo');
      p.setAttribute('data-state', st);
      p.setAttribute('data-done', i <= maxReached ? '1' : '0');
      const dot = p.querySelector('.wizard-step-dot');
      dot.innerHTML = i < current ? ic('check-circle') : String(i + 1);
    });

    document.getElementById('wizard-title').textContent = label(current);
    document.getElementById('wizard-cur').textContent = String(current + 1);
    document.getElementById('wizard-bar').style.width =
      `${Math.round(((current + 1) / steps.length) * 100)}%`;

    prevBtn.disabled = current === 0;
    prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
    nextBtn.classList.toggle('hidden', last);
    if (btnSubmit) btnSubmit.classList.toggle('hidden', !last);
    hideAlert();
  }

  function goTo(i, { skipValidation } = {}) {
    if (i > current && !skipValidation) {
      // avançar exige validar cada etapa intermediária
      for (let s = current; s < i; s++) {
        if (!validateStep(s)) { current = s; render(); showAlert(); return; }
      }
    }
    current = Math.max(0, Math.min(steps.length - 1, i));
    maxReached = Math.max(maxReached, current);
    render();
    progress.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  nextBtn.addEventListener('click', () => {
    if (validateStep(current)) goTo(current + 1, { skipValidation: true });
    else showAlert();
  });
  prevBtn.addEventListener('click', () => goTo(current - 1, { skipValidation: true }));

  pills.forEach((p, i) => {
    p.addEventListener('click', () => {
      if (i <= maxReached) goTo(i);   // só permite ir a etapas já alcançadas
    });
  });

  // Reinício após submissão bem-sucedida (chamado por app.js resetForm).
  window.CedaeWizard = {
    reset() {
      current = 0;
      maxReached = 0;
      steps.forEach((s) => s.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid')));
      render();
    },
  };

  render();
})();
