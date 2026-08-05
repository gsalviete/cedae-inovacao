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

/**
 * Serviço de envio de e-mails (ADR-014 §12).
 *
 * Relay interno da CEDAE: porta 25, sem autenticação, liberado por whitelist de
 * IP. O envio é best-effort — nenhuma falha interrompe a operação principal
 * (ex.: a submissão da Via 2) — mas todo caminho que *não* envia registra o
 * motivo em log. Silêncio aqui já custou caro: um retorno `false` mudo tornava
 * indistinguíveis "desligado", "sem destinatário" e "relay recusou".
 */

/** Logo anexada por CID. dist/mail → raiz do projeto → frontend/static/img. */
const CAMINHO_LOGO = join(
  __dirname, '..', '..', '..', 'frontend', 'static', 'img', 'logo-colorido-horizontal.png',
);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private readonly host = process.env.SMTP_HOST?.trim() ?? '';
  private readonly port = Number(process.env.SMTP_PORT ?? '25');
  private readonly ligado = (process.env.MAIL_ENABLED ?? 'false').toLowerCase() === 'true';
  /** E-mail institucional: remetente e também o contato exibido no corpo. */
  private readonly contato = process.env.MAIL_FROM || 'bi.7@cedae.com.br';
  private readonly remetente = `"${process.env.MAIL_FROM_NAME || 'CEDAE Inovação'}" <${this.contato}>`;

  private readonly transporter: Transporter | null = this.criarTransporte();

  private criarTransporte(): Transporter | null {
    if (!this.ligado) {
      this.logger.warn('Envio de e-mail DESLIGADO (MAIL_ENABLED != true).');
      return null;
    }
    if (!this.host) {
      this.logger.error('MAIL_ENABLED=true mas SMTP_HOST está vazio — nenhum e-mail sairá.');
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
      // O relay usa certificado de CA própria e a rede já é interna, então o
      // STARTTLS oportunista não exige cadeia confiável. Ligue a validação com
      // SMTP_TLS_REJECT_UNAUTHORIZED=true quando houver CA publicável.
      tls: {
        rejectUnauthorized:
          (process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'false').toLowerCase() === 'true',
      },
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      // Sem estes limites, um relay inalcançável (firewall que engole o SYN)
      // segura a conexão por minutos antes de falhar.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

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
