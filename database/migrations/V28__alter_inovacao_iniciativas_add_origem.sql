-- V28__alter_inovacao_iniciativas_add_origem.sql
-- Fonte: ADR-013 (Captação Multicanal) §12.1
-- Adiciona as colunas de ORIGEM/PROCEDÊNCIA à base única de iniciativas.
-- Estratégia aditiva (ADR-001): todas as colunas nullable, nenhuma coluna
-- existente é removida ou renomeada, nenhuma tabela nova é criada.
--
-- Também:
--   • faz o backfill de CANAL_CODIGO='VIA_2' / PROPONENTE_TIPO='INTERNO' nos
--     registros legados (RN-12) — só a Via 2 operou até aqui;
--   • gera CODIGO_PUBLICO (INOV-AAAA-NNN) para os registros legados que ainda
--     não têm protocolo (a coluna existe desde a V19 mas nunca foi preenchida);
--   • cria o índice IDX_INI_CANAL para os filtros/indicadores por via;
--   • reforça o domínio das colunas de origem com CHECK constraints.
--
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema: CEDAE_INOVACAO

-- ── 1. Colunas de origem (todas nullable) ────────────────────────────────────
DECLARE
  PROCEDURE add_col_if_not_exists(p_col VARCHAR2, p_def VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tab_columns
    WHERE table_name = 'INOVACAO_INICIATIVAS' AND column_name = UPPER(p_col);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE INOVACAO_INICIATIVAS ADD ' || p_col || ' ' || p_def;
    END IF;
  END;
BEGIN
  add_col_if_not_exists('CANAL_CODIGO',        'VARCHAR2(30)');
  add_col_if_not_exists('PROPONENTE_TIPO',     'VARCHAR2(10)');
  add_col_if_not_exists('ORGANIZACAO_EXTERNA', 'VARCHAR2(300)');
  add_col_if_not_exists('TIPO_INSTITUICAO',    'VARCHAR2(30)');
  add_col_if_not_exists('SISTEMA_ORIGEM',      'VARCHAR2(20)');
  add_col_if_not_exists('CODIGO_ORIGEM',       'VARCHAR2(100)');
  add_col_if_not_exists('REGISTRADO_POR_LOGIN','VARCHAR2(100)');
END;
/

-- ── 2. Backfill do legado: tudo que existe hoje é Via 2 / Interno (RN-12) ─────
UPDATE INOVACAO_INICIATIVAS SET CANAL_CODIGO = 'VIA_2'
 WHERE CANAL_CODIGO IS NULL;

UPDATE INOVACAO_INICIATIVAS SET PROPONENTE_TIPO = 'INTERNO'
 WHERE PROPONENTE_TIPO IS NULL;

COMMIT;

-- ── 3. Backfill de CODIGO_PUBLICO (INOV-AAAA-NNN) para registros legados ──────
-- A coluna existe desde a V19 mas a aplicação nunca a preencheu. Numeramos por
-- ano de criação, na ordem do ID, respeitando qualquer protocolo já existente.
DECLARE
  v_ano   VARCHAR2(4);
  v_seq   NUMBER;
BEGIN
  FOR r IN (
    SELECT ID, TO_CHAR(CRIADO_EM, 'YYYY') AS ANO
      FROM INOVACAO_INICIATIVAS
     WHERE CODIGO_PUBLICO IS NULL
     ORDER BY TO_CHAR(CRIADO_EM, 'YYYY'), ID
  ) LOOP
    IF v_ano IS NULL OR v_ano <> r.ANO THEN
      v_ano := r.ANO;
      SELECT NVL(MAX(TO_NUMBER(SUBSTR(CODIGO_PUBLICO, 11))), 0)
        INTO v_seq
        FROM INOVACAO_INICIATIVAS
       WHERE CODIGO_PUBLICO LIKE 'INOV-' || v_ano || '-%'
         AND REGEXP_LIKE(CODIGO_PUBLICO, '^INOV-[0-9]{4}-[0-9]+$');
    END IF;
    v_seq := v_seq + 1;
    UPDATE INOVACAO_INICIATIVAS
       SET CODIGO_PUBLICO = 'INOV-' || v_ano || '-' || LPAD(v_seq, 3, '0')
     WHERE ID = r.ID;
  END LOOP;
  COMMIT;
END;
/

-- ── 4. Índice por canal (filtros e indicadores por via) ──────────────────────
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IDX_INI_CANAL';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_INI_CANAL ON INOVACAO_INICIATIVAS (CANAL_CODIGO)';
  END IF;
END;
/

-- ── 5. CHECK constraints de domínio (reforço; validação primária na aplicação)─
DECLARE
  PROCEDURE add_check_if_not_exists(p_name VARCHAR2, p_cond VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_constraints
     WHERE constraint_name = p_name AND table_name = 'INOVACAO_INICIATIVAS';
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE INOVACAO_INICIATIVAS ADD CONSTRAINT ' ||
        p_name || ' CHECK (' || p_cond || ')';
    END IF;
  END;
BEGIN
  add_check_if_not_exists('CK_INI_PROP_TIPO',
    'PROPONENTE_TIPO IS NULL OR PROPONENTE_TIPO IN (''INTERNO'',''EXTERNO'')');
  add_check_if_not_exists('CK_INI_SIST_ORIGEM',
    'SISTEMA_ORIGEM IS NULL OR SISTEMA_ORIGEM IN (''SGE'',''SGP'')');
  add_check_if_not_exists('CK_INI_TIPO_INST',
    'TIPO_INSTITUICAO IS NULL OR TIPO_INSTITUICAO IN ' ||
    '(''ICT'',''UNIVERSIDADE'',''EMPRESA_PUBLICA'',''PARCERIA'',''OUTRO'')');
END;
/

COMMIT;
