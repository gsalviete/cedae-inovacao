/* ══════════════════════════════════════════════════════
   CEDAE Inovação — UI compartilhada (ui.js)
   App shell (sidebar/drawer), contadores animados e ícones Lucide
   inline. Carregado antes dos scripts de cada página administrativa.
   Não contém regra de negócio — apenas apresentação e interação.
   ══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Registro de ícones (Lucide, ISC License) ──────────
     Apenas o miolo de cada <svg>; o wrapper é montado por icon(). */
  const PATHS = {
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    'plus-circle': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'list': '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'sliders': '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
    'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'scroll-text': '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    'menu': '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
    'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'search-check': '<path d="m8 11 2 2 4-4"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    'flask': '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.58 16.5h12.85"/>',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    'minus': '<path d="M5 12h14"/>',
    'droplets': '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 4.8 7 3.3c-.29 1.5-1.14 2.83-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
    'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'bar-chart': '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    'gauge': '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'building': '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    'git-branch': '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    'sparkles': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
    'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  };

  /** Retorna o markup <svg> de um ícone Lucide pelo nome. */
  function icon(name, cls) {
    const inner = PATHS[name] || PATHS['circle-dot'];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''} aria-hidden="true">${inner}</svg>`;
  }

  /** Substitui <i data-icon="name"></i> pelos SVGs correspondentes. */
  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.getAttribute('data-icon');
      el.innerHTML = icon(name);
      el.removeAttribute('data-icon');
    });
  }

  /* ── Contador animado (respeita prefers-reduced-motion) ── */
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCount(el, to, opts) {
    if (!el) return;
    const target = Number(to) || 0;
    const suffix = (opts && opts.suffix) || '';
    if (REDUCE || target === 0) { el.textContent = `${target}${suffix}`; return; }
    const dur = (opts && opts.duration) || 720;
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);          // easeOutCubic
      el.textContent = `${Math.round(from + (target - from) * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── App shell: sidebar colapsável + drawer mobile ─────── */
  const COLLAPSE_KEY = 'cedae.sidebar.collapsed';

  function isMobile() { return window.matchMedia('(max-width: 960px)').matches; }

  function toggleNav() {
    const app = document.querySelector('.app');
    if (!app) return;
    if (isMobile()) {
      app.classList.toggle('is-drawer-open');
    } else {
      app.classList.toggle('is-collapsed');
      try { localStorage.setItem(COLLAPSE_KEY, app.classList.contains('is-collapsed') ? '1' : '0'); } catch (e) { /* storage indisponível */ }
    }
  }

  function closeDrawer() {
    document.querySelector('.app')?.classList.remove('is-drawer-open');
  }

  function initShell() {
    hydrateIcons();

    // Marca o item de navegação da página atual (data-active vem do layout).
    const nav = document.querySelector('.sidebar-nav');
    if (nav && nav.dataset.active) {
      nav.querySelector(`.nav-item[data-nav="${nav.dataset.active}"]`)?.classList.add('is-active');
    }

    const app = document.querySelector('.app');
    if (!app) return;
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1' && !isMobile()) {
        app.classList.add('is-collapsed');
      }
    } catch (e) { /* storage indisponível */ }

    // Fecha o drawer ao navegar por um item ou tecla Esc
    app.querySelector('.sidebar-scrim')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    window.addEventListener('resize', () => { if (!isMobile()) closeDrawer(); });
  }

  /* ── Identidade do usuário no rodapé da sidebar ────────
     Compartilhada pelas três páginas do painel. Silenciosa se a página
     não tiver os elementos. */
  function renderSidebarUser(me) {
    const nomeCompleto = (me && (me.nome || me.login)) || '—';
    const primeiro = ((me && me.nome) || '').trim().split(/\s+/)[0]
      || ((me && me.login) || '').split('@')[0] || '·';
    const nameEl = document.getElementById('side-user-name');
    const roleEl = document.getElementById('side-user-role');
    const avEl   = document.getElementById('side-avatar');
    if (nameEl) nameEl.textContent = nomeCompleto;
    if (roleEl) roleEl.textContent = me && me.role === 'ADM' ? 'Administrador' : 'Colaborador';
    if (avEl)   avEl.textContent = (primeiro.charAt(0) || '·').toUpperCase();
  }

  /* ── Toast de feedback ─────────────────────────────────
     Notificação efêmera, reutilizável por qualquer página do painel.
     tipo: 'ok' (padrão) | 'erro'. Cria o container sob demanda. */
  function toast(msg, tipo) {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${tipo === 'erro' ? 'erro' : 'ok'}`;
    el.textContent = msg;
    host.appendChild(el);
    // força reflow para a transição de entrada e agenda a saída.
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  // Exposição global (os templates chamam via onclick / os scripts de página usam os helpers)
  window.CedaeUI = { icon, hydrateIcons, animateCount, renderSidebarUser, toast };
  window.renderSidebarUser = renderSidebarUser;
  window.toggleNav = toggleNav;
  window.closeDrawer = closeDrawer;

  document.addEventListener('DOMContentLoaded', initShell);
})();
