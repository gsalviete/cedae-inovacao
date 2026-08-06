import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { IdentidadeService } from './identidade.service';

@Controller('api')
export class MeController {
  constructor(
    private readonly authService: AuthService,
    private readonly identidade: IdentidadeService,
  ) {}

  @Get('me')
  async getMe(@Req() req: Request): Promise<RequestUser> {
    const login = this.identidade.readLogin(req);

    // 401 aqui significa requisição sem `x-remote-user` — formulário público
    // acessado fora do IIS, ou proxy mal configurado. Não há tela de login.
    if (!login) {
      throw new UnauthorizedException('Requisição sem identidade (x-remote-user).');
    }

    return this.authService.resolveUser(login);
  }
}
