# ADRs Finais — CEDAE Inovação
**Versão:** 1.0 — APROVADO  
**Data:** 2026-06-24  
**Origem:** Consolidação de architecture-decision-records.md + adr-review.md  
**Alterações aplicadas:**
- HOMOLOGADA → APROVADA; DESQUALIFICADA → REPROVADA
- Vias 1, 3 e Mapeamento Externo removidos do MVP
- PE/Metas Globais removidos do MVP
- Estados RASCUNHO, DEVOLVIDA, SUSPENSA, CONCLUIDA, CANCELADA movidos para backlog futuro
- ADR-002 revisado: STATUS_WORKFLOW extraído como tabela separada

---

## Índice de Status

| ADR | Título | Status |
|---|---|---|
| ADR-001 | Schema Additive | **APPROVED** |
| ADR-002 | DOMINIO_VALORES (sem status de workflow) | **APPROVED** |
| ADR-002-B | STATUS_WORKFLOW como tabela própria | **APPROVED** |
| ADR-003 | Separação Identidade / Auth / Authz | **APPROVED** |
| ADR-004 | Workflow como dado (TRANSICOES_STATUS) | **APPROVED** |
| ADR-005 | HISTORICO_STATUS imutável com `anulado` | **APPROVED** |
| ADR-006 | Feature flag em PARAMETROS_SISTEMA | **APPROVED** |
| ADR-007 | Mecanismo duplo de autenticação | **APPROVED** |
| ADR-008 | Auditoria em duas camadas | **APPROVED** |
| ADR-009 | Manter stack NestJS + OracleDB thin mode | **APPROVED** |
| ADR-010 | PARAMETROS_SISTEMA configuração sem deploy | **APPROVED** |
| ADR-011 | Proponentes apenas internos no MVP | **APPROVED** |
| ADR-012 | Ciclo de vida MVP: 3 estados | **APPROVED** |

---

## ADR-001 — Schema Additive: Construção Paralela do Modelo TO-BE

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** E1, E2, E3, E4, E5

### Decisão

Criar o novo schema Oracle em paralelo ao schema existente. A aplicação migra gradualmente de um schema para o outro, controlada por feature flag em PARAMETROS_SISTEMA. As tabelas legadas só são removidas após 30 dias de produção estável no novo schema, seguidos de 90 dias de quarentena com rename.

### Contexto

O sistema está em produção com dados reais. O schema atual (2 tabelas planas) é estruturalmente diferente do schema TO-BE (13 tabelas com relacionamentos). A migração precisa acontecer sem downtime e com rollback disponível em qualquer etapa.

### Alternativas rejeitadas

- **Big bang migration**: risco de downtime e perda de dados; rollback complexo. REJEITADO.
- **Shadow writes**: complexidade operacional alta; risco de inconsistência entre schemas. REJEITADO.

### Regras de implementação

1. Nunca remover ou renomear colunas das tabelas legadas até a Fase 5
2. Colunas adicionadas a tabelas existentes são sempre nullable (não quebram INSERTs legados)
3. ETL deve ser idempotente — re-execução não duplica dados
4. O feature flag `FORMULARIO_DESTINO_TABELA` controla o destino das submissões
5. O código do caminho legado deve ter comentário: `// TODO: remover após Fase 5 — [data-limite]`

### Rollback por fase

| Fase | Mecanismo | Tempo | Perda de dados |
|---|---|---|---|
| Fase 1 | DROP tabelas novas | < 5 min | Nenhuma |
| Fase 2 | Flag → LEGADO | < 1 min | Submissões no período (reconciliar) |
| Fase 5 (rename) | Rename de volta | < 5 min | Nenhuma |
| Fase 5 (DROP) | **Sem rollback** — dump obrigatório | N/A | N/A |

---

## ADR-002 — DOMINIO_VALORES: Tabela Única para Enums (exceto status de workflow)

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1

### Decisão

Criar uma tabela `DOMINIO_VALORES` única para gerenciar todos os campos categóricos do sistema, com exceção dos status do ciclo de vida das iniciativas. Status de workflow são gerenciados pela tabela `STATUS_WORKFLOW` (ADR-002-B).

