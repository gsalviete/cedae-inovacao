# CEDAE Inovação — Documentação de Implementação
## Formulário Digital Via 2 — Esteira de Captação Ativa de Inovação

---

## 1. Visão Geral

Sistema web para captação, registro e gestão de iniciativas de inovação submetidas por colaboradores da CEDAE. O formulário é público (sem login obrigatório para preenchimento) e possui um painel administrativo restrito ao usuário `gsalviete`.

---

## 2. Stack Tecnológica

| Camada      | Tecnologia                         |
|-------------|------------------------------------|
| Backend     | Node.js 20 + NestJS (TypeScript)   |
| Frontend    | HTML5 / CSS3 / JavaScript (vanilla)|
| Banco de Dados | Oracle (via `oracledb` thin mode) |
| Servidor    | Express (via NestJS)               |
| Container   | Docker + Docker Compose            |
| CI/CD       | GitLab CI (pipeline a configurar)  |

---

## 3. Estrutura de Diretórios

```
cedae-inovacao/
├── docker-compose.yml
├── .env.example             # Variáveis de ambiente — copie para .env
├── .gitlab-ci.yml           # Pipeline CI (vazio — a configurar)
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts          # Entrypoint NestJS + Bootstrap
│       ├── app.module.ts    # Módulo raiz + ServeStaticModule
│       ├── auth/
│       │   ├── auth.controller.ts # POST /api/auth/login
│       │   ├── auth.service.ts    # Login e JWT
│       │   └── jwt.strategy.ts    # Estratégia Passport
│       ├── iniciativas/
│       │   ├── iniciativas.controller.ts # GET/POST /api/iniciativas/
│       │   └── iniciativas.service.ts    # CRUD Oracle
│       ├── admin/
│       │   ├── admin.controller.ts # GET /api/admin/{kpis,logs,acessos}
│       │   └── admin.service.ts    # Relatórios Oracle
│       └── database/
│           └── database.service.ts # Fábrica de conexão Oracle (thin mode)
├── frontend/
│   ├── templates/
│   │   ├── index.html       # Formulário público
│   │   └── admin.html       # Painel administrativo
│   └── static/
│       ├── css/
│       │   ├── style.css    # Estilos principais (tema água/CEDAE)
│       │   └── admin.css    # Estilos do painel admin
│       ├── js/
│       │   ├── app.js       # Lógica do formulário (submit, login, sessão)
│       │   └── admin.js     # Lógica do painel admin (KPIs, tabelas, logs)
│       └── img/
│           └── LEIA-ME.txt  # Instruções para inserir a logo do setor
└── docs/
    ├── create_tables.sql    # DDL Oracle (sequences + tabelas + índices)
    └── IMPLEMENTACAO.md     # Este arquivo
```

---

## 4. Modelagem de Dados (Oracle)

### 4.1 Tabela `INOVACAO_INICIATIVAS`

Armazena cada submissão do Formulário Via 2.

| Coluna                  | Tipo            | Descrição                                      |
|-------------------------|-----------------|------------------------------------------------|
| ID                      | NUMBER (PK)     | Sequência auto-incremental                     |
| NOME_COLABORADOR        | VARCHAR2(255)   | Nome completo do proponente                    |
| CANAL_CONTATO           | VARCHAR2(255)   | Ramal, celular ou e-mail                       |
| TITULO_INICIATIVA       | VARCHAR2(500)   | Título da iniciativa                           |
| AREA_PROPONENTE         | VARCHAR2(255)   | Gerência / Diretoria (texto livre)             |
| LOCAL_APLICACAO         | VARCHAR2(255)   | Unidade operacional ou administrativa          |
| PROBLEMA_PRATICO        | CLOB            | Descrição do problema/gargalo                  |
| SOLUCAO_PROPOSTA        | CLOB            | Descrição da solução                           |
| RISCO_MITIGADO          | CLOB            | Risco corporativo/regulatório mitigado         |
| ESTAGIO_DESENVOLVIMENTO | VARCHAR2(100)   | `ideacao` \| `piloto` \| `escala`              |
| MACRODIMENSAO           | VARCHAR2(100)   | Dimensão de inovação (ver domínios abaixo)     |
| PERFIL_IMPACTO          | VARCHAR2(50)    | `incremental` \| `radical`                    |
| APORTE_FINANCEIRO       | VARCHAR2(10)    | `nao` \| `sim`                                |
| VALOR_APORTE            | VARCHAR2(255)   | Valor estimado (texto livre)                   |
| RETORNO_ECONOMICO       | NUMBER(15,2)    | Economia anualizada em R$                      |
| SUPORTE_NECESSARIO      | VARCHAR2(1000)  | Valores múltiplos separados por `\|`           |
| COMENTARIOS_ADICIONAIS  | CLOB            | Observações livres                             |
| CRIADO_EM               | DATE            | Data/hora de submissão (SYSDATE)               |

