import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o usuário.' })
  @MaxLength(256)
  username: string = '';

  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(256)
  password: string = '';
}
