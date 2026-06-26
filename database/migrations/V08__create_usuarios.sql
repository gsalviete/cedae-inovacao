-- V08__create_usuarios.sql
-- Fonte: future-data-model.md §3.3 + ADR-003
-- senha_hash: coluna adicional ao modelo (ADR-003 §Regras "Senhas armazenadas como hash bcrypt")
-- area_id: nullable sem FK neste script; FK adicionada em V29
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'USUARIOS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE USUARIOS (
        id                  NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        login               VARCHAR2(100)  NOT NULL,
        nome_completo       VARCHAR2(300)  NOT NULL,
        email               VARCHAR2(200)  NOT NULL,
        senha_hash          VARCHAR2(100),
        area_id             NUMBER,
        ativo               NUMBER(1)      DEFAULT 1 NOT NULL,
        ultimo_acesso       TIMESTAMP,
        origem_identidade   VARCHAR2(20)   DEFAULT ''LOCAL'' NOT NULL,
        criado_em           TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        criado_por_id       NUMBER,
        atualizado_em       TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_por_id   NUMBER,
        CONSTRAINT UQ_USR_LOGIN UNIQUE (login),
        CONSTRAINT UQ_USR_EMAIL UNIQUE (email),
        CONSTRAINT CK_USR_ATIVO CHECK (ativo IN (0,1)),
        CONSTRAINT CK_USR_ORIG  CHECK (origem_identidade IN (''LOCAL'',''LDAP'',''AD'',''SSO''))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_USR_LOGIN ON USUARIOS (login)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_USR_AREA  ON USUARIOS (area_id)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_USR_ATIVO ON USUARIOS (ativo)';
  END IF;
END;
/

COMMIT;
