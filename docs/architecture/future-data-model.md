# Modelo de Dados Futuro — CEDAE Inovação
**Versão:** 0.1 — Proposta para Validação  
**Data:** 2026-06-24  
**Banco de dados:** Oracle (versão mínima: 19c)  
**Status:** Rascunho — aguarda confirmação do schema atual antes de plano de migração

---

## 1. Princípios do Modelo de Dados

### 1.1 Convenções de nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Tabelas | Maiúsculas, plural, underscores | `INICIATIVAS`, `USUARIOS` |
| Colunas | Minúsculas, underscores | `data_submissao`, `titulo` |
| Chaves primárias | `id` (BIGINT) em todas as tabelas | `id` |
| Chaves estrangeiras | `{entidade_referenciada}_id` | `proponente_id`, `usuario_id` |
| Índices | `IDX_{TABELA}_{COLUNA(S)}` | `IDX_INICIATIVAS_STATUS` |
| Unique constraints | `UQ_{TABELA}_{COLUNA(S)}` | `UQ_INICIATIVAS_CODIGO_PUBLICO` |
| Check constraints | `CK_{TABELA}_{REGRA}` | `CK_INICIATIVAS_INVESTIMENTO_POS` |
| Foreign keys | `FK_{TABELA_ORIGEM}_{TABELA_DESTINO}` | `FK_INICIATIVAS_PROPONENTES` |
| Sequences | `SEQ_{TABELA}` | `SEQ_INICIATIVAS` |
| Triggers | `TRG_{TABELA}_{EVENTO}` | `TRG_INICIATIVAS_BEF_INS` |

### 1.2 Campos de auditoria presentes em todas as tabelas mutáveis

Toda tabela que não é puramente de log/auditoria deve conter:
- `criado_em TIMESTAMP NOT NULL` — preenchido por trigger
- `criado_por_id BIGINT` — FK → USUARIOS; nullable para registros do sistema
- `atualizado_em TIMESTAMP NOT NULL` — preenchido por trigger
- `atualizado_por_id BIGINT` — FK → USUARIOS; nullable para operações do sistema

### 1.3 Soft delete como padrão

Nenhuma tabela de domínio deve ter registros fisicamente removidos. O padrão é:
- `ativo BOOLEAN DEFAULT TRUE` nas tabelas de referência
- `cancelado_em TIMESTAMP` nas tabelas transacionais (onde aplicável)
- Deleção física apenas em `AUDITORIA_LOGS` (por política de retenção configurável)

---

## 2. Diagrama Entidade-Relacionamento (Descritivo)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NÚCLEO DO DOMÍNIO                               │
│                                                                         │
│  CANAIS_CAPTACAO ──────────────────────────────────────────────────┐   │
│                                                                     │   │
│  UNIDADES_ORGANIZACIONAIS ──────────────────────────────────────┐  │   │
│      (hierarquia self-referenciada)                              │  │   │
│                                                                  │  │   │
│  PROPONENTES ──────────────────────────────────────────────┐    │  │   │
│      │                                                      │    │  │   │
│      │ (1:N)                                                │    │  │   │
│      └──────────────────────────► INICIATIVAS ◄────────────┘    │  │   │
│                                        │                         │  │   │
│                               (1:N)    │    (N:M)               │  │   │
│                    ┌──────────────────►│◄──────────────────┐    │  │   │
│                    │                  │                     │    │  │   │
│          HISTORICO_STATUS    INICIATIVAS_SUPORTES   INICIATIVAS_METAS  │
│                              (DOMINIO_VALORES)    (METAS_ESTRATEGICAS) │
│                                       │                                 │
│                              (1:N)    │    (N:M via RELACIONAMENTOS)   │
│                    ┌──────────────────┤                                 │
│                    │                  │                                 │
│               ANOTACOES       INVESTIMENTOS                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       IDENTIDADE E ACESSO                               │
│                                                                         │
│  USUARIOS ◄────────────────────── USUARIOS_PERFIS ──► PERFIS_ACESSO   │
│      │                                                                  │
│      └──────────────────────► AUDITORIA_LOGS                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      TABELAS DE REFERÊNCIA                              │
│                                                                         │
│  DOMINIO_VALORES   METAS_ESTRATEGICAS   PARAMETROS_SISTEMA             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Definição das Tabelas

### 3.1 DOMINIO_VALORES — Tabela de Referência Universal

```
DOMINIO_VALORES
├── id                  BIGINT          NOT NULL    PK
├── dominio             VARCHAR2(50)    NOT NULL    [ESTAGIO_MATURIDADE | DIMENSAO_INOVACAO | 
│                                                    GRAU_IMPACTO | STATUS_INICIATIVA |
│                                                    QUALIFICACAO | TIPO_SUPORTE | 
│                                                    FONTE_INVESTIMENTO | TIPO_INVESTIMENTO |
│                                                    STATUS_INVESTIMENTO | TIPO_RELACAO |
│                                                    TIPO_ANOTACAO | VISIBILIDADE_ANOTACAO |
│                                                    TIPO_UNIDADE | TIPO_EVENTO_STATUS]
├── codigo              VARCHAR2(50)    NOT NULL
├── rotulo_pt           VARCHAR2(200)   NOT NULL
├── descricao           CLOB
├── ordem               NUMBER(5)       NOT NULL    DEFAULT 0
├── ativo               NUMBER(1)       NOT NULL    DEFAULT 1
├── metadados           VARCHAR2(4000)              -- JSON para propriedades extras
├── criado_em           TIMESTAMP       NOT NULL
└── atualizado_em       TIMESTAMP       NOT NULL

Constraints:
  UQ_DOMINIO_VALORES_DOM_COD:  UNIQUE (dominio, codigo)
  CK_DOMINIO_VALORES_ATIVO:    ativo IN (0, 1)

Índices:
  IDX_DOMINIO_VALORES_DOMINIO: (dominio, ativo)
```

