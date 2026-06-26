import { IsString, IsNotEmpty } from 'class-validator';

export class ObservacaoDto {
  @IsString()
  @IsNotEmpty()
  texto: string;
}
