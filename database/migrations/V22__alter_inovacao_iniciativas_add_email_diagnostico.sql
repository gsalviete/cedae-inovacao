-- V22__alter_inovacao_iniciativas_add_email_diagnostico.sql
-- Adiciona EMAIL_PROPONENTE (Bloco 0) e DIAGNOSTICO_OBSERVACAO (Bloco IV, condicional ao Apoio Diagnóstico)
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  PROCEDURE add_col_if_not_exists(p_col VARCHAR2, p_def VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tab_columns
    WHERE table_name = 'INOVACAO_INICIATIVAS' AND column_name = UPPER(p_col);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE INOVACAO_INICIATIVAS ADD ' || p_col || ' ' || p_def;
    END IF;
  END;
BEGIN
  add_col_if_not_exists('EMAIL_PROPONENTE',       'VARCHAR2(255)');
  add_col_if_not_exists('DIAGNOSTICO_OBSERVACAO', 'VARCHAR2(2000)');
END;
/

COMMIT;
