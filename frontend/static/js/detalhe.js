/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Detalhe de Iniciativa (detalhe.js)
   Autenticação: Kerberos/IIS via /api/me (sem JWT)
   ══════════════════════════════════════════════════════ */

const API = '';
const JANELA_EDICAO_MS = 2 * 60 * 60 * 1000;
const TIPOS_EDITAVEIS = new Set(['TRIAGEM', 'APROVACAO', 'REPROVACAO', 'OBSERVACAO']);
let _pendingStatus = null;
let _justObrig = false;
let _me = null;
let _editTarget = null;

function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return val; }
}

const STATUS_MAP = {
  SUBMETIDA:      ['Submetida',      'badge-status-submetida'],
  EM_ANALISE:     ['Em Análise',     'badge-status-em_analise'],
  EM_OBSERVACAO:  ['Em Observação',  'badge-status-em_observacao'],
  APROVADA:       ['Aprovada',       'badge-status-aprovada'],
  REPROVADA:      ['Reprovada',      'badge-status-reprovada'],
};

const SUPORTE_MAP = {
  instrumentos_juridicos: 'Instrumentos Técnicos e Jurídicos',
  academia:               'Conexão com Academia',
  mercado_startups:       'Conexão com Mercado / Startups',
  sinergia_interna:       'Sinergia Interdepartamental',
  monitoramento:          'Monitoramento Corporativo',
  diagnostico:            'Apoio Diagnóstico',
};

function formatSuporte(val) {
  if (!val) return null;
  return val.split('|').filter(Boolean).map(v => SUPORTE_MAP[v] || v).join(' · ');
}

function statusBadge(val) {
  const [label, cls] = STATUS_MAP[val] || [val || '—', 'badge-default'];
  return `<span class="badge ${cls}" style="font-size:14px;padding:4px 12px;">${label}</span>`;
}

const TIPO_EVENTO_LABEL = {
  SUBMISSAO:  'Submissão',
  TRIAGEM:    'Triagem',
  APROVACAO:  'Aprovação',
  REPROVACAO: 'Reprovação',
  ANALISE:    'Análise',
  CORRECAO:   'Correção',
  OBSERVACAO: 'Observação',
};

function getIniciativaId() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('id') || '0', 10);
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '—';
}

function logout() {
  window.location.href = '/';
}

/* ── Guard via /api/me ───────────────────────────────── */
async function checkAdmin() {
  try {
    const res = await fetch(`${API}/api/me`);
    if (!res.ok) { redirectHome(); return false; }
    const me = await res.json();
    if (!me.admin) { redirectHome(); return false; }
    _me = me;
    return true;
  } catch {
    redirectHome();
    return false;
  }
}

function redirectHome() {
  const content = document.getElementById('detalhe-content');
  const guard   = document.getElementById('admin-guard');
  if (content) content.classList.add('hidden');
  if (guard)   guard.classList.remove('hidden');
  setTimeout(() => window.location.href = '/', 2000);
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
      window.location.href = '/';
      return;
    }
    if (!res.ok) {
      document.getElementById('d-titulo').textContent = 'Iniciativa não encontrada.';
      return;
    }
    const data = await res.json();

    document.getElementById('d-titulo').textContent = data.titulo_iniciativa || 'Sem título';
    document.getElementById('d-id').textContent = `#${data.id}`;
    document.getElementById('d-status-badge').innerHTML = statusBadge(data.status || 'SUBMETIDA');

    setField('d-nome_colaborador', data.nome_colaborador);
    setField('d-canal_contato', data.canal_contato);
    setField('d-email_proponente', data.email_proponente);
    setField('d-area_proponente', data.area_proponente);
    setField('d-local_aplicacao', data.local_aplicacao);
    document.getElementById('d-criado_em').textContent = fmtDate(data.criado_em);

    setField('d-problema_pratico', data.problema_pratico);
    setField('d-solucao_proposta', data.solucao_proposta);
    setField('d-risco_mitigado', data.risco_mitigado);

    setField('d-estagio_desenvolvimento', data.estagio_desenvolvimento);
    setField('d-macrodimensao', data.macrodimensao);
    setField('d-perfil_impacto', data.perfil_impacto);

    setField('d-aporte_financeiro', data.aporte_financeiro);
    setField('d-valor_aporte', data.valor_aporte);
    setField('d-retorno_economico', data.retorno_economico);
    setField('d-suporte_necessario', formatSuporte(data.suporte_necessario));
    setField('d-diagnostico_observacao', data.diagnostico_observacao);
    setField('d-comentarios_adicionais', data.comentarios_adicionais);

    await loadAcoes(id, data.status || 'SUBMETIDA');
    await loadHistorico(id);
  } catch {
    document.getElementById('d-titulo').textContent = 'Erro ao carregar iniciativa.';
  }
}

