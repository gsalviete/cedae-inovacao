import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { IniciativasController } from './iniciativas.controller';
import { IniciativasService } from './iniciativas.service';

@Module({
  imports: [AuthModule, WorkflowModule],
  controllers: [IniciativasController],
  providers: [IniciativasService],
})
export class IniciativasModule {}
