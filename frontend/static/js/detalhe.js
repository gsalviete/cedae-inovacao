/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Detalhe de Iniciativa (detalhe.js)
   Autenticação: Kerberos/IIS via /api/me (sem JWT)
   ══════════════════════════════════════════════════════ */

const JANELA_EDICAO_MS = 2 * 60 * 60 * 1000;
const TIPOS_EDITAVEIS = new Set(['TRIAGEM', 'HOMOLOGACAO', 'DESCLASSIFICACAO', 'OBSERVACAO']);
let _pendingStatus = null;
let _justObrig = false;
let _me = null;
let _editTarget = null;
let _iniciativaData = null;

function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return val; }
}

const STATUS_MAP = {
  SUBMETIDA:      ['Submetida',      'badge-status-submetida'],
  EM_ANALISE:     ['Em Análise',     'badge-status-em_analise'],
  EM_OBSERVACAO:  ['Em Observação',  'badge-status-em_observacao'],
  HOMOLOGADA:      ['Homologada',      'badge-status-homologada'],
  DESCLASSIFICADA: ['Desclassificada', 'badge-status-desclassificada'],
};

/* Rótulos de suporte vêm de api.js (SUPORTE_LABEL), compartilhados com o
   formulário público e com a edição administrativa. */
function formatSuporte(val) {
  if (!val) return null;
  return val.split('|').filter(Boolean).map(v => SUPORTE_LABEL[v] || v).join(' · ');
}

function statusBadge(val) {
  const [label, cls] = STATUS_MAP[val] || [val || '—', 'badge-default'];
  return `<span class="badge ${cls}" style="font-size:14px;padding:4px 12px;">${label}</span>`;
}

const TIPO_EVENTO_LABEL = {
  SUBMISSAO:        'Submissão',
  TRIAGEM:          'Triagem',
  HOMOLOGACAO:      'Homologação',
  DESCLASSIFICACAO: 'Desclassificação',
  ANALISE:          'Análise',
  CORRECAO:         'Correção',
  OBSERVACAO:       'Observação',
  REVERSAO:         'Reversão',
};

function getIniciativaId() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('id') || '0', 10);
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '—';
}

/* Converte o valor gravado (chave do domínio) no rótulo de exibição. Valores
   sem rótulo — dados legados ou fora do domínio — são mostrados como estão,
   em vez de sumirem da tela. */
function rotulo(mapa, val) {
  if (!val) return null;
  return mapa[val] || val;
}

/* Marca (ou desmarca) um label como obrigatório. Usado nos campos cuja
   exigência depende do contexto — via de captação, transição, tipo de
   registro —, mantendo o mesmo asterisco dos formulários públicos. */
function marcarObrigatorio(labelId, texto, obrigatorio) {
  const el = document.getElementById(labelId);
  if (!el) return;
  el.innerHTML = obrigatorio ? `${texto} <span class="required">*</span>` : texto;
}

