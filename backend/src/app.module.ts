import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { IniciativasModule } from './iniciativas/iniciativas.module';
import { AdminModule } from './admin/admin.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CanaisModule } from './canais/canais.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000,
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    }]),
    DatabaseModule,
    WorkflowModule,
    IniciativasModule,
    AdminModule,
    CanaisModule,
  ],
})
export class AppModule {}
