# Análise do Sistema — Estado Atual (As-Is)

> Documento gerado em 2026-06-24. Reflete exclusivamente o estado atual encontrado no código-fonte.
> Não contém propostas de arquitetura futura nem de refatoração.

---

## Visão Geral

### Objetivo atual do sistema

O sistema é uma **esteira de captação de iniciativas de inovação** para a CEDAE (Companhia Estadual de Águas e Esgotos do Rio de Janeiro). Permite que colaboradores submetam ideias e propostas de inovação por meio de um formulário público estruturado em quatro blocos. Um painel administrativo restrito exibe KPIs, histórico de acessos e logs de auditoria.

### Principais módulos identificados

| Módulo | Responsabilidade |
|--------|-----------------|
| `AuthModule` | Autenticação via JWT, geração de token, auditoria de login |
| `IniciativasModule` | Recepção e listagem de iniciativas submetidas |
| `AdminModule` | KPIs, histórico de acessos e logs — acesso restrito |
| `DatabaseModule` | Provedor global de conexões Oracle (thin mode) |
| Frontend (estático) | Formulário público e painel administrativo em HTML/CSS/JS puro |

---

## Arquitetura Atual

### Estrutura dos módulos NestJS

```
AppModule
├── DatabaseModule   (Global — provedor único de conexão Oracle)
├── AuthModule
│   ├── AuthController   → POST /api/auth/login
│   ├── AuthService      → validateCredentials, generateToken, registrarLog
│   ├── JwtStrategy      → extrai payload do Bearer token
│   ├── JwtAuthGuard     → guard padrão Passport
│   └── AdminGuard       → verifica is_admin no payload JWT
├── IniciativasModule
│   ├── IniciativasController  → POST /api/iniciativas, GET /api/iniciativas
│   └── IniciativasService     → criar, listar
└── AdminModule
    ├── AdminController  → GET /api/admin/kpis, /acessos, /logs
    └── AdminService     → getKpis, getAcessos, listarLogs, listarIniciativas
```

O `ServeStaticModule` está configurado no `AppModule` para servir o diretório `frontend/` na raiz `/`, com exclusão explícita das rotas `/api/*`. O `main.ts` registra adicionalmente rotas diretas `GET /` e `GET /admin-panel` que entregam os arquivos HTML correspondentes.

### Fluxo frontend → backend → banco

```
Usuário (browser)
    │
    ├─ GET /                  → index.html  (formulário público)
    ├─ GET /admin-panel        → admin.html  (painel restrito)
    │
    ├─ POST /api/auth/login
    │       └─ AuthService.validateCredentials()
    │               └─ compara com ADMIN_USERNAME / ADMIN_PASSWORD (env)
    │       └─ AuthService.generateToken()  → JWT
    │       └─ AuthService.registrarLog()   → INSERT INTO INOVACAO_LOGS (async)
    │
    ├─ POST /api/iniciativas   (sem autenticação)
    │       └─ IniciativasService.criar()
    │               └─ INSERT INTO INOVACAO_INICIATIVAS
    │       └─ AuthService.registrarLog()   → INSERT INTO INOVACAO_LOGS (async)
    │
    ├─ GET /api/iniciativas    (sem autenticação)
    │       └─ IniciativasService.listar()
    │               └─ SELECT * FROM INOVACAO_INICIATIVAS
    │
    ├─ GET /api/admin/kpis     (AdminGuard)
    │       └─ AdminService.getKpis()
    │               └─ SELECT * FROM INOVACAO_INICIATIVAS (computado em memória)
    │
    ├─ GET /api/admin/acessos  (AdminGuard)
    │       └─ AdminService.getAcessos()
    │               └─ SELECT * FROM INOVACAO_LOGS (filtrado por acao='login')
    │
    └─ GET /api/admin/logs     (AdminGuard)
            └─ AdminService.listarLogs()
                    └─ SELECT * FROM INOVACAO_LOGS FETCH FIRST 500 ROWS
```

### Dependências relevantes (backend)

