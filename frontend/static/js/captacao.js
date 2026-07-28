/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Captação Multicanal (captacao.js)
   Registro manual autenticado das Vias 1, 3 e Captação Externa (ADR-013).
   ══════════════════════════════════════════════════════ */

let _canal = null;
let _ultimaIniciativaId = null;

/** Vias em que o proponente é opcional (ADR-015 §6). */
const PROPONENTE_OPCIONAL = new Set(['MAPEAMENTO_EXTERNO']);

const VIA_META = {
  VIA_1: {
    tag: 'Via 1 · SGE/SGP',
    origemTitle: 'Procedência — Sistema Corporativo',
    proponenteTitle: 'Responsável pela Iniciativa',
    nomeLabel: 'Nome do Responsável',
  },
  VIA_3: {
    tag: 'Via 3 · Reunião',
    origemTitle: 'Contexto da Reunião',
    proponenteTitle: 'Proponente / Área',
    nomeLabel: 'Nome do Proponente',
  },
  MAPEAMENTO_EXTERNO: {
    tag: 'Captação Externa',
    origemTitle: 'Instituição de Origem',
    proponenteTitle: 'Contato do Proponente Externo',
    nomeLabel: 'Nome do Contato Externo',
  },
};

/* ── Seleção de via ──────────────────────────────────── */
function selecionarVia(canal) {
  _canal = canal;
  const meta = VIA_META[canal];

  document.querySelectorAll('#via-selector .via-card').forEach((c) =>
    c.classList.toggle('is-active', c.dataset.canal === canal));

  // Bloco de procedência específico da via.
  document.querySelectorAll('.origem-fields').forEach((el) =>
    el.classList.toggle('hidden', el.dataset.origem !== canal));

  document.getElementById('origem-tag').textContent = meta.tag;
  document.getElementById('origem-title').textContent = meta.origemTitle;
  document.getElementById('bloco-proponente-title').textContent = meta.proponenteTitle;

  aplicarObrigatoriedadeProponente(canal, meta);
  aplicarRelevanciaDaVia(canal);

  const form = document.getElementById('captacao-form');
  form.classList.remove('hidden');
  document.getElementById('captacao-success').classList.add('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Obrigatoriedade do proponente por via (RN-15) ───── */
function aplicarObrigatoriedadeProponente(canal, meta) {
  const opcional = PROPONENTE_OPCIONAL.has(canal);
  const asterisco = opcional ? '' : ' <span class="required">*</span>';

  document.getElementById('lbl-nome').innerHTML = `${meta.nomeLabel}${asterisco}`;
  document.getElementById('lbl-contato').innerHTML = `Canal de Contato${asterisco}`;
  document.getElementById('hint-proponente-opcional').classList.toggle('hidden', !opcional);

  // Mensagens de erro anteriores deixam de fazer sentido ao trocar de via.
  setErr('err-nome', '');
  setErr('err-contato', '');
}

/* ── Relevância estratégica por via (RN-14) ──────────────
   A Via 1 (SGE/SGP) é sempre "presente no Planejamento Estratégico" e o
   sistema carimba isso sozinho — o campo aparece travado, apenas informativo.
   O backend reaplica a regra, independentemente do que o formulário enviar. */
function aplicarRelevanciaDaVia(canal) {
  const sel = document.getElementById('relevancia_estrategica');
  const hint = document.getElementById('hint-relevancia');
  if (!sel) return;

  if (canal === 'VIA_1') {
    sel.value = 'PLANEJAMENTO_ESTRATEGICO';
    sel.disabled = true;
    hint.textContent =
      'Definida automaticamente: toda iniciativa registrada a partir do SGE/SGP '
      + 'consta do Planejamento Estratégico.';
  } else {
    sel.disabled = false;
    if (!sel.value) sel.value = 'INDETERMINADA';
    hint.textContent =
      'Avaliação da Assessoria sobre a importância estratégica desta iniciativa.';
  }
}

/* ── Campos condicionais ─────────────────────────────── */
function toggleMacroObs() {
  const show = document.getElementById('macrodimensao').value === 'outros';
  const wrap = document.getElementById('macro-obs-wrapper');
  wrap.classList.toggle('hidden', !show);
  if (!show) document.getElementById('macrodimensao_observacao').value = '';
}

function toggleValorAporte() {
  const show = document.getElementById('aporte_financeiro').value === 'sim';
  const wrap = document.getElementById('valor-aporte-wrapper');
  wrap.classList.toggle('hidden', !show);
  if (!show) {
    const el = document.getElementById('valor_aporte');
    el.value = '';
    el.dataset.cents = '0';
  }
}

/* ── Máscara de moeda ──────────────────────────────────
   Mesma implementação do formulário público (ui.js / CedaeMoney). */
function initCurrency() {
  window.CedaeMoney.initAll();
}

/* ── Validação ───────────────────────────────────────── */
function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}

function validar() {
  let ok = true;
  // O proponente só é exigido nas vias em que ele é conhecido no cadastro
  // (RN-15) — na Captação Externa os dois campos são opcionais.
  const proponente = PROPONENTE_OPCIONAL.has(_canal) ? [] : [
    ['nome_colaborador', 'err-nome', 'Informe o nome.'],
    ['canal_contato', 'err-contato', 'Informe um canal de contato.'],
  ];
  const req = [
    ...proponente,
    ['titulo_iniciativa', 'err-titulo', 'Informe o título.'],
    ['area_proponente', 'err-area', 'Informe a área.'],
    ['local_aplicacao', 'err-local', 'Informe o local de aplicação.'],
    ['problema_pratico', 'err-problema', 'Descreva o problema.'],
  ];
  req.forEach(([id, errId, msg]) => {
    const v = (document.getElementById(id).value || '').trim();
    setErr(errId, v ? '' : msg);
    if (!v) ok = false;
  });

  const email = (document.getElementById('email_proponente').value || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    setErr('err-email', 'E-mail inválido.');
    ok = false;
  } else {
    setErr('err-email', '');
  }

  if (_canal === 'VIA_1') {
    const sis = document.querySelector('input[name="sistema_origem"]:checked');
    setErr('err-sistema', sis ? '' : 'Selecione o sistema de origem.');
    if (!sis) ok = false;
  }
  if (_canal === 'MAPEAMENTO_EXTERNO') {
    const org = (document.getElementById('organizacao_externa').value || '').trim();
    const tipo = document.getElementById('tipo_instituicao').value;
    setErr('err-organizacao', org ? '' : 'Informe a instituição.');
    setErr('err-tipo', tipo ? '' : 'Selecione o tipo de instituição.');
    if (!org) ok = false;
    if (!tipo) ok = false;
  }
  return ok;
}

/* ── Coleta ──────────────────────────────────────────── */
function coletar() {
  const g = (id) => (document.getElementById(id).value || '').trim() || null;
  const money = (id) => window.CedaeMoney.value(document.getElementById(id));

  const payload = {
    canal_codigo: _canal,
    // Via 1 é sempre carimbada pelo backend; enviar aqui apenas reflete a UI.
    relevancia_estrategica: g('relevancia_estrategica'),
    nome_colaborador: g('nome_colaborador') ?? undefined,
    canal_contato: g('canal_contato') ?? undefined,
    email_proponente: g('email_proponente') || undefined,
    titulo_iniciativa: g('titulo_iniciativa'),
    area_proponente: g('area_proponente'),
    local_aplicacao: g('local_aplicacao'),
    problema_pratico: g('problema_pratico'),
    solucao_proposta: g('solucao_proposta'),
    risco_mitigado: g('risco_mitigado'),
    estagio_desenvolvimento: g('estagio_desenvolvimento'),
    macrodimensao: g('macrodimensao'),
    macrodimensao_observacao:
      document.getElementById('macrodimensao').value === 'outros' ? g('macrodimensao_observacao') : null,
    perfil_impacto: g('perfil_impacto'),
    aporte_financeiro: g('aporte_financeiro'),
    valor_aporte: money('valor_aporte')?.toString() ?? null,
    retorno_economico: money('retorno_economico'),
    comentarios_adicionais: g('comentarios_adicionais'),
  };

  if (_canal === 'VIA_1') {
    payload.sistema_origem = document.querySelector('input[name="sistema_origem"]:checked')?.value || null;
    payload.codigo_origem = g('codigo_origem');
  }
  if (_canal === 'VIA_3') {
    payload.data_reuniao = g('data_reuniao');
    payload.area_reuniao = g('area_reuniao');
  }
  if (_canal === 'MAPEAMENTO_EXTERNO') {
    payload.organizacao_externa = g('organizacao_externa');
    payload.tipo_instituicao = document.getElementById('tipo_instituicao').value || null;
  }
  return payload;
}

/* ── Submit ──────────────────────────────────────────── */
async function submitCaptacao(e) {
  e.preventDefault();
  const errBox = document.getElementById('captacao-error');
  errBox.classList.add('hidden');

  if (!validar()) {
    errBox.textContent = 'Revise os campos destacados antes de registrar.';
    errBox.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-cap-submit');
  btn.disabled = true;
  document.getElementById('btn-cap-text').classList.add('hidden');
  document.getElementById('btn-cap-loader').classList.remove('hidden');

  try {
    const res = await fetch(`${API}/api/admin/iniciativas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coletar()),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      _ultimaIniciativaId = data.id;
      document.getElementById('cap-protocol-code').textContent = data.codigo_publico || '—';
      document.getElementById('captacao-form').classList.add('hidden');
      document.getElementById('via-selector').classList.add('hidden');
      document.getElementById('captacao-success').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const msg = Array.isArray(data.message) ? data.message.join(' ') : (data.message || 'Erro ao registrar iniciativa.');
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    }
  } catch {
    errBox.textContent = 'Erro de comunicação com o servidor.';
    errBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    document.getElementById('btn-cap-text').classList.remove('hidden');
    document.getElementById('btn-cap-loader').classList.add('hidden');
  }
}

function novoRegistro() {
  document.getElementById('captacao-form').reset();
  // reset() limpa o texto, mas não o valor canônico da máscara monetária.
  ['valor_aporte', 'retorno_economico'].forEach((id) =>
    window.CedaeMoney.setValue(document.getElementById(id), null));
  document.getElementById('relevancia_estrategica').disabled = false;
  document.getElementById('macro-obs-wrapper').classList.add('hidden');
  document.getElementById('valor-aporte-wrapper').classList.add('hidden');
  document.getElementById('captacao-success').classList.add('hidden');
  document.getElementById('captacao-form').classList.add('hidden');
  document.getElementById('via-selector').classList.remove('hidden');
  document.querySelectorAll('#via-selector .via-card').forEach((c) => c.classList.remove('is-active'));
  _canal = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Admin.guard())) return;
  initCurrency();
  document.getElementById('captacao-form').addEventListener('submit', submitCaptacao);
  document.getElementById('cap-ver-detalhe').addEventListener('click', () => {
    if (_ultimaIniciativaId) goTo(`/admin/iniciativa?id=${_ultimaIniciativaId}`);
  });
});
