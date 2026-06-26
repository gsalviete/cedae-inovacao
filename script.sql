-- ============================================================
-- CEDAE Inovação — Script de Atualização de Banco
-- Arquitetura: Kerberos/IIS → x-remote-user → ADMIN_USERS
-- Gerado em: 2026-06-26
--
-- COMO USAR:
--   Abrir no SQL Developer, conectar ao schema CEDAE_INOVACAO e executar uma vez.
--   O script é idempotente: pode ser executado novamente sem efeitos colaterais.
--
-- PRÉ-REQUISITO:
--   As migrações V01–V19 já devem ter sido executadas.
--
-- ATENÇÃO — DROP TABLE ao final:
--   A seção de remoção de tabelas legadas está COMENTADA por segurança.
--   Faça backup completo antes de descomentar.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- BLOCO 1 — Criar ADMIN_USERS (whitelist de admins Kerberos)
-- ────────────────────────────────────────────────────────────
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
    DBMS_OUTPUT.PUT_LINE('ADMIN_USERS criada.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('ADMIN_USERS já existe — pulando criação.');
  END IF;
END;
/


-- ────────────────────────────────────────────────────────────
-- BLOCO 2 — Seeds de ADMIN_USERS
-- Ajuste os valores de login/nome conforme os usuários reais do domínio.
-- ────────────────────────────────────────────────────────────
INSERT INTO ADMIN_USERS (login, nome, role)
  SELECT 'gsalviete', 'Gabriel Salviete', 'ADM' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM ADMIN_USERS WHERE login = 'gsalviete');


-- ────────────────────────────────────────────────────────────
-- BLOCO 3 — ALTER HISTORICO_STATUS: adicionar usuario_login
-- ────────────────────────────────────────────────────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'HISTORICO_STATUS' AND column_name = 'USUARIO_LOGIN';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE HISTORICO_STATUS ADD (usuario_login VARCHAR2(100))';
    DBMS_OUTPUT.PUT_LINE('Coluna USUARIO_LOGIN adicionada em HISTORICO_STATUS.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('USUARIO_LOGIN já existe em HISTORICO_STATUS — pulando.');
  END IF;
END;
/

-- Índice para usuario_login
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_HS_LOGIN';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_HS_LOGIN ON HISTORICO_STATUS (usuario_login)';
    DBMS_OUTPUT.PUT_LINE('Índice IDX_HS_LOGIN criado.');
  END IF;
END;
/

-- Remove índice obsoleto de usuario_id
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_HS_USUARIO';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'DROP INDEX IDX_HS_USUARIO';
    DBMS_OUTPUT.PUT_LINE('Índice IDX_HS_USUARIO removido.');
  END IF;
END;
/


-- ────────────────────────────────────────────────────────────
-- BLOCO 4 — Recriar VW_HISTORICO_ATIVO com usuario_login
-- ────────────────────────────────────────────────────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_objects
  WHERE object_name = 'VW_HISTORICO_ATIVO' AND object_type = 'VIEW';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'DROP VIEW VW_HISTORICO_ATIVO';
    DBMS_OUTPUT.PUT_LINE('VW_HISTORICO_ATIVO removida para recriação.');
  END IF;
END;
/

CREATE VIEW VW_HISTORICO_ATIVO AS
  SELECT id, iniciativa_id, status_anterior, status_novo,
         tipo_evento, usuario_login, data_hora, justificativa
  FROM HISTORICO_STATUS
  ORDER BY data_hora ASC;


-- ────────────────────────────────────────────────────────────
-- BLOCO 5 — Remoção de tabelas legadas (COMENTADO — fazer backup antes)
--
-- IMPORTANTE: Essas tabelas (USUARIOS, USUARIOS_PERFIS, PERFIS_ACESSO)
-- não são mais usadas pela aplicação. Remova manualmente após confirmar:
--   1. Nenhuma aplicação legacy ainda as consulta
--   2. Backup completo do schema foi feito
--   3. O sistema novo está em produção há pelo menos 7 dias sem erros
--
-- Para executar, descomente e execute manualmente:
-- ────────────────────────────────────────────────────────────
/*
-- Verificar se há dados antes de dropar
SELECT 'USUARIOS_PERFIS',   COUNT(*) FROM USUARIOS_PERFIS   UNION ALL
SELECT 'USUARIOS',          COUNT(*) FROM USUARIOS           UNION ALL
SELECT 'PERFIS_ACESSO',     COUNT(*) FROM PERFIS_ACESSO;

DROP TABLE USUARIOS_PERFIS CASCADE CONSTRAINTS;
DROP TABLE USUARIOS         CASCADE CONSTRAINTS;
DROP TABLE PERFIS_ACESSO    CASCADE CONSTRAINTS;

DROP SEQUENCE USUARIOS_SEQ;        -- se existir
DROP SEQUENCE PERFIS_ACESSO_SEQ;   -- se existir
*/


COMMIT;

-- Verificação pós-script
SELECT 'ADMIN_USERS'         AS tabela, COUNT(*) AS registros FROM ADMIN_USERS
UNION ALL
SELECT 'HISTORICO_STATUS'    AS tabela, COUNT(*) AS registros FROM HISTORICO_STATUS;
