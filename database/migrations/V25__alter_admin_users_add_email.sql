-- V25__alter_admin_users_add_email.sql
-- Adiciona coluna EMAIL a ADMIN_USERS para persistir o e-mail resolvido
-- via busca de usuários do Active Directory (CONSCORP.vw_ad_user).
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
   WHERE table_name = 'ADMIN_USERS' AND column_name = 'EMAIL';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ADMIN_USERS ADD (EMAIL VARCHAR2(200))';
  END IF;
END;
/

COMMIT;
