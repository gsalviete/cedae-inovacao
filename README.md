# CEDAE Inovação

Sistema de captação e gestão de iniciativas de inovação.

## Pré-requisitos

- Docker 24+ e Docker Compose v2+
- Acesso ao Oracle (solicitar ao DBA: host, service name, usuário e senha)
- Node.js 22+ (apenas para desenvolvimento local sem Docker)

## Configuração do ambiente

```bash
# 1. Copie o template de variáveis
cp .env.example .env
cp .env.example backend/.env

# 2. Preencha as credenciais no arquivo .env (e em backend/.env)
#    - Credenciais Oracle: solicitar ao DBA responsável pelo schema CEDAE_INOVACAO
#    - JWT_SECRET: gerar com o comando abaixo (mínimo 32 caracteres)

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Execute o DDL no Oracle (como DBA ou com permissão CREATE TABLE)
sqlplus usuario/senha@dsn @docs/create_tables.sql

# 4. Suba a aplicação
docker compose up --build

# 5. Acesse
#    Formulário: http://localhost:8095
#    Painel Admin: http://localhost:8095/admin-panel
```

## Variáveis de ambiente obrigatórias

| Variável | Descrição | Como obter |
|---|---|---|
| `ORACLE_HOST` | Host do Oracle | Solicitar ao DBA |
| `ORACLE_PORT` | Porta Oracle | Padrão: `1521` |
| `ORACLE_SERVICE` | Service name Oracle | Solicitar ao DBA |
| `ORACLE_USER` | Usuário Oracle | Solicitar ao DBA |
| `ORACLE_PASSWORD` | Senha Oracle | Solicitar ao DBA — **rotacionar após qualquer exposição** |
| `JWT_SECRET` | Chave de assinatura JWT | Gerar com `crypto.randomBytes(32).toString('hex')` |
| `JWT_EXPIRES_IN` | Expiração do token | Padrão: `60m` |
| `ADMIN_USERNAME` | Login do administrador | Definir livremente |
| `ADMIN_PASSWORD` | Senha do administrador | Definir — mínimo 12 caracteres |
| `PORT` | Porta HTTP | Padrão: `8095` |

**Importante:** O arquivo `.env` contém segredos e nunca deve ser commitado.
O `.gitignore` já bloqueia `.env` e `.env.*`.

## Rotação de credenciais

Sempre que uma credencial for exposta (acidentalmente commitada, logada, etc.):

1. **Oracle:** Acionar o DBA para alterar a senha do usuário `CEDAE_INOVACAO`.
2. **JWT_SECRET:** Gerar um novo valor e atualizar o `.env`. Todos os tokens ativos são invalidados.
3. **ADMIN_PASSWORD:** Atualizar o `.env` e reiniciar a aplicação.

## Documentação técnica

Ver [`docs/`](docs/README.md) para arquitetura, ADRs e plano de implementação.