**Domínios iniciais e seus valores:**

| dominio | codigo | rotulo_pt |
|---|---|---|
| ESTAGIO_MATURIDADE | IDEACAO | Ideação |
| ESTAGIO_MATURIDADE | PILOTO | Teste / Piloto (MVP) |
| ESTAGIO_MATURIDADE | ESCALA | Escala / Operação Ativa |
| DIMENSAO_INOVACAO | TECNOLOGICA | Inovação Tecnológica |
| DIMENSAO_INOVACAO | OPERACIONAL | Inovação Operacional |
| DIMENSAO_INOVACAO | GERENCIAL | Inovação Gerencial / Administrativa |
| DIMENSAO_INOVACAO | SOCIAL_AMBIENTAL | Inovação Social e Ambiental |
| DIMENSAO_INOVACAO | MULTIDIMENSIONAL | Multidimensional / Outro |
| GRAU_IMPACTO | INCREMENTAL | Incremental |
| GRAU_IMPACTO | RADICAL | Radical / Disruptivo |
| STATUS_INICIATIVA | RASCUNHO | Rascunho |
| STATUS_INICIATIVA | SUBMETIDA | Submetida |
| STATUS_INICIATIVA | DEVOLVIDA | Devolvida para Complementação |
| STATUS_INICIATIVA | EM_ANALISE | Em Análise Técnica |
| STATUS_INICIATIVA | HOMOLOGADA | Homologada |
| STATUS_INICIATIVA | SUSPENSA | Suspensa |
| STATUS_INICIATIVA | DESQUALIFICADA | Desqualificada |
| STATUS_INICIATIVA | CONCLUIDA | Concluída |
| STATUS_INICIATIVA | CANCELADA | Cancelada |
| QUALIFICACAO | PROJETO_COMPLEXO | Projeto — Metodologia Complexa |
| QUALIFICACAO | ACAO_SIMPLIFICADA | Ação — Rito Simplificado |
| TIPO_SUPORTE | MODELAGEM_TR_ACT | Modelagem de TR/ACT |
| TIPO_SUPORTE | CONEXAO_ICT | Conexão com Academia / ICTs |
| TIPO_SUPORTE | CONEXAO_MERCADO | Conexão com Mercado / Startups |
| TIPO_SUPORTE | CONEXAO_INTERSETORIAL | Sinergia Interna |
| TIPO_SUPORTE | MONITORAMENTO | Apenas Monitoramento Corporativo |
| TIPO_SUPORTE | APOIO_DIAGNOSTICO | Apoio Diagnóstico / Mentoria |
| TIPO_SUPORTE | OUTRO | Outro |

---

### 3.2 UNIDADES_ORGANIZACIONAIS

```
UNIDADES_ORGANIZACIONAIS
├── id                  BIGINT          NOT NULL    PK
├── sigla               VARCHAR2(20)    NOT NULL
├── nome                VARCHAR2(300)   NOT NULL
├── tipo                VARCHAR2(30)    NOT NULL    [DIRETORIA | SUPERINTENDENCIA | 
│                                                    GERENCIA | UNIDADE_OPERACIONAL | EXTERNO]
├── pai_id              BIGINT                      FK → UNIDADES_ORGANIZACIONAIS(id)
├── ativa               NUMBER(1)       NOT NULL    DEFAULT 1
├── codigo_externo      VARCHAR2(100)               -- Código no ERP/AD
├── criado_em           TIMESTAMP       NOT NULL
├── criado_por_id       BIGINT                      FK → USUARIOS(id)
├── atualizado_em       TIMESTAMP       NOT NULL
└── atualizado_por_id   BIGINT                      FK → USUARIOS(id)

Constraints:
  UQ_UNIDADES_SIGLA:      UNIQUE (sigla) WHERE ativa = 1
  CK_UNIDADES_TIPO:       tipo IN ('DIRETORIA','SUPERINTENDENCIA','GERENCIA',
                                   'UNIDADE_OPERACIONAL','EXTERNO')
  CK_UNIDADES_ATIVA:      ativa IN (0, 1)
  FK_UNIDADES_PAI:        pai_id → UNIDADES_ORGANIZACIONAIS(id)

Índices:
  IDX_UNIDADES_PAI:       (pai_id)
  IDX_UNIDADES_TIPO:      (tipo, ativa)
```

---

### 3.3 USUARIOS

