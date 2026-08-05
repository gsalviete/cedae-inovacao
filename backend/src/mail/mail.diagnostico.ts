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

async function main(): Promise<void> {
  const destinatario = process.argv[2];
  if (!destinatario) {
    console.error('Uso: node dist/mail/mail.diagnostico.js <destinatario@cedae.com.br>');
    process.exit(2);
  }

  console.log('── Configuração vista pelo app ──');
  for (const chave of [
    'MAIL_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
    'SMTP_TLS_REJECT_UNAUTHORIZED', 'SMTP_USER', 'MAIL_FROM', 'MAIL_FROM_NAME',
  ]) {
    console.log(`  ${chave.padEnd(28)}= ${process.env[chave] ?? '(indefinida)'}`);
  }
  console.log(`  ${'SMTP_PASS'.padEnd(28)}= ${process.env.SMTP_PASS ? '(definida)' : '(vazia)'}`);

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
