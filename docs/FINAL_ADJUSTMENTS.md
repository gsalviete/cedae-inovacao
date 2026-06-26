# FINAL_ADJUSTMENTS.md
**Versão:** 2.0  
**Data:** 2026-06-26  
**Escopo:** MVP-1 — Autenticação Kerberos + Workflow de Iniciativas

---

## 1. Arquitetura de Autenticação

### Produção (IIS + Kerberos)
O sistema **não possui autenticação própria**. Toda autenticação é delegada ao IIS via Kerberos/NTLM. O IIS injeta o header:

```
x-remote-user: <login-de-dominio>
```

O NestJS lê esse header em cada requisição. O usuário não precisa existir em nenhuma tabela do sistema para usar o formulário.

### Controle de acesso ao painel admin
Uma tabela whitelist (`ADMIN_USERS`) define quais logins de domínio têm acesso ao painel administrativo. A consulta é feita a cada requisição ao AdminGuard:

```sql
SELECT login, nome, role FROM ADMIN_USERS WHERE login = :login AND ativo = 1
```

Se o login não está na tabela, o usuário é tratado como "usuário comum" — pode usar o formulário, mas não acessa o painel.

### Desenvolvimento local (sem IIS)
Definir a variável `DEV_REMOTE_USER` no `.env` ou `docker-compose.yml`:
```
DEV_REMOTE_USER=gsalviete
```

O `AdminGuard` e o endpoint `GET /api/me` usam esse fallback quando o header `x-remote-user` não está presente.

---

## 2. Tabelas do banco de dados

### ADMIN_USERS (V20)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | NUMBER IDENTITY | PK |
| login | VARCHAR2(100) | Login de domínio Kerberos (único) |
| nome | VARCHAR2(200) | Nome exibível (opcional) |
| role | VARCHAR2(20) | `ADM` ou `CONTRIBUTOR` |
| ativo | NUMBER(1) | 1 = ativo, 0 = desativado |
| criado_em | TIMESTAMP | Data de cadastro |

**Roles:**
- `ADM`: acesso total, gerencia outros admins
- `CONTRIBUTOR`: visualização + execução de workflow

### Alterações em HISTORICO_STATUS (V21)
- **Adicionado:** `usuario_login VARCHAR2(100)` — login do usuário que executou a transição
- **Mantido:** `usuario_id NUMBER` — dados históricos; não é mais escrito pela aplicação
- **Removido:** índice `IDX_HS_USUARIO` (substituído por `IDX_HS_LOGIN`)
- **Recriado:** view `VW_HISTORICO_ATIVO` sem o JOIN em USUARIOS

### Tabelas legadas (não mais usadas)
As tabelas abaixo não são mais referenciadas pela aplicação. **Não foram dropadas** no script de migração para segurança. Remover manualmente após confirmar que nenhum sistema legacy as consulta.

| Tabela | Status |
|--------|--------|
| USUARIOS | Não usada — remover manualmente |
| USUARIOS_PERFIS | Não usada — remover manualmente |
| PERFIS_ACESSO | Não usada — remover manualmente |

---

## 3. API

### Endpoint público
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/me` | Retorna dados do usuário atual (login, nome, role, admin) |
| `POST` | `/api/iniciativas` | Submissão do formulário (público) |
| `GET` | `/api/iniciativas` | Listagem de iniciativas (público) |

### Endpoints administrativos (requer ADMIN_USERS)
| Método | Rota | Role mínima |
|--------|------|-------------|
| `GET` | `/api/admin/kpis` | CONTRIBUTOR |
| `GET` | `/api/admin/acessos` | CONTRIBUTOR |
| `GET` | `/api/admin/logs` | CONTRIBUTOR |
| `GET` | `/api/admin/users` | CONTRIBUTOR |
| `POST` | `/api/admin/users` | ADM |
| `PATCH` | `/api/admin/users/:id/status` | ADM |
| `PATCH` | `/api/admin/users/:id/role` | ADM |
| `GET` | `/api/iniciativas/:id` | CONTRIBUTOR |
| `GET` | `/api/iniciativas/:id/historico` | CONTRIBUTOR |
| `PATCH` | `/api/iniciativas/:id/status` | CONTRIBUTOR |

### Resposta de GET /api/me
```json
{
  "login": "gsalviete",
  "nome": "Gabriel Salviete",
  "role": "ADM",
  "admin": true
}
```

Usuário sem cadastro em ADMIN_USERS:
```json
{
  "login": "joao.colaborador",
  "nome": null,
  "role": null,
  "admin": false
}
```

---

## 4. Dependências removidas

| Pacote | Motivo |
|--------|--------|
| `@nestjs/jwt` | Não há JWT interno |
| `@nestjs/passport` | Não há Passport strategy |
| `passport` | Idem |
| `passport-jwt` | Idem |
| `bcrypt` | Não há senhas no sistema |
| `@types/bcrypt` | Idem |
| `@types/passport-jwt` | Idem |

---

## 5. Arquivos removidos do backend

| Arquivo | Motivo |
|---------|--------|
| `auth/auth.controller.ts` | Endpoint POST /api/auth/login removido |
| `auth/jwt.strategy.ts` | Sem JWT |
| `auth/jwt-auth.guard.ts` | Sem Passport |
| `auth/dto/login.dto.ts` | Sem login por senha |
| `common/interfaces/jwt-payload.interface.ts` | Substituído por `request-user.interface.ts` |

---

## 6. Variáveis de ambiente

| Variável | Necessária | Descrição |
|----------|-----------|-----------|
| `ORACLE_HOST` | Sim | Host do Oracle 19c |
| `ORACLE_PORT` | Sim | Porta (padrão 1521) |
| `ORACLE_SERVICE` | Sim | Service name |
| `ORACLE_USER` | Sim | Usuário do schema |
| `ORACLE_PASSWORD` | Sim | Senha do schema |
| `PORT` | Não | Porta do servidor (padrão 8095) |
| `DEV_REMOTE_USER` | Só em dev | Login de fallback quando x-remote-user ausente |
| `RATE_LIMIT_TTL` | Não | Janela de rate limiting em segundos (padrão 60) |
| `RATE_LIMIT_MAX` | Não | Máximo de requisições na janela (padrão 100) |

**Removidas:** `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

---

## 7. Script de banco

O arquivo `script.sql` na raiz do projeto contém todas as alterações necessárias:
1. **BLOCO 1** — Criação de `ADMIN_USERS`
2. **BLOCO 2** — Seed do usuário inicial (`gsalviete` como ADM)
3. **BLOCO 3** — `ALTER TABLE HISTORICO_STATUS ADD usuario_login`
4. **BLOCO 4** — Recriação de `VW_HISTORICO_ATIVO`
5. **BLOCO 5** — DROP de tabelas legadas (comentado, executar manualmente)

---

## 8. Pendências conhecidas

| Item | Prioridade | Nota |
|------|-----------|------|
| Seed do ADMIN_USERS em produção | Alta | Executar `script.sql` no schema antes do deploy |
| DROP de USUARIOS/USUARIOS_PERFIS/PERFIS_ACESSO | Baixa | Após confirmar que sistema legacy não as usa |
| Pool de conexões Oracle (E5-S01) | Média | DatabaseService usa uma conexão por requisição |
| Proteção de GET /api/iniciativas (E2-S09) | Média | Atualmente público |
| FK diferidas em V29 | Baixa | iniciativa_id em HISTORICO_STATUS sem FK formal |
| Testes unitários | Baixa | Nenhum configurado |
| Paginação nas listagens | Baixa | Listagem retorna todos os registros |
