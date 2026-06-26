-- V19__alter_inovacao_iniciativas_add_columns.sql
-- Fonte: database-migration-plan.md §3/V19 + ADR-006
-- Adiciona colunas de bridge para coexistência legado/novo (todas nullable)
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
  add_col_if_not_exists('CODIGO_PUBLICO', 'VARCHAR2(20)');
  add_col_if_not_exists('STATUS',         'VARCHAR2(50) DEFAULT ''SUBMETIDA''');
  add_col_if_not_exists('ANALISTA_ID',    'NUMBER');
  add_col_if_not_exists('ATUALIZADO_EM',  'DATE DEFAULT SYSDATE');
END;
/

-- Preencher STATUS para registros já existentes sem status
UPDATE INOVACAO_INICIATIVAS
SET STATUS = 'SUBMETIDA'
WHERE STATUS IS NULL;

COMMIT;