### Domínios gerenciados por DOMINIO_VALORES (MVP)

| dominio | Valores iniciais |
|---|---|
| `ESTAGIO_MATURIDADE` | IDEACAO, PILOTO, ESCALA |
| `DIMENSAO_INOVACAO` | TECNOLOGICA, OPERACIONAL, GERENCIAL, SOCIAL_AMBIENTAL, MULTIDIMENSIONAL |
| `GRAU_IMPACTO` | INCREMENTAL, RADICAL |
| `TIPO_SUPORTE` | MODELAGEM_TR_ACT, CONEXAO_ICT, CONEXAO_MERCADO, CONEXAO_INTERSETORIAL, MONITORAMENTO, APOIO_DIAGNOSTICO, OUTRO |
| `QUALIFICACAO` | PROJETO_COMPLEXO, ACAO_SIMPLIFICADA |
| `TIPO_ANOTACAO` | COMENTARIO_PROPONENTE, NOTA_TECNICA, COMUNICADO |
| `VISIBILIDADE_ANOTACAO` | PUBLICA, INTERNA |

### Por que NÃO usar para status de workflow

Status de workflow têm semântica de máquina de estados: têm transições, regras de quem pode executar cada transição e lógica de validação de pré-condição. Misturá-los com "tipos de suporte" e "estágios de maturidade" reduz a clareza do modelo e cria ambiguidade sobre onde aplicar validações.

### Regras de implementação

1. Integridade de domínio validada na camada de aplicação (serviço) ao criar/atualizar
2. FK de `INICIATIVAS` aponta para `DOMINIO_VALORES.id`; o domínio correto é validado pelo serviço
3. Views por domínio: `VW_ESTAGIOS_MATURIDADE`, `VW_DIMENSOES_INOVACAO`, etc.
4. Cache de TTL 5 minutos no backend para listas de domínio
5. Frontend carrega listas de domínio via `GET /api/reference/:domain` no load da página

### Schema

```sql
CREATE TABLE DOMINIO_VALORES (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio     VARCHAR2(50)   NOT NULL,
  codigo      VARCHAR2(50)   NOT NULL,
  rotulo_pt   VARCHAR2(200)  NOT NULL,
  descricao   CLOB,
  ordem       NUMBER(5)      DEFAULT 0 NOT NULL,
  ativo       NUMBER(1)      DEFAULT 1 NOT NULL,
  metadados   VARCHAR2(4000),
  criado_em   TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  atualizado_em TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT UQ_DV_DOM_COD UNIQUE (dominio, codigo),
  CONSTRAINT CK_DV_ATIVO   CHECK  (ativo IN (0,1))
);
CREATE INDEX IDX_DV_DOMINIO ON DOMINIO_VALORES (dominio, ativo);
```

---

## ADR-002-B — STATUS_WORKFLOW: Tabela Própria para Estados do Ciclo de Vida

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1, E2  
**Substitui parcialmente:** ADR-002 original (que incluía STATUS_INICIATIVA em DOMINIO_VALORES)

### Decisão

Os status do ciclo de vida das iniciativas são gerenciados em tabela própria `STATUS_WORKFLOW`, separada de `DOMINIO_VALORES`. Esta tabela é a fonte de verdade dos estados possíveis para o campo `status_id` de `INICIATIVAS`.

### MVP: 3 estados ativos

| codigo | rotulo_pt | terminal |
|---|---|---|
| `SUBMETIDA` | Submetida | 0 |
| `EM_ANALISE` | Em Análise | 0 |
| `APROVADA` | Aprovada | 1 |
| `REPROVADA` | Reprovada | 1 |

Estados `RASCUNHO`, `DEVOLVIDA`, `SUSPENSA`, `CONCLUIDA`, `CANCELADA` ficam no backlog futuro. A tabela os suporta, mas não são populados no MVP.

### Regras de implementação

