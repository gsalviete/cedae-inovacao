import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Módulo de e-mail. Global para que qualquer módulo (ex.: Iniciativas) possa
 * injetar o MailService sem reimportá-lo explicitamente.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
