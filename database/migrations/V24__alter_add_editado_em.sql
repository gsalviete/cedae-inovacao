-- V23__alter_add_editado_em.sql
-- Suporta edição (janela de 2h pelo autor) de observações e eventos do histórico.
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  PROCEDURE add_col_if_not_exists(p_table VARCHAR2, p_col VARCHAR2, p_def VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tab_columns
    WHERE table_name = UPPER(p_table) AND column_name = UPPER(p_col);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD ' || p_col || ' ' || p_def;
    END IF;
  END;
BEGIN
  add_col_if_not_exists('INICIATIVA_OBSERVACOES', 'EDITADO_EM', 'TIMESTAMP');
  add_col_if_not_exists('HISTORICO_STATUS',       'EDITADO_EM', 'TIMESTAMP');
END;
/

COMMIT;
