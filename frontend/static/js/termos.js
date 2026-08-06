/* ══════════════════════════════════════════════════════
   CEDAE Inovação — Termos e Condições de Uso (termos.js)
   Exibido ao usuário autenticado no AD SEM perfil administrativo, no
   primeiro acesso (ou quando a versão dos termos muda). Aceite libera o
   uso; recusa encerra a sessão no backend e retorna ao login.
   Ver ADR-014 §12-bis. Chamado por app.js (initHeader).
   ══════════════════════════════════════════════════════ */

let _termosEnviando = false;

async function verificarTermos() {
  try {
    const res = await fetch(`${API}/api/termos/status`);
    if (!res.ok) return; // anônimo/sem sessão — não se aplica
    const data = await res.json();
    if (!data.aceito) mostrarTermos();
  } catch { /* silencioso — não bloqueia o formulário público */ }
}

function mostrarTermos() {
  const overlay = document.getElementById('termos-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function ocultarTermos() {
  const overlay = document.getElementById('termos-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function aceitarTermos() { enviarDecisaoTermos('ACEITE'); }
function recusarTermos() { enviarDecisaoTermos('RECUSA'); }

async function enviarDecisaoTermos(acao) {
  if (_termosEnviando) return;
  _termosEnviando = true;
  try {
    const res = await fetch(`${API}/api/termos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao }),
    });
    if (!res.ok) { _termosEnviando = false; return; }

    if (acao === 'ACEITE') {
      ocultarTermos();
      _termosEnviando = false;
    } else {
      // Recusa: sem aceite não há uso. Não existe sessão para encerrar (a
      // identidade vem do IIS), então a recusa fica registrada e a página é
      // recarregada — os termos voltam a ser exigidos no próximo acesso.
      const base = window.__BASE_PATH__ || '';
      window.location.href = `${base}/?termos=recusados`;
    }
  } catch {
    _termosEnviando = false;
  }
}