```
USUARIOS
├── id                  BIGINT          NOT NULL    PK
├── login               VARCHAR2(100)   NOT NULL
├── nome_completo       VARCHAR2(300)   NOT NULL
├── email               VARCHAR2(200)   NOT NULL
├── area_id             BIGINT                      FK → UNIDADES_ORGANIZACIONAIS(id)
├── ativo               NUMBER(1)       NOT NULL    DEFAULT 1
├── ultimo_acesso       TIMESTAMP
├── origem_identidade   VARCHAR2(20)    NOT NULL    DEFAULT 'LOCAL'
│                                                   [LOCAL | LDAP | AD | SSO]
├── criado_em           TIMESTAMP       NOT NULL
├── criado_por_id       BIGINT                      FK → USUARIOS(id)
├── atualizado_em       TIMESTAMP       NOT NULL
└── atualizado_por_id   BIGINT                      FK → USUARIOS(id)

Constraints:
  UQ_USUARIOS_LOGIN:      UNIQUE (login)
  UQ_USUARIOS_EMAIL:      UNIQUE (email)
  CK_USUARIOS_ATIVO:      ativo IN (0, 1)
  CK_USUARIOS_ORIGEM:     origem_identidade IN ('LOCAL','LDAP','AD','SSO')

Índices:
  IDX_USUARIOS_LOGIN:     (login)
  IDX_USUARIOS_EMAIL:     (email)
  IDX_USUARIOS_AREA:      (area_id)
  IDX_USUARIOS_ATIVO:     (ativo)
```

---

### 3.4 PERFIS_ACESSO

```
PERFIS_ACESSO
├── id                  BIGINT          NOT NULL    PK
├── codigo              VARCHAR2(50)    NOT NULL
├── nome                VARCHAR2(200)   NOT NULL
├── descricao           CLOB
├── ativo               NUMBER(1)       NOT NULL    DEFAULT 1
├── criado_em           TIMESTAMP       NOT NULL
└── atualizado_em       TIMESTAMP       NOT NULL

Constraints:
  UQ_PERFIS_CODIGO:       UNIQUE (codigo)
  CK_PERFIS_ATIVO:        ativo IN (0, 1)

Dados iniciais:
  (PROPONENTE_EXTERNO, Proponente Externo)
  (GESTOR_AREA, Gestor de Área)
  (ANALISTA_ASSESSORIA, Analista da Assessoria)
  (SUPERVISOR_ASSESSORIA, Supervisor da Assessoria)
  (ADMINISTRADOR, Administrador do Sistema)
```

---

### 3.5 USUARIOS_PERFIS

```
USUARIOS_PERFIS
├── usuario_id          BIGINT          NOT NULL    FK → USUARIOS(id)
├── perfil_id           BIGINT          NOT NULL    FK → PERFIS_ACESSO(id)
├── concedido_em        TIMESTAMP       NOT NULL
├── concedido_por_id    BIGINT          NOT NULL    FK → USUARIOS(id)
├── valido_ate          TIMESTAMP                   -- NULL = sem expiração
└── revogado_em         TIMESTAMP                   -- NULL = ativo

Constraints:
  PK_USUARIOS_PERFIS:     PRIMARY KEY (usuario_id, perfil_id)
  FK_UP_USUARIO:          usuario_id → USUARIOS(id)
  FK_UP_PERFIL:           perfil_id → PERFIS_ACESSO(id)
  FK_UP_CONCEDIDO_POR:    concedido_por_id → USUARIOS(id)

Índices:
  IDX_UP_USUARIO:         (usuario_id)
  IDX_UP_PERFIL:          (perfil_id)
  IDX_UP_VIGENCIA:        (usuario_id, valido_ate, revogado_em)
```

---

### 3.6 CANAIS_CAPTACAO

```
CANAIS_CAPTACAO
├── id                  BIGINT          NOT NULL    PK
├── codigo              VARCHAR2(30)    NOT NULL
├── nome                VARCHAR2(200)   NOT NULL
├── descricao           CLOB
├── requer_formulario   NUMBER(1)       NOT NULL    DEFAULT 0
├── criterio_ativacao   CLOB
├── ativo               NUMBER(1)       NOT NULL    DEFAULT 1
├── criado_em           TIMESTAMP       NOT NULL
└── atualizado_em       TIMESTAMP       NOT NULL

Constraints:
  UQ_CANAIS_CODIGO:       UNIQUE (codigo)
  CK_CANAIS_FORM:         requer_formulario IN (0, 1)
  CK_CANAIS_ATIVO:        ativo IN (0, 1)

Dados iniciais:
  (VIA_1, 'Via 1 — Formulário Interno (Critério Financeiro)', requer_formulario=1)
  (VIA_2, 'Via 2 — Formulário Interno (Captação Ativa)', requer_formulario=1)
  (VIA_3, 'Via 3 — Registro Simplificado Interno', requer_formulario=1)
  (MAPEAMENTO_EXTERNO, 'Mapeamento Externo', requer_formulario=0)
```

---

### 3.7 PROPONENTES

