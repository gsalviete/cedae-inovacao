import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { SessionService } from './session.service';

@Controller('api')
export class MeController {
  constructor(
    private readonly authService: AuthService,
    private readonly session: SessionService,
  ) {}

  @Get('me')
  async getMe(@Req() req: Request): Promise<RequestUser> {
    const login = this.session.readLogin(req);

    if (!login) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    return this.authService.resolveUser(login);
  }
}
