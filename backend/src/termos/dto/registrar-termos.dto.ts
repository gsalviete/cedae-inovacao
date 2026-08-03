import { IsIn } from 'class-validator';

export class RegistrarTermosDto {
  @IsIn(['ACEITE', 'RECUSA'])
  acao: 'ACEITE' | 'RECUSA' = 'ACEITE';
}