```
PROPONENTES
├── id                  BIGINT          NOT NULL    PK
├── tipo                VARCHAR2(10)    NOT NULL    [INTERNO | EXTERNO]
├── nome_completo       VARCHAR2(300)   NOT NULL
├── email               VARCHAR2(200)
├── telefone            VARCHAR2(50)
├── matricula_corp      VARCHAR2(50)                -- Apenas internos
├── organizacao_ext     VARCHAR2(300)               -- Apenas externos
├── area_id             BIGINT                      FK → UNIDADES_ORGANIZACIONAIS(id)
├── usuario_id          BIGINT                      FK → USUARIOS(id); nullable
├── ativo               NUMBER(1)       NOT NULL    DEFAULT 1
├── criado_em           TIMESTAMP       NOT NULL
├── criado_por_id       BIGINT                      FK → USUARIOS(id)
├── atualizado_em       TIMESTAMP       NOT NULL
└── atualizado_por_id   BIGINT                      FK → USUARIOS(id)

Constraints:
  CK_PROPONENTES_TIPO:    tipo IN ('INTERNO', 'EXTERNO')
  CK_PROPONENTES_ATIVO:   ativo IN (0, 1)
  CK_PROP_INT_AREA:       -- Proponentes internos devem ter area_id
                          (tipo = 'EXTERNO') OR (tipo = 'INTERNO' AND area_id IS NOT NULL)
  CK_PROP_EXT_ORG:        -- Proponentes externos devem ter organização ou email
                          (tipo = 'INTERNO') OR 
                          (tipo = 'EXTERNO' AND 
                           (organizacao_ext IS NOT NULL OR email IS NOT NULL))
  FK_PROP_AREA:           area_id → UNIDADES_ORGANIZACIONAIS(id)
  FK_PROP_USUARIO:        usuario_id → USUARIOS(id)

Índices:
  IDX_PROP_EMAIL:         (email)
  IDX_PROP_MATRICULA:     (matricula_corp) WHERE matricula_corp IS NOT NULL
  IDX_PROP_USUARIO:       (usuario_id) WHERE usuario_id IS NOT NULL
  IDX_PROP_AREA:          (area_id)
```

---

### 3.8 INICIATIVAS (Tabela Central)

```
INICIATIVAS
├── id                      BIGINT          NOT NULL    PK
├── codigo_publico           VARCHAR2(20)    NOT NULL    -- INOV-AAAA-NNN; gerado por trigger
│
│   -- CONTEXTO DE CAPTAÇÃO (imutável após status SUBMETIDA)
├── titulo                  VARCHAR2(300)   NOT NULL
├── canal_id                BIGINT          NOT NULL    FK → CANAIS_CAPTACAO(id)
├── proponente_id           BIGINT          NOT NULL    FK → PROPONENTES(id)
├── area_proponente_id      BIGINT          NOT NULL    FK → UNIDADES_ORGANIZACIONAIS(id)
├── local_aplicacao         VARCHAR2(500)   NOT NULL
├── descricao_gargalo       CLOB            NOT NULL
├── descricao_solucao       CLOB            NOT NULL
├── descricao_risco         CLOB
├── estagio_maturidade_id   BIGINT                      FK → DOMINIO_VALORES(id)
│                                                       -- dominio = ESTAGIO_MATURIDADE
├── dimensao_inovacao_id    BIGINT                      FK → DOMINIO_VALORES(id)
│                                                       -- dominio = DIMENSAO_INOVACAO
├── grau_impacto_id         BIGINT                      FK → DOMINIO_VALORES(id)
│                                                       -- dominio = GRAU_IMPACTO
├── tem_investimento        NUMBER(1)       NOT NULL    DEFAULT 0
├── retorno_economico_anual NUMBER(18,2)               -- BRL; anualizado; após 100% implementado
├── comentario_proponente   CLOB                        -- Espaço aberto do formulário
├── versao_formulario       VARCHAR2(10)               -- Ex: 'VIA2_R0'
├── data_submissao          TIMESTAMP                  -- Preenchido na transição para SUBMETIDA
│
│   -- CONTEXTO DE GESTÃO (preenchido/evoluído pela Assessoria)
├── status_id               BIGINT          NOT NULL    FK → DOMINIO_VALORES(id)
│                                                       -- dominio = STATUS_INICIATIVA; default RASCUNHO
├── qualificacao_id         BIGINT                      FK → DOMINIO_VALORES(id)
│                                                       -- dominio = QUALIFICACAO
├── analista_id             BIGINT                      FK → USUARIOS(id)
├── homologador_id          BIGINT                      FK → USUARIOS(id)
├── data_homologacao        TIMESTAMP
├── relevancia_financeira   NUMBER(1)       NOT NULL    DEFAULT 0
├── relevancia_executiva    NUMBER(1)       NOT NULL    DEFAULT 0
│
│   -- CAMPOS DE AUDITORIA
├── criado_em               TIMESTAMP       NOT NULL
├── criado_por_id           BIGINT                      FK → USUARIOS(id)
├── atualizado_em           TIMESTAMP       NOT NULL
└── atualizado_por_id       BIGINT                      FK → USUARIOS(id)

Constraints:
  UQ_INICIATIVAS_COD_PUB:     UNIQUE (codigo_publico)
  CK_INI_TEM_INV:             tem_investimento IN (0, 1)
  CK_INI_REL_FIN:             relevancia_financeira IN (0, 1)
  CK_INI_REL_EXE:             relevancia_executiva IN (0, 1)
  CK_INI_RETORNO_POS:         retorno_economico_anual IS NULL 
                              OR retorno_economico_anual >= 0
  CK_INI_DATA_SUBM:           data_submissao IS NULL 
                              OR data_submissao >= criado_em

  FK_INI_CANAL:               canal_id → CANAIS_CAPTACAO(id)
  FK_INI_PROPONENTE:          proponente_id → PROPONENTES(id)
  FK_INI_AREA:                area_proponente_id → UNIDADES_ORGANIZACIONAIS(id)
  FK_INI_ESTAGIO:             estagio_maturidade_id → DOMINIO_VALORES(id)
  FK_INI_DIMENSAO:            dimensao_inovacao_id → DOMINIO_VALORES(id)
  FK_INI_IMPACTO:             grau_impacto_id → DOMINIO_VALORES(id)
  FK_INI_STATUS:              status_id → DOMINIO_VALORES(id)
  FK_INI_QUALIFICACAO:        qualificacao_id → DOMINIO_VALORES(id)
  FK_INI_ANALISTA:            analista_id → USUARIOS(id)
  FK_INI_HOMOLOGADOR:         homologador_id → USUARIOS(id)

Índices:
  IDX_INI_STATUS:             (status_id)
  IDX_INI_PROPONENTE:         (proponente_id)
  IDX_INI_AREA:               (area_proponente_id)
  IDX_INI_CANAL:              (canal_id)
  IDX_INI_ANALISTA:           (analista_id)
  IDX_INI_DATA_SUBM:          (data_submissao)
  IDX_INI_STATUS_AREA:        (status_id, area_proponente_id)  -- Para filtros combinados comuns
  IDX_INI_RELEVANCIA:         (relevancia_financeira, relevancia_executiva)
```

