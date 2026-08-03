/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Núcleo do painel (admin-core.js)
   Guard de acesso, formatadores e badges compartilhados por todas as
   páginas administrativas. Exposto como `window.Admin` (namespace único,
   sem globais soltos) para não colidir com os scripts de cada página.
   Carregado após api.js/ui.js e antes do script da página.
   ══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ESTAGIO_MAP = {
    ideacao:    ['Ideação',    'badge-ideacao'],
    piloto:     ['Piloto',     'badge-piloto'],
    escala:     ['Escala',     'badge-escala'],
    paralisada: ['Paralisada', 'badge-paralisada'],
  };

  const STATUS_MAP = {
    SUBMETIDA:       ['Submetida',       'badge-status-submetida'],
    EM_ANALISE:      ['Em Análise',      'badge-status-em_analise'],
    EM_OBSERVACAO:   ['Em Observação',   'badge-status-em_observacao'],
    HOMOLOGADA:      ['Homologada',      'badge-status-homologada'],
    DESCLASSIFICADA: ['Desclassificada', 'badge-status-desclassificada'],
  };

  const DIM_MAP = {
    tecnologica:      'Tecnológica',
    operacional:      'Operacional',
    gerencial:        'Gerencial / Adm.',
    social_ambiental: 'Social e Ambiental',
    outros:           'Outros',
  };

  function fmtDate(val) {
    if (!val) return '—';
    try { return new Date(val).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
    catch { return val; }
  }

  function stageBadge(val) {
    const [labelTxt, cls] = ESTAGIO_MAP[val] || ['—', 'badge-default'];
    return `<span class="badge ${cls}">${labelTxt}</span>`;
  }

  function statusBadge(val, extraStyle) {
    const [labelTxt, cls] = STATUS_MAP[val] || [val || '—', 'badge-default'];
    const style = extraStyle ? ` style="${extraStyle}"` : '';
    return `<span class="badge ${cls}"${style}>${labelTxt}</span>`;
  }

  function dimLabel(key) { return DIM_MAP[key] || key; }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  /** Número com contagem animada quando ui.js está presente. */
  function setNum(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (window.CedaeUI && window.CedaeUI.animateCount) window.CedaeUI.animateCount(el, val);
    else el.textContent = val;
  }

  /** Esconde itens de navegação exclusivos de ADM para não-ADM. */
  function applyRoleNav(me) {
    if (me && me.role === 'ADM') return;
    document.querySelectorAll('.nav-item[data-role="ADM"]').forEach((el) => el.setAttribute('hidden', ''));
  }

  function redirectHome() {
    document.getElementById('admin-content')?.classList.add('hidden');
    document.getElementById('admin-guard')?.classList.remove('hidden');
    setTimeout(() => goTo('/'), 2000);
  }

  /* Guard único: valida sessão e perfil de admin via /api/me.
     Retorna o objeto `me` quando autorizado, ou null (após redirecionar). */
  async function guard() {
    try {
      const res = await fetch(`${API}/api/me`);
      if (res.status === 401) { redirectToLogin(); return null; }
      if (!res.ok) { redirectHome(); return null; }
      const me = await res.json();
      if (!me.admin) { redirectHome(); return null; }
      Admin.me = me;
      window.renderSidebarUser?.(me);
      applyRoleNav(me);
      return me;
    } catch {
      redirectHome();
      return null;
    }
  }

  const Admin = {
    me: null,
    guard, redirectHome, applyRoleNav,
    fmtDate, stageBadge, statusBadge, dimLabel,
    escapeHtml, setText, setNum,
    ESTAGIO_MAP, STATUS_MAP, DIM_MAP,
  };
  window.Admin = Admin;
})();