/* ── Ações de tramitação ─────────────────────────────── */
async function loadAcoes(id, statusAtual) {
  const el = document.getElementById('workflow-acoes');

  const TRANSICOES = {
    SUBMETIDA:  [{ status_destino: 'EM_ANALISE', label: 'Iniciar Análise', classe: 'btn-workflow-info', justObrig: false }],
    EM_ANALISE: [
      { status_destino: 'APROVADA',  label: 'Aprovar',  classe: 'btn-workflow-ok',  justObrig: false },
      { status_destino: 'REPROVADA', label: 'Reprovar', classe: 'btn-workflow-err', justObrig: true  },
    ],
    APROVADA:  [],
    REPROVADA: [],
  };

  const terminais = ['APROVADA', 'REPROVADA'];
  const acoes = TRANSICOES[statusAtual] || [];
  const ehTerminal = terminais.includes(statusAtual);

  if (ehTerminal) {
    el.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Tramitação encerrada — nenhuma ação disponível.</p>';
    return;
  }

  el.innerHTML = acoes.map(a => `
    <button class="btn-workflow ${a.classe}"
            onclick="iniciarTransicao(${id}, '${a.status_destino}', ${a.justObrig})">
      ${a.label}
    </button>
  `).join('');
}

function iniciarTransicao(id, statusDestino, justObrig) {
  _pendingStatus = { id, statusDestino };
  _justObrig = justObrig;

  const labels = {
    EM_ANALISE: 'Iniciar Análise',
    APROVADA:   'Aprovar Iniciativa',
    REPROVADA:  'Reprovar Iniciativa',
  };
  document.getElementById('modal-just-title').textContent = labels[statusDestino] || statusDestino;
  document.getElementById('just-text').value = '';
  document.getElementById('just-error').classList.add('hidden');
  document.getElementById('just-text').placeholder = justObrig
    ? 'Justificativa obrigatória...'
    : 'Justificativa (opcional)...';

  document.getElementById('modal-justificativa').classList.remove('hidden');
}

function closeJustModal() {
  document.getElementById('modal-justificativa').classList.add('hidden');
  _pendingStatus = null;
}

function closeJustModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-justificativa')) closeJustModal();
}

async function confirmarTransicao() {
  if (!_pendingStatus) return;
  const justificativa = document.getElementById('just-text').value.trim();
  const errEl = document.getElementById('just-error');

  if (_justObrig && !justificativa) {
    errEl.textContent = 'Justificativa obrigatória para esta transição.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API}/api/iniciativas/${_pendingStatus.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: _pendingStatus.statusDestino, justificativa: justificativa || undefined }),
    });
    const data = await res.json();

    if (res.ok) {
      closeJustModal();
      await loadDetalhe();
    } else {
      errEl.textContent = data.message || 'Erro ao realizar transição.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
  }
}

/* ── Modal de Observação ─────────────────────────────── */
let _obsId = null;

function abrirModalObservacao(id) {
  _obsId = id;
  document.getElementById('obs-text').value = '';
  document.getElementById('obs-error').classList.add('hidden');
  document.getElementById('modal-observacao').classList.remove('hidden');
}

function closeObsModal() {
  document.getElementById('modal-observacao').classList.add('hidden');
  _obsId = null;
}

function closeObsModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-observacao')) closeObsModal();
}

async function confirmarObservacao() {
  const texto = document.getElementById('obs-text').value.trim();
  const errEl = document.getElementById('obs-error');
  if (!texto) {
    errEl.textContent = 'Digite o texto da observação.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const res = await fetch(`${API}/api/iniciativas/${_obsId}/observacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    if (res.ok) {
      closeObsModal();
      await loadDetalhe();
    } else {
      const data = await res.json();
      errEl.textContent = data.message || 'Erro ao registrar observação.';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
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
      el.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Sem histórico registrado.</p>';
      return;
    }

    el.innerHTML = eventos.map(ev => renderEvento(ev, id)).join('');
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
      <div class="historico-item" data-evento-kind="${ev.kind}" data-evento-id="${ev.id}">
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
    <div class="historico-item" data-evento-kind="${ev.kind}" data-evento-id="${ev.id}">
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
  document.getElementById('edit-text').value = textoAtual;
  document.getElementById('edit-error').classList.add('hidden');
  document.getElementById('modal-edit-evento').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('modal-edit-evento').classList.add('hidden');
  _editTarget = null;
}

function closeEditModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-edit-evento')) closeEditModal();
}

async function confirmarEdicao() {
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

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      closeEditModal();
      await loadHistorico(iniciativaId);
      return;
    }
    const data = await res.json().catch(() => ({}));
    errEl.textContent = data.message || 'Não foi possível salvar a edição.';
    errEl.classList.remove('hidden');
  } catch {
    errEl.textContent = 'Erro de comunicação com o servidor.';
    errEl.classList.remove('hidden');
  }
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await checkAdmin())) return;
  loadDetalhe();
});
