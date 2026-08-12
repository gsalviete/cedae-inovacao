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
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
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

  /* ══════════════════════════════════════════════════════
     Trava de rolagem do body
     Compartilhada por modais e pelo drawer mobile. Contada por referência:
     fechar uma modal aberta sobre outra não pode liberar a rolagem da que
     continua aberta. A largura da barra de rolagem é compensada em padding
     para o conteúdo não saltar horizontalmente ao travar.
     ══════════════════════════════════════════════════════ */
  let _scrollLocks = 0;
  let _paddingAnterior = '';

  function travarScroll() {
    if (_scrollLocks++ > 0) return;
    const larguraBarra = window.innerWidth - document.documentElement.clientWidth;
    _paddingAnterior = document.body.style.paddingRight;
    if (larguraBarra > 0) document.body.style.paddingRight = `${larguraBarra}px`;
    document.body.style.overflow = 'hidden';
  }

  function liberarScroll() {
    if (_scrollLocks === 0) return;
    if (--_scrollLocks > 0) return;
    document.body.style.overflow = '';
    document.body.style.paddingRight = _paddingAnterior;
  }

  /* ══════════════════════════════════════════════════════
     Modal acessível (CedaeUI.modal)
     Extraído do modal de aviso de privacidade do formulário público, que já
     fazia o certo, e generalizado para os seis modais do painel. Cobre o que
     faltava: role/aria, Escape, foco inicial, devolução do foco à origem,
     armadilha de Tab e trava de rolagem.

     Serve às duas anatomias do sistema:
     - painel: um `.modal-overlay` que contém a `.modal-box` (o próprio
       overlay é o elemento escondido);
     - formulário público: uma `.modal` centrada por transform, com o overlay
       em um elemento irmão (informado em `opts.overlay`).
     ══════════════════════════════════════════════════════ */
  const SELETOR_FOCAVEL = [
    'a[href]', 'button:not(:disabled)', 'input:not(:disabled):not([type="hidden"])',
    'select:not(:disabled)', 'textarea:not(:disabled)', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const _modais = [];   // pilha: o topo é quem recebe Escape e Tab

  /** Elemento que representa o diálogo em si (a caixa, não o overlay). */
  function caixaDe(el) {
    return el.querySelector('.modal-box') || el;
  }

  function focaveis(el) {
    return Array.from(caixaDe(el).querySelectorAll(SELETOR_FOCAVEL))
      .filter((n) => n.offsetParent !== null || n === document.activeElement);
  }

  function aplicarAria(el) {
    const caixa = caixaDe(el);
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    const titulo = caixa.querySelector('.modal-title, .modal-header h3, h3');
    if (titulo) {
      if (!titulo.id) titulo.id = `${el.id || 'modal'}-titulo`;
      caixa.setAttribute('aria-labelledby', titulo.id);
    }
  }

  /**
   * Abre um modal.
   * @param {HTMLElement|string} alvo   elemento (ou id) que perde `.hidden`
   * @param {object} [opts]
   * @param {HTMLElement} [opts.overlay] overlay irmão (formulário público)
   * @param {HTMLElement|string} [opts.focus] primeiro elemento a receber foco
   * @param {Function} [opts.onClose] fechamento por Escape/overlay — deve ser
   *        a função de fechar da própria página, para que ela limpe o estado
   */
  function abrirModal(alvo, opts) {
    const el = typeof alvo === 'string' ? document.getElementById(alvo) : alvo;
    if (!el || _modais.some((m) => m.el === el)) return;
    const o = opts || {};

    const origem = document.activeElement;
    aplicarAria(el);

    o.overlay?.classList.remove('hidden');
    el.classList.remove('hidden');
    travarScroll();

    _modais.push({ el, overlay: o.overlay || null, origem, onClose: o.onClose || null, fechando: false });

    // Foco no primeiro campo (ou no primeiro controle disponível). Sem alvo
    // focável a caixa recebe o foco, para que o leitor de tela entre nela.
    const alvoFoco = typeof o.focus === 'string'
      ? el.querySelector(o.focus)
      : (o.focus || focaveis(el)[0]);
    if (alvoFoco) {
      alvoFoco.focus();
    } else {
      const caixa = caixaDe(el);
      caixa.setAttribute('tabindex', '-1');
      caixa.focus();
    }
  }

  /** Fecha um modal e devolve o foco a quem o abriu. */
  function fecharModal(alvo) {
    const el = typeof alvo === 'string' ? document.getElementById(alvo) : alvo;
    if (!el) return;
    const idx = _modais.findIndex((m) => m.el === el);

    el.classList.add('hidden');
    if (idx < 0) return;                 // já fora da pilha: só esconde

    const entrada = _modais.splice(idx, 1)[0];
    entrada.overlay?.classList.add('hidden');
    liberarScroll();
    if (entrada.origem && document.contains(entrada.origem)) entrada.origem.focus();
  }

  /** Fecha pelo caminho da página (para que ela limpe o próprio estado). */
  function encerrarTopo() {
    const topo = _modais[_modais.length - 1];
    if (!topo || topo.fechando) return;
    topo.fechando = true;
    if (topo.onClose) topo.onClose();
    else fecharModal(topo.el);
    topo.fechando = false;
  }

  /** True quando o clique caiu no overlay, e não dentro da caixa. */
  function cliqueNoOverlay(ev) {
    const topo = _modais[_modais.length - 1];
    return !!topo && ev.target === topo.el;
  }

  document.addEventListener('keydown', (ev) => {
    if (!_modais.length) return;

    if (ev.key === 'Escape') {
      ev.stopPropagation();
      encerrarTopo();
      return;
    }

    // Armadilha de foco: Tab circula dentro da caixa do topo.
    if (ev.key !== 'Tab') return;
    const topo = _modais[_modais.length - 1];
    const lista = focaveis(topo.el);
    if (!lista.length) { ev.preventDefault(); return; }
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const atual = document.activeElement;

    if (!caixaDe(topo.el).contains(atual)) {
      ev.preventDefault();
      (ev.shiftKey ? ultimo : primeiro).focus();
    } else if (ev.shiftKey && atual === primeiro) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && atual === ultimo) {
      ev.preventDefault();
      primeiro.focus();
    }
  }, true);

  /* ══════════════════════════════════════════════════════
     Estado de carregamento de botão
     Toda ação que altera dado precisa de confirmação visível de imediato —
     nem que seja o botão dizendo que está trabalhando.
     ══════════════════════════════════════════════════════ */
  function botaoOcupado(btn, ocupado, textoOcupado) {
    if (!btn) return;
    if (ocupado) {
      if (btn.dataset.textoOriginal === undefined) btn.dataset.textoOriginal = btn.textContent;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      if (textoOcupado) btn.textContent = textoOcupado;
    } else {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (btn.dataset.textoOriginal !== undefined) {
        btn.textContent = btn.dataset.textoOriginal;
        delete btn.dataset.textoOriginal;
      }
    }
  }

  /* ══════════════════════════════════════════════════════
     Linhas de tabela clicáveis
     São `<tr onclick>`: sem isto, não existem para quem usa teclado. O
     handler é delegado — vale para linhas renderizadas depois.
     ══════════════════════════════════════════════════════ */
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
    const linha = ev.target.closest?.('tr.row-clickable');
    if (!linha || linha !== ev.target) return;
    ev.preventDefault();      // Espaço rolaria a página
    linha.click();
  });

  /* ── App shell: sidebar colapsável + drawer mobile ─────── */
  const COLLAPSE_KEY = 'cedae.sidebar.collapsed';
  let _origemDrawer = null;

  function isMobile() { return window.matchMedia('(max-width: 960px)').matches; }

  function toggleNav() {
    const app = document.querySelector('.app');
    if (!app) return;
    if (isMobile()) {
      if (app.classList.contains('is-drawer-open')) { closeDrawer(); return; }
      _origemDrawer = document.activeElement;
      app.classList.add('is-drawer-open');
      travarScroll();
      // O primeiro item do menu recebe o foco: o drawer é navegação, e a
      // navegação precisa começar onde o usuário acabou de abrir.
      app.querySelector('.sidebar-nav .nav-item')?.focus();
    } else {
      app.classList.toggle('is-collapsed');
      try { localStorage.setItem(COLLAPSE_KEY, app.classList.contains('is-collapsed') ? '1' : '0'); } catch (e) { /* storage indisponível */ }
    }
  }

  function closeDrawer() {
    const app = document.querySelector('.app');
    if (!app || !app.classList.contains('is-drawer-open')) return;
    app.classList.remove('is-drawer-open');
    liberarScroll();
    // Devolve o foco ao botão que abriu — sem isso ele volta para o topo do
    // documento e a navegação por teclado recomeça do zero.
    const origem = _origemDrawer && document.contains(_origemDrawer)
      ? _origemDrawer
      : app.querySelector('.topbar-toggle.drawer-only');
    origem?.focus();
    _origemDrawer = null;
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

    // Fecha o drawer ao navegar por um item ou tecla Esc. Com um modal
    // aberto o Escape é consumido por ele (ver a pilha de modais acima).
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
     tipo: 'ok' (padrão) | 'erro'. Cria o container sob demanda.

     O host é uma coluna: dois toasts simultâneos empilham (o segundo entra
     abaixo, deslocando o primeiro pelo próprio layout), nunca se sobrepõem.
     A região é anunciada por leitor de tela — sem isso, o retorno de toda
     ação administrativa seria invisível para quem não vê a tela. */
  const TOAST_MS = 3200;
  const TOAST_SAIDA_MS = 250;

  function toastHost() {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-atomic', 'false');
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(msg, tipo) {
    const erro = tipo === 'erro';
    const host = toastHost();
    // Erro interrompe a leitura em curso; confirmação espera a vez.
    host.setAttribute('aria-live', erro ? 'assertive' : 'polite');

    const el = document.createElement('div');
    el.className = `toast toast-${erro ? 'erro' : 'ok'}`;
    el.textContent = msg;
    host.appendChild(el);

    let timer = null;
    const sair = () => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), TOAST_SAIDA_MS);
    };
    const agendar = () => { timer = setTimeout(sair, TOAST_MS); };

    // Quem está lendo a mensagem não pode perdê-la no meio: o mouse sobre o
    // toast pausa o timer, e sair reinicia a contagem.
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', agendar);

    // força reflow para a transição de entrada e agenda a saída.
    requestAnimationFrame(() => el.classList.add('is-visible'));
    agendar();
  }

  /* ── Máscara monetária BRL (compartilhada) ─────────────
     Fonte única da experiência de valor em reais: formulário público,
     cadastro manual e edição administrativa usam exatamente a mesma
     máscara, o mesmo bloqueio de teclas e o mesmo parse (ADR-015 §5.4).
     O valor canônico fica em `dataset.cents` (inteiro, em centavos);
     o texto exibido é apenas apresentação. */
  const TECLAS_CONTROLE = new Set([
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
  ]);

  function formatBRL(cents) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
    }).format((Number(cents) || 0) / 100);
  }

  function moneyKeydown(e) {
    if (TECLAS_CONTROLE.has(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();   // bloqueia letras e símbolos
  }

  function moneyInput(e) {
    const el = e.target;
    const digits = el.value.replace(/\D/g, '');
    el.dataset.cents = digits || '0';
    el.value = digits ? formatBRL(parseInt(digits, 10)) : '';
  }

  /** Liga a máscara em um input (idempotente — não duplica listeners). */
  function attachMoney(el) {
    if (!el || el.dataset.currencyBound === '1') return;
    el.dataset.currencyBound = '1';
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('autocomplete', 'off');
    el.addEventListener('keydown', moneyKeydown);
    el.addEventListener('input', moneyInput);
    // Colar texto com letras também precisa ser sanitizado.
    el.addEventListener('paste', () => setTimeout(() => moneyInput({ target: el }), 0));
  }

  /** Liga a máscara em todos os `[data-currency]` do escopo informado. */
  function initMoney(root) {
    (root || document).querySelectorAll('[data-currency]').forEach(attachMoney);
  }

  /** Valor em reais (Number) ou null quando vazio. */
  function moneyValue(el) {
    if (!el) return null;
    const cents = parseInt(el.dataset.cents || '0', 10);
    return cents ? cents / 100 : null;
  }

  /** Preenche o campo a partir de um valor em reais (Number ou string). */
  function setMoney(el, valor) {
    if (!el) return;
    const num = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(',', '.'));
    if (!Number.isFinite(num) || num === 0) {
      el.value = '';
      el.dataset.cents = '0';
      return;
    }
    const cents = Math.round(num * 100);
    el.dataset.cents = String(cents);
    el.value = formatBRL(cents);
  }

  /** Exibição de um valor já gravado (Number ou string vinda da API, em reais):
     "1000000" vira "R$ 1.000.000,00". Devolve null quando não há valor — quem
     chama decide o placeholder — e o texto original quando não é numérico,
     para que dado legado não suma da tela. */
  function displayBRL(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const num = typeof valor === 'number'
      ? valor
      : Number(String(valor).trim().replace(',', '.'));
    if (!Number.isFinite(num)) return String(valor);
    return formatBRL(Math.round(num * 100));
  }

  window.CedaeMoney = {
    formatBRL, attach: attachMoney, initAll: initMoney,
    value: moneyValue, setValue: setMoney, display: displayBRL,
  };

  // Exposição global (os templates chamam via onclick / os scripts de página usam os helpers)
  window.CedaeUI = {
    icon, hydrateIcons, animateCount, renderSidebarUser, toast,
    modal: {
      open: abrirModal,
      close: fecharModal,
      isOverlayClick: cliqueNoOverlay,
    },
    busy: botaoOcupado,
    lockScroll: travarScroll,
    unlockScroll: liberarScroll,
  };
  window.renderSidebarUser = renderSidebarUser;
  window.toggleNav = toggleNav;
  window.closeDrawer = closeDrawer;

  document.addEventListener('DOMContentLoaded', initShell);
})();
