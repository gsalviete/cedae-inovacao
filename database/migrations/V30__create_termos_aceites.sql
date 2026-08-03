-- V30__create_termos_aceites.sql
-- Fonte: ADR-014 (§9.2 e §12-bis) — Termos e Condições de Uso.
-- Registra o aceite/recusa dos Termos por usuário autenticado sem perfil
-- administrativo. Estado autoritativo (versionado) + trilha de auditoria; o
-- log geral continua em INOVACAO_LOGS (ADR-008, duas camadas).
--
-- Estratégia aditiva (ADR-001): tabela nova, nenhuma coluna/tabela existente
-- é alterada. Oracle 19c | Idempotente (seguro reexecutar) | Schema: CEDAE_INOVACAO

-- ── 1. Tabela ────────────────────────────────────────────────────────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'TERMOS_ACEITES';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE TERMOS_ACEITES (
        id             NUMBER          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        login          VARCHAR2(100)   NOT NULL,
        versao_termos  VARCHAR2(20)    NOT NULL,
        acao           VARCHAR2(10)    NOT NULL,
        ip             VARCHAR2(45),
        user_agent     VARCHAR2(400),
        registrado_em  TIMESTAMP       DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP) NOT NULL,
        CONSTRAINT CK_TA_ACAO CHECK (acao IN (''ACEITE'',''RECUSA''))
      )';
  END IF;
END;
/

-- ── 2. Índice de consulta de status (login + versão) ─────────────────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_TA_LOGIN_VERSAO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_TA_LOGIN_VERSAO ON TERMOS_ACEITES (login, versao_termos)';
  END IF;
END;
/

COMMIT;