**Domínios de MACRODIMENSAO:** `tecnologica`, `operacional`, `gerencial`, `social_ambiental`, `outros`

### 4.2 Tabela `INOVACAO_LOGS`

Registra acessos e ações no sistema para auditoria.

| Coluna    | Tipo           | Descrição                              |
|-----------|----------------|----------------------------------------|
| ID        | NUMBER (PK)    | Sequência auto-incremental             |
| USERNAME  | VARCHAR2(100)  | Usuário que executou a ação            |
| ACAO      | VARCHAR2(100)  | `login` \| `submit_formulario`         |
| DETALHE   | VARCHAR2(1000) | Informação adicional (IP, título etc.) |
| CRIADO_EM | DATE           | Data/hora do evento                    |

---

## 5. API REST

| Método | Endpoint                 | Auth    | Descrição                              |
|--------|--------------------------|---------|----------------------------------------|
| POST   | /api/auth/login          | —       | Autenticação — retorna JWT             |
| POST   | /api/iniciativas/        | —       | Submeter nova iniciativa               |
| GET    | /api/iniciativas/        | —       | Listar todas as iniciativas            |
| GET    | /api/admin/kpis          | Admin   | KPIs e distribuições agregadas         |
| GET    | /api/admin/acessos       | Admin   | Histórico de logins                    |
| GET    | /api/admin/logs          | Admin   | Log completo do sistema                |

Documentação de endpoints (Swagger) pode ser adicionada no futuro, mas as rotas mantêm a mesma estrutura da API anterior (via FastAPI).

---

## 6. Autenticação e Segurança

- **Formulário:** público, sem autenticação. Qualquer colaborador pode submeter.
- **Admin:** autenticação via JWT (HS256). Credenciais configuradas no `.env`.
- **Frontend:** token armazenado em `sessionStorage` (não em `localStorage` nem em cookies). Nenhuma chave ou credencial exposta no JS.
- **Backend:** variáveis sensíveis lidas exclusivamente via variáveis de ambiente — nunca hardcoded.
- **Painel Admin:** o botão "Painel Admin" só aparece se `is_admin: true` retornar no login. O backend valida o token em cada requisição protegida.

---

## 7. Como Executar

### 7.1 Pré-requisitos
- Docker 24+ e Docker Compose v2+
- Acesso a uma instância Oracle com usuário e permissão de criação de tabelas

### 7.2 Configuração inicial

```bash
# 1. Clone o repositório
git clone <url-do-repo>
cd cedae-inovacao

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais reais do Oracle e a SECRET_KEY

# 3. Execute o DDL no Oracle (como DBA ou com permissão CREATE TABLE)
sqlplus usuario/senha@dsn @docs/create_tables.sql

# 4. Suba a aplicação
docker compose up --build

# 5. Acesse
# Formulário: http://localhost:8095
# Painel Admin: http://localhost:8095/admin-panel (faça login com gsalviete/senha123)
```

### 7.3 Logo do setor
Substitua (ou adicione) o arquivo em:
```
frontend/static/img/logo-placeholder.png
```
O nome pode ser alterado no atributo `src` da tag `<img id="logo-setor">` nos dois templates HTML.

---

## 8. Variáveis de Ambiente

| Variável          | Descrição                                         | Exemplo                  |
|-------------------|---------------------------------------------------|--------------------------|
| ORACLE_HOST       | Host do Oracle                                    | `localhost`              |
| ORACLE_PORT       | Porta do Oracle                                   | `1521`                   |
| ORACLE_SERVICE    | Service Name do Oracle                            | `XEPDB1`                 |
| ORACLE_USER       | Usuário Oracle                                    | `cedae_user`             |
| ORACLE_PASSWORD   | Senha Oracle                                      | `cedae_password`         |
| JWT_SECRET        | Chave para assinatura JWT (mín. 32 caracteres)    | `minha-chave-segura-...` |
| JWT_EXPIRES_IN    | Tempo de expiração do JWT                         | `60m`                    |
| ADMIN_USERNAME    | Usuário administrador                             | `gsalviete`              |
| ADMIN_PASSWORD    | Senha do administrador                            | `senha123`               |

---

## 9. Próximos Passos Sugeridos

1. **Pipeline GitLab CI** — configurar stages de lint, test e deploy no `.gitlab-ci.yml`
2. **Múltiplos usuários** — criar tabela `USUARIOS` e autenticação via LDAP/AD da CEDAE
3. **Exportação de relatórios** — endpoint para gerar Excel/PDF com as iniciativas
4. **Notificações** — envio de e-mail automático ao proponente após submissão
5. **Anexos** — campo de upload de documentos (ex.: fluxogramas, planilhas de custo)
