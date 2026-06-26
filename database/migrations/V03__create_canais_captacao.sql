-- V03__create_canais_captacao.sql
-- Fonte: future-data-model.md §3.6 (DDL completo)
-- Seeds: future-data-model.md §3.6 "Dados iniciais" + ADR-011 (ativo=1 apenas para VIA_2)
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables
  WHERE table_name = 'CANAIS_CAPTACAO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE CANAIS_CAPTACAO (
        id                 NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        codigo             VARCHAR2(30)   NOT NULL,
        nome               VARCHAR2(200)  NOT NULL,
        descricao          CLOB,
        requer_formulario  NUMBER(1)      DEFAULT 0 NOT NULL,
        criterio_ativacao  CLOB,
        ativo              NUMBER(1)      DEFAULT 1 NOT NULL,
        criado_em          TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_em      TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT UQ_CANAIS_CODIGO UNIQUE (codigo),
        CONSTRAINT CK_CANAIS_FORM   CHECK  (requer_formulario IN (0,1)),
        CONSTRAINT CK_CANAIS_ATIVO  CHECK  (ativo IN (0,1))
      )';
  END IF;
END;
/

-- ============================================================
-- SEEDS
-- Todos os 4 canais do future-data-model.md §3.6 "Dados iniciais"
-- ativo=1 apenas para VIA_2 conforme ADR-011 e adr-review.md DQ-010
-- VIA_1, VIA_3, MAPEAMENTO_EXTERNO: ativo=0 (fora do MVP — mvp-scope.md §OUT/Canais)
-- ============================================================
INSERT INTO CANAIS_CAPTACAO (codigo, nome, requer_formulario, ativo)
  SELECT 'VIA_1', 'Via 1 — Formulário Interno (Critério Financeiro)', 1, 0 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM CANAIS_CAPTACAO WHERE codigo = 'VIA_1');

INSERT INTO CANAIS_CAPTACAO (codigo, nome, requer_formulario, ativo)
  SELECT 'VIA_2', 'Via 2 — Formulário Interno (Captação Ativa)', 1, 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM CANAIS_CAPTACAO WHERE codigo = 'VIA_2');

INSERT INTO CANAIS_CAPTACAO (codigo, nome, requer_formulario, ativo)
  SELECT 'VIA_3', 'Via 3 — Registro Simplificado Interno', 1, 0 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM CANAIS_CAPTACAO WHERE codigo = 'VIA_3');

INSERT INTO CANAIS_CAPTACAO (codigo, nome, requer_formulario, ativo)
  SELECT 'MAPEAMENTO_EXTERNO', 'Mapeamento Externo', 0, 0 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM CANAIS_CAPTACAO WHERE codigo = 'MAPEAMENTO_EXTERNO');

COMMIT;
