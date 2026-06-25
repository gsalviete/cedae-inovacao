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