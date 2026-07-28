import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
 * Transporte SMTP via nodemailer, configurado por variáveis de ambiente. Todo
 * envio é best-effort: qualquer falha é registrada em log e engolida, para
 * nunca interromper a operação principal (ex.: a submissão da Via 2).
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  /** Habilitação geral do envio (permite desligar em dev sem SMTP). */
  private get habilitado(): boolean {
    return (process.env.MAIL_ENABLED ?? 'false').toLowerCase() === 'true';
  }

  private get remetente(): string {
    const email = process.env.MAIL_FROM || 'bi.7@cedae.com.br';
    const nome = process.env.MAIL_FROM_NAME || 'CEDAE Inovação';
    return `"${nome}" <${email}>`;
  }

  /** E-mail de contato/suporte exibido no corpo (mesmo do remetente por padrão). */
  private get contato(): string {
    return process.env.MAIL_FROM || 'bi.7@cedae.com.br';
  }

  onModuleInit(): void {
    if (!this.habilitado) {
      this.logger.warn('Envio de e-mail DESABILITADO (MAIL_ENABLED != true).');
      return;
    }
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn('SMTP_HOST não configurado — envio de e-mail indisponível.');
      return;
    }
    const port = Number(process.env.SMTP_PORT ?? '25');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
      // O relay interno usa certificado de CA própria: por padrão não exigimos
      // cadeia confiável no STARTTLS (a rede já é interna). Ligue a validação
      // com SMTP_TLS_REJECT_UNAUTHORIZED=true quando houver CA publicável.
      tls: {
        rejectUnauthorized:
          (process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'false').toLowerCase() === 'true',
      },
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    // Diagnóstico de boot: distingue firewall/DNS de recusa do relay, sem
    // bloquear a inicialização do módulo.
    void this.transporter
      .verify()
      .then(() => this.logger.log(`Transporte SMTP OK (${host}:${port}).`))
      .catch((e: any) =>
        this.logger.error(`SMTP inacessível (${host}:${port}): ${e?.message ?? e}`),
      );
  }

  /** Localiza a logo horizontal para anexar por CID (best-effort). */
  private caminhoLogo(): string | null {
    const candidatos = [
      // dist/mail → sobe até a raiz do projeto e desce em frontend/static/img.
      join(__dirname, '..', '..', '..', 'frontend', 'static', 'img', 'logo-colorido-horizontal.png'),
      join(process.cwd(), 'frontend', 'static', 'img', 'logo-colorido-horizontal.png'),
      join(process.cwd(), '..', 'frontend', 'static', 'img', 'logo-colorido-horizontal.png'),
    ];
    return candidatos.find((p) => existsSync(p)) ?? null;
  }

  /**
   * E-mail de confirmação ao proponente da Via 2. Não lança — retorna false em
   * caso de falha ou quando o envio está desabilitado/sem destinatário.
   */
  async sendConfirmacaoVia2(dados: { nome: string; email: string; protocolo: string }): Promise<boolean> {
    if (!this.transporter || !dados.email) return false;

    const conteudo = {
      nome: dados.nome,
      protocolo: dados.protocolo,
      contato: this.contato,
    };
    const html = renderConfirmacaoVia2(conteudo);
    const text = renderConfirmacaoVia2Texto(conteudo);
    const logo = this.caminhoLogo();

    try {
      await this.transporter.sendMail({
        from: this.remetente,
        to: dados.email,
        subject: assuntoConfirmacaoVia2(dados.protocolo),
        text,
        html,
        attachments: logo
          ? [{ filename: 'logo-cedae.png', path: logo, cid: 'logo-cedae' }]
          : [],
      });
      this.logger.log(`Confirmação Via 2 enviada para ${dados.email} (${dados.protocolo}).`);
      return true;
    } catch (e: any) {
      this.logger.error(`Falha ao enviar confirmação Via 2: ${e?.message ?? e}`);
      return false;
    }
  }
}