**Trigger de geração de `codigo_publico`:**
```
TRG_INICIATIVAS_BEF_INS: BEFORE INSERT
  Lógica: SELECT 'INOV-' || TO_CHAR(SYSDATE, 'YYYY') || '-' || 
          LPAD(SEQ_INICIATIVAS_ANO.NEXTVAL, 3, '0')
          INTO :new.codigo_publico FROM DUAL;
  
  Nota: A sequence SEQ_INICIATIVAS_ANO deve ser resetada anualmente 
  ou deve ser uma sequence por ano (gerenciada em PARAMETROS_SISTEMA).
  Alternativa mais robusta: sequence global (sem reset) + formatação apenas visual.
```

---

### 3.9 HISTORICO_STATUS

```
HISTORICO_STATUS
├── id                  BIGINT          NOT NULL    PK
├── iniciativa_id       BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── status_anterior     VARCHAR2(50)                -- NULL para o primeiro evento
├── status_novo         VARCHAR2(50)    NOT NULL
├── tipo_evento         VARCHAR2(30)    NOT NULL    [SUBMISSAO | TRIAGEM | ANALISE | 
│                                                    HOMOLOGACAO | DESQUALIFICACAO | 
│                                                    REABERTURA | SUSPENSAO | CONCLUSAO |
│                                                    DEVOLUCAO | CANCELAMENTO]
├── usuario_id          BIGINT          NOT NULL    FK → USUARIOS(id)
├── data_hora           TIMESTAMP       NOT NULL
└── justificativa       CLOB                        -- Obrigatório para DESQUALIFICACAO, 
                                                    -- SUSPENSAO, DEVOLUCAO, REABERTURA

Constraints:
  CK_HS_TIPO_EVENTO:    tipo_evento IN ('SUBMISSAO','TRIAGEM','ANALISE','HOMOLOGACAO',
                                        'DESQUALIFICACAO','REABERTURA','SUSPENSAO',
                                        'CONCLUSAO','DEVOLUCAO','CANCELAMENTO')
  CK_HS_JUST_OBRIG:     -- Justificativa obrigatória para transições sensíveis
                        NOT (tipo_evento IN ('DESQUALIFICACAO','SUSPENSAO','DEVOLUCAO',
                                             'REABERTURA') AND justificativa IS NULL)
  FK_HS_INICIATIVA:     iniciativa_id → INICIATIVAS(id)
  FK_HS_USUARIO:        usuario_id → USUARIOS(id)

Índices:
  IDX_HS_INICIATIVA:    (iniciativa_id, data_hora)  -- Consulta de histórico cronológico
  IDX_HS_USUARIO:       (usuario_id)
  IDX_HS_TIPO:          (tipo_evento)
  IDX_HS_DATA:          (data_hora)

Nota de imutabilidade: Esta tabela NÃO DEVE ter operações de UPDATE ou DELETE.
Enforcement via trigger:
  TRG_HS_NO_UPD_DEL: BEFORE UPDATE OR DELETE ON HISTORICO_STATUS → RAISE_APPLICATION_ERROR
```

---

### 3.10 INVESTIMENTOS

