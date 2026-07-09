import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly session: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const login = this.session.readLogin(request);

    if (!login) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    const user = await this.authService.resolveUser(login);
    (request as Request & { user: unknown }).user = user;

    if (!user.admin) {
      throw new ForbiddenException('Acesso restrito ao painel administrativo');
    }

    return true;
  }
}
