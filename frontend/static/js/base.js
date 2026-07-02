/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Ajuste do <base> conforme PROJECT_PATH (base.js)
   Único ponto que lê window.__ENV__.PROJECT_PATH (exposto por /env.js)
   para montar o prefixo da aplicação. Precisa ser carregado por
   caminho absoluto, antes de qualquer outro recurso relativo
   (CSS/JS/imagens), para que estes resolvam corretamente tanto com
   PROJECT_PATH definido (ex.: "inovacao") quanto vazio (raiz "/").
   ══════════════════════════════════════════════════════ */

(function () {
  var projectPath = (window.__ENV__ && window.__ENV__.PROJECT_PATH) || '';
  if (projectPath) {
    document.getElementById('app-base').href = `/${projectPath}/`;
  }
})();