| Pacote | Versão | Finalidade |
|--------|--------|-----------|
| `@nestjs/core` | ^10.3.10 | Framework NestJS |
| `@nestjs/jwt` | ^10.2.0 | Geração e verificação de JWT |
| `@nestjs/passport` | ^10.0.3 | Integração Passport com NestJS |
| `passport-jwt` | ^4.0.1 | Estratégia JWT para Passport |
| `oracledb` | ^6.6.0 | Driver Oracle thin mode (sem client instalado) |
| `class-validator` | ^0.14.1 | Validação de DTOs |
| `class-transformer` | ^0.5.1 | Transformação de tipos nos DTOs |
| `@nestjs/serve-static` | ^4.0.2 | Servir frontend estático |
| `bcrypt` | ^5.1.1 | Instalado como dependência, **não utilizado** no código atual |

---

## Modelo de Dados Atual

### Tabelas encontradas

#### `INOVACAO_INICIATIVAS`

**Finalidade:** Armazenar cada iniciativa de inovação submetida por um colaborador.

| Coluna | Tipo | Constraint | Descrição |
|--------|------|-----------|-----------|
| `ID` | NUMBER | PK, DEFAULT SEQ_INICIATIVA.NEXTVAL | Identificador único |
| `NOME_COLABORADOR` | VARCHAR2(255) | NOT NULL | Nome do proponente |
| `CANAL_CONTATO` | VARCHAR2(255) | NOT NULL | Contato (e-mail, telefone etc.) |
| `TITULO_INICIATIVA` | VARCHAR2(500) | NOT NULL | Título da ideia |
| `AREA_PROPONENTE` | VARCHAR2(255) | NOT NULL | Área/departamento proponente |
| `LOCAL_APLICACAO` | VARCHAR2(255) | NOT NULL | Local onde a iniciativa será aplicada |
| `PROBLEMA_PRATICO` | CLOB | NOT NULL | Descrição do problema a ser resolvido |
| `SOLUCAO_PROPOSTA` | CLOB | NOT NULL | Proposta de solução |
| `RISCO_MITIGADO` | CLOB | NULL | Riscos mitigados pela solução |
| `ESTAGIO_DESENVOLVIMENTO` | VARCHAR2(100) | NULL | Valores esperados: `ideacao`, `piloto`, `escala` |
| `MACRODIMENSAO` | VARCHAR2(100) | NULL | Valores esperados: `tecnologica`, `operacional`, `gerencial`, `social_ambiental`, `outros` |
| `PERFIL_IMPACTO` | VARCHAR2(50) | NULL | Valores esperados: `incremental`, `radical` |
| `APORTE_FINANCEIRO` | VARCHAR2(10) | NULL | Valores esperados: `nao`, `sim` |
| `VALOR_APORTE` | VARCHAR2(255) | NULL | Valor textual formatado em BRL |
| `RETORNO_ECONOMICO` | NUMBER(15,2) | NULL | Estimativa de retorno econômico |
| `SUPORTE_NECESSARIO` | VARCHAR2(1000) | NULL | Valores separados por `\|` (pipe) |
| `COMENTARIOS_ADICIONAIS` | CLOB | NULL | Observações livres |
| `CRIADO_EM` | DATE | NOT NULL, DEFAULT SYSDATE | Timestamp de criação |

**Índices:**
- `IDX_INIC_CRIADO` em `CRIADO_EM`
- `IDX_INIC_AREA` em `AREA_PROPONENTE`

**Sequência:** `SEQ_INICIATIVA` (START WITH 1, INCREMENT BY 1, NOCACHE, NOCYCLE)

---

#### `INOVACAO_LOGS`

**Finalidade:** Registro de auditoria de ações no sistema (acessos e submissões).

| Coluna | Tipo | Constraint | Descrição |
|--------|------|-----------|-----------|
| `ID` | NUMBER | PK, DEFAULT SEQ_LOG.NEXTVAL | Identificador único |
| `USERNAME` | VARCHAR2(100) | NOT NULL | Usuário que realizou a ação |
| `ACAO` | VARCHAR2(100) | NOT NULL | Tipo de ação: `login` ou `submit_formulario` |
| `DETALHE` | VARCHAR2(1000) | NULL | Detalhes complementares (IP no login; ID e título na submissão) |
| `CRIADO_EM` | DATE | NOT NULL, DEFAULT SYSDATE | Timestamp do evento |