```
INVESTIMENTOS
├── id                  BIGINT          NOT NULL    PK
├── iniciativa_id       BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── valor               NUMBER(18,2)    NOT NULL
├── moeda               CHAR(3)         NOT NULL    DEFAULT 'BRL'  -- ISO 4217
├── ano_referencia      NUMBER(4)       NOT NULL
├── fonte               VARCHAR2(30)    NOT NULL    [ORCAMENTO_PROPRIO | SOLICITACAO_ASSESSORIA |
│                                                    CAPTACAO_EXTERNA | PARCERIA | SEM_CUSTO]
├── status_aprov        VARCHAR2(20)    NOT NULL    DEFAULT 'ESTIMADO'
│                                                   [ESTIMADO | APROVADO | CONTINGENTE | CANCELADO]
├── tipo                VARCHAR2(10)    NOT NULL    [CAPEX | OPEX | MISTO]
├── observacao          VARCHAR2(500)
├── versao              NUMBER(5)       NOT NULL    DEFAULT 1
├── criado_em           TIMESTAMP       NOT NULL
├── criado_por_id       BIGINT                      FK → USUARIOS(id)
├── atualizado_em       TIMESTAMP       NOT NULL
└── atualizado_por_id   BIGINT                      FK → USUARIOS(id)

Constraints:
  CK_INV_VALOR_POS:     valor >= 0
  CK_INV_FONTE:         fonte IN ('ORCAMENTO_PROPRIO','SOLICITACAO_ASSESSORIA',
                                   'CAPTACAO_EXTERNA','PARCERIA','SEM_CUSTO')
  CK_INV_STATUS:        status_aprov IN ('ESTIMADO','APROVADO','CONTINGENTE','CANCELADO')
  CK_INV_TIPO:          tipo IN ('CAPEX','OPEX','MISTO')
  CK_INV_ANO:           ano_referencia BETWEEN 2020 AND 2099
  FK_INV_INICIATIVA:    iniciativa_id → INICIATIVAS(id)

Índices:
  IDX_INV_INICIATIVA:   (iniciativa_id, versao DESC)  -- Versão mais recente first
  IDX_INV_STATUS:       (status_aprov)
  IDX_INV_ANO:          (ano_referencia)
```

---

### 3.11 METAS_ESTRATEGICAS

```
METAS_ESTRATEGICAS
├── id                  BIGINT          NOT NULL    PK
├── tipo                VARCHAR2(25)    NOT NULL    [ODS | PLANO_ESTRATEGICO | 
│                                                    REGULATORIO | EFICIENCIA_OPERACIONAL]
├── codigo              VARCHAR2(20)    NOT NULL
├── titulo              VARCHAR2(300)   NOT NULL
├── descricao           CLOB
├── ativo               NUMBER(1)       NOT NULL    DEFAULT 1
├── vigencia_inicio     DATE
├── vigencia_fim        DATE
├── criado_em           TIMESTAMP       NOT NULL
└── atualizado_em       TIMESTAMP       NOT NULL

Constraints:
  UQ_METAS_CODIGO:      UNIQUE (codigo)
  CK_METAS_TIPO:        tipo IN ('ODS','PLANO_ESTRATEGICO','REGULATORIO',
                                  'EFICIENCIA_OPERACIONAL')
  CK_METAS_ATIVO:       ativo IN (0, 1)
  CK_METAS_VIGENCIA:    vigencia_fim IS NULL OR vigencia_fim > vigencia_inicio

Dados iniciais (ODS):
  (ODS, 'ODS-6', 'Água Potável e Saneamento')
  (ODS, 'ODS-9', 'Indústria, Inovação e Infraestrutura')
  (ODS, 'ODS-11', 'Cidades e Comunidades Sustentáveis')
  ... (todos os 17 ODS)
```

---

### 3.12 INICIATIVAS_METAS (Associativa N:N)

```
INICIATIVAS_METAS
├── iniciativa_id       BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── meta_id             BIGINT          NOT NULL    FK → METAS_ESTRATEGICAS(id)
├── associado_por_id    BIGINT          NOT NULL    FK → USUARIOS(id)
└── associado_em        TIMESTAMP       NOT NULL

Constraints:
  PK_INI_METAS:         PRIMARY KEY (iniciativa_id, meta_id)
  FK_IM_INICIATIVA:     iniciativa_id → INICIATIVAS(id)
  FK_IM_META:           meta_id → METAS_ESTRATEGICAS(id)
  FK_IM_USUARIO:        associado_por_id → USUARIOS(id)

Índices:
  IDX_IM_META:          (meta_id)
```

---

### 3.13 INICIATIVAS_SUPORTES (Associativa N:N — Revisada)

```
INICIATIVAS_SUPORTES
├── id                      BIGINT          NOT NULL    PK
├── iniciativa_id           BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── tipo_suporte_id         BIGINT          NOT NULL    FK → DOMINIO_VALORES(id)
│                                                       -- dominio = TIPO_SUPORTE
├── descricao_complementar  VARCHAR2(500)               -- Obrigatório quando tipo = OUTRO
├── status                  VARCHAR2(20)    NOT NULL    DEFAULT 'SOLICITADO'
│                                                       [SOLICITADO | EM_ATENDIMENTO | 
│                                                        CONCLUIDO | CANCELADO]
├── registrado_em           TIMESTAMP       NOT NULL
├── registrado_por_id       BIGINT          NOT NULL    FK → USUARIOS(id)
├── atualizado_em           TIMESTAMP       NOT NULL
└── atualizado_por_id       BIGINT                      FK → USUARIOS(id)

Constraints:
  UQ_IS_INI_TIPO:       UNIQUE (iniciativa_id, tipo_suporte_id) WHERE status != 'CANCELADO'
  CK_IS_STATUS:         status IN ('SOLICITADO','EM_ATENDIMENTO','CONCLUIDO','CANCELADO')
  CK_IS_OUTRO_DESC:     -- Descrição obrigatória para tipo OUTRO
                        (SELECT codigo FROM DOMINIO_VALORES 
                         WHERE id = tipo_suporte_id) != 'OUTRO' 
                        OR descricao_complementar IS NOT NULL
  FK_IS_INICIATIVA:     iniciativa_id → INICIATIVAS(id)
  FK_IS_TIPO:           tipo_suporte_id → DOMINIO_VALORES(id)

Índices:
  IDX_IS_INICIATIVA:    (iniciativa_id)
  IDX_IS_TIPO:          (tipo_suporte_id)
  IDX_IS_STATUS:        (status)
```

