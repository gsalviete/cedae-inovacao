-- V02__create_status_workflow.sql
-- Fonte: database-migration-plan.md §3/V02 + ADR-002B §Schema + ADR-012
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables
  WHERE table_name = 'STATUS_WORKFLOW';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE STATUS_WORKFLOW (
        id            NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        codigo        VARCHAR2(50)   NOT NULL,
        rotulo_pt     VARCHAR2(200)  NOT NULL,
        descricao     CLOB,
        terminal      NUMBER(1)      DEFAULT 0 NOT NULL,
        ordem         NUMBER(5)      DEFAULT 0 NOT NULL,
        ativo         NUMBER(1)      DEFAULT 1 NOT NULL,
        criado_em     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_em TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT UQ_SW_CODIGO UNIQUE (codigo),
        CONSTRAINT CK_SW_ATIVO  CHECK  (ativo IN (0,1)),
        CONSTRAINT CK_SW_TERM   CHECK  (terminal IN (0,1))
      )';
  END IF;
END;
/

-- ============================================================
-- SEEDS — 4 estados do MVP
-- Fonte: ADR-002B §MVP (tabela de estados) + ADR-012 (4 Estados, 3 Transições)
-- terminal=1 indica estado sem transições de saída (ADR-002B §Regras item 1)
-- ============================================================
INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'SUBMETIDA', 'Submetida', 0, 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo = 'SUBMETIDA');

INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'EM_ANALISE', 'Em Análise', 0, 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo = 'EM_ANALISE');

INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'APROVADA', 'Aprovada', 1, 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo = 'APROVADA');

INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'REPROVADA', 'Reprovada', 1, 4 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo = 'REPROVADA');

COMMIT;
