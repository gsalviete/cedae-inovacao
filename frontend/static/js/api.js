/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Cliente de API centralizado (api.js)
   BASE_PATH é derivado do <base> já resolvido por base.js (que lê
   window.__ENV__.PROJECT_PATH). É o único ponto de prefixo usado
   tanto pelas chamadas fetch (API) quanto pela navegação entre
   páginas (goTo) — evita recalcular PROJECT_PATH em mais de um lugar.
   ══════════════════════════════════════════════════════ */

const BASE_PATH = new URL(document.baseURI).pathname.replace(/\/$/, '');
const API = BASE_PATH;

function goTo(path) {
  window.location.href = `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
