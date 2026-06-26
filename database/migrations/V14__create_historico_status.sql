-- V14__create_historico_status.sql
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'HISTORICO_STATUS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE HISTORICO_STATUS (
        id               NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        iniciativa_id    NUMBER         NOT NULL,
        status_anterior  VARCHAR2(50),
        status_novo      VARCHAR2(50)   NOT NULL,
        tipo_evento      VARCHAR2(30)   NOT NULL,
        usuario_id       NUMBER,
        data_hora        TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        justificativa    CLOB,
        CONSTRAINT CK_HS_TIPO CHECK (tipo_evento IN (
          ''SUBMISSAO'',''TRIAGEM'',''ANALISE'',''APROVACAO'',''REPROVACAO'',''CORRECAO''
        ))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_INICIATIVA ON HISTORICO_STATUS (iniciativa_id, data_hora)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_DATA       ON HISTORICO_STATUS (data_hora)';
  END IF;
END;
/

COMMIT;