---

### 3.14 ANOTACOES

```
ANOTACOES
├── id                  BIGINT          NOT NULL    PK
├── iniciativa_id       BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── texto               CLOB            NOT NULL
├── tipo                VARCHAR2(25)    NOT NULL    [COMENTARIO_PROPONENTE | NOTA_TECNICA | 
│                                                    NOTA_AUDITORIA | COMUNICADO | ALERTA_SISTEMA]
├── visibilidade        VARCHAR2(15)    NOT NULL    DEFAULT 'INTERNA'
│                                                   [PUBLICA | INTERNA | RESTRITA]
├── autor_id            BIGINT          NOT NULL    FK → USUARIOS(id)
├── criado_em           TIMESTAMP       NOT NULL
└── editado_em          TIMESTAMP                   -- NULL se nunca editada

Constraints:
  CK_ANO_TIPO:          tipo IN ('COMENTARIO_PROPONENTE','NOTA_TECNICA','NOTA_AUDITORIA',
                                  'COMUNICADO','ALERTA_SISTEMA')
  CK_ANO_VIS:           visibilidade IN ('PUBLICA','INTERNA','RESTRITA')
  CK_ANO_PROP_PUB:      -- Comentários do proponente são sempre públicos
                        tipo != 'COMENTARIO_PROPONENTE' OR visibilidade = 'PUBLICA'
  FK_ANO_INICIATIVA:    iniciativa_id → INICIATIVAS(id)
  FK_ANO_AUTOR:         autor_id → USUARIOS(id)

Índices:
  IDX_ANO_INICIATIVA:   (iniciativa_id, criado_em)
  IDX_ANO_TIPO_VIS:     (tipo, visibilidade)
```

---

### 3.15 RELACIONAMENTOS_INICIATIVAS

```
RELACIONAMENTOS_INICIATIVAS
├── id                      BIGINT          NOT NULL    PK
├── iniciativa_origem_id    BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── iniciativa_destino_id   BIGINT          NOT NULL    FK → INICIATIVAS(id)
├── tipo_relacao            VARCHAR2(20)    NOT NULL    [DUPLICATA | DEPENDENTE_DE | 
│                                                        COMPLEMENTAR_A | SUBSTITUI | 
│                                                        CONFLITA_COM]
├── observacao              VARCHAR2(500)
├── criado_por_id           BIGINT          NOT NULL    FK → USUARIOS(id)
└── criado_em               TIMESTAMP       NOT NULL

Constraints:
  UQ_RI_PAR_TIPO:       UNIQUE (iniciativa_origem_id, iniciativa_destino_id, tipo_relacao)
  CK_RI_NAO_REFLEXIVO:  iniciativa_origem_id != iniciativa_destino_id
  CK_RI_TIPO:           tipo_relacao IN ('DUPLICATA','DEPENDENTE_DE','COMPLEMENTAR_A',
                                          'SUBSTITUI','CONFLITA_COM')
  FK_RI_ORIGEM:         iniciativa_origem_id → INICIATIVAS(id)
  FK_RI_DESTINO:        iniciativa_destino_id → INICIATIVAS(id)

Índices:
  IDX_RI_ORIGEM:        (iniciativa_origem_id)
  IDX_RI_DESTINO:       (iniciativa_destino_id)
```

---

### 3.16 AUDITORIA_LOGS

```
AUDITORIA_LOGS
├── id                  BIGINT          NOT NULL    PK
├── tabela              VARCHAR2(100)   NOT NULL
├── operacao            VARCHAR2(10)    NOT NULL    [INSERT | UPDATE | DELETE]
├── registro_id         VARCHAR2(100)   NOT NULL
├── dados_anteriores    CLOB                        -- JSON; NULL para INSERT
├── dados_novos         CLOB                        -- JSON; NULL para DELETE
├── usuario_id          BIGINT                      FK → USUARIOS(id); NULL para sistema
├── timestamp_tz        TIMESTAMP WITH TIME ZONE NOT NULL
├── ip_origem           VARCHAR2(45)
└── sessao_id           VARCHAR2(100)

Constraints:
  CK_AL_OPERACAO:       operacao IN ('INSERT','UPDATE','DELETE')
  CK_AL_INS_DADOS:      -- INSERT deve ter dados_novos
                        operacao != 'INSERT' OR dados_novos IS NOT NULL
  CK_AL_DEL_DADOS:      -- DELETE deve ter dados_anteriores
                        operacao != 'DELETE' OR dados_anteriores IS NOT NULL

Índices:
  IDX_AL_TABELA_ID:     (tabela, registro_id)
  IDX_AL_USUARIO:       (usuario_id)
  IDX_AL_TIMESTAMP:     (timestamp_tz)
  IDX_AL_TABELA_TS:     (tabela, timestamp_tz)   -- Para auditoria por tabela no tempo

Política de retenção:
  Registros com timestamp_tz < SYSDATE - INTERVAL '7' YEAR podem ser arquivados.
  Nunca deletar registros de INICIATIVAS, HISTORICO_STATUS, USUARIOS.
```

