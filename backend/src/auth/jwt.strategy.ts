import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET não definido ou inválido — verifique as variáveis de ambiente');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): { sub: string | number; username: string; login: string; perfis: string[]; is_admin: boolean } {
    return {
      sub: payload.sub,
      username: payload.login ?? String(payload.sub),
      login: payload.login ?? String(payload.sub),
      perfis: payload.perfis ?? [],
      is_admin: payload.is_admin,
    };
  }
}
