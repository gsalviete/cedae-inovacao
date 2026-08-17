import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  assuntoConfirmacaoVia2,
  renderConfirmacaoVia2,
  renderConfirmacaoVia2Texto,
} from './templates/confirmacao-via2.template';
import {
  AvisoNovaIniciativaDados,
  assuntoAvisoNovaIniciativa,
  renderAvisoNovaIniciativa,
  renderAvisoNovaIniciativaTexto,
} from './templates/aviso-nova-iniciativa.template';
import {
  ler,
  ligado as envioLigado,
  renomeadasPendentes,
  remetenteDoServidorIgnorado,
} from './mail.config';

/**
 * Serviço de envio de e-mails (ADR-014 §12).
 *
 * Relay interno da CEDAE: porta 25, sem autenticação, liberado por whitelist de
 * IP. O envio é best-effort — nenhuma falha interrompe a operação principal
 * (ex.: a submissão da Via 2) — mas todo caminho que *não* envia registra o
 * motivo em log. Silêncio aqui já custou caro: um retorno `false` mudo tornava
 * indistinguíveis "desligado", "sem destinatário" e "relay recusou".
 */

/**
 * Caixa institucional que recebe o aviso de toda nova iniciativa.
 *
 * Fixo no código por decisão explícita: é o endereço da Assessoria de Inovação,
 * não um parâmetro de ambiente. Uma variável a mais aqui significaria mais um
 * item para a infra manter em sincronia entre .env e .env.dev — e um typo lá
 * viraria "o aviso parou e ninguém sabe". Se um dia o destino precisar variar
 * por ambiente, este é o único ponto a trocar.
 */
const DESTINO_AVISO_INTERNO = 'inovacao@cedae.com.br';

