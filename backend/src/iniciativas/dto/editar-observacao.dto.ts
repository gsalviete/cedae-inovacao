import { IsString, IsNotEmpty } from 'class-validator';

export class EditarObservacaoDto {
  @IsString()
  @IsNotEmpty()
  texto: string;
}
