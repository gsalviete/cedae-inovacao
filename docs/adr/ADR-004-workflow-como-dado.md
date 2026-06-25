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