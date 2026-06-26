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

## Gestão do JWT_SECRET

O `JWT_SECRET` assina e verifica todos os tokens de autenticação.
A aplicação **recusa iniciar** se o valor estiver ausente ou tiver menos de 32 caracteres.

### Gerar um novo JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado (64 caracteres hexadecimais) e coloque no `.env`:

```
JWT_SECRET=<resultado-do-comando-acima>
```

### Requisitos mínimos

- Mínimo 32 caracteres
- Gerado aleatoriamente (`crypto.randomBytes` ou equivalente)
- Não deve conter palavras como "troque", "change", "default", "secret"
- Não deve ser commitado — o `.gitignore` já bloqueia `.env`

### Verificar o valor atual

```bash
node -e "const s = process.env.JWT_SECRET; console.log('Tamanho:', s?.length ?? 'NÃO DEFINIDO', s && s.length >= 32 ? '✓ OK' : '✗ INVÁLIDO')"
```

### Quando rotacionar

- Após qualquer exposição do valor atual (commit acidental, log, etc.)
- A cada 90 dias em produção como boa prática
- Ao substituir membros da equipe com acesso ao `.env`

### Impacto da rotação

**Todos os tokens ativos são imediatamente invalidados.** Usuários logados precisarão fazer login novamente. Planejar a rotação fora do horário de pico.

## Rotação de credenciais

Sempre que uma credencial for exposta (acidentalmente commitada, logada, etc.):

1. **Oracle:** Acionar o DBA para alterar a senha do usuário `CEDAE_INOVACAO`.
2. **JWT_SECRET:** Gerar um novo valor conforme seção acima. Todos os tokens ativos são invalidados.
3. **ADMIN_PASSWORD:** Atualizar o `.env` e reiniciar a aplicação.

## Documentação técnica

Ver [`docs/`](docs/README.md) para arquitetura, ADRs e plano de implementação.