**Índices:**
- `IDX_LOG_USERNAME` em `USERNAME`
- `IDX_LOG_CRIADO` em `CRIADO_EM`

**Sequência:** `SEQ_LOG` (START WITH 1, INCREMENT BY 1, NOCACHE, NOCYCLE)

---

### Diagrama textual do modelo de dados

```
┌──────────────────────────────────────────────────┐
│             INOVACAO_INICIATIVAS                 │
│──────────────────────────────────────────────────│
│ PK  ID                     NUMBER                │
│     NOME_COLABORADOR        VARCHAR2(255) NN      │
│     CANAL_CONTATO           VARCHAR2(255) NN      │
│     TITULO_INICIATIVA       VARCHAR2(500) NN      │
│     AREA_PROPONENTE         VARCHAR2(255) NN      │
│     LOCAL_APLICACAO         VARCHAR2(255) NN      │
│     PROBLEMA_PRATICO        CLOB          NN      │
│     SOLUCAO_PROPOSTA        CLOB          NN      │
│     RISCO_MITIGADO          CLOB                  │
│     ESTAGIO_DESENVOLVIMENTO VARCHAR2(100)         │
│     MACRODIMENSAO           VARCHAR2(100)         │
│     PERFIL_IMPACTO          VARCHAR2(50)          │
│     APORTE_FINANCEIRO       VARCHAR2(10)          │
│     VALOR_APORTE            VARCHAR2(255)         │
│     RETORNO_ECONOMICO       NUMBER(15,2)          │
│     SUPORTE_NECESSARIO      VARCHAR2(1000)        │
│     COMENTARIOS_ADICIONAIS  CLOB                  │
│     CRIADO_EM               DATE          NN      │
└──────────────────────────────────────────────────┘
         (sem FK para INOVACAO_LOGS — tabelas independentes)
┌──────────────────────────────────────────────────┐
│                 INOVACAO_LOGS                    │
│──────────────────────────────────────────────────│
│ PK  ID          NUMBER                           │
│     USERNAME    VARCHAR2(100)  NN                │
│     ACAO        VARCHAR2(100)  NN                │
│     DETALHE     VARCHAR2(1000)                   │
│     CRIADO_EM   DATE           NN                │
└──────────────────────────────────────────────────┘

Sequências autônomas:
  SEQ_INICIATIVA → gera ID de INOVACAO_INICIATIVAS
  SEQ_LOG        → gera ID de INOVACAO_LOGS
```

**Relacionamentos:** Não existem foreign keys entre as tabelas. `INOVACAO_LOGS.USERNAME` referencia logicamente o usuário que realizou a ação, mas não há constraint de integridade referencial.

---

## Entidades de Negócio Identificadas

### Iniciativa de Inovação

- **Responsabilidade:** Registrar propostas de inovação submetidas por colaboradores da CEDAE.
- **Origem:** Formulário público (`/`) preenchido pelo colaborador.
- **Como é utilizada:**
  - Criada via `POST /api/iniciativas` por qualquer usuário sem autenticação.
  - Listada via `GET /api/iniciativas` (também público).
  - Consumida pelo `AdminService.getKpis()` para cálculo de métricas em memória.
  - Exibida no painel administrativo com filtro por estágio e dimensão.

### Administrador