/* ── Carrega dados da iniciativa ─────────────────────── */
async function loadDetalhe() {
  const id = getIniciativaId();
  if (!id) {
    document.getElementById('d-titulo').textContent = 'ID de iniciativa não informado.';
    return;
  }

  try {
    const res = await fetch(`${API}/api/iniciativas/${id}`);
    if (res.status === 401 || res.status === 403) {
      goTo('/');
      return;
    }
    if (!res.ok) {
      document.getElementById('d-titulo').textContent = 'Iniciativa não encontrada.';
      return;
    }
    const data = await res.json();
    _iniciativaData = data;

    document.getElementById('d-titulo').textContent = data.titulo_iniciativa || 'Sem título';
    // Identificação pelo código protocolar; o id interno só aparece nos
    // registros antigos, sem código gerado.
    document.getElementById('d-id').textContent = data.codigo_publico || `#${data.id}`;
    document.getElementById('d-status-badge').innerHTML =
      `${canalBadge(data.canal_codigo || 'VIA_2', true)} ${statusBadge(data.status || 'SUBMETIDA')}`;

    renderOrigem(data);

    setField('d-nome_colaborador', data.nome_colaborador);
    setField('d-canal_contato', data.canal_contato);
    setField('d-email_proponente', data.email_proponente);
    setField('d-area_proponente', data.area_proponente);
    setField('d-local_aplicacao', data.local_aplicacao);
    document.getElementById('d-criado_em').textContent = fmtDate(data.criado_em);

    setField('d-problema_pratico', data.problema_pratico);
    setField('d-solucao_proposta', data.solucao_proposta);
    setField('d-risco_mitigado', data.risco_mitigado);

    setField('d-estagio_desenvolvimento', rotulo(ESTAGIO_LABEL, data.estagio_desenvolvimento));
    setField('d-macrodimensao', rotulo(MACRODIMENSAO_LABEL, data.macrodimensao));
    // Só existe quando a macrodimensão é "outros" — sem isso o campo apareceria
    // vazio para todas as demais iniciativas.
    setField('d-macrodimensao_observacao', data.macrodimensao_observacao);
    document
      .getElementById('d-macrodimensao_observacao-field')
      ?.classList.toggle('hidden', !data.macrodimensao_observacao);
    setField('d-perfil_impacto', rotulo(PERFIL_IMPACTO_LABEL, data.perfil_impacto));
    setField('d-relevancia_estrategica',
      rotulo(RELEVANCIA_LABEL, data.relevancia_estrategica));
    setField('d-classificacao_iniciativa',
      CLASSIFICACAO_LABEL[String(data.classificacao_iniciativa || '').toUpperCase()] || null);

    renderAporte(data);
    // Valores monetários chegam crus da API (número/string em reais); a
    // exibição usa a mesma formatação BRL da máscara dos formulários.
    setField('d-valor_aporte', window.CedaeMoney.display(data.valor_aporte));
    setField('d-retorno_economico', window.CedaeMoney.display(data.retorno_economico));
    setField('d-suporte_necessario', formatSuporte(data.suporte_necessario));
    setField('d-diagnostico_observacao', data.diagnostico_observacao);
    setField('d-comentarios_adicionais', data.comentarios_adicionais);

    await loadAcoes(id, data.status || 'SUBMETIDA');
    await loadHistorico(id);
  } catch {
    document.getElementById('d-titulo').textContent = 'Erro ao carregar iniciativa.';
  }
}

/* ── Bloco de origem (ADR-013) ───────────────────────── */
function renderOrigem(data) {
  const canal = data.canal_codigo || 'VIA_2';
  document.getElementById('d-canal-badge').innerHTML = canalBadge(canal, false);

  const tipo = data.proponente_tipo || 'INTERNO';
  setField('d-proponente_tipo', tipo === 'EXTERNO' ? 'Externo' : 'Interno');

  const show = (fieldId, valueId, value) => {
    const has = value !== null && value !== undefined && value !== '';
    document.getElementById(fieldId)?.classList.toggle('hidden', !has);
    if (has) setField(valueId, value);
  };

  show('d-sistema-field', 'd-sistema_origem', data.sistema_origem);
  show('d-codigo-origem-field', 'd-codigo_origem', data.codigo_origem);
  show('d-org-field', 'd-organizacao_externa', data.organizacao_externa);
  show('d-tipo-inst-field', 'd-tipo_instituicao',
    data.tipo_instituicao ? (TIPO_INSTITUICAO_LABEL[data.tipo_instituicao] || data.tipo_instituicao) : null);
  show('d-registrado-field', 'd-registrado_por_login', data.registrado_por_login);
}

/* ── Aporte financeiro ───────────────────────────────────
   O valor gravado é "sim"/"nao" (formulário público, Bloco III). Aqui vira um
   indicador com ícone; sem aporte previsto, valor estimado e retorno econômico
   somem da tela — a menos que estejam preenchidos, caso em que continuam
   visíveis para não esconder dado já registrado. */
