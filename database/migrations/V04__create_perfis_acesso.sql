-- V04__create_perfis_acesso.sql
-- Fonte: future-data-model.md §3.4 (DDL completo)
-- Seeds: future-data-model.md §3.4 "Dados iniciais" (5 perfis)
-- Perfis MVP (ADR-003): ANALISTA_ASSESSORIA, GESTOR_AREA, ADMINISTRADOR
-- Perfis extras (dormentes no MVP): PROPONENTE_EXTERNO, SUPERVISOR_ASSESSORIA
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables
  WHERE table_name = 'PERFIS_ACESSO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE PERFIS_ACESSO (
        id            NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        codigo        VARCHAR2(50)   NOT NULL,
        nome          VARCHAR2(200)  NOT NULL,
        descricao     CLOB,
        ativo         NUMBER(1)      DEFAULT 1 NOT NULL,
        criado_em     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_em TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT UQ_PERFIS_CODIGO UNIQUE (codigo),
        CONSTRAINT CK_PERFIS_ATIVO  CHECK  (ativo IN (0,1))
      )';
  END IF;
END;
/

-- ============================================================
-- SEEDS — 5 perfis
-- Fonte: future-data-model.md §3.4 "Dados iniciais"
-- ADMINISTRADOR, ANALISTA_ASSESSORIA, GESTOR_AREA: ativos no MVP (ADR-003 §Perfis MVP)
-- PROPONENTE_EXTERNO, SUPERVISOR_ASSESSORIA: inseridos mas dormentes até Fase 3+
-- ============================================================
INSERT INTO PERFIS_ACESSO (codigo, nome)
  SELECT 'ADMINISTRADOR', 'Administrador do Sistema' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PERFIS_ACESSO WHERE codigo = 'ADMINISTRADOR');

INSERT INTO PERFIS_ACESSO (codigo, nome)
  SELECT 'ANALISTA_ASSESSORIA', 'Analista da Assessoria' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PERFIS_ACESSO WHERE codigo = 'ANALISTA_ASSESSORIA');

INSERT INTO PERFIS_ACESSO (codigo, nome)
  SELECT 'GESTOR_AREA', 'Gestor de Área' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PERFIS_ACESSO WHERE codigo = 'GESTOR_AREA');

INSERT INTO PERFIS_ACESSO (codigo, nome)
  SELECT 'SUPERVISOR_ASSESSORIA', 'Supervisor da Assessoria' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PERFIS_ACESSO WHERE codigo = 'SUPERVISOR_ASSESSORIA');

INSERT INTO PERFIS_ACESSO (codigo, nome)
  SELECT 'PROPONENTE_EXTERNO', 'Proponente Externo' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PERFIS_ACESSO WHERE codigo = 'PROPONENTE_EXTERNO');

COMMIT;