/** Logo anexada por CID. dist/mail → raiz do projeto → frontend/static/img. */
const CAMINHO_LOGO = join(
  __dirname, '..', '..', '..', 'frontend', 'static', 'img', 'logo-colorido-horizontal.png',
);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private readonly host = ler('SMTP_SERVER') ?? '';
  private readonly port = Number(ler('SMTP_PORT') ?? '25');
  private readonly ligado = envioLigado();
  /** E-mail institucional: remetente e também o contato exibido no corpo. */
  private readonly contato = ler('INOVACAO_MAIL_FROM') ?? 'bi.7@cedae.com.br';
  private readonly remetente = `"${ler('INOVACAO_MAIL_FROM_NAME') ?? 'CEDAE Inovação'}" <${this.contato}>`;

  private readonly transporter: Transporter | null = this.criarTransporte();

  private criarTransporte(): Transporter | null {
    // Deploy com a configuração anterior (tudo sob INOVACAO_): o app não lê
    // mais esses nomes, então o sintoma seria "e-mail parou sem motivo".
    const renomeadas = renomeadasPendentes();
    if (renomeadas.length) {
      this.logger.error(
        `Variáveis de e-mail no formato ANTIGO, ignoradas — renomeie: ${renomeadas.join(', ')}.`,
      );
    }

    // Estas são do servidor (cron de deploy da infra) e continuam ignoradas;
    // avisar só importa quando o app não tem a sua própria.
    const doServidor = remetenteDoServidorIgnorado();
    if (doServidor.length) {
      this.logger.warn(
        `Remetente do ambiente do servidor ignorado (${doServidor.join(', ')}) — ` +
          'pertence ao host, não ao app.',
      );
    }

    if (!this.ligado) {
      this.logger.warn('Envio de e-mail DESLIGADO (SMTP_ENABLED != true).');
      return null;
    }
    if (!this.host) {
      this.logger.error('SMTP_ENABLED=true mas SMTP_SERVER está vazio — nenhum e-mail sairá.');
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: (ler('SMTP_SECURE') ?? 'false').toLowerCase() === 'true',
      // O relay usa certificado de CA própria e a rede já é interna, então o
      // STARTTLS oportunista não exige cadeia confiável. Ligue a validação com
      // SMTP_TLS_REJECT_UNAUTHORIZED=true quando houver CA publicável.
      tls: {
        rejectUnauthorized: (ler('SMTP_TLS_REJECT_UNAUTHORIZED') ?? 'false').toLowerCase() === 'true',
      },
      // Sem `auth`: o relay interno libera por whitelist de IP e não aceita
      // credencial. Se um dia exigir autenticação, é aqui que ela entra.

      // Sem estes limites, um relay inalcançável (firewall que engole o SYN)
      // segura a conexão por minutos antes de falhar.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    // O remetente efetivo vai para o log porque é o valor mais fácil de herdar
    // por engano do ambiente do host (ver mail.config.ts).
    this.logger.log(`Remetente configurado: ${this.remetente}`);

    // Diagnóstico de boot: separa "firewall/DNS" de "relay recusou", sem
    // bloquear a inicialização.
    void transporter
      .verify()
      .then(() => this.logger.log(`Relay SMTP acessível (${this.host}:${this.port}).`))
      .catch((e: any) =>
        this.logger.error(`Relay SMTP inacessível (${this.host}:${this.port}): ${e?.message ?? e}`),
      );

    return transporter;
  }

  /**
   * E-mail de confirmação ao proponente da Via 2. Não lança: retorna false
   * quando o envio está desligado, falta destinatário ou o relay recusou —
   * sempre com o motivo em log.
   */
  async sendConfirmacaoVia2(dados: {
    nome: string;
    email: string;
    protocolo: string;
  }): Promise<boolean> {
    const conteudo = { nome: dados.nome, protocolo: dados.protocolo, contato: this.contato };
    return this.enviar({
      para: dados.email,
      assunto: assuntoConfirmacaoVia2(dados.protocolo),
      texto: renderConfirmacaoVia2Texto(conteudo),
      html: renderConfirmacaoVia2(conteudo),
      referencia: `confirmação Via 2 ${dados.protocolo}`,
    });
  }

  /**
   * Aviso à Assessoria de Inovação a cada nova iniciativa, de qualquer via.
   *
   * Independente do e-mail ao proponente: na Via 2 os dois saem, e o fracasso de
   * um não afeta o outro. Mesmo contrato dos demais envios — não lança, retorna
   * false com o motivo em log.
   */
  async sendAvisoNovaIniciativa(dados: AvisoNovaIniciativaDados): Promise<boolean> {
    return this.enviar({
      para: DESTINO_AVISO_INTERNO,
      assunto: assuntoAvisoNovaIniciativa(dados.protocolo),
      texto: renderAvisoNovaIniciativaTexto(dados),
      html: renderAvisoNovaIniciativa(dados),
      referencia: `aviso interno ${dados.protocolo}`,
    });
  }

  /** Envio propriamente dito. Único ponto que fala com o relay. */
  private async enviar(msg: {
    para: string;
    assunto: string;
    texto: string;
    html: string;
    /** Rótulo curto usado só nos logs, para identificar o envio. */
    referencia: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`E-mail não enviado (${msg.referencia}): transporte SMTP indisponível.`);
      return false;
    }
    if (!msg.para?.trim()) {
      this.logger.warn(`E-mail não enviado (${msg.referencia}): destinatário vazio.`);
      return false;
    }

    const temLogo = existsSync(CAMINHO_LOGO);
    if (!temLogo) {
      this.logger.warn(`Logo não encontrada em ${CAMINHO_LOGO} — e-mail seguirá sem o cabeçalho.`);
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.remetente,
        to: msg.para,
        subject: msg.assunto,
        text: msg.texto,
        html: msg.html,
        attachments: temLogo
          ? [{ filename: 'logo-cedae.png', path: CAMINHO_LOGO, cid: 'logo-cedae' }]
          : [],
      });
      this.logger.log(
        `E-mail enviado (${msg.referencia}) para ${msg.para} — relay respondeu: ${info.response}`,
      );
      return true;
    } catch (e: any) {
      this.logger.error(
        `Falha ao enviar e-mail (${msg.referencia}) para ${msg.para}: ${e?.message ?? e}` +
          (e?.responseCode ? ` [SMTP ${e.responseCode}: ${e.response}]` : '') +
          (e?.code ? ` [${e.code}]` : ''),
      );
      return false;
    }
  }
}
