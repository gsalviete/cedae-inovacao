/**
 * Template do e-mail de confirmação de submissão pela Via 2 (ADR-014 §12.5).
 *
 * Mantido como módulo (string HTML) — e não como arquivo .html avulso — para
 * não depender de cópia de assets no build e continuar sendo o ponto único de
 * personalização futura do layout. A logo entra por CID (cid:logo-cedae),
 * anexada pelo MailService, garantindo exibição mesmo com bloqueio de recursos
 * externos nos clientes de e-mail.
 */

export interface ConfirmacaoVia2Dados {
  nome: string;
  protocolo: string;
  /** E-mail de contato/suporte exibido no corpo (remetente institucional). */
  contato: string;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Assunto padrão do e-mail de confirmação. */
export function assuntoConfirmacaoVia2(protocolo: string): string {
  return `Iniciativa registrada — Protocolo ${protocolo} · CEDAE Inovação`;
}

export function renderConfirmacaoVia2(dados: ConfirmacaoVia2Dados): string {
  const nome = escapeHtml(dados.nome || 'Colaborador(a)');
  const protocolo = escapeHtml(dados.protocolo);
  const contato = escapeHtml(dados.contato);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmação de Iniciativa</title>
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
              <h1 style="margin:0 0 8px;font-size:20px;color:#0067AC;">Iniciativa registrada com sucesso!</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
                Olá, <strong>${nome}</strong>,
              </p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
                Confirmamos o recebimento da sua iniciativa pela Esteira de Captação Ativa de
                Inovação da CEDAE. A Assessoria de Inovação para Planejamento fará a análise e
                entrará em contato caso necessário.
              </p>
            </td>
          </tr>
          <!-- Protocolo -->
          <tr>
            <td style="padding:0 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6fa;border:1px solid #d8e4ef;border-radius:10px;">
                <tr>
                  <td style="padding:18px 24px;text-align:center;">
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Número do protocolo</div>
                    <div style="font-size:24px;font-weight:bold;color:#0067AC;margin-top:6px;font-family:'Courier New',monospace;">${protocolo}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:6px;">Guarde este código para acompanhar sua iniciativa.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Contato -->
          <tr>
            <td style="padding:20px 40px 32px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                Em caso de dúvidas, entre em contato pelo e-mail
                <a href="mailto:${contato}" style="color:#0067AC;text-decoration:none;font-weight:bold;">${contato}</a>.
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