- **Responsabilidade:** Único usuário privilegiado do sistema.
- **Origem:** Definido por variáveis de ambiente (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- **Como é utilizado:**
  - Faz login em `POST /api/auth/login` e recebe JWT com `is_admin: true`.
  - Acessa endpoints protegidos em `/api/admin/*`.
  - Não existe representação em banco de dados — credencial hardcoded via env.

### Log de Auditoria

- **Responsabilidade:** Registrar eventos do sistema (login e submissão de iniciativas).
- **Origem:** Gerado automaticamente pelo `AuthService.registrarLog()` após login ou submissão.
- **Como é utilizado:**
  - Inserido de forma assíncrona e não-bloqueante após cada evento.
  - Consultado no painel administrativo via `GET /api/admin/logs` e `GET /api/admin/acessos`.
  - Limitado a 500 linhas na query de listagem.

---

## Fluxos Funcionais Encontrados

### Submissão de iniciativa

```
1. Usuário acessa GET /  →  index.html carregado
2. Frontend (app.js) chama applySession() → verifica sessionStorage
3. Usuário preenche formulário (4 blocos)
4. app.js → collectFormData() monta objeto payload
5. app.js → validateForm(payload) valida campos obrigatórios no frontend
6. app.js → submitForm() → POST /api/iniciativas { payload JSON }
7. Backend: ValidationPipe valida CreateIniciativaDto
8. IniciativasController.submeter() → IniciativasService.criar()
9. DatabaseService.getConnection() abre conexão Oracle
10. INSERT INTO INOVACAO_INICIATIVAS ... RETURNING ID INTO :17
11. conn.commit() + conn.close()
12. (async) AuthService.registrarLog(nome_colaborador, 'submit_formulario', 'Iniciativa #ID - Título')
    → INSERT INTO INOVACAO_LOGS
13. Resposta: { message, id }
14. Frontend: oculta formulário, exibe cartão de sucesso
```

### Login

```
1. Usuário clica "Login" → modal abre (toggleLoginModal)
2. Usuário preenche username/password → clica "Entrar"
3. app.js → doLogin() → POST /api/auth/login { username, password }
4. Backend: AuthController.login()
5. AuthService.validateCredentials() → compara com ADMIN_USERNAME / ADMIN_PASSWORD (env)
6. Se inválido: UnauthorizedException 401
7. Se válido: AuthService.generateToken() → jwtService.sign({ sub: username, is_admin: true })
8. (async) AuthService.registrarLog(username, 'login', 'IP: x.x.x.x')
9. Resposta: { access_token, token_type: 'bearer', is_admin: true }
10. Frontend: saveSession({ token, is_admin, username }) → sessionStorage
11. applySession() → exibe botão "Admin Panel" na navbar
12. Modal fecha
```

### Dashboard / Painel Administrativo

```
1. Usuário acessa GET /admin-panel →  admin.html carregado
2. admin.js → checkAdmin() → lê sessionStorage
   → se não autenticado ou não admin: redireciona para /
3. DOMContentLoaded:
   a. loadKPIs()    → GET /api/admin/kpis    (Bearer token)
      → renderiza total, por estágio, gráfico de barras por dimensão
   b. loadAcessos() → GET /api/admin/acessos (Bearer token)
      → popula tabela de acessos (filtrado por acao='login')
   c. loadIniciativas() → GET /api/iniciativas (sem auth)
      → popula tabela de iniciativas com badges de estágio
   d. loadLogs()    → GET /api/admin/logs    (Bearer token)
      → popula tabela de logs completa (máx 500 linhas)
```

### Logs / Auditoria

```
Inserção:
  AuthService.registrarLog(username, acao, detalhe)
    → INSERT INTO INOVACAO_LOGS (USERNAME, ACAO, DETALHE, CRIADO_EM) VALUES (...)
    → Executado de forma assíncrona e silenciosa (catch vazio)

Consulta:
  GET /api/admin/logs → AdminService.listarLogs()
    → SELECT * FROM INOVACAO_LOGS ORDER BY CRIADO_EM DESC FETCH FIRST 500 ROWS ONLY

  GET /api/admin/acessos → AdminService.getAcessos()
    → listarLogs() + filter(l => l.acao === 'login')  [filtro em memória]
```

### Consultas administrativas (KPIs)

```
GET /api/admin/kpis → AdminService.getKpis()
  1. Chama listarIniciativas()
     → SELECT * FROM INOVACAO_INICIATIVAS ORDER BY CRIADO_EM DESC
  2. Itera sobre todos os registros em memória:
     - Conta total
     - Agrupa por ESTAGIO_DESENVOLVIMENTO
     - Agrupa por MACRODIMENSAO
  3. Retorna: { total_iniciativas, por_estagio, por_dimensao }
```

---

## Autenticação e Autorização

### Como funciona hoje

O sistema possui **um único usuário administrador**, definido por variáveis de ambiente. Não existe cadastro de usuários nem autenticação de colaboradores — o formulário de submissão é **completamente público** (sem autenticação).

### Como JWT é utilizado

1. Ao fazer login, `AuthService.generateToken()` cria um token com payload `{ sub: username, is_admin: true/false }`.
2. O token é assinado com `JWT_SECRET` e expira conforme `JWT_EXPIRES_IN` (padrão: 60 minutos).
3. O frontend armazena o token em `sessionStorage` (chave: `cedae_session`).
4. Nas chamadas aos endpoints admin, o frontend inclui o header `Authorization: Bearer <token>`.

### Como permissões são aplicadas

Existem dois guards no sistema:

**`JwtAuthGuard`** (`jwt-auth.guard.ts`): Estende `AuthGuard('jwt')` do Passport. Valida o Bearer token usando a `JwtStrategy`. Não está aplicado em nenhum endpoint no momento — presente no código mas sem uso ativo.

**`AdminGuard`** (`admin.guard.ts`): Guard customizado. Extrai o token do header `Authorization`, verifica manualmente com `jwtService.verify()`, e checa `payload.is_admin === true`. Aplicado via `@UseGuards(AdminGuard)` no `AdminController`. Não utiliza a estratégia Passport; faz verificação direta.

Endpoints sem guard: `POST /api/auth/login`, `POST /api/iniciativas`, `GET /api/iniciativas`.

### Dependências de variáveis de ambiente

| Variável | Uso | Valor padrão no código |
|----------|-----|----------------------|
| `JWT_SECRET` | Assinar e verificar JWT | `'insecure-default-change-me-32-chars'` |
| `JWT_EXPIRES_IN` | Expiração do token | `'60m'` |
| `ADMIN_USERNAME` | Credencial do admin | `'gsalviete'` (docker-compose.yml) |
| `ADMIN_PASSWORD` | Credencial do admin | `'senha123'` (docker-compose.yml) |

---

## Configuração e Infraestrutura

### Docker

O backend possui um `Dockerfile` em `backend/Dockerfile`:

- **Imagem base:** `node:22-slim`
- **Package manager:** `pnpm 10.17.1` (via corepack)
- **Build:** `pnpm install --frozen-lockfile` → `pnpm run build` (compila TypeScript)
- **Porta exposta:** `8095`
- **Comando de inicialização:** `node dist/main.js`

Não existe Dockerfile para o frontend — os arquivos estáticos são servidos diretamente pelo NestJS via `ServeStaticModule`.

### Docker Compose

**Arquivo:** `docker-compose.yml` (raiz do repositório)

- Um único serviço: `app` (backend NestJS)
- Porta mapeada: `8095:8095`
- `extra_hosts: host.docker.internal:host-gateway` — permite que o container acesse o Oracle instalado no host
- Volume: `./backend/.env:/app/.env` — injeta variáveis de ambiente
- Volume: `./frontend:/frontend` — serve o frontend estático
- Rede: `cedae_net` (bridge)
- Política de restart: `unless-stopped`

### Variáveis de ambiente

| Variável | Descrição | Exemplo real |
|----------|-----------|-------------|
| `ORACLE_HOST` | Host do banco Oracle | `bl202.cedae.corp` |
| `ORACLE_PORT` | Porta Oracle | `1521` |
| `ORACLE_SERVICE` | Service name Oracle | `cedaetst.cedae.corp` |
| `ORACLE_USER` | Usuário Oracle | `CEDAE_INOVACAO` |
| `ORACLE_PASSWORD` | Senha Oracle | `Cedae#2026` |
| `JWT_SECRET` | Segredo JWT | `troque-por-uma-chave-segura-de-32-chars` (não trocado) |
| `JWT_EXPIRES_IN` | Expiração JWT | `60m` |
| `ADMIN_USERNAME` | Login do admin | `gsalviete` |
| `ADMIN_PASSWORD` | Senha do admin | `senha123` |
| `PORT` | Porta HTTP do app | `8095` |

O arquivo `.env` real (com credenciais de produção/teste) está **no repositório** — o `.gitignore` inclui `.env` e `.env.*`, mas o arquivo foi commitado no estado inicial (`first commit`).

### Dependências externas

- **Oracle Database** — instância externa (`bl202.cedae.corp:1521/cedaetst.cedae.corp`). Não containerizada — existente na infraestrutura da CEDAE.
- **OracleDB thin mode** — não requer Oracle Instant Client instalado no container.
- **GitLab CI** — arquivo `.gitlab-ci.yml` presente mas vazio, sem pipeline configurado.

---

## Divergências Encontradas

### Entre implementação e documentação (`IMPLEMENTACAO.md`)

| Item | Documentado em IMPLEMENTACAO.md | Implementado no código |
|------|--------------------------------|----------------------|
| Stack backend | "Node.js 20, NestJS" | Node.js 22 no Dockerfile |
| Frontend | "arquivos estáticos servidos pelo NestJS" | Correto, via ServeStaticModule |
| Autenticação | "JWT com `is_admin` no payload" | Correto |
| Módulo Database | Mencionado | Correto, global |
| `GET /api/iniciativas` | Não mencionado como público | É público — sem autenticação |
| `bcrypt` | Documentado como dependência presente | Instalado, mas **não utilizado** em nenhum arquivo de código |

### Inconsistências internas no código

| Inconsistência | Local | Detalhamento |
|---------------|-------|-------------|
| Duplo mecanismo de guarda | `JwtAuthGuard` vs `AdminGuard` | `JwtAuthGuard` existe mas não é usado; `AdminGuard` reimplementa verificação de JWT manualmente |
| `req.connection` depreciado | `iniciativas.controller.ts:28` | `req.connection?.remoteAddress` — `connection` está depreciado no Node.js 18+ (usar `req.socket`) |
| `initOracleClient()` desnecessário em thin mode | `database.service.ts:12` | OracleDB thin mode não requer `initOracleClient()`; chamada envolve try/catch mas pode causar confusão |
| Volume do frontend no compose | `docker-compose.yml` | Volume monta `/frontend` mas o Dockerfile serve `../../frontend` — o caminho depende de como o compose monta os volumes relativamente ao WORKDIR `/app` |
| `console.log` com credenciais | `auth.service.ts:7-12` | Loga `username` e `password` (em texto claro) e os valores de `ADMIN_USERNAME`/`ADMIN_PASSWORD` no console de produção |
| `strictNullChecks: false` | `tsconfig.json` | TypeScript com checagem de nulos desabilitada — erros de null/undefined não detectados em tempo de compilação |
| `noImplicitAny: false` | `tsconfig.json` | Permite variáveis `any` sem declaração explícita |
| `aporte_financeiro` como VARCHAR2(10) | SQL + DTO | Campo esperado como `'sim'` ou `'nao'` mas modelado como VARCHAR2(10) sem constraint CHECK |
| KPIs calculados em memória | `admin.service.ts` | `getKpis()` carrega TODOS os registros de `INOVACAO_INICIATIVAS` e agrupa em memória via JavaScript — não usa GROUP BY SQL |
| `getAcessos()` filtra em memória | `admin.service.ts` | Carrega todos os 500 logs e filtra por `acao === 'login'` em JS — poderia usar WHERE na query |

---

## Dívidas Técnicas

### Acoplamentos

- **`AdminService.getKpis()`** chama `listarIniciativas()` internamente, que por sua vez acessa o banco — o método de KPI não é independente e duplica a lógica de listagem com `IniciativasService.listar()`.
- **`AuthService.registrarLog()`** é importado diretamente no `IniciativasController` — o controlador de iniciativas depende do serviço de autenticação para logging.
- **`AdminGuard`** reimplementa manualmente a verificação JWT (`jwtService.verify()`) em vez de usar a estratégia Passport já configurada (`JwtAuthGuard`), criando dois caminhos de validação paralelos.

### Duplicações

- **`listarIniciativas()`** existe em `AdminService` com implementação idêntica a `IniciativasService.listar()` — mesma query SQL, mesma normalização de chaves.
- **Normalização de keys Oracle** (`key.toLowerCase()`) repetida em cada método de consulta em todos os services.
- O `JWT_SECRET` é referenciado explicitamente em três locais: `auth.module.ts`, `jwt.strategy.ts` e `admin.guard.ts`.

### Validações ausentes

- **Backend:** `GET /api/iniciativas` não tem autenticação — qualquer pessoa com acesso à porta 8095 pode listar todas as iniciativas.
- **Backend:** Não há validação de domínio nos campos enum-like (`ESTAGIO_DESENVOLVIMENTO`, `MACRODIMENSAO`, `PERFIL_IMPACTO`, `APORTE_FINANCEIRO`) — valores arbitrários são aceitos e persistidos.
- **Banco de dados:** Nenhum `CHECK CONSTRAINT` nos campos com valores pré-definidos.
- **Frontend:** Validação parcial — campos obrigatórios verificados, mas sem validação de formato de e-mail, sem limite de tamanho em textarea, sem validação cruzada entre `APORTE_FINANCEIRO` e `VALOR_APORTE`.
- **Rate limiting:** Ausente — endpoint de login não tem proteção contra força bruta.
- **HTTPS:** Não configurado — tráfego em HTTP puro, incluindo envio de senha no login.

### Problemas de modelagem

- `SUPORTE_NECESSARIO` armazena múltiplos valores separados por `|` em um único VARCHAR2(1000) — viola normalização.
- `VALOR_APORTE` é VARCHAR2(255) armazenando valor monetário em formato texto (ex: `"R$ 10.000,00"`) — deveria ser numérico.
- `RETORNO_ECONOMICO` é NUMBER(15,2) mas no DTO é `@IsOptional()` e `@IsNumber()` — inconsistente com `VALOR_APORTE` que é string.
- Sem `UPDATED_AT` ou histórico de alterações — não é possível auditar modificações após submissão.
- Sem status de workflow na iniciativa (ex: recebida, em análise, aprovada, rejeitada) — campo ausente.

### Riscos de manutenção

- Credenciais reais de banco de dados Oracle (`Cedae#2026`) presentes no `.env` que foi incluído no commit inicial.
- JWT_SECRET com valor placeholder `'troque-por-uma-chave-segura-de-32-chars'` no `.env` real — não foi substituído.
- `console.log` de credenciais em `AuthService.validateCredentials()` — logs de produção expõem `ADMIN_PASSWORD`.
- `bcrypt` instalado mas não utilizado — dependência morta que aumenta superfície de ataque e tamanho do bundle.
- `passport-local` instalado mas sem `LocalStrategy` implementada — dependência morta.
- TypeScript com `strictNullChecks: false` e `noImplicitAny: false` — erros de runtime silenciados em compilação.

---

## Riscos de Refatoração

### Tabelas críticas

| Tabela | Criticidade | Risco |
|--------|------------|-------|
| `INOVACAO_INICIATIVAS` | Alta | Dados de negócio; qualquer alteração de schema requer migração dos dados existentes |
| `INOVACAO_LOGS` | Média | Auditoria; perda de registros históricos é irreversível |

### Fluxos críticos

| Fluxo | Criticidade | Risco |
|-------|------------|-------|
| Submissão de iniciativa (`POST /api/iniciativas`) | Alta | Único ponto de entrada de dados de negócio; downtime implica perda de submissões |
| Login (`POST /api/auth/login`) | Alta | Falha bloqueia acesso ao painel admin |
| Registro de log (assíncrono) | Baixa | Falha silenciosa já prevista; não afeta operação principal |

### Possíveis impactos de mudanças

- **Renomear colunas Oracle:** Todas as queries SQL são strings literais embutidas nos services — uma mudança de coluna exige busca manual em todos os arquivos.
- **Alterar estrutura do JWT payload:** `AdminGuard` e `JwtStrategy` verificam `payload.is_admin` diretamente — mudanças no payload quebram autenticação silenciosamente (sem type-safety).
- **Adicionar autenticação ao `GET /api/iniciativas`:** O painel admin (`admin.js → loadIniciativas()`) chama esse endpoint **sem token** — adicionar auth quebraria o painel.
- **Migrar de Oracle:** Todas as queries são Oracle-específicas (`SYSDATE`, `FETCH FIRST N ROWS ONLY`, `RETURNING ... INTO`, sequences) — migração de banco exige reescrita de todas as queries.
- **Adicionar multi-usuário:** O modelo atual não tem tabela de usuários; credencial única em env; JWT não referencia entidade persistida.

---

## Resumo Executivo

### 1. O que está bem estruturado?

- Organização modular do backend segue convenções NestJS (`AuthModule`, `IniciativasModule`, `AdminModule`, `DatabaseModule`).
- Uso de DTOs com `class-validator` para validação de entrada na camada de API.
- Separação clara entre formulário público e painel administrativo.
- Logging de auditoria assíncrono e não-bloqueante — não compromete a operação principal em caso de falha.
- Docker Compose funcional com variáveis externalizadas.
- Thin mode do OracleDB elimina dependência de Oracle Instant Client no container.
- Design responsivo (mobile-first) do frontend com sistema de CSS bem organizado.

### 2. O que representa maior risco?

- **Credenciais expostas:** `.env` real com senha Oracle e JWT_SECRET placeholder no repositório git.
- **`console.log` de senha em produção:** `AuthService.validateCredentials()` loga `ADMIN_PASSWORD` em texto claro.
- **Endpoint público de listagem:** `GET /api/iniciativas` expõe todos os dados de iniciativas sem autenticação.
- **Sem rate limiting no login:** Vulnerável a ataques de força bruta.
- **TypeScript sem strict mode:** Erros de null/undefined não detectados em compilação.

### 3. O que deveria ser preservado?

- Estrutura de módulos NestJS — bem organizada e segue o padrão do framework.
- Schema das duas tabelas Oracle — estrutura fundamentalmente correta para o propósito.
- Mecanismo de log de auditoria assíncrono — boa prática de não bloquear a operação principal.
- DTOs com validação via `class-validator`.
- Separação frontend/backend com API REST bem definida.
- Layout e UX do formulário — estruturado em blocos lógicos com boa experiência de usuário.

### 4. O que deveria ser refeito?

- **Autenticação:** Substituir credenciais hardcoded em env por tabela de usuários com hash de senha (bcrypt já está instalado).
- **Guard de autenticação:** Consolidar `JwtAuthGuard` e `AdminGuard` em um único mecanismo usando Passport corretamente.
- **`listarIniciativas()` duplicado:** Eliminar duplicação entre `AdminService` e `IniciativasService`.
- **KPIs via SQL:** Substituir agregação em memória por `GROUP BY` no banco.
- **`SUPORTE_NECESSARIO`:** Normalizar para tabela de relacionamento N:N.
- **`VALOR_APORTE`:** Converter para tipo numérico no banco.
- **`console.log` de credenciais:** Remover imediatamente.
- **TypeScript strict mode:** Habilitar `strictNullChecks` e `noImplicitAny`.

### 5. Quais áreas exigem mais cuidado durante a refatoração?

- **Endpoint `GET /api/iniciativas`:** Usado tanto pelo painel admin quanto potencialmente por integrações externas — adicionar autenticação requer atualização coordenada do frontend.
- **Modelo de dados Oracle:** Qualquer alteração de schema requer script de migração cuidadoso, pois não há ORM com migrations automáticas (queries são SQL puro).
- **JWT payload e guards:** Múltiplos pontos no código dependem da estrutura exata do payload — mudanças devem ser feitas em conjunto em `auth.service.ts`, `jwt.strategy.ts` e `admin.guard.ts`.
- **Volume Docker do frontend:** A relação entre os volumes montados e o caminho servido pelo `ServeStaticModule` é frágil — mudanças na estrutura de diretórios podem quebrar o serving de arquivos estáticos.
- **Gestão de conexões Oracle:** Cada operação abre e fecha uma conexão individual — não há connection pool configurado; sob carga, isso pode tornar-se gargalo.
