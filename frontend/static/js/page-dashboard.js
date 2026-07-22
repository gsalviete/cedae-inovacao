/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Página Dashboard (page-dashboard.js)
   KPIs executivos, funil da inovação, captação por canal, distribuição
   por macrodimensão e cards de atenção. Consome /api/admin/kpis e
   /api/iniciativas (somente leitura). Helpers em admin-core.js (Admin.*).
   ══════════════════════════════════════════════════════ */

const CANAL_ORDER = ['VIA_1', 'VIA_2', 'VIA_3', 'MAPEAMENTO_EXTERNO'];
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) requestAnimationFrame(() => { el.style.width = `${pct}%`; });
}

/* ── KPIs + agregados ────────────────────────────────── */
async function loadKPIs() {
  try {
    const res = await fetch(`${API}/api/admin/kpis`);
    if (!res.ok) return;
    const data = await res.json();

    Admin.setNum('kpi-total',   data.total_iniciativas ?? 0);
    Admin.setNum('kpi-ideacao', data.por_estagio?.ideacao ?? 0);
    Admin.setNum('kpi-piloto',  data.por_estagio?.piloto  ?? 0);
    Admin.setNum('kpi-escala',  data.por_estagio?.escala  ?? 0);

    const ps = data.por_status || {};
    Admin.setNum('sk-submetida',       ps.SUBMETIDA       ?? 0);
    Admin.setNum('sk-em_analise',      ps.EM_ANALISE      ?? 0);
    Admin.setNum('sk-homologada',      ps.HOMOLOGADA      ?? 0);
    Admin.setNum('sk-desclassificada', ps.DESCLASSIFICADA ?? 0);

    renderFunnel(data);
    renderDimensao(data.por_dimensao || {});
    renderCanalKpis(data);
  } catch { /* silencioso */ }
}

/* ── Funil da inovação ───────────────────────────────── */
function renderFunnel(data) {
  const est = data.por_estagio || {};
  const st  = data.por_status  || {};
  const stages = [
    ['ideacao', est.ideacao ?? 0],
    ['analise', st.EM_ANALISE ?? 0],
    ['homolog', st.HOMOLOGADA ?? 0],
    ['piloto',  est.piloto ?? 0],
    ['escala',  est.escala ?? 0],
  ];
  const max = Math.max(...stages.map((s) => s[1]), 1);
  const totalRef = data.total_iniciativas || stages.reduce((a, s) => a + s[1], 0) || 1;
  stages.forEach(([key, val]) => {
    Admin.setNum(`fn-${key}`, val);
    setWidth(`fnb-${key}`, Math.round((val / max) * 100));
    const share = document.getElementById(`fns-${key}`);
    if (share) share.textContent = val ? `${Math.round((val / totalRef) * 100)}% do total` : '—';
  });
}

/* ── Distribuição por macrodimensão ──────────────────── */
function renderDimensao(dims) {
  const barEl = document.getElementById('dimensao-bars');
  if (!barEl) return;
  barEl.innerHTML = '';
  const max = Math.max(...Object.values(dims), 1);

  Object.entries(dims).forEach(([key, count]) => {
    const label = Admin.dimLabel(key);
    barEl.insertAdjacentHTML('beforeend', `
      <div class="bar-row fade-in">
        <span class="bar-label" title="${label}">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>
        <span class="bar-count">${count}</span>
      </div>`);
  });

  requestAnimationFrame(() => {
    Object.values(dims).forEach((count, idx) => {
      const pct  = Math.round((count / max) * 100);
      const fill = barEl.children[idx]?.querySelector('.bar-fill');
      if (fill) fill.style.width = `${pct}%`;
    });
  });

  if (!Object.keys(dims).length) {
    barEl.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">Nenhuma iniciativa registrada ainda.</p>';
  }
}

