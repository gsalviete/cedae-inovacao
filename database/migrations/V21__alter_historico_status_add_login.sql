-- V21__alter_historico_status_add_login.sql
-- Adiciona usuario_login (VARCHAR2) em HISTORICO_STATUS
-- O campo usuario_id (NUMBER) é mantido com seus dados históricos, mas não é mais escrito
-- A view VW_HISTORICO_ATIVO é recriada para expor usuario_login
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

-- ── 1. Adiciona coluna usuario_login ──────────────────────────────────
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

-- ── 2. Cria índice em usuario_login ──────────────────────────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_HS_LOGIN';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_LOGIN ON HISTORICO_STATUS (usuario_login)';
  END IF;
END;
/

-- ── 3. Remove índice antigo IDX_HS_USUARIO (usuario_id já não é escrito) ──
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_HS_USUARIO';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'DROP INDEX IDX_HS_USUARIO';
  END IF;
END;
/

-- ── 4. Recria view VW_HISTORICO_ATIVO com usuario_login ──────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_objects
  WHERE object_name = 'VW_HISTORICO_ATIVO' AND object_type = 'VIEW';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'DROP VIEW VW_HISTORICO_ATIVO';
  END IF;
END;
/

CREATE VIEW VW_HISTORICO_ATIVO AS
  SELECT id, iniciativa_id, status_anterior, status_novo,
         tipo_evento, usuario_login, data_hora, justificativa
  FROM HISTORICO_STATUS
  ORDER BY data_hora ASC;

COMMIT;
