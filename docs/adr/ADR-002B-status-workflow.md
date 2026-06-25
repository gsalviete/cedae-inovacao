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