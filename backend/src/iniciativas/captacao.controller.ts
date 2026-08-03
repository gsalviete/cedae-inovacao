import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateManualIniciativaDto } from './dto/create-manual-iniciativa.dto';
import { IniciativasService } from './iniciativas.service';

type AuthRequest = Request & { user: RequestUser };

/**
 * Registro manual autenticado das Vias 1, 3 e Captação Externa (ADR-013 §16).
 * Reaproveita o AdminGuard/identidade LDAP existentes — CONTRIBUTOR ou ADM
 * podem registrar (RN-06). A Via 2 continua no controller público.
 */
@Controller('api/admin/iniciativas')
@UseGuards(AdminGuard)
export class CaptacaoController {
  constructor(
    private readonly iniciativasService: IniciativasService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async registrar(
    @Body() dto: CreateManualIniciativaDto,
    @Req() req: Request,
  ): Promise<object> {
    const user = (req as AuthRequest).user;
    const { id, codigo_publico } = await this.iniciativasService.criarManual(dto, user.login);
    this.authService
      .registrarLog(
        user.login,
        'registrar_iniciativa',
        `${dto.canal_codigo} · ${codigo_publico} (#${id}) - ${dto.titulo_iniciativa}`,
      )
      .catch(() => {});
    return { message: 'Iniciativa registrada com sucesso.', id, codigo_publico };
  }
}
