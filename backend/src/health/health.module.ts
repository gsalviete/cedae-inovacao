import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health check do balanceador. Sem providers e sem dependência de nenhum
 * outro módulo de propósito: precisa responder mesmo quando o resto da
 * aplicação está mal configurado — é justamente esse o caso que ele reporta.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
