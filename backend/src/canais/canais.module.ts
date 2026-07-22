import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CanaisAdminController, ReferenceController } from './canais.controller';
import { CanaisService } from './canais.service';

@Module({
  imports: [AuthModule],
  controllers: [ReferenceController, CanaisAdminController],
  providers: [CanaisService],
  exports: [CanaisService],
})
export class CanaisModule {}
