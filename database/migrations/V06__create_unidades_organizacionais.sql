-- V06__create_unidades_organizacionais.sql
-- Fonte: future-data-model.md §3.2
-- Nota MVP: tabela criada vazia — seed via E1-S02 após receber lista da Assessoria
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'UNIDADES_ORGANIZACIONAIS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE UNIDADES_ORGANIZACIONAIS (
        id                NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        sigla             VARCHAR2(20)   NOT NULL,
        nome              VARCHAR2(300)  NOT NULL,
        tipo              VARCHAR2(30)   NOT NULL,
        pai_id            NUMBER,
        ativa             NUMBER(1)      DEFAULT 1 NOT NULL,
        codigo_externo    VARCHAR2(100),
        criado_em         TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        criado_por_id     NUMBER,
        atualizado_em     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_por_id NUMBER,
        CONSTRAINT CK_UO_TIPO  CHECK (tipo IN (''DIRETORIA'',''SUPERINTENDENCIA'',''GERENCIA'',''UNIDADE_OPERACIONAL'',''EXTERNO'')),
        CONSTRAINT CK_UO_ATIVA CHECK (ativa IN (0,1))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_UO_PAI  ON UNIDADES_ORGANIZACIONAIS (pai_id)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_UO_TIPO ON UNIDADES_ORGANIZACIONAIS (tipo, ativa)';
  END IF;
END;
/

COMMIT;