1. O campo `terminal` (NUMBER(1)) indica se o estado não admite transições de saída
2. Toda transição de status passa obrigatoriamente pelo `WorkflowService` — nunca UPDATE direto em `INICIATIVAS.status_id`
3. A tabela `TRANSICOES_STATUS` (ADR-004) referencia `STATUS_WORKFLOW` por código (VARCHAR2), não por ID — mais legível e estável

### Schema

```sql
CREATE TABLE STATUS_WORKFLOW (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR2(50)   NOT NULL,
  rotulo_pt   VARCHAR2(200)  NOT NULL,
  descricao   CLOB,
  terminal    NUMBER(1)      DEFAULT 0 NOT NULL,
  ordem       NUMBER(5)      DEFAULT 0 NOT NULL,
  ativo       NUMBER(1)      DEFAULT 1 NOT NULL,
  criado_em   TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  atualizado_em TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT UQ_SW_CODIGO  UNIQUE (codigo),
  CONSTRAINT CK_SW_ATIVO   CHECK  (ativo IN (0,1)),
  CONSTRAINT CK_SW_TERM    CHECK  (terminal IN (0,1))
);
```

---

## ADR-003 — Separação Identidade / Autenticação / Autorização

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E3

### Decisão

A entidade `USUARIOS` usa `id` (BIGINT gerado pelo banco) como chave primária imutável em todos os relacionamentos. O campo `login` é apenas um atributo de autenticação e pode ser atualizado sem impacto em cascata. O campo `origem_identidade` registra o mecanismo de autenticação atual da conta.

### Regras de implementação

1. O JWT usa `sub: user_id` (número inteiro), não o login
2. O campo `login` nunca aparece como FK em nenhuma outra tabela
3. Perfis e permissões ficam em `USUARIOS_PERFIS` (N:M) — separados da identidade
4. Senhas armazenadas exclusivamente como hash bcrypt (nunca plain text)
5. `origem_identidade` aceita: `LOCAL` | `LDAP` | `AD` | `SSO` — registra de onde veio a identidade, não o mecanismo de senha
6. Migração futura para AD: apenas `UPDATE USUARIOS SET login = upn, origem_identidade = 'AD'` — sem impacto em outras tabelas

### JWT payload (formato obrigatório após E3)

```json
{
  "sub": 1,
  "login": "gsalviete",
  "perfis": ["ADMINISTRADOR"],
  "area_id": 3,
  "iat": 1750000000,
  "exp": 1750003600
}
```

### Perfis MVP

| codigo | Pode ver | Pode transitar status | Pode administrar |
|---|---|---|---|
| `ANALISTA_ASSESSORIA` | Todas as iniciativas | SUBMETIDA→EM_ANALISE, EM_ANALISE→APROVADA, EM_ANALISE→REPROVADA | Não |
| `GESTOR_AREA` | Iniciativas da sua área | Não | Não |
| `ADMINISTRADOR` | Tudo | Tudo | Sim |

---

## ADR-004 — Workflow como Dado (TRANSICOES_STATUS Configurável)

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** E2, E3

### Decisão

As regras de transição de status são armazenadas na tabela `TRANSICOES_STATUS`. O `WorkflowService` consulta essa tabela para validar cada transição, sem lógica hardcoded. Ajustes no processo são feitos via INSERT/UPDATE nessa tabela, sem deploy.

### Transições MVP (dados iniciais)

| status_origem | status_destino | perfil_requerido | justificativa_obrig | notificar |
|---|---|---|---|---|
| `SUBMETIDA` | `EM_ANALISE` | `ANALISTA_ASSESSORIA` | 0 | 0 |
| `EM_ANALISE` | `APROVADA` | `ANALISTA_ASSESSORIA` | 0 | 1 |
| `EM_ANALISE` | `REPROVADA` | `ANALISTA_ASSESSORIA` | 1 | 1 |

### Regras de implementação

