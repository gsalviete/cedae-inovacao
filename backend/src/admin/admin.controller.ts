import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AdminService, CreateAdminUserDto } from './admin.service';

type AuthRequest = Request & { user: RequestUser };

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private requireAdm(req: Request): void {
    const user = (req as AuthRequest).user;
    if (user.role !== 'ADM') {
      throw new ForbiddenException('Esta operação requer role ADM');
    }
  }

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
  async listarAdmins(): Promise<object[]> {
    return this.adminService.listarAdmins();
  }

  @Get('ad-users')
  async buscarUsuariosAD(
    @Query('q') q: string | undefined,
    @Req() req: Request,
  ): Promise<object[]> {
    this.requireAdm(req);
    const termo = (q ?? '').trim();
    if (termo.length < 2) return [];
    return this.adminService.buscarUsuariosAD(termo);
  }

  @Get('ad-users/resolve')
  async resolverUsuarioAD(
    @Query('nome') nome: string | undefined,
    @Req() req: Request,
  ): Promise<object> {
    this.requireAdm(req);
    const resolved = await this.adminService.resolverUsuarioAD((nome ?? '').trim());
    return resolved ?? { email: null, login: null };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async criarAdmin(
    @Body() dto: CreateAdminUserDto,
    @Req() req: Request,
  ): Promise<object> {
    this.requireAdm(req);
    const result = await this.adminService.criarAdmin(dto);
    return { message: 'Usuário administrativo criado.', id: result.id };
  }

  @Patch('users/:id/status')
  async toggleAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { ativo: boolean },
    @Req() req: Request,
  ): Promise<object> {
    this.requireAdm(req);
    await this.adminService.toggleAdmin(id, body.ativo);
    return { message: 'Status atualizado.' };
  }

  @Patch('users/:id/role')
  async atualizarRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { role: 'ADM' | 'CONTRIBUTOR' },
    @Req() req: Request,
  ): Promise<object> {
    this.requireAdm(req);
    await this.adminService.atualizarRole(id, body.role);
    return { message: 'Role atualizado.' };
  }
}