function renderAporte(data) {
  const el = document.getElementById('d-aporte_financeiro');
  const tem = data.aporte_financeiro === 'sim';
  const nao = data.aporte_financeiro === 'nao';

  if (el) {
    if (tem || nao) {
      const ico = window.CedaeUI.icon(tem ? 'check-circle' : 'x-circle');
      el.innerHTML = `<span class="detalhe-flag ${tem ? 'is-ok' : 'is-off'}">${ico}${tem ? 'Sim' : 'Não'}</span>`;
    } else {
      el.textContent = '—';
    }
  }

  document.getElementById('d-valor_aporte-field')
    ?.classList.toggle('hidden', !tem && !data.valor_aporte);
  document.getElementById('d-retorno_economico-field')
    ?.classList.toggle('hidden', !tem && !data.retorno_economico);
}

/* ── Ações de tramitação ─────────────────────────────── */
async function loadAcoes(id, statusAtual) {
  const el = document.getElementById('workflow-acoes');

  // A partir de um status terminal a única ação é a reversão da decisão, que
  // devolve a iniciativa à análise (ADR-015 §4). Nada é apagado: o histórico
  // ganha um evento de reversão a mais.
  const TRANSICOES = {
    SUBMETIDA:  [{ status_destino: 'EM_ANALISE', label: 'Iniciar Análise', classe: 'btn-workflow-info', justObrig: false }],
    EM_ANALISE: [
      { status_destino: 'HOMOLOGADA',      label: 'Homologar',      classe: 'btn-workflow-ok',  justObrig: false },
      { status_destino: 'DESCLASSIFICADA', label: 'Desclassificar', classe: 'btn-workflow-err', justObrig: true  },
    ],
    HOMOLOGADA: [
      { status_destino: 'EM_ANALISE', label: 'Reverter Homologação', classe: 'btn-workflow-warn', justObrig: true, somenteAdm: true },
    ],
    DESCLASSIFICADA: [
      { status_destino: 'EM_ANALISE', label: 'Reverter Desclassificação', classe: 'btn-workflow-warn', justObrig: true, somenteAdm: true },
    ],
  };

  const terminais = ['HOMOLOGADA', 'DESCLASSIFICADA'];
  const ehTerminal = terminais.includes(statusAtual);

  // Homologar/desclassificar — e desfazê-los — são exclusivos de ADM
  // (ADR-014 §10, ADR-015 §4). O colaborador enxerga a esteira, mas não decide.
  const ehAdm = _me?.role === 'ADM';
  const ACOES_EXCLUSIVAS_ADM = new Set(['HOMOLOGADA', 'DESCLASSIFICADA']);
  const acoes = (TRANSICOES[statusAtual] || [])
    .filter(a => ehAdm || !(a.somenteAdm || ACOES_EXCLUSIVAS_ADM.has(a.status_destino)));

  if (!acoes.length) {
    el.innerHTML = ehTerminal
      ? '<p style="color:var(--gray-500);font-size:13px;">Tramitação encerrada. Somente administradores podem reverter esta decisão.</p>'
      : '<p style="color:var(--gray-500);font-size:13px;">Nenhuma ação disponível para o seu perfil. Homologar e desclassificar são exclusivos de administradores.</p>';
    return;
  }

  const aviso = ehTerminal
    ? '<p class="workflow-aviso" data-reveal>A reversão exige justificativa e fica registrada no histórico — nenhum evento anterior é removido.</p>'
    : '';

  el.innerHTML = aviso + acoes.map(a => `
    <button class="btn-workflow ${a.classe}"
            onclick="iniciarTransicao(${id}, '${a.status_destino}', ${a.justObrig}, '${a.label}')">
      ${a.label}
    </button>
  `).join('');
  window.CedaeReveal?.scan(el);
}