/* ── Captação por canal (ADR-013 §14) ────────────────── */
function renderCanalKpis(data) {
  const porCanal = data.por_canal || {};
  const homolog = data.homologacao_por_canal || {};

  CANAL_ORDER.forEach((canal) => {
    Admin.setText(`ck-${canal}`, porCanal[canal] ?? 0);
    const rateEl = document.getElementById(`cr-${canal}`);
    if (rateEl) {
      const h = homolog[canal];
      rateEl.textContent = h && h.total ? `${h.taxa}% homolog.` : '—';
    }
  });

  const prop = data.por_proponente || {};
  const interno = prop.INTERNO ?? 0;
  const externo = prop.EXTERNO ?? 0;
  const totalProp = interno + externo || 1;
  Admin.setText('split-interno', interno);
  Admin.setText('split-externo', externo);
  setWidth('split-interno-fill', Math.round((interno / totalProp) * 100));
  setWidth('split-externo-fill', Math.round((externo / totalProp) * 100));

  const breakdown = document.getElementById('canal-breakdown');
  if (breakdown) {
    const blocks = [];
    const sist = data.via1_por_sistema || {};
    if (Object.keys(sist).length) {
      blocks.push(breakdownBlock('Via 1 · por sistema de origem',
        Object.entries(sist).map(([k, v]) => [k, v])));
    }
    const tipos = data.externa_por_tipo || {};
    if (Object.keys(tipos).length) {
      blocks.push(breakdownBlock('Captação Externa · por instituição',
        Object.entries(tipos).map(([k, v]) => [TIPO_INSTITUICAO_LABEL[k] || k, v])));
    }
    breakdown.innerHTML = blocks.join('');
  }
}

function breakdownBlock(titulo, pares) {
  const chips = pares
    .map(([label, count]) => `<span class="mini-chip">${label}<b>${count}</b></span>`)
    .join('');
  return `<div class="canal-breakdown-block"><span class="canal-breakdown-title">${titulo}</span><div class="mini-chip-row">${chips}</div></div>`;
}

/* ── Cards de atenção — derivados da base já carregada ── */
async function loadAtencao() {
  try {
    const res = await fetch(`${API}/api/iniciativas/`);
    if (!res.ok) return;
    renderAttention(await res.json());
  } catch { /* silencioso */ }
}

function renderAttention(lista) {
  const grid = document.getElementById('attention-grid');
  const sec  = document.getElementById('sec-atencao');
  if (!grid || !sec) return;

  const agora = Date.now();
  const submetidas = lista.filter((i) => (i.status || 'SUBMETIDA') === 'SUBMETIDA');
  const emAnalise  = lista.filter((i) => i.status === 'EM_ANALISE');
  const antigas = submetidas.filter((i) => {
    const t = new Date(i.criado_em).getTime();
    return Number.isFinite(t) && (agora - t) > SETE_DIAS_MS;
  });

  const ic = (name) => (window.CedaeUI?.icon ? window.CedaeUI.icon(name) : '');
  const cards = [];

  if (antigas.length) {
    cards.push(`
      <div class="attention-card is-warn">
        <span class="attention-ic">${ic('clock')}</span>
        <div class="attention-body">
          <h4><b>${antigas.length}</b> aguardando triagem há mais de 7 dias</h4>
          <p>Iniciativas submetidas ainda não movidas para análise.</p>
          <button class="attention-cta" onclick="goTo('/admin/iniciativas')">Revisar agora ${ic('arrow-right')}</button>
        </div>
      </div>`);
  }
  if (submetidas.length) {
    cards.push(`
      <div class="attention-card is-info">
        <span class="attention-ic">${ic('inbox')}</span>
        <div class="attention-body">
          <h4><b>${submetidas.length}</b> na fila de triagem</h4>
          <p>Novas iniciativas aguardando início da análise.</p>
          <button class="attention-cta" onclick="goTo('/admin/iniciativas')">Ver iniciativas ${ic('arrow-right')}</button>
        </div>
      </div>`);
  }
  if (emAnalise.length) {
    cards.push(`
      <div class="attention-card is-ok">
        <span class="attention-ic">${ic('search-check')}</span>
        <div class="attention-body">
          <h4><b>${emAnalise.length}</b> em análise</h4>
          <p>Em avaliação para homologação ou desclassificação.</p>
          <button class="attention-cta" onclick="goTo('/admin/iniciativas')">Acompanhar ${ic('arrow-right')}</button>
        </div>
      </div>`);
  }

  if (!cards.length) { sec.hidden = true; return; }
  grid.innerHTML = cards.join('');
  sec.hidden = false;
}

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Admin.guard())) return;
  loadKPIs();
  loadAtencao();
});
