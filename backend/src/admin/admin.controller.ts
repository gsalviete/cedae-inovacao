import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('kpis')
  async getKpis() {
    return this.adminService.getKpis();
  }

  @Get('acessos')
  async getAcessos() {
    return this.adminService.getAcessos();
  }

  @Get('logs')
  async getLogs() {
    return this.adminService.listarLogs();
  }
}
