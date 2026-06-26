export interface RequestUser {
  login: string;
  nome: string | null;
  role: 'ADM' | 'CONTRIBUTOR' | null;
  admin: boolean;
}
