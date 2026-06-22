import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { IniciativasService } from './iniciativas.service';
import { CreateIniciativaDto } from './dto/create-iniciativa.dto';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';

@Controller('api/iniciativas')
export class IniciativasController {
  constructor(
    private readonly iniciativasService: IniciativasService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async submeter(@Body() dto: CreateIniciativaDto, @Req() req: Request) {
    try {
      const id = await this.iniciativasService.criar(dto);
      // Registra log de submissão
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      await this.authService
        .registrarLog(
          dto.nome_colaborador,
          'submit_formulario',
          `Iniciativa #${id} - ${dto.titulo_iniciativa}`,
        )
        .catch(() => {
          // Log nunca deve quebrar a operação principal
        });
      return { message: 'Iniciativa registrada com sucesso.', id };
    } catch (err) {
      throw new HttpException(err.message || 'Erro interno', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async listar() {
    return this.iniciativasService.listar();
  }
}
