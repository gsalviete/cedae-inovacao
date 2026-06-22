import { Module } from '@nestjs/common';
import { IniciativasController } from './iniciativas.controller';
import { IniciativasService } from './iniciativas.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IniciativasController],
  providers: [IniciativasService],
})
export class IniciativasModule {}