function iniciarTransicao(id, statusDestino, justObrig, titulo) {
  _pendingStatus = { id, statusDestino };
  _justObrig = justObrig;

  const labels = {
    EM_ANALISE:      'Iniciar Análise',
    HOMOLOGADA:      'Homologar Iniciativa',
    DESCLASSIFICADA: 'Desclassificar Iniciativa',
  };
  document.getElementById('modal-just-title').textContent =
    titulo || labels[statusDestino] || statusDestino;
  document.getElementById('just-text').value = '';
  document.getElementById('just-error').classList.add('hidden');
  document.getElementById('just-text').placeholder = justObrig
    ? 'Justificativa obrigatória...'
    : 'Justificativa (opcional)...';
  marcarObrigatorio('lbl-justificativa', 'Justificativa', justObrig);

  // Comportamento acessível de modal (role/aria, Escape, foco preso e
  // devolvido, rolagem travada) vem do helper compartilhado em ui.js.
  window.CedaeUI.modal.open('modal-justificativa', {
    focus: '#just-text',
    onClose: closeJustModal,
  });
}

function closeJustModal() {
  window.CedaeUI.modal.close('modal-justificativa');
  _pendingStatus = null;
}

function closeJustModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-justificativa')) closeJustModal();
}

async function confirmarTransicao(btn) {
  if (!_pendingStatus) return;
  const justificativa = document.getElementById('just-text').value.trim();
  const errEl = document.getElementById('just-error');

  if (_justObrig && !justificativa) {
    errEl.textContent = 'Justificativa obrigatória para esta transição.';
    errEl.classList.remove('hidden');
    return;
  }

  window.CedaeUI.busy(btn, true, 'Registrando…');
  try {
    const res = await fetch(`${API}/api/iniciativas/${_pendingStatus.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: _pendingStatus.statusDestino, justificativa: justificativa || undefined }),
    });
    const data = await res.json();

    if (res.ok) {
      closeJustModal();
      // O novo evento entra na timeline com reveal E o toast confirma. Um
      // sem o outro deixaria dúvida se a tramitação foi mesmo registrada.
      window.CedaeUI.toast('Tramitação registrada.', 'ok');
      await loadDetalhe();
    } else {
      errEl.textContent = data.message || 'Erro ao realizar transição.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
  } finally {
    window.CedaeUI.busy(btn, false);
  }
}

/* ── Modal de Observação ─────────────────────────────── */
let _obsId = null;

function abrirModalObservacao(id) {
  _obsId = id;
  document.getElementById('obs-text').value = '';
  document.getElementById('obs-error').classList.add('hidden');
  window.CedaeUI.modal.open('modal-observacao', {
    focus: '#obs-text',
    onClose: closeObsModal,
  });
}

function closeObsModal() {
  window.CedaeUI.modal.close('modal-observacao');
  _obsId = null;
}

function closeObsModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-observacao')) closeObsModal();
}

async function confirmarObservacao(btn) {
  const texto = document.getElementById('obs-text').value.trim();
  const errEl = document.getElementById('obs-error');
  if (!texto) {
    errEl.textContent = 'Digite o texto da observação.';
    errEl.classList.remove('hidden');
    return;
  }
  window.CedaeUI.busy(btn, true, 'Registrando…');
  try {
    const res = await fetch(`${API}/api/iniciativas/${_obsId}/observacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    if (res.ok) {
      closeObsModal();
      window.CedaeUI.toast('Observação registrada.', 'ok');
      await loadDetalhe();
    } else {
      const data = await res.json();
      errEl.textContent = data.message || 'Erro ao registrar observação.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
  } finally {
    window.CedaeUI.busy(btn, false);
  }
}

/* ── Histórico de tramitação ─────────────────────────────
   Mescla eventos de HISTORICO_STATUS e INICIATIVA_OBSERVACOES
   em uma única timeline cronológica. */
async function loadHistorico(id) {
  const el = document.getElementById('historico-timeline');
  try {
    const [histRes, obsRes] = await Promise.all([
      fetch(`${API}/api/iniciativas/${id}/historico`),
      fetch(`${API}/api/iniciativas/${id}/observacoes`),
    ]);
    if (!histRes.ok) return;
    const historico = await histRes.json();
    const observacoes = obsRes.ok ? await obsRes.json() : [];

    const eventos = [
      ...historico.map(h => ({
        kind: 'hist',
        id: h.id,
        tipo_evento: h.tipo_evento,
        usuario_login: h.usuario_login,
        data_hora: h.data_hora,
        editado_em: h.editado_em,
        status_anterior: h.status_anterior,
        status_novo: h.status_novo,
        justificativa: h.justificativa,
      })),
      ...observacoes.map(o => ({
        kind: 'obs',
        id: o.id,
        tipo_evento: 'OBSERVACAO',
        usuario_login: o.usuario_login,
        data_hora: o.criado_em,
        editado_em: o.editado_em,
        status_anterior: null,
        status_novo: null,
        justificativa: o.texto,
      })),
    ].sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));

    if (!eventos.length) {
      // Estado vazio entra com reveal padrão, sem cascata: é uma frase só.
      el.innerHTML = '<p class="obs-vazia" data-reveal>Sem histórico registrado.</p>';
      el.removeAttribute('data-reveal-group');
      window.CedaeReveal?.scan(el);
      return;
    }

    el.innerHTML = eventos.map(ev => renderEvento(ev, id)).join('');
    // A timeline é o componente narrativo da tela: os itens entram em ordem
    // cronológica, com cascata de 60ms e teto de 360ms (o container declara
    // o grupo; o reveal.js distribui os atrasos).
    el.setAttribute('data-reveal-group', '');
    window.CedaeReveal?.scan(el);
  } catch { /* silencioso */ }
}

