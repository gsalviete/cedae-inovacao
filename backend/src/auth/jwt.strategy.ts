import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'insecure-default-change-me-32-chars',
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub,
      username: payload.sub,
      is_admin: payload.is_admin,
    };
  }
}
