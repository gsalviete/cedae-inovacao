-- V27__solucao_opcional_e_macrodimensao_obs.sql
-- 1. SOLUCAO_PROPOSTA deixa de ser obrigatória (era CLOB NOT NULL). Sem isso, o
--    formulário aceitaria o campo vazio mas o INSERT quebraria com ORA-01400:
--    o Oracle trata string vazia como NULL.
-- 2. Nova coluna MACRODIMENSAO_OBSERVACAO, preenchida quando o proponente
--    escolhe a macrodimensão "Outros / Multidimensionais" — mesmo padrão já
--    usado por DIAGNOSTICO_OBSERVACAO (V22).
--
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  -- 1. Remove o NOT NULL apenas se ele ainda estiver lá (MODIFY é idempotente
  --    na prática, mas repetir gera ORA-01451 em algumas versões).
  SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
   WHERE table_name  = 'INOVACAO_INICIATIVAS'
     AND column_name = 'SOLUCAO_PROPOSTA'
     AND nullable    = 'N';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE INOVACAO_INICIATIVAS MODIFY (SOLUCAO_PROPOSTA NULL)';
  END IF;

  -- 2. Coluna nova para o texto livre da macrodimensão "Outros".
  SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
   WHERE table_name  = 'INOVACAO_INICIATIVAS'
     AND column_name = 'MACRODIMENSAO_OBSERVACAO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE INOVACAO_INICIATIVAS ADD (MACRODIMENSAO_OBSERVACAO VARCHAR2(2000))';
  END IF;
END;
/

COMMIT;
