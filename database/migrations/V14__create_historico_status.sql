-- V14__create_historico_status.sql
-- Fonte: database-migration-plan.md §3/V14
-- iniciativa_id: referencia INOVACAO_INICIATIVAS.ID sem FK formal (adicionada em V29 após INICIATIVAS)
-- usuario_id: nullable — permite registro de submissão anônima (formulário público)
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
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_USUARIO    ON HISTORICO_STATUS (usuario_id)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_DATA       ON HISTORICO_STATUS (data_hora)';
  END IF;
END;
/

-- Trigger de imutabilidade (database-migration-plan.md §3/V14)
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_objects
  WHERE object_name = 'TRG_HS_NO_UPD_DEL' AND object_type = 'TRIGGER';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TRIGGER TRG_HS_NO_UPD_DEL
      BEFORE UPDATE OR DELETE ON HISTORICO_STATUS
      FOR EACH ROW
      BEGIN
        IF UPDATING THEN
          RAISE_APPLICATION_ERROR(-20001,
            ''HISTORICO_STATUS e imutavel. Nao e permitido UPDATE nesta tabela.'');
        END IF;
        IF DELETING THEN
          RAISE_APPLICATION_ERROR(-20002,
            ''DELETE em HISTORICO_STATUS nao e permitido.'');
        END IF;
      END;';
  END IF;
END;
/

-- View para uso da aplicação (database-migration-plan.md §3/V14)
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_objects
  WHERE object_name = 'VW_HISTORICO_ATIVO' AND object_type = 'VIEW';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE VIEW VW_HISTORICO_ATIVO AS
        SELECT id, iniciativa_id, status_anterior, status_novo,
               tipo_evento, usuario_id, data_hora, justificativa
        FROM HISTORICO_STATUS
        ORDER BY data_hora ASC';
  END IF;
END;
/

COMMIT;
