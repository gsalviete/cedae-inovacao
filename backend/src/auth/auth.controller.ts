import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Request } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Req() req: Request) {
    console.log('headers: ', req.headers);
    console.log('raw body: ', req.body);
    console.log('body: ', body);

    if (!this.authService.validateCredentials(body.username, body.password)) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const result = this.authService.generateToken(body.username);

    // Registra log de acesso sem bloquear a resposta
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    this.authService
      .registrarLog(body.username, 'login', `IP: ${ip}`)
      .catch(() => {
        // Log nunca deve quebrar o login
      });

    return {
      access_token: result.access_token,
      token_type: 'bearer',
      is_admin: result.is_admin,
    };
  }
}
