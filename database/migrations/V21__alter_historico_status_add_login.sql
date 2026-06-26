-- V21__alter_historico_status_add_login.sql
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'HISTORICO_STATUS' AND column_name = 'USUARIO_LOGIN';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE HISTORICO_STATUS ADD (usuario_login VARCHAR2(100))';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_HS_LOGIN';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_LOGIN ON HISTORICO_STATUS (usuario_login)';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_HS_USUARIO';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'DROP INDEX IDX_HS_USUARIO';
  END IF;
END;
/

COMMIT;
