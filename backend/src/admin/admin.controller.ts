import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService, CreateUserDto } from './admin.service';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('kpis')
  async getKpis(): Promise<object> {
    return this.adminService.getKpis();
  }

  @Get('acessos')
  async getAcessos(): Promise<object[]> {
    return this.adminService.getAcessos();
  }

  @Get('logs')
  async getLogs(): Promise<object[]> {
    return this.adminService.listarLogs();
  }

  @Get('users')
  async listarUsuarios(): Promise<object[]> {
    return this.adminService.listarUsuarios();
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async criarUsuario(@Body() dto: CreateUserDto, @Req() req: Request): Promise<object> {
    const payload = (req as any).user;
    const criadoPorId: number = typeof payload?.sub === 'number' ? payload.sub : 0;
    const result = await this.adminService.criarUsuario(dto, criadoPorId);
    return {
      message: 'Usuário criado com sucesso.',
      id: result.id,
      senha_temporaria: result.senha,
    };
  }

  @Patch('users/:id/status')
  async atualizarStatusUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { ativo: boolean },
  ): Promise<object> {
    await this.adminService.atualizarStatusUsuario(id, body.ativo);
    return { message: 'Status do usuário atualizado.' };
  }
}
