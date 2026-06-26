-- V12__create_transicoes_status.sql
-- Fonte: database-migration-plan.md §2 (GRUPO 5) + ADR-004
-- Referencia STATUS_WORKFLOW por código VARCHAR2, não por ID (ADR-002B §Regras item 3)
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'TRANSICOES_STATUS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE TRANSICOES_STATUS (
        id                   NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        status_origem        VARCHAR2(50)   NOT NULL,
        status_destino       VARCHAR2(50)   NOT NULL,
        perfil_requerido     VARCHAR2(50)   NOT NULL,
        justificativa_obrig  NUMBER(1)      DEFAULT 0 NOT NULL,
        notificar_proponente NUMBER(1)      DEFAULT 0 NOT NULL,
        descricao            VARCHAR2(200),
        CONSTRAINT UQ_TS_ORIG_DEST_PERF UNIQUE (status_origem, status_destino, perfil_requerido),
        CONSTRAINT CK_TS_JUST  CHECK (justificativa_obrig  IN (0,1)),
        CONSTRAINT CK_TS_NOTIF CHECK (notificar_proponente IN (0,1))
      )';
  END IF;
END;
/

COMMIT;
