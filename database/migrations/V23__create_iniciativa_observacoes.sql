-- V23__create_iniciativa_observacoes.sql
-- Tabela dedicada para observações livres durante a tramitação
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'INICIATIVA_OBSERVACOES';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE INICIATIVA_OBSERVACOES (
        id            NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        iniciativa_id NUMBER        NOT NULL,
        usuario_login VARCHAR2(100) NOT NULL,
        texto         CLOB          NOT NULL,
        criado_em     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_IO_INICIATIVA ON INICIATIVA_OBSERVACOES (iniciativa_id, criado_em)';
  END IF;
END;
/

COMMIT;
