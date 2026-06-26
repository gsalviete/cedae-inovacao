/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Detalhe de Iniciativa (detalhe.js)
   Autenticação: Kerberos/IIS via /api/me (sem JWT)
   ══════════════════════════════════════════════════════ */

const API = '';
let _pendingStatus = null;
let _justObrig = false;

function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return val; }
}

const STATUS_MAP = {
  SUBMETIDA:   ['Submetida',   'badge-status-submetida'],
  EM_ANALISE:  ['Em Análise',  'badge-status-em_analise'],
  APROVADA:    ['Aprovada',    'badge-status-aprovada'],
  REPROVADA:   ['Reprovada',   'badge-status-reprovada'],
};

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
    setField('d-suporte_necessario', data.suporte_necessario);
    setField('d-comentarios_adicionais', data.comentarios_adicionais);

    await loadAcoes(id, data.status || 'SUBMETIDA');
    await loadHistorico(id);
  } catch {
    document.getElementById('d-titulo').textContent = 'Erro ao carregar iniciativa.';
  }
}

/* ── Ações de workflow ───────────────────────────────── */
async function loadAcoes(id, statusAtual) {
  const el = document.getElementById('workflow-acoes');

  const TRANSICOES = {
    SUBMETIDA:  [{ status_destino: 'EM_ANALISE',  label: 'Iniciar Análise', classe: 'btn-workflow-info', justObrig: false }],
    EM_ANALISE: [
      { status_destino: 'APROVADA',   label: 'Aprovar',   classe: 'btn-workflow-ok',   justObrig: false },
      { status_destino: 'REPROVADA',  label: 'Reprovar',  classe: 'btn-workflow-err',  justObrig: true  },
    ],
    APROVADA:   [],
    REPROVADA:  [],
  };

  const acoes = TRANSICOES[statusAtual] || [];
  if (!acoes.length) {
    el.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Nenhuma ação disponível — status terminal.</p>';
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

/* ── Histórico de status ─────────────────────────────── */
async function loadHistorico(id) {
  const el = document.getElementById('historico-timeline');
  try {
    const res = await fetch(`${API}/api/iniciativas/${id}/historico`);
    if (!res.ok) return;
    const data = await res.json();

    if (!data.length) {
      el.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Sem histórico registrado.</p>';
      return;
    }

    el.innerHTML = data.map(h => {
      const [, cls] = STATUS_MAP[h.status_novo] || ['', 'badge-default'];
      const tipoLabel = TIPO_EVENTO_LABEL[h.tipo_evento] || h.tipo_evento;
      const autor = h.usuario_login || 'Sistema';
      const anterior = h.status_anterior
        ? `<span class="historico-seta">${h.status_anterior} → ${h.status_novo}</span>`
        : `<span class="historico-seta">Submissão inicial: ${h.status_novo}</span>`;
      const just = h.justificativa ? `<div class="historico-just">"${h.justificativa}"</div>` : '';
      return `
        <div class="historico-item">
          <div class="historico-dot ${cls}"></div>
          <div class="historico-body">
            <div class="historico-top">
              <span class="badge ${cls}">${tipoLabel}</span>
              <span class="historico-data">${fmtDate(h.data_hora)}</span>
            </div>
            <div class="historico-desc">${anterior} — por <strong>${autor}</strong></div>
            ${just}
          </div>
        </div>`;
    }).join('');
  } catch { /* silencioso */ }
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await checkAdmin())) return;
  loadDetalhe();
});
