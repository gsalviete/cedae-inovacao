/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Scroll reveal (reveal.js)
   Revela conteúdo quando ele se aproxima da viewport, uma única vez.
   Sem dependência externa: IntersectionObserver + CSS.

   Contrato com o CSS (style.css, bloco "SCROLL REVEAL"):
   - este módulo marca <html> com `.js-reveal`;
   - todo estado inicial oculto vive sob `.js-reveal`, então sem JS
     (ou sem IntersectionObserver) nada é escondido;
   - ao entrar, o elemento recebe `.is-revealed`.

   Carregado no <head> — de propósito. O estado inicial oculto precisa
   valer antes da primeira pintura; carregado no fim do <body> haveria um
   piscar (conteúdo pintado → escondido → revelado). O arquivo é pequeno,
   local e não faz nada além de marcar a raiz até o DOM ficar pronto.
   ══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SUPORTA = typeof IntersectionObserver === 'function';

  /* Sem suporte (ou com movimento reduzido) a interface fica como está: o
     `.js-reveal` nunca entra, logo nenhuma regra de estado inicial se aplica
     e nada pode ficar invisível por causa deste módulo. */
  const ATIVO = SUPORTA && !REDUCE;
  if (ATIVO) document.documentElement.classList.add('js-reveal');

  /* Passo e teto da cascata: lidos dos tokens do design system, com o mesmo
     valor do CSS como fallback (o :root pode ainda não ter sido aplicado). */
  function token(nome, padrao) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : padrao;
  }

  let STAGGER_STEP = 60;
  let STAGGER_MAX = 360;

  const observer = ATIVO
    ? new IntersectionObserver(onIntersect, {
        // Revela um pouco antes de o elemento encostar na borda inferior:
        // quando o olho chega nele, o movimento já terminou.
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.01,
      })
    : null;

  function onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      mostrar(entry.target);
    });
  }

  /* Tempo de vida do estado de entrada: a mais longa é 600ms (--dur-slower)
     somada ao teto da cascata (360ms). Com folga, 1400ms. */
  const LIMPEZA_MS = 1400;

  /** Revela um elemento e para de observá-lo — reveal é evento único. */
  function mostrar(el) {
    if (!el || el.classList.contains('is-revealed')) return;
    el.classList.add('is-revealed');
    observer?.unobserve(el);
    aplicarFills(el);
    limpar(el);
  }

  /* Terminada a entrada, o atributo sai do elemento.
     Sem isso o `transition` declarado em `.js-reveal [data-reveal]` continua
     valendo para sempre — e como ele cobre `transform`, o hover dos cards
     passaria a levar os 380ms da entrada em vez dos 120ms da escala tátil.
     Removido o atributo, o elemento volta a ser exatamente o que era antes
     do reveal existir, e cada componente recupera a própria transição.
     O estado final do reveal é idêntico ao estado natural (opacidade 1, sem
     transform, sem filtro), então a remoção não provoca salto visual. */
  function limpar(el) {
    setTimeout(() => {
      el.removeAttribute('data-reveal');
      el.style.removeProperty('--reveal-delay');
    }, LIMPEZA_MS);
  }

  /* ── Cascata ───────────────────────────────────────────
     O atraso é declarado no container (`data-reveal-group`) e distribuído
     aos filhos como `--reveal-delay`, com teto em `--stagger-max`: em uma
     tabela com dezenas de linhas ninguém espera a cascata inteira. */
  function aplicarStagger(container) {
    const filhos = container.querySelectorAll(':scope > [data-reveal]');
    filhos.forEach((filho, i) => {
      const delay = Math.min(i * STAGGER_STEP, STAGGER_MAX);
      filho.style.setProperty('--reveal-delay', `${delay}ms`);
    });
  }

  /* ── Barras proporcionais ──────────────────────────────
     O valor é dado (não decoração): quem chama guarda a proporção em
     `dataset.fill` e ela vira `--fill` quando a barra entra em cena. A
     largura nunca é animada — o CSS usa scaleX. */
  function aplicarFills(root) {
    if (!root) return;
    if (root.dataset && root.dataset.fill !== undefined) definirFill(root);
    root.querySelectorAll?.('[data-fill]').forEach(definirFill);
  }

  function definirFill(el) {
    const valor = parseFloat(el.dataset.fill);
    el.style.setProperty('--fill', Number.isFinite(valor) ? String(valor) : '0');
  }

  /* Observer dedicado às barras: uma barra pode receber o dado depois de já
     estar visível (a API responde após o scroll), e nesse caso o crescimento
     precisa disparar na hora. */
  const fillObserver = SUPORTA
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          definirFill(entry.target);
          fillObserver.unobserve(entry.target);
        });
      }, { threshold: 0.01 })
    : null;

  /**
   * Define a proporção de preenchimento de uma barra (0 a 1).
   * Cresce quando a barra entra na viewport; se já estiver visível — ou com
   * movimento reduzido —, o valor é aplicado imediatamente.
   */
  function fill(el, ratio) {
    if (!el) return;
    const valor = Math.max(0, Math.min(1, Number(ratio) || 0));
    el.dataset.fill = String(valor);
    if (!fillObserver || REDUCE) { definirFill(el); return; }
    fillObserver.unobserve(el);
    fillObserver.observe(el);   // dispara no próximo frame com o estado atual
  }

  /**
   * Observa o conteúdo revelável de um trecho da página. Chamada pelos
   * render*() do painel: linhas, cards e itens de timeline nascem depois do
   * load e precisam ser observados quando entram no DOM.
   */
  function scan(root) {
    const escopo = root || document;

    escopo.querySelectorAll?.('[data-reveal-group]').forEach(aplicarStagger);
    if (escopo.matches?.('[data-reveal-group]')) aplicarStagger(escopo);

    if (!ATIVO) { aplicarFills(escopo); return; }

    escopo.querySelectorAll?.('[data-reveal]').forEach((el) => {
      if (!el.classList.contains('is-revealed')) observer.observe(el);
    });
    if (escopo.matches?.('[data-reveal]') && !escopo.classList.contains('is-revealed')) {
      observer.observe(escopo);
    }
  }

  /** Revela agora, sem esperar a viewport — para conteúdo que aparece por JS
      (card de sucesso, por exemplo), cuja exibição já é o próprio evento. */
  function show(el) {
    if (!el) return;
    if (!ATIVO) { aplicarFills(el); return; }
    requestAnimationFrame(() => mostrar(el));
  }

  window.CedaeReveal = { scan, show, fill, ativo: ATIVO };

  document.addEventListener('DOMContentLoaded', () => {
    STAGGER_STEP = token('--stagger-step', 60);
    STAGGER_MAX = token('--stagger-max', 360);
    scan(document);
  });
})();