---

### 3.17 PARAMETROS_SISTEMA

```
PARAMETROS_SISTEMA
├── id                  BIGINT          NOT NULL    PK
├── chave               VARCHAR2(100)   NOT NULL
├── valor               VARCHAR2(1000)  NOT NULL
├── descricao           VARCHAR2(500)
├── tipo_valor          VARCHAR2(15)    NOT NULL    [TEXTO | NUMERO | BOOLEANO | DATA | JSON]
├── editavel            NUMBER(1)       NOT NULL    DEFAULT 1
├── criado_em           TIMESTAMP       NOT NULL
├── atualizado_em       TIMESTAMP       NOT NULL
└── atualizado_por_id   BIGINT                      FK → USUARIOS(id)

Constraints:
  UQ_PARAM_CHAVE:       UNIQUE (chave)

Dados iniciais sugeridos:
  (RLC_VALOR_REFERENCIA, '0', 'Valor atual da RLC em BRL para cálculo do critério financeiro')
  (RLC_PERCENTUAL_GATILHO, '0.0001', 'Percentual da RLC que aciona relevância financeira')
  (EMAIL_ASSESSORIA, '', 'E-mail da Assessoria para notificações')
  (PRAZO_ANALISE_DIAS, '30', 'Prazo padrão para análise de iniciativas em dias')
  (VERSAO_FORMULARIO_ATUAL, 'VIA2_R0', 'Versão atual do formulário Via 2')
```

---

## 4. Mapa de Dependências das Tabelas (Ordem de Criação)

```
1. DOMINIO_VALORES           (sem dependências externas)
2. UNIDADES_ORGANIZACIONAIS  (self-referenciada; criar sem FK primeiro, depois adicionar)
3. USUARIOS                  (depende de UNIDADES_ORGANIZACIONAIS)
4. PERFIS_ACESSO             (sem dependências externas)
5. USUARIOS_PERFIS           (depende de USUARIOS, PERFIS_ACESSO)
6. CANAIS_CAPTACAO           (sem dependências externas)
7. METAS_ESTRATEGICAS        (sem dependências externas)
8. PROPONENTES               (depende de UNIDADES_ORGANIZACIONAIS, USUARIOS)
9. INICIATIVAS               (depende de quase tudo acima)
10. HISTORICO_STATUS         (depende de INICIATIVAS, USUARIOS)
11. INVESTIMENTOS            (depende de INICIATIVAS, USUARIOS)
12. INICIATIVAS_METAS        (depende de INICIATIVAS, METAS_ESTRATEGICAS, USUARIOS)
13. INICIATIVAS_SUPORTES     (depende de INICIATIVAS, DOMINIO_VALORES, USUARIOS)
14. ANOTACOES                (depende de INICIATIVAS, USUARIOS)
15. RELACIONAMENTOS_INICIATIVAS (depende de INICIATIVAS, USUARIOS)
16. AUDITORIA_LOGS           (depende de USUARIOS; criada por último para capturar tudo)
17. PARAMETROS_SISTEMA       (depende de USUARIOS)
```

---

## 5. Views Analíticas Recomendadas

Não são tabelas — são views que simplificam consultas frequentes e isolam a complexidade do modelo normalizado.

**VW_PORTFOLIO_ATIVO:** Iniciativas com status ativo (não CANCELADA, não DESQUALIFICADA), com dados desnormalizados de área, proponente, status atual e métricas financeiras.

**VW_METRICAS_DASHBOARD:** Agrega contadores por status, investimento total, retorno projetado, agrupados por ano de submissão — alimenta o dashboard.

**VW_HISTORICO_COMPLETO:** Join de INICIATIVAS + HISTORICO_STATUS + USUARIOS para linha do tempo auditável de cada iniciativa.

**VW_SUPORTE_PENDENTE:** Iniciativas homologadas com demandas de suporte em status SOLICITADO ou EM_ATENDIMENTO — fila de trabalho da Assessoria.

**VW_PROPONENTE_PORTFOLIO:** Todas as iniciativas de um proponente com seu status atual — para o proponente acompanhar suas submissões.

---

## 6. Estratégia de Migração (Diretrizes)

A estratégia de migração não pode ser finalizada sem o schema atual. As diretrizes abaixo são preliminares:

**Fase 1 — Criação paralela:** Criar o novo schema em paralelo ao existente, sem remover nenhuma tabela atual.

**Fase 2 — ETL de dados históricos:** Migrar os registros existentes para o novo modelo, incluindo:
- Criar entidade PROPONENTE para cada ponto de contato distinto
- Criar entidades UNIDADE_ORGANIZACIONAL a partir do texto livre de áreas
- Criar INVESTIMENTO para cada registro com valor > 0
- Criar HISTORICO_STATUS com um único registro de "estado inicial" para cada iniciativa migrada
- Criar ANOTACAO tipo NOTA_TECNICA para o conteúdo atual de notas

**Fase 3 — Validação:** Confirmar integridade dos dados migrados antes de remover o schema antigo.

**Fase 4 — Cutover:** Redirecionar a aplicação para o novo schema.

**Princípio de ouro:** Nenhum dado histórico deve ser descartado. Se não há correspondência direta no novo modelo, o dado vai para um campo `metadados` ou `legado` até ser tratado.