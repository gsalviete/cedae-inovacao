/**
 * Template do aviso interno de nova iniciativa, enviado à Assessoria de Inovação
 * a cada cadastro, por qualquer via (ADR-013 §3.2 — o gatilho é a ingestão).
 *
 * Difere do e-mail de confirmação da Via 2 em público e em propósito: aquele
 * tranquiliza o proponente, este é operacional — o destinatário precisa do
 * número do protocolo e do mínimo de contexto para decidir se abre o painel
 * agora ou depois. Por isso a ficha de dados no lugar do texto corrido.
 *
 * Sem link para o registro: o app não conhece a própria URL pública (só
 * PROJECT_PATH, um prefixo de caminho), e inventar uma variável de ambiente para
 * isso é decisão de infra, não de template.
 */

export interface AvisoNovaIniciativaDados {
  protocolo: string;
  titulo: string;
  /** Código do canal (VIA_1, VIA_2, VIA_3, MAPEAMENTO_EXTERNO). */
  canal: string;
  proponente?: string | null;
  area?: string | null;
  organizacaoExterna?: string | null;
  /** Login do analista que cadastrou; ausente na Via 2 (submissão sem autoria). */
  registradoPor?: string | null;
}

/**
 * Espelha o mapa de export.service.ts: o e-mail mostra o mesmo texto que a tela
 * e o arquivo exportado, nunca a chave crua gravada no banco.
 */
const CANAL_LABEL: Record<string, string> = {
  VIA_1: 'Registro de Sistemas Corporativos (SGE/SGP)',
  VIA_2: 'Formulário Interno de Submissão',
  VIA_3: 'Registro de Reuniões com Áreas',
  MAPEAMENTO_EXTERNO: 'Captação Externa',
};

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rotuloCanal(canal: string): string {
  return CANAL_LABEL[canal] ?? canal;
}

/** Linhas da ficha, já sem os campos vazios daquela via. */
function linhas(dados: AvisoNovaIniciativaDados): Array<[string, string]> {
  const out: Array<[string, string]> = [
    ['Protocolo', dados.protocolo],
    ['Título', dados.titulo],
    ['Via de captação', rotuloCanal(dados.canal)],
  ];
  // RN-15: a Captação Externa nasce sem proponente identificado, então estes
  // campos não aparecem — melhor ausentes que como "—" repetido.
  if (dados.proponente?.trim()) out.push(['Proponente', dados.proponente.trim()]);
  if (dados.area?.trim()) out.push(['Área', dados.area.trim()]);
  if (dados.organizacaoExterna?.trim()) {
    out.push(['Instituição de origem', dados.organizacaoExterna.trim()]);
  }
  out.push([
    'Registrado por',
    dados.registradoPor?.trim() || 'Submissão pelo formulário (sem usuário autenticado)',
  ]);
  return out;
}

/** Assunto do aviso interno. O protocolo vem no assunto: é o que se busca na caixa. */
export function assuntoAvisoNovaIniciativa(protocolo: string): string {
  return `Nova iniciativa recebida — Protocolo ${protocolo} · CEDAE Inovação`;
}

/**
 * Alternativa em texto puro do mesmo conteúdo, enviada junto do HTML como
 * multipart/alternative. Sem escape — não é markup.
 */
export function renderAvisoNovaIniciativaTexto(dados: AvisoNovaIniciativaDados): string {
  return [
    'Uma nova iniciativa foi cadastrada na Esteira de Captação Ativa de Inovação',
    'da CEDAE e aguarda análise da Assessoria.',
    '',
    ...linhas(dados).map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    '',
    'Acesse o painel administrativo para consultar o registro completo.',
    '',
    '--',
    'CEDAE — Companhia Estadual de Águas e Esgotos do Rio de Janeiro',
    'Assessoria de Inovação para Planejamento',
    'Esta é uma mensagem automática — por favor, não responda diretamente.',
  ].join('\n');
}

export function renderAvisoNovaIniciativa(dados: AvisoNovaIniciativaDados): string {
  const protocolo = escapeHtml(dados.protocolo);
  const ficha = linhas(dados)
    .map(
      ([rotulo, valor]) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #eef2f6;font-size:13px;color:#6b7280;width:38%;vertical-align:top;">${escapeHtml(rotulo)}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #eef2f6;font-size:14px;color:#1f2937;font-weight:bold;vertical-align:top;">${escapeHtml(valor)}</td>
                </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova Iniciativa Cadastrada</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08);">
          <!-- Cabeçalho com a logo -->
          <tr>
            <td align="center" style="background-color:#ffffff;padding:28px 24px 16px;border-bottom:1px solid #e5eaf0;">
              <img src="cid:logo-cedae" alt="CEDAE Inovação — Conexões que Transformam" width="240" style="display:block;max-width:240px;height:auto;" />
            </td>
          </tr>
          <!-- Faixa institucional -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#0067AC,#8DC63F);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Corpo -->
          <tr>
            <td style="padding:32px 40px 8px;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#0067AC;">Nova iniciativa cadastrada</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
                Uma nova iniciativa foi registrada na Esteira de Captação Ativa de Inovação
                e aguarda análise da Assessoria.
              </p>
            </td>
          </tr>
          <!-- Protocolo -->
          <tr>
            <td style="padding:0 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6fa;border:1px solid #d8e4ef;border-radius:10px;">
                <tr>
                  <td style="padding:18px 24px;text-align:center;">
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Número da iniciativa</div>
                    <div style="font-size:24px;font-weight:bold;color:#0067AC;margin-top:6px;font-family:'Courier New',monospace;">${protocolo}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Ficha -->
          <tr>
            <td style="padding:20px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ficha}
              </table>
            </td>
          </tr>
          <!-- Chamada -->
          <tr>
            <td style="padding:18px 40px 32px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                Acesse o painel administrativo do CEDAE Inovação para consultar o registro completo.
              </p>
            </td>
          </tr>
          <!-- Rodapé -->
          <tr>
            <td style="background-color:#0b2b45;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#c7d5e2;line-height:1.6;">
                CEDAE — Companhia Estadual de Águas e Esgotos do Rio de Janeiro<br />
                Assessoria de Inovação para Planejamento
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size:11px;color:#9aa7b4;margin:16px 0 0;">Esta é uma mensagem automática — por favor, não responda diretamente a este e-mail.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