1. Nenhum código fora do `WorkflowService` faz UPDATE em `INICIATIVAS.status_id`
2. `WorkflowService.transicionar()` é o único ponto de entrada para transições
3. Cache de TRANSICOES_STATUS no backend: TTL 2 minutos
4. Pré-condições complexas (ex: "só pode aprovar se tiver analista responsável") ficam como validações explícitas no `WorkflowService`, documentadas com comentário referenciando a regra
5. Toda transição bem-sucedida gera INSERT imutável em `HISTORICO_STATUS`

### Schema

```sql
CREATE TABLE TRANSICOES_STATUS (
  id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status_origem        VARCHAR2(50)  NOT NULL,
  status_destino       VARCHAR2(50)  NOT NULL,
  perfil_requerido     VARCHAR2(50)  NOT NULL,
  justificativa_obrig  NUMBER(1)     DEFAULT 0 NOT NULL,
  notificar_proponente NUMBER(1)     DEFAULT 0 NOT NULL,
  descricao            VARCHAR2(200),
  ativo                NUMBER(1)     DEFAULT 1 NOT NULL,
  CONSTRAINT UQ_TS_ORIG_DEST_PERFIL UNIQUE (status_origem, status_destino, perfil_requerido),
  CONSTRAINT CK_TS_JUST  CHECK (justificativa_obrig IN (0,1)),
  CONSTRAINT CK_TS_NOTIF CHECK (notificar_proponente IN (0,1)),
  CONSTRAINT CK_TS_ATIVO CHECK (ativo IN (0,1))
);
CREATE INDEX IDX_TS_ORIGEM ON TRANSICOES_STATUS (status_origem, ativo);
```

---

## ADR-005 — HISTORICO_STATUS Imutável com Campo `anulado`

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E2

### Decisão

A tabela `HISTORICO_STATUS` é imutável por trigger de banco: nenhum UPDATE (exceto no campo `anulado` e seus campos associados) e nenhum DELETE são permitidos. Erros de inserção são corrigidos via marcação de `anulado = 1` com `anulado_por_id`, `anulado_em` e `motivo_anulacao` obrigatórios.

### Regras de implementação

1. Trigger `TRG_HS_NO_UPD_DEL` bloqueia DELETE e UPDATE de qualquer campo exceto `anulado`, `anulado_por_id`, `anulado_em`, `motivo_anulacao`
2. Apenas código executado por usuário com perfil `ADMINISTRADOR` pode setar `anulado = 1`
3. Toda anulação gera INSERT adicional em `HISTORICO_STATUS` com `tipo_evento = 'CORRECAO'`
4. Toda consulta da aplicação usa a view `VW_HISTORICO_ATIVO` (filtra `anulado = 0`)
5. A interface admin tem tela separada mostrando o histórico completo (incluindo anulados)
6. Toda anulação gera registro em `AUDITORIA_LOGS`

### Schema

```sql
CREATE TABLE HISTORICO_STATUS (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iniciativa_id    NUMBER        NOT NULL,
  status_anterior  VARCHAR2(50),
  status_novo      VARCHAR2(50)  NOT NULL,
  tipo_evento      VARCHAR2(30)  NOT NULL,
  usuario_id       NUMBER        NOT NULL,
  data_hora        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  justificativa    CLOB,
  anulado          NUMBER(1)     DEFAULT 0 NOT NULL,
  anulado_por_id   NUMBER,
  anulado_em       TIMESTAMP,
  motivo_anulacao  CLOB,
  CONSTRAINT FK_HS_INICIATIVA FOREIGN KEY (iniciativa_id) REFERENCES INICIATIVAS(id),
  CONSTRAINT FK_HS_USUARIO    FOREIGN KEY (usuario_id)    REFERENCES USUARIOS(id),
  CONSTRAINT CK_HS_ANULADO    CHECK (anulado IN (0,1)),
  CONSTRAINT CK_HS_TIPO       CHECK (tipo_evento IN (
    'SUBMISSAO','TRIAGEM','ANALISE','APROVACAO','REPROVACAO','CORRECAO'
  )),
  CONSTRAINT CK_HS_ANULADO_COMPLETO CHECK (
    anulado = 0 OR (
      anulado_por_id IS NOT NULL AND
      anulado_em     IS NOT NULL AND
      motivo_anulacao IS NOT NULL
    )
  )
);
CREATE INDEX IDX_HS_INICIATIVA ON HISTORICO_STATUS (iniciativa_id, data_hora);
CREATE INDEX IDX_HS_USUARIO    ON HISTORICO_STATUS (usuario_id);

CREATE OR REPLACE VIEW VW_HISTORICO_ATIVO AS
  SELECT * FROM HISTORICO_STATUS WHERE anulado = 0 ORDER BY data_hora ASC;
```

