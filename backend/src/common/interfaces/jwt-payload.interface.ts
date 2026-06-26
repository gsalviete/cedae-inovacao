export interface JwtPayload {
  sub: string | number;
  login: string;
  perfis: string[];
  is_admin: boolean;
}
