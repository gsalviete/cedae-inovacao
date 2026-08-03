import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CanaisService } from './canais.service';

type AuthRequest = Request & { user: RequestUser };

/** Dados de referência para os formulários e filtros do painel (ADR-013 §16). */
@Controller('api/reference')
@UseGuards(AdminGuard)
export class ReferenceController {
  constructor(private readonly canais: CanaisService) {}

  @Get('canais')
  async canaisAtivos(): Promise<object[]> {
    return this.canais.listarAtivos();
  }
}

/** Gestão de canais — leitura para qualquer admin; edição só ADM (RN-11). */
@Controller('api/admin/canais')
@UseGuards(AdminGuard)
export class CanaisAdminController {
  constructor(private readonly canais: CanaisService) {}

  @Get()
  async listar(): Promise<object[]> {
    return this.canais.listarTodos();
  }

  @Patch(':codigo')
  async atualizar(
    @Param('codigo') codigo: string,
    @Body() body: { nome?: string; descricao?: string; ativo?: boolean },
    @Req() req: Request,
  ): Promise<object> {
    if ((req as AuthRequest).user.role !== 'ADM') {
      throw new ForbiddenException('Apenas ADM pode configurar canais.');
    }
    await this.canais.atualizar(codigo, body);
    return { message: 'Canal atualizado.' };
  }
}
