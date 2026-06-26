-- V13__seed_transicoes_status_mvp.sql
-- Fonte: database-migration-plan.md §3/V13 + ADR-012 (3 transições ativas do MVP)
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

-- SUBMETIDA → EM_ANALISE (Iniciar análise)
INSERT INTO TRANSICOES_STATUS (status_origem, status_destino, perfil_requerido, justificativa_obrig, notificar_proponente, descricao)
  SELECT 'SUBMETIDA', 'EM_ANALISE', 'ANALISTA_ASSESSORIA', 0, 0, 'Iniciar análise da iniciativa'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM TRANSICOES_STATUS
    WHERE status_origem = 'SUBMETIDA' AND status_destino = 'EM_ANALISE' AND perfil_requerido = 'ANALISTA_ASSESSORIA'
  );

-- EM_ANALISE → APROVADA
INSERT INTO TRANSICOES_STATUS (status_origem, status_destino, perfil_requerido, justificativa_obrig, notificar_proponente, descricao)
  SELECT 'EM_ANALISE', 'APROVADA', 'ANALISTA_ASSESSORIA', 0, 1, 'Aprovar iniciativa'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM TRANSICOES_STATUS
    WHERE status_origem = 'EM_ANALISE' AND status_destino = 'APROVADA' AND perfil_requerido = 'ANALISTA_ASSESSORIA'
  );

-- EM_ANALISE → REPROVADA (justificativa obrigatória)
INSERT INTO TRANSICOES_STATUS (status_origem, status_destino, perfil_requerido, justificativa_obrig, notificar_proponente, descricao)
  SELECT 'EM_ANALISE', 'REPROVADA', 'ANALISTA_ASSESSORIA', 1, 1, 'Reprovar iniciativa (justificativa obrigatória)'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM TRANSICOES_STATUS
    WHERE status_origem = 'EM_ANALISE' AND status_destino = 'REPROVADA' AND perfil_requerido = 'ANALISTA_ASSESSORIA'
  );

COMMIT;
