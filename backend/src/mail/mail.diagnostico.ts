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

  const CHAVES = [
    'MAIL_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
    'SMTP_TLS_REJECT_UNAUTHORIZED', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_FROM_NAME',
  ];

  console.log('── Configuração lida pelo app (INOVACAO_*) ──');
  for (const chave of CHAVES) {
    const valor = process.env[`INOVACAO_${chave}`];
    console.log(
      `  INOVACAO_${chave.padEnd(30)}= ` +
        (chave === 'SMTP_PASS' ? (valor ? '(definida)' : '(vazia)') : (valor ?? '(indefinida)')),
    );
  }

  // Tudo que parece de e-mail e o app NÃO lê: as do cron de deploy da infra
  // (MAIL_FROM=deploy@, SMTP_SERVER=…) e qualquer tentativa de configurar o app
  // sem o prefixo. Listar as duas coisas juntas é o que torna o engano óbvio.
  const ignoradas = Object.keys(process.env)
    .filter((k) => /^(MAIL|SMTP)_/.test(k))
    .sort();
  if (ignoradas.length) {
    console.log('\n── Presentes no ambiente, IGNORADAS pelo app ──');
    for (const k of ignoradas) {
      // `undefined` e não truthiness: INOVACAO_SMTP_USER='' é configuração
      // legítima (relay sem auth), não prefixo esquecido.
      const faltouPrefixo = CHAVES.includes(k) && process.env[`INOVACAO_${k}`] === undefined;
      console.log(`  ${k.padEnd(32)}${faltouPrefixo ? '  <-- faltou o prefixo INOVACAO_' : ''}`);
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
