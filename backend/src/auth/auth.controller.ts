import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Request } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateCredentials(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const access_token = this.authService.generateToken(user);
    const is_admin = user.perfis.includes('ADMINISTRADOR');

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    this.authService.registrarLog(body.username, 'login', `IP: ${ip}`).catch(() => {});

    return {
      access_token,
      token_type: 'bearer',
      is_admin,
      login: user.login,
      perfis: user.perfis,
    };
  }
}
