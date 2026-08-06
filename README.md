# CEDAE Inovação

Sistema de captação e gestão de iniciativas de inovação.

## Pré-requisitos

- Docker 24+ e Docker Compose v2+
- Acesso ao Oracle (solicitar ao DBA: host, service name, usuário e senha)
- Node.js 22+ (apenas para desenvolvimento local sem Docker)

## Configuração do ambiente

**Um ambiente, um arquivo.** O app carrega exatamente um, nunca dois em cascata
(`backend/src/env.ts`):

| Situação | Arquivo lido |
|---|---|
| `ENV_FILE=/caminho/arquivo` | o caminho indicado (vence tudo) |
| `NODE_ENV=production` | `.env` — todo container, o Dockerfile define |
| qualquer outro caso | `.env.dev`, e `.env` só se `.env.dev` não existir |

Ler os dois em cascata seria pior que não ler nenhum: uma variável ausente do
`.env.dev` cairia no valor de produção sem avisar. Quando o arquivo existe, ele
vence as variáveis do ambiente — é o que impede a configuração do host (o cron
de deploy da infra define `MAIL_FROM`, `SMTP_SERVER`) de vazar para o app.

```bash
# 1. Copie o template — .env para produção/container, .env.dev para sua máquina
cp .env.example .env.dev

# 2. Preencha (o próprio template explica cada variável)
#    - Oracle: solicitar host/service/usuário/senha ao DBA
#    - DEV_REMOTE_USER: seu login, para simular o header do IIS fora do servidor

# 3. Execute o DDL no Oracle (como DBA ou com permissão CREATE TABLE)
sqlplus usuario/senha@dsn @database/schema/create_tables.sql

# 4. Suba a aplicação
docker compose up --build

# 5. Acesse (com PROJECT_PATH=esteira_inovacao)
#    Formulário:   http://localhost:8095/esteira_inovacao/
#    Painel Admin: http://localhost:8095/esteira_inovacao/admin/dashboard
#    Health:       http://localhost:8095/esteira_inovacao/api/health
```

Nunca commite `.env` nem `.env.dev` (o `.gitignore` bloqueia `.env*`, menos o
`.env.example`) e não crie `backend/.env`: o Dockerfile copia `backend/` para
dentro da imagem — o `.dockerignore` bloqueia, mas o arquivo não deve existir.

## Variáveis de ambiente obrigatórias

Ausência de qualquer uma faz `/api/health` responder **503** com o nome do que
falta, e o balanceador tira a instância do pool.

| Variável | Descrição | Como obter |
|---|---|---|
| `ORACLE_USER` | Usuário Oracle | Solicitar ao DBA |
| `ORACLE_PASSWORD` | Senha Oracle | Solicitar ao DBA — **rotacionar após qualquer exposição** |
| `ORACLE_HOST` | Host do Oracle (em produção, o SCAN do RAC) | Solicitar ao DBA |
| `ORACLE_SERVICE` | Service name Oracle | Solicitar ao DBA |

A conexão é sempre Easy Connect (`HOST:PORT/SERVICE`) — não há
`ORACLE_CONNECT_STRING` nem `tnsnames.ora` dentro do container. O failover entre
nós do RAC vem do próprio SCAN.

Demais variáveis (`PORT`, `PROJECT_PATH`, `SMTP_*`, `INOVACAO_MAIL_FROM*`,
`TERMOS_VERSAO`, rate limit) estão documentadas uma a uma no
[`.env.example`](.env.example).

## Autenticação

**A aplicação não tem tela de login.** Em produção o IIS autentica no Active
Directory (Kerberos) e injeta o header `x-remote-user` em toda requisição; o app
apenas lê esse header (`backend/src/auth/identidade.service.ts`) e resolve as
permissões na tabela `ADMIN_USERS`. Não há sessão, cookie, JWT nem logout.

Fora do servidor não existe IIS na frente: `DEV_REMOTE_USER` faz o papel do
header. Em produção ela significa que uma requisição que chegue **sem** o header
— alguém falando direto com o container, sem passar pelo proxy — é atendida como
esse usuário; o app avisa no log de boot e em `/api/health`.

## Rotação de credenciais

Sempre que uma credencial for exposta (acidentalmente commitada, logada, etc.),
acionar o DBA para alterar a senha do usuário `CEDAE_INOVACAO` e atualizar o
`.env`.

## Diagnóstico

```bash
# Configuração essencial presente? (503 = falta algo; a resposta diz o quê)
curl -s http://localhost:8095/esteira_inovacao/api/health

# Onde exatamente o envio de e-mail para: variável, DNS/firewall ou o relay
docker exec cedae_inovacao_app node dist/mail/mail.diagnostico.js seu.nome@cedae.com.br
```

## Documentação técnica

Ver [`docs/`](docs/README.md) para arquitetura, ADRs e plano de implementação.
