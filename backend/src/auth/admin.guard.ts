import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const login =
      (request.headers['x-remote-user'] as string | undefined) ??
      process.env.DEV_REMOTE_USER;

    if (!login) {
      throw new UnauthorizedException(
        'Usuário não identificado — header x-remote-user ausente',
      );
    }

    const user = await this.authService.resolveUser(login);
    (request as Request & { user: unknown }).user = user;

    if (!user.admin) {
      throw new ForbiddenException('Acesso restrito ao painel administrativo');
    }

    return true;
  }
}
