/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Cliente de API centralizado (api.js)
   BASE_PATH vem de window.__BASE_PATH__, embutido pelo servidor
   diretamente no HTML (ver main.ts). É o único ponto de prefixo usado
   tanto pelas chamadas fetch (API) quanto pela navegação entre
   páginas (goTo) — evita recalcular PROJECT_PATH em mais de um lugar.
   ══════════════════════════════════════════════════════ */

const BASE_PATH = window.__BASE_PATH__ || '';
const API = BASE_PATH;

function goTo(path) {
  window.location.href = `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
