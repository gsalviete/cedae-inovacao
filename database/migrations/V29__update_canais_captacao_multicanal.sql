-- V29__update_canais_captacao_multicanal.sql
-- Fonte: ADR-013 (Captação Multicanal) §1.3 e §12.2
-- Reconciliação de nomenclatura dos canais e ativação das quatro vias.
--
-- Os CÓDIGOS dos canais (VIA_1, VIA_2, VIA_3, MAPEAMENTO_EXTERNO) são imutáveis
-- por estabilidade — apenas nome/descrição são atualizados, e VIA_1/VIA_3/
-- MAPEAMENTO_EXTERNO passam a ativo=1 (RN-11).
--
-- A tabela CANAIS_CAPTACAO deveria existir desde a V03, mas — assim como a V02
-- (ver nota na V26) — a V03 não foi aplicada em todos os ambientes. Esta
-- migration é, portanto, auto-suficiente: garante a existência da tabela antes
-- do upsert (mesmo DDL da V03) e então aplica os rótulos/ativação.
--
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema: CEDAE_INOVACAO

-- ── 1. Garante a existência da tabela (DDL idêntico à V03) ────────────────────
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

-- ── 2. Upsert dos quatro canais com os rótulos oficiais (§1.3) e ativação ─────
MERGE INTO CANAIS_CAPTACAO c
USING (
  SELECT 'VIA_1' AS codigo,
         'Registro de Sistemas Corporativos (SGE/SGP)' AS nome,
         'Iniciativas identificadas manualmente pelo analista nos sistemas corporativos SGE/SGP e cadastradas no Banco de Dados de Inovacao. Cadastro manual - sem qualquer integracao automatica.' AS descricao,
         1 AS ativo FROM DUAL
  UNION ALL
  SELECT 'VIA_2',
         'Formulário Interno de Submissão',
         'Formulario publico de autosservico preenchido pelo proprio colaborador proponente.',
         1 FROM DUAL
  UNION ALL
  SELECT 'VIA_3',
         'Registro de Reuniões com Áreas',
         'Iniciativas levantadas em reunioes com as areas e cadastradas manualmente pelo analista.',
         1 FROM DUAL
  UNION ALL
  SELECT 'MAPEAMENTO_EXTERNO',
         'Captação Externa',
         'Iniciativas oriundas de ICTs, universidades, empresas publicas e parceiros externos, cadastradas manualmente pelo analista.',
         1 FROM DUAL
) src
ON (c.codigo = src.codigo)
WHEN MATCHED THEN UPDATE SET
  c.nome          = src.nome,
  c.descricao     = src.descricao,
  c.ativo         = src.ativo,
  c.atualizado_em = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (codigo, nome, descricao, requer_formulario, ativo)
  VALUES (src.codigo, src.nome, src.descricao, 1, src.ativo);

COMMIT;