---

## ADR-006 — Feature Flag em PARAMETROS_SISTEMA

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1, E2

### Decisão

A migração do destino de escrita do formulário (tabela legada → tabela nova) é controlada pelo parâmetro `FORMULARIO_DESTINO_TABELA` em `PARAMETROS_SISTEMA`. Cache TTL 1 minuto no backend. Rollback sem deploy.

### Regras de implementação

1. Valores aceitos: `LEGADO` (padrão) ou `NOVO`
2. Valor inválido → fallback para `LEGADO` + log de erro
3. `IniciativasService.criar()` consulta o parâmetro via `ParametrosService.get()`
4. Comentário obrigatório no código: `// TODO: remover após Fase 5`
5. Parâmetro removido da tabela e do código na Fase 5 (junto com o código legado)

---

## ADR-007 — Mecanismo Duplo de Autenticação Durante a Transição

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E3  
**Prazo máximo:** 1 semana após deploy de E3-001

### Decisão

Durante a transição para autenticação via `USUARIOS`, o sistema mantém dois caminhos ativos: (1) USUARIOS + bcrypt; (2) fallback para env vars com log de warning. O fallback é removido após 1 semana sem incidentes (story E3-005).

### Regras de implementação

1. O fallback para env vars é explicitamente temporário — comentário `// TEMPORÁRIO: remover em E3-005`
2. Ambos os caminhos geram JWT com o mesmo payload (formato do ADR-003)
3. O fallback gera log `[WARN] Autenticação via credencial legada — migrar para E3-005`
4. E3-005 só pode ser deployada após confirmação documentada de login bem-sucedido via USUARIOS
5. `ADMIN_USERNAME` e `ADMIN_PASSWORD` são deletadas do `.env` em E3-005

---

## ADR-008 — Auditoria em Duas Camadas

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** E1, E2

### Decisão

Duas tabelas com propósitos distintos e separados:

- **HISTORICO_STATUS**: auditoria de negócio — eventos semânticos do ciclo de vida. Permanente. Consultado por gestores e auditorias regulatórias.
- **AUDITORIA_LOGS**: auditoria técnica — INSERT/UPDATE/DELETE em tabelas críticas. Retenção 7 anos. Consultado por DBAs e investigações de segurança.

### Tabelas auditadas pelo AUDITORIA_LOGS no MVP

INICIATIVAS, USUARIOS, USUARIOS_PERFIS, HISTORICO_STATUS, TRANSICOES_STATUS, PARAMETROS_SISTEMA.

### Regras de implementação

1. INOVACAO_LOGS (legado) → dados migrados para AUDITORIA_LOGS no ETL como registros históricos
2. `AuditService.registrar()` é chamado de forma assíncrona e não-bloqueante
3. HISTORICO_STATUS: retenção permanente | AUDITORIA_LOGS: retenção 7 anos
4. `AuthService.registrarLog()` legado é substituído por chamadas ao `AuditModule`

---

## ADR-009 — Manter Stack NestJS + OracleDB Thin Mode

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** Todos

### Decisão

A stack tecnológica atual é mantida integralmente: NestJS v10, OracleDB thin mode, HTML/CSS/JS puro no frontend. Modernizações de stack (TypeORM, React, etc.) são adiadas para após a estabilização funcional.

### Exceções documentadas

- Connection pool via `oracledb.createPool()` na Fase 5 (API do mesmo driver, não troca de stack)
- TypeScript strict mode habilitado na Fase 0 (melhoria dentro da stack)

