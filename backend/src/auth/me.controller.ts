import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Controller('api')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async getMe(@Req() req: Request): Promise<RequestUser> {
    const login =
      (req.headers['x-remote-user'] as string | undefined) ??
      process.env.DEV_REMOTE_USER;

    if (!login) {
      throw new UnauthorizedException(
        'Usuário não autenticado — header x-remote-user ausente',
      );
    }

    return this.authService.resolveUser(login);
  }
}
