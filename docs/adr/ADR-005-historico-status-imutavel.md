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