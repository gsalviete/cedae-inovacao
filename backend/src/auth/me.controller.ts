import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { normalizeLogin } from './normalize-login';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Controller('api')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async getMe(@Req() req: Request): Promise<RequestUser> {
    console.log('================ AQUI DOIDAO ================');
    console.log(req.headers);
    console.log('=========================================');

    const header = req.headers['x-remote-user'];

    const raw =
      (Array.isArray(header) ? header[0] : header) ??
      process.env.DEV_REMOTE_USER;

    const login = raw ? normalizeLogin(raw) : undefined;

    if (!login) {
      throw new UnauthorizedException(
        'Usuário não autenticado — header x-remote-user ausente',
      );
    }

    return this.authService.resolveUser(login);
  }
}