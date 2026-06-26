-- V20__create_admin_users.sql
-- Tabela whitelist de usuários administrativos autenticados via Kerberos/IIS
-- Substitui USUARIOS + USUARIOS_PERFIS + PERFIS_ACESSO para o controle de acesso ao painel admin
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'ADMIN_USERS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE ADMIN_USERS (
        id        NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        login     VARCHAR2(100) NOT NULL,
        nome      VARCHAR2(200),
        role      VARCHAR2(20)  NOT NULL,
        ativo     NUMBER(1)     DEFAULT 1 NOT NULL,
        criado_em TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT UQ_AU_LOGIN UNIQUE (login),
        CONSTRAINT CK_AU_ROLE  CHECK  (role IN (''ADM'', ''CONTRIBUTOR'')),
        CONSTRAINT CK_AU_ATIVO CHECK  (ativo IN (0, 1))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_AU_LOGIN ON ADMIN_USERS (login)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_AU_ATIVO ON ADMIN_USERS (ativo)';
  END IF;
END;
/

COMMIT;