function podeEditar(ev) {
  if (!_me || !TIPOS_EDITAVEIS.has(ev.tipo_evento)) return false;
  if (ev.usuario_login !== _me.login) return false;
  const idade = Date.now() - new Date(ev.data_hora).getTime();
  return Number.isFinite(idade) && idade <= JANELA_EDICAO_MS;
}

function renderEvento(ev, iniciativaId) {
  const tipoLabel = TIPO_EVENTO_LABEL[ev.tipo_evento] || ev.tipo_evento;
  const autor = ev.usuario_login || 'Sistema';
  const editadoBadge = ev.editado_em
    ? `<span class="badge-editado" title="Editado em ${fmtDate(ev.editado_em)}">editado</span>`
    : '';
  const btnEditar = podeEditar(ev)
    ? `<button class="btn-editar-evento"
               onclick="iniciarEdicao('${ev.kind}', ${iniciativaId}, ${ev.id})">Editar</button>`
    : '';

  if (ev.tipo_evento === 'OBSERVACAO') {
    const cls = 'badge-status-em_observacao';
    const texto = ev.justificativa
      ? `<div class="historico-just" data-evento-texto>"${escapeHtml(ev.justificativa)}"</div>`
      : '';
    return `
      <div class="historico-item" data-reveal data-evento-kind="${ev.kind}" data-evento-id="${ev.id}">
        <div class="historico-dot ${cls}"></div>
        <div class="historico-body">
          <div class="historico-top">
            <span class="badge ${cls}">${tipoLabel}</span>
            ${editadoBadge}
            <span class="historico-data">${fmtDate(ev.data_hora)}</span>
            ${btnEditar}
          </div>
          <div class="historico-desc">Observação registrada por <strong>${autor}</strong></div>
          ${texto}
        </div>
      </div>`;
  }

  const [, cls] = STATUS_MAP[ev.status_novo] || ['', 'badge-default'];
  const anterior = ev.status_anterior
    ? `<span class="historico-seta">${ev.status_anterior} → ${ev.status_novo}</span>`
    : `<span class="historico-seta">Submissão inicial: ${ev.status_novo}</span>`;
  const just = ev.justificativa
    ? `<div class="historico-just" data-evento-texto>"${escapeHtml(ev.justificativa)}"</div>`
    : '';
  return `
    <div class="historico-item" data-reveal data-evento-kind="${ev.kind}" data-evento-id="${ev.id}">
      <div class="historico-dot ${cls}"></div>
      <div class="historico-body">
        <div class="historico-top">
          <span class="badge ${cls}">${tipoLabel}</span>
          ${editadoBadge}
          <span class="historico-data">${fmtDate(ev.data_hora)}</span>
          ${btnEditar}
        </div>
        <div class="historico-desc">${anterior} — por <strong>${autor}</strong></div>
        ${just}
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Edição (janela de 2h, autor) ────────────────────── */
function iniciarEdicao(kind, iniciativaId, recordId) {
  const item = document.querySelector(
    `.historico-item[data-evento-kind="${kind}"][data-evento-id="${recordId}"]`,
  );
  const textoEl = item?.querySelector('[data-evento-texto]');
  const textoAtual = textoEl
    ? textoEl.textContent.replace(/^"|"$/g, '')
    : '';

  _editTarget = { kind, iniciativaId, recordId };
  marcarObrigatorio(
    'lbl-edit-texto',
    kind === 'obs' ? 'Observação' : 'Justificativa',
    kind === 'obs',
  );
  document.getElementById('edit-text').value = textoAtual;
  document.getElementById('edit-error').classList.add('hidden');
  window.CedaeUI.modal.open('modal-edit-evento', {
    focus: '#edit-text',
    onClose: closeEditModal,
  });
}

function closeEditModal() {
  window.CedaeUI.modal.close('modal-edit-evento');
  _editTarget = null;
}

function closeEditModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-edit-evento')) closeEditModal();
}

async function confirmarEdicao(btn) {
  if (!_editTarget) return;
  const texto = document.getElementById('edit-text').value.trim();
  const errEl = document.getElementById('edit-error');
  const { kind, iniciativaId, recordId } = _editTarget;

  if (kind === 'obs' && !texto) {
    errEl.textContent = 'O texto da observação não pode ser vazio.';
    errEl.classList.remove('hidden');
    return;
  }

  const url = kind === 'obs'
    ? `${API}/api/iniciativas/${iniciativaId}/observacao/${recordId}`
    : `${API}/api/iniciativas/${iniciativaId}/historico/${recordId}`;
  const body = kind === 'obs'
    ? { texto }
    : { justificativa: texto || null };

  window.CedaeUI.busy(btn, true, 'Salvando…');
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      closeEditModal();
      window.CedaeUI.toast('Registro atualizado.', 'ok');
      await loadHistorico(iniciativaId);
      return;
    }
    const data = await res.json().catch(() => ({}));
    errEl.textContent = data.message || 'Não foi possível salvar a edição.';
    errEl.classList.remove('hidden');
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
  } finally {
    window.CedaeUI.busy(btn, false);
  }
}

/* ── Init ────────────────────────────────────────────── */
/* ── Edição administrativa da iniciativa (ADM e CONTRIBUTOR) ── */
/* Campos texto/select simples: valor lido e escrito diretamente em `e-<campo>`.
   Os demais (suporte, monetários, classificação) têm tratamento próprio. */
const EDIT_FIELDS = [
  'nome_colaborador', 'canal_contato', 'email_proponente',
  'titulo_iniciativa', 'area_proponente', 'local_aplicacao',
  'problema_pratico', 'solucao_proposta', 'risco_mitigado',
  'estagio_desenvolvimento', 'macrodimensao', 'macrodimensao_observacao',
  'perfil_impacto', 'aporte_financeiro',
  'diagnostico_observacao', 'comentarios_adicionais',
  'relevancia_estrategica',
];

const EDIT_MONEY_FIELDS = ['valor_aporte', 'retorno_economico'];

/* Campos que não podem ser esvaziados na edição: são NOT NULL no banco
   (INOVACAO_INICIATIVAS) — apagar o conteúdo faria o UPDATE falhar. O backend
   valida o mesmo conjunto; aqui é só para avisar antes do envio. */
const EDIT_REQUIRED = {
  titulo_iniciativa: 'o título da iniciativa',
  area_proponente: 'a área proponente',
  local_aplicacao: 'o local de aplicação',
  problema_pratico: 'o problema prático',
};

/* RN-15: o proponente é obrigatório em todas as vias, menos na Captação Externa. */
const EDIT_REQUIRED_PROPONENTE = {
  nome_colaborador: 'o nome do proponente',
  canal_contato: 'o canal de contato',
};

function camposObrigatoriosEdicao() {
  return _iniciativaData?.canal_codigo === 'MAPEAMENTO_EXTERNO'
    ? EDIT_REQUIRED
    : { ...EDIT_REQUIRED, ...EDIT_REQUIRED_PROPONENTE };
}

/* ── Suporte Necessário: mesmas opções do formulário público ──
   (ADR-015 §5.2). Montado uma única vez, na primeira abertura da modal. */
function montarCheckboxesSuporte() {
  const host = document.getElementById('e-suporte_necessario');
  if (!host || host.childElementCount) return;
  host.innerHTML = SUPORTE_OPCOES.map((o) => `
    <label class="checkbox-option">
      <input type="checkbox" name="e-suporte" value="${o.valor}" />
      <span class="checkbox-box"></span>
      <div><strong>${o.titulo}</strong><p>${o.desc}</p></div>
    </label>`).join('');
  host.addEventListener('change', toggleEditDiagnostico);
}

function lerSuporteSelecionado() {
  return [...document.querySelectorAll('input[name="e-suporte"]:checked')]
    .map((el) => el.value);
}

function preencherSuporte(valor) {
  const marcados = new Set(String(valor || '').split('|').filter(Boolean));
  document.querySelectorAll('input[name="e-suporte"]').forEach((el) => {
    el.checked = marcados.has(el.value);
  });
}

/* ── Campos condicionais (mesmo comportamento do formulário público) ── */

/** Descrição da macrodimensão: só com "Outros / Multidimensionais". */
function toggleEditMacroObs() {
  const mostrar = document.getElementById('e-macrodimensao').value === 'outros';
  document.getElementById('e-macrodimensao_observacao-group')
    .classList.toggle('hidden', !mostrar);
  if (!mostrar) document.getElementById('e-macrodimensao_observacao').value = '';
}

/** Apoio diagnóstico: só com a opção correspondente marcada em Suporte. */
function toggleEditDiagnostico() {
  const mostrar = lerSuporteSelecionado().includes('diagnostico');
  document.getElementById('e-diagnostico_observacao-group')
    .classList.toggle('hidden', !mostrar);
  if (!mostrar) document.getElementById('e-diagnostico_observacao').value = '';
}

/* ── Classificação Ação/Projeto (controle segmentado) ── */
function selecionarClassificacao(valor) {
  document.querySelectorAll('#e-classificacao_iniciativa .segmented-option')
    .forEach((btn) => {
      const ativo = btn.dataset.valor === (valor || '');
      btn.classList.toggle('is-active', ativo);
      btn.setAttribute('aria-checked', ativo ? 'true' : 'false');
    });
}

function lerClassificacao() {
  const ativo = document.querySelector(
    '#e-classificacao_iniciativa .segmented-option.is-active',
  );
  return ativo?.dataset.valor || null;
}

function abrirEdicaoIniciativa() {
  if (!_iniciativaData) return;
  montarCheckboxesSuporte();

  EDIT_FIELDS.forEach((f) => {
    const el = document.getElementById(`e-${f}`);
    if (!el) return;
    const val = _iniciativaData[f];
    el.value = (val === null || val === undefined) ? '' : val;
  });

  // Monetários: mesma máscara do formulário público (ADR-015 §5.4).
  window.CedaeMoney.initAll(document.getElementById('modal-edit-iniciativa'));
  EDIT_MONEY_FIELDS.forEach((f) =>
    window.CedaeMoney.setValue(document.getElementById(`e-${f}`), _iniciativaData[f]));

  preencherSuporte(_iniciativaData.suporte_necessario);
  selecionarClassificacao(_iniciativaData.classificacao_iniciativa);

  // Asterisco do par proponente conforme a via (RN-15).
  const exigeProponente = !!camposObrigatoriosEdicao().nome_colaborador;
  marcarObrigatorio('lbl-e-nome', 'Nome do Proponente', exigeProponente);
  marcarObrigatorio('lbl-e-contato', 'Canal de Contato', exigeProponente);

  // Os dois campos condicionais já foram preenchidos acima (EDIT_FIELDS); os
  // toggles apenas os revelam ou os limpam, conforme o gatilho correspondente.
  toggleEditMacroObs();
  toggleEditDiagnostico();

  document.getElementById('edit-ini-error')?.classList.add('hidden');
  // Formulário longo com corpo rolável (.edit-scroll): a trava de rolagem
  // do body não afeta o scroll interno da caixa.
  window.CedaeUI.modal.open('modal-edit-iniciativa', {
    focus: '#e-titulo_iniciativa',
    onClose: closeEditIniciativa,
  });
}

function closeEditIniciativa() {
  window.CedaeUI.modal.close('modal-edit-iniciativa');
}

function closeEditIniciativaOnOverlay(e) {
  if (e.target === document.getElementById('modal-edit-iniciativa')) closeEditIniciativa();
}

async function salvarEdicaoIniciativa() {
  const id = getIniciativaId();
  if (!id) return;
  const errEl = document.getElementById('edit-ini-error');
  const btn = document.getElementById('btn-salvar-iniciativa');

  const payload = {};
  EDIT_FIELDS.forEach((f) => {
    const el = document.getElementById(`e-${f}`);
    if (el) payload[f] = el.value.trim();
  });

  // Campos obrigatórios esvaziados: avisa aqui, sem ida ao servidor.
  for (const [campo, rotulo] of Object.entries(camposObrigatoriosEdicao())) {
    if (payload[campo] !== undefined && !payload[campo]) {
      if (errEl) {
        errEl.textContent = `Não é possível deixar ${rotulo} em branco.`;
        errEl.classList.remove('hidden');
      }
      document.getElementById(`e-${campo}`)?.focus();
      return;
    }
  }

  // Monetários: valor canônico da máscara (Number em reais) ou null.
  EDIT_MONEY_FIELDS.forEach((f) => {
    const valor = window.CedaeMoney.value(document.getElementById(`e-${f}`));
    payload[f] = valor === null ? null : valor;
  });
  // VALOR_APORTE é texto no banco; RETORNO_ECONOMICO é numérico.
  if (payload.valor_aporte !== null) payload.valor_aporte = String(payload.valor_aporte);

  payload.suporte_necessario = lerSuporteSelecionado().join('|');
  // O DTO valida o domínio; "não definido" precisa ir como null, não como "".
  payload.classificacao_iniciativa = lerClassificacao();

  window.CedaeUI.busy(btn, true, 'Salvando…');
  try {
    const res = await fetch(`${API}/api/iniciativas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      closeEditIniciativa();
      window.CedaeUI?.toast('Iniciativa atualizada.', 'ok');
      await loadDetalhe();
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = Array.isArray(data.message) ? data.message.join(' ') : (data.message || 'Não foi possível salvar as alterações.');
      if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    }
  } catch {
    if (errEl) { errEl.textContent = 'Erro de comunicação com o servidor.'; errEl.classList.remove('hidden'); }
  } finally {
    window.CedaeUI.busy(btn, false);
  }
}

/** Liga os controles da modal de edição que não dependem dos dados carregados. */
function initEdicaoIniciativa() {
  document.getElementById('e-macrodimensao')
    ?.addEventListener('change', toggleEditMacroObs);

  document.querySelectorAll('#e-classificacao_iniciativa .segmented-option')
    .forEach((btn) => btn.addEventListener('click', () => selecionarClassificacao(btn.dataset.valor)));
}

document.addEventListener('DOMContentLoaded', async () => {
  const me = await Admin.guard();
  if (!me) return;
  _me = me;
  // Edição administrativa: disponível a ADM e CONTRIBUTOR — o backend
  // (PATCH /api/iniciativas/:id) autoriza os dois perfis, protegido apenas
  // pelo AdminGuard. As restrições de papel seguem sendo homologar e
  // desclassificar, tratadas em loadAcoes().
  document.getElementById('btn-editar-iniciativa')?.classList.remove('hidden');
  initEdicaoIniciativa();
  loadDetalhe();
});
