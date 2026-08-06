/**
 * Diagnóstico de e-mail — `pnpm mail:test <destinatario>`.
 *
 * Roda o MailService real, com a mesma configuração do app, fora do Nest e sem
 * banco. Serve para responder, dentro do ambiente onde o app roda (host ou
 * container), onde exatamente o envio para: variável faltando, relay
 * inalcançável ou recusa do relay.
 *
 *   pnpm mail:test bi.7@cedae.com.br
 *   docker exec cedae_inovacao_app node dist/mail/mail.diagnostico.js bi.7@cedae.com.br
 */
import '../env';
import { MailService } from './mail.service';
import { CHAVES_EMAIL, renomeadasPendentes, remetenteDoServidorIgnorado } from './mail.config';

async function main(): Promise<void> {
  const destinatario = process.argv[2];
  if (!destinatario) {
    console.error('Uso: node dist/mail/mail.diagnostico.js <destinatario@cedae.com.br>');
    process.exit(2);
  }

  console.log('── Configuração lida pelo app ──');
  for (const chave of CHAVES_EMAIL) {
    console.log(`  ${chave.padEnd(38)}= ${process.env[chave] ?? '(indefinida)'}`);
  }

  // Configuração antiga ainda no ambiente: é a causa mais provável de "o
  // e-mail parou depois do deploy".
  const renomeadas = renomeadasPendentes();
  if (renomeadas.length) {
    console.log('\n── Formato ANTIGO, ignorado pelo app — renomeie ──');
    for (const r of renomeadas) console.log(`  ${r}`);
  }

  // Tudo que parece de e-mail e o app NÃO lê: as do cron de deploy da infra
  // (MAIL_FROM=deploy@, SMTP_SERVER=…). Listar junto torna o engano óbvio.
  const ignoradas = Object.keys(process.env)
    .filter((k) => /^(MAIL|SMTP|INOVACAO_(MAIL|SMTP))_/.test(k) && !CHAVES_EMAIL.includes(k))
    .sort();
  if (ignoradas.length) {
    console.log('\n── Presentes no ambiente, IGNORADAS pelo app ──');
    const doServidor = new Set(remetenteDoServidorIgnorado().map((s) => s.split(' ')[0]));
    for (const k of ignoradas) {
      console.log(`  ${k.padEnd(38)}${doServidor.has(k) ? '  <-- do servidor; use INOVACAO_' + k : ''}`);
    }
  }

  console.log('\n── Envio de teste ──');
  const enviado = await new MailService().sendConfirmacaoVia2({
    nome: 'Teste de Diagnóstico',
    email: destinatario,
    protocolo: 'TESTE-0000',
  });

  console.log(
    enviado
      ? `\nOK — mensagem aceita pelo relay para ${destinatario}.`
      : '\nFALHOU — veja o motivo nas linhas de log acima.',
  );
  process.exit(enviado ? 0 : 1);
}

void main();