### Melhorias de organização aprovadas (sem troca de stack)

- Queries SQL centralizadas em arquivos `*.repository.ts` por entidade
- Frontend: funções JS componentizadas sem framework

---

## ADR-010 — PARAMETROS_SISTEMA como Configuração sem Deploy

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1, E4

### Decisão

Parâmetros de negócio configuráveis são armazenados em `PARAMETROS_SISTEMA` com cache TTL 5 minutos na aplicação. Segredos de infraestrutura permanecem em variáveis de ambiente.

### Parâmetros MVP iniciais

| chave | valor_default | tipo | editavel |
|---|---|---|---|
| `FORMULARIO_DESTINO_TABELA` | `LEGADO` | TEXTO | 0 (não editável via UI) |
| `PRAZO_ANALISE_DIAS` | `30` | NUMERO | 1 |
| `EMAIL_ASSESSORIA` | `` | TEXTO | 1 |
| `VERSAO_FORMULARIO_ATUAL` | `VIA2_R0` | TEXTO | 0 |

### Schema

```sql
CREATE TABLE PARAMETROS_SISTEMA (
  id                NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave             VARCHAR2(100)  NOT NULL,
  valor             VARCHAR2(1000) NOT NULL,
  tipo_valor        VARCHAR2(15)   NOT NULL,
  descricao         VARCHAR2(500),
  editavel          NUMBER(1)      DEFAULT 1 NOT NULL,
  atualizado_em     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  atualizado_por_id NUMBER,
  CONSTRAINT UQ_PS_CHAVE   UNIQUE (chave),
  CONSTRAINT CK_PS_TIPO    CHECK (tipo_valor IN ('TEXTO','NUMERO','BOOLEANO','DATA','JSON')),
  CONSTRAINT CK_PS_EDIT    CHECK (editavel IN (0,1))
);
```

---

## ADR-011 — Proponentes Apenas Internos no MVP

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1, E2  
**Decisão originada em:** Resposta DQ-009/010

### Decisão

No MVP, todos os proponentes são colaboradores internos da CEDAE. A entidade `PROPONENTES` tem `tipo = 'INTERNO'` por padrão. O campo `tipo EXTERNO` existe no schema mas não é utilizado no MVP. Nenhum módulo de "inserção pela Assessoria" para parceiros externos é construído no MVP.

### Regras de implementação

1. `PROPONENTES.tipo` = `INTERNO` para todos os registros criados no MVP
2. Campo `canal_id` em `INICIATIVAS` = ID do canal `VIA_2` em todas as submissões — preenchido automaticamente
3. `CANAIS_CAPTACAO` criada com um único registro ativo: `VIA_2`
4. A estrutura para `EXTERNO` existe no schema — apenas não é populada

---

## ADR-012 — Ciclo de Vida MVP: 4 Estados, 3 Transições

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E2  
**Decisão originada em:** Resposta DQ-005/006

### Decisão

O MVP implementa o ciclo de vida mínimo confirmado com a Assessoria:

```
SUBMETIDA ──► EM_ANALISE ──► APROVADA
                        └──► REPROVADA
```

Estados `RASCUNHO`, `DEVOLVIDA`, `SUSPENSA`, `CONCLUIDA`, `CANCELADA` são válidos no schema (STATUS_WORKFLOW os conhece) mas não têm transições ativas no MVP. São adicionados via INSERT em TRANSICOES_STATUS quando o processo da Assessoria amadurecer.

### Nomenclatura obrigatória

| Antigo (documentos anteriores) | Correto (este documento em diante) |
|---|---|
| HOMOLOGADA | **APROVADA** |
| DESQUALIFICADA | **REPROVADA** |

### Impacto no ETL (Fase 1)

Registros históricos da planilha que estavam como `[Homologada]` são migrados com `status = 'APROVADA'`. Registros `[Desqualificada]` → `status = 'REPROVADA'`. Registros `[Em Análise]` → `status = 'EM_ANALISE'`.