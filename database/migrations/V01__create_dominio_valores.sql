-- V01__create_dominio_valores.sql
-- Fonte: database-migration-plan.md §3/V01 + future-data-model.md §3.1 + ADR-002
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables
  WHERE table_name = 'DOMINIO_VALORES';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE DOMINIO_VALORES (
        id            NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        dominio       VARCHAR2(50)   NOT NULL,
        codigo        VARCHAR2(50)   NOT NULL,
        rotulo_pt     VARCHAR2(200)  NOT NULL,
        descricao     CLOB,
        ordem         NUMBER(5)      DEFAULT 0 NOT NULL,
        ativo         NUMBER(1)      DEFAULT 1 NOT NULL,
        metadados     VARCHAR2(4000),
        criado_em     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_em TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT UQ_DV_DOM_COD UNIQUE (dominio, codigo),
        CONSTRAINT CK_DV_ATIVO   CHECK  (ativo IN (0,1))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_DV_DOMINIO ON DOMINIO_VALORES (dominio, ativo)';
  END IF;
END;
/

-- ============================================================
-- SEEDS — ESTAGIO_MATURIDADE
-- Fonte: database-migration-plan.md §3/V01 + future-data-model.md §3.1
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'ESTAGIO_MATURIDADE', 'IDEACAO', 'Ideação', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'ESTAGIO_MATURIDADE' AND codigo = 'IDEACAO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'ESTAGIO_MATURIDADE', 'PILOTO', 'Teste / Piloto (MVP)', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'ESTAGIO_MATURIDADE' AND codigo = 'PILOTO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'ESTAGIO_MATURIDADE', 'ESCALA', 'Escala / Operação Ativa', 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'ESTAGIO_MATURIDADE' AND codigo = 'ESCALA');

-- ============================================================
-- SEEDS — DIMENSAO_INOVACAO
-- Fonte: database-migration-plan.md §3/V01 + future-data-model.md §3.1
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO', 'TECNOLOGICA', 'Inovação Tecnológica', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'DIMENSAO_INOVACAO' AND codigo = 'TECNOLOGICA');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO', 'OPERACIONAL', 'Inovação Operacional', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'DIMENSAO_INOVACAO' AND codigo = 'OPERACIONAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO', 'GERENCIAL', 'Inovação Gerencial / Administrativa', 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'DIMENSAO_INOVACAO' AND codigo = 'GERENCIAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO', 'SOCIAL_AMBIENTAL', 'Inovação Social e Ambiental', 4 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'DIMENSAO_INOVACAO' AND codigo = 'SOCIAL_AMBIENTAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO', 'MULTIDIMENSIONAL', 'Multidimensional / Outro', 5 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'DIMENSAO_INOVACAO' AND codigo = 'MULTIDIMENSIONAL');

-- ============================================================
-- SEEDS — GRAU_IMPACTO
-- Fonte: database-migration-plan.md §3/V01 + future-data-model.md §3.1
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'GRAU_IMPACTO', 'INCREMENTAL', 'Incremental', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'GRAU_IMPACTO' AND codigo = 'INCREMENTAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'GRAU_IMPACTO', 'RADICAL', 'Radical / Disruptivo', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'GRAU_IMPACTO' AND codigo = 'RADICAL');

-- ============================================================
-- SEEDS — TIPO_SUPORTE
-- Fonte: database-migration-plan.md §3/V01 + future-data-model.md §3.1
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'MODELAGEM_TR_ACT', 'Modelagem de TR/ACT', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'MODELAGEM_TR_ACT');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'CONEXAO_ICT', 'Conexão com Academia / ICTs', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'CONEXAO_ICT');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'CONEXAO_MERCADO', 'Conexão com Mercado / Startups', 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'CONEXAO_MERCADO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'CONEXAO_INTERSETORIAL', 'Sinergia Interna / Conexão Interdepartamental', 4 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'CONEXAO_INTERSETORIAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'MONITORAMENTO', 'Apenas Monitoramento Corporativo', 5 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'MONITORAMENTO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'APOIO_DIAGNOSTICO', 'Apoio Diagnóstico / Mentoria', 6 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'APOIO_DIAGNOSTICO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE', 'OUTRO', 'Outro', 7 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_SUPORTE' AND codigo = 'OUTRO');

-- ============================================================
-- SEEDS — QUALIFICACAO
-- Fonte: database-migration-plan.md §3/V01 + future-data-model.md §3.1
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'QUALIFICACAO', 'PROJETO_COMPLEXO', 'Projeto — Metodologia Complexa', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'QUALIFICACAO' AND codigo = 'PROJETO_COMPLEXO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'QUALIFICACAO', 'ACAO_SIMPLIFICADA', 'Ação — Rito Simplificado', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'QUALIFICACAO' AND codigo = 'ACAO_SIMPLIFICADA');

-- ============================================================
-- SEEDS — TIPO_ANOTACAO
-- Fonte: database-migration-plan.md §3/V01
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_ANOTACAO', 'COMENTARIO_PROPONENTE', 'Comentário do Proponente', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_ANOTACAO' AND codigo = 'COMENTARIO_PROPONENTE');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_ANOTACAO', 'NOTA_TECNICA', 'Nota Técnica (interna)', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_ANOTACAO' AND codigo = 'NOTA_TECNICA');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_ANOTACAO', 'COMUNICADO', 'Comunicado ao Proponente', 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'TIPO_ANOTACAO' AND codigo = 'COMUNICADO');

-- ============================================================
-- SEEDS — VISIBILIDADE_ANOTACAO
-- Fonte: database-migration-plan.md §3/V01
-- ============================================================
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'VISIBILIDADE_ANOTACAO', 'PUBLICA', 'Pública', 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'VISIBILIDADE_ANOTACAO' AND codigo = 'PUBLICA');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'VISIBILIDADE_ANOTACAO', 'INTERNA', 'Interna', 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio = 'VISIBILIDADE_ANOTACAO' AND codigo = 'INTERNA');

COMMIT;
