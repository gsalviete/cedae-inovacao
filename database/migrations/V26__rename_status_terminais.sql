-- V26__rename_status_terminais.sql
-- Renomeia os dois status terminais do workflow para a linguagem de negócio atual:
--   APROVADA  → HOMOLOGADA       (tipo de evento APROVACAO  → HOMOLOGACAO)
--   REPROVADA → DESCLASSIFICADA  (tipo de evento REPROVACAO → DESCLASSIFICACAO)
--
-- Os códigos são referenciados por VARCHAR2 (ADR-002B §Regras item 3), então a
-- renomeação precisa alcançar tanto os catálogos (STATUS_WORKFLOW,
-- TRANSICOES_STATUS) quanto os dados já gravados (INOVACAO_INICIATIVAS,
-- HISTORICO_STATUS) — caso contrário iniciativas já tramitadas ficariam com um
-- status órfão, sem rótulo e sem transições.
--
-- ATENÇÃO — reescrita de auditoria:
-- HISTORICO_STATUS é imutável por trigger (TRG_HS_NO_UPD_DEL, ADR-005). Esta
-- migration DESABILITA a trigger para reescrever os eventos antigos e a reabilita
-- em seguida. É uma exceção consciente e pontual à imutabilidade, decidida para
-- manter a nomenclatura do histórico coerente com a nova. ADR-005 precisa ser
-- atualizado registrando esta exceção.
--
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema: CEDAE_INOVACAO

-- ── Catálogo de estados ──────────────────────────────────────────────────────
-- STATUS_WORKFLOW pode não existir no schema (a V02 não foi aplicada em todos os
-- ambientes, e o backend não consulta esta tabela). Guardado para não abortar.
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'STATUS_WORKFLOW';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE q'[UPDATE STATUS_WORKFLOW SET codigo = 'HOMOLOGADA', rotulo_pt = 'Homologada', atualizado_em = SYSTIMESTAMP WHERE codigo = 'APROVADA']';
    EXECUTE IMMEDIATE q'[UPDATE STATUS_WORKFLOW SET codigo = 'DESCLASSIFICADA', rotulo_pt = 'Desclassificada', atualizado_em = SYSTIMESTAMP WHERE codigo = 'REPROVADA']';
  END IF;
END;
/

-- ── Transições ───────────────────────────────────────────────────────────────
UPDATE TRANSICOES_STATUS
   SET status_destino = 'HOMOLOGADA', descricao = 'Homologar iniciativa'
 WHERE status_destino = 'APROVADA';

UPDATE TRANSICOES_STATUS
   SET status_destino = 'DESCLASSIFICADA',
       descricao = 'Desclassificar iniciativa (justificativa obrigatória)'
 WHERE status_destino = 'REPROVADA';

-- Defensivo: ambos são terminais hoje (não há transição saindo deles), mas se
-- alguma for cadastrada no futuro, a origem também precisa acompanhar o código.
UPDATE TRANSICOES_STATUS SET status_origem = 'HOMOLOGADA'      WHERE status_origem = 'APROVADA';
UPDATE TRANSICOES_STATUS SET status_origem = 'DESCLASSIFICADA' WHERE status_origem = 'REPROVADA';

-- ── Dados: iniciativas ───────────────────────────────────────────────────────
UPDATE INOVACAO_INICIATIVAS SET STATUS = 'HOMOLOGADA'      WHERE STATUS = 'APROVADA';
UPDATE INOVACAO_INICIATIVAS SET STATUS = 'DESCLASSIFICADA' WHERE STATUS = 'REPROVADA';

COMMIT;

-- ── Dados: histórico (exceção à imutabilidade) ───────────────────────────────
-- Ordem obrigatória:
--   1. derrubar CK_HS_TIPO  (ela só aceita os tipos antigos)
--   2. desabilitar a trigger de imutabilidade
--   3. reescrever os registros
--   4. reabilitar a trigger  (garantido pelo EXCEPTION, mesmo se o UPDATE falhar)
--   5. recriar CK_HS_TIPO com os tipos novos
-- ALTER é DDL e faz commit implícito, então os UPDATEs abaixo não são reversíveis
-- por rollback — faça backup da tabela antes de rodar em produção.
DECLARE
  v_count           NUMBER;
  v_trigger_existe  BOOLEAN := FALSE;
BEGIN
  -- 1. Constraint antiga fora do caminho.
  SELECT COUNT(*) INTO v_count
    FROM user_constraints
   WHERE constraint_name = 'CK_HS_TIPO' AND table_name = 'HISTORICO_STATUS';
  IF v_count > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE HISTORICO_STATUS DROP CONSTRAINT CK_HS_TIPO';
  END IF;

  -- 2. Trigger de imutabilidade fora do caminho.
  SELECT COUNT(*) INTO v_count
    FROM user_triggers
   WHERE trigger_name = 'TRG_HS_NO_UPD_DEL';
  v_trigger_existe := v_count > 0;

  IF v_trigger_existe THEN
    EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_HS_NO_UPD_DEL DISABLE';
  END IF;

  -- 3. Reescrita. Qualquer falha aqui reabilita a trigger antes de propagar.
  BEGIN
    UPDATE HISTORICO_STATUS SET status_anterior = 'HOMOLOGADA'      WHERE status_anterior = 'APROVADA';
    UPDATE HISTORICO_STATUS SET status_anterior = 'DESCLASSIFICADA' WHERE status_anterior = 'REPROVADA';
    UPDATE HISTORICO_STATUS SET status_novo     = 'HOMOLOGADA'      WHERE status_novo     = 'APROVADA';
    UPDATE HISTORICO_STATUS SET status_novo     = 'DESCLASSIFICADA' WHERE status_novo     = 'REPROVADA';

    UPDATE HISTORICO_STATUS SET tipo_evento = 'HOMOLOGACAO'      WHERE tipo_evento = 'APROVACAO';
    UPDATE HISTORICO_STATUS SET tipo_evento = 'DESCLASSIFICACAO' WHERE tipo_evento = 'REPROVACAO';

    COMMIT;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      IF v_trigger_existe THEN
        EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_HS_NO_UPD_DEL ENABLE';
      END IF;
      RAISE;
  END;

  -- 4. Imutabilidade de volta.
  IF v_trigger_existe THEN
    EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_HS_NO_UPD_DEL ENABLE';
  END IF;

  -- 5. Constraint nova. Só valida agora que não resta nenhum tipo antigo.
  SELECT COUNT(*) INTO v_count
    FROM user_constraints
   WHERE constraint_name = 'CK_HS_TIPO' AND table_name = 'HISTORICO_STATUS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      ALTER TABLE HISTORICO_STATUS ADD CONSTRAINT CK_HS_TIPO CHECK (tipo_evento IN (
        ''SUBMISSAO'',''TRIAGEM'',''ANALISE'',''HOMOLOGACAO'',''DESCLASSIFICACAO'',''CORRECAO''
      ))';
  END IF;
END;
/

COMMIT;
