import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateIniciativaDto } from './dto/create-iniciativa.dto';
import { EditarHistoricoDto } from './dto/editar-historico.dto';
import { EditarObservacaoDto } from './dto/editar-observacao.dto';
import { ObservacaoDto } from './dto/observacao.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { IniciativasService } from './iniciativas.service';

type AuthRequest = Request & { user: RequestUser };

@Controller('api/iniciativas')
export class IniciativasController {
  constructor(
    private readonly iniciativasService: IniciativasService,
    private readonly authService: AuthService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Post()
  async submeter(@Body() dto: CreateIniciativaDto, @Req() req: Request): Promise<object> {
    try {
      const id = await this.iniciativasService.criar(dto);
      this.authService
        .registrarLog(dto.nome_colaborador, 'submit_formulario', `Iniciativa #${id} - ${dto.titulo_iniciativa}`)
        .catch(() => {});
      return { message: 'Iniciativa registrada com sucesso.', id };
    } catch (err: any) {
      throw new HttpException(err.message || 'Erro interno', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async listar(): Promise<object[]> {
    return this.iniciativasService.listar();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  async getById(@Param('id', ParseIntPipe) id: number): Promise<object> {
    const ini = await this.iniciativasService.getById(id);
    if (!ini) throw new NotFoundException(`Iniciativa #${id} não encontrada`);
    return ini;
  }

  @Get(':id/historico')
  @UseGuards(AdminGuard)
  async getHistorico(@Param('id', ParseIntPipe) id: number): Promise<object[]> {
    return this.workflowService.getHistorico(id);
  }

  @Get(':id/observacoes')
  @UseGuards(AdminGuard)
  async getObservacoes(@Param('id', ParseIntPipe) id: number): Promise<object[]> {
    return this.workflowService.getObservacoes(id);
  }

  @Post(':id/observacao')
  @UseGuards(AdminGuard)
  async addObservacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObservacaoDto,
    @Req() req: Request,
  ): Promise<object> {
    const user = (req as AuthRequest).user;
    await this.workflowService.registrarObservacao(id, dto.texto, user);
    return { message: 'Observação registrada.' };
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  async patchStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchStatusDto,
    @Req() req: Request,
  ): Promise<object> {
    const user = (req as AuthRequest).user;
    return this.workflowService.transicionar(id, dto.status, dto.justificativa, user);
  }

  @Patch(':id/observacao/:obsId')
  @UseGuards(AdminGuard)
  async editarObservacao(
    @Param('id', ParseIntPipe) id: number,
    @Param('obsId', ParseIntPipe) obsId: number,
    @Body() dto: EditarObservacaoDto,
    @Req() req: Request,
  ): Promise<object> {
    const user = (req as AuthRequest).user;
    await this.workflowService.editarObservacao(id, obsId, dto.texto, user);
    return { message: 'Observação atualizada.' };
  }

  @Patch(':id/historico/:eventoId')
  @UseGuards(AdminGuard)
  async editarEventoHistorico(
    @Param('id', ParseIntPipe) id: number,
    @Param('eventoId', ParseIntPipe) eventoId: number,
    @Body() dto: EditarHistoricoDto,
    @Req() req: Request,
  ): Promise<object> {
    const user = (req as AuthRequest).user;
    await this.workflowService.editarEventoHistorico(id, eventoId, dto.justificativa, user);
    return { message: 'Evento atualizado.' };
  }
}
