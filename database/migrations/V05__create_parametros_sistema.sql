-- V05__create_parametros_sistema.sql
-- Fonte: ADR-010 §Schema + future-data-model.md §3.17
-- criado_em: future-data-model.md §3.17 + §1.2 (campos de auditoria)
-- Seeds: ADR-010 §Parâmetros MVP + ADR-006 + future-data-model.md §3.17 "Dados iniciais sugeridos"
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables
  WHERE table_name = 'PARAMETROS_SISTEMA';
  IF v_count = 0 THEN
    -- atualizado_por_id: FK → USUARIOS(id) declarada sem CONSTRAINT formal aqui
    -- USUARIOS não existe em V05; FK adicionada em V29__add_fks_to_support_tables.sql
    EXECUTE IMMEDIATE '
      CREATE TABLE PARAMETROS_SISTEMA (
        id                  NUMBER          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        chave               VARCHAR2(100)   NOT NULL,
        valor               VARCHAR2(1000)  NOT NULL,
        tipo_valor          VARCHAR2(15)    NOT NULL,
        descricao           VARCHAR2(500),
        editavel            NUMBER(1)       DEFAULT 1 NOT NULL,
        criado_em           TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_em       TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_por_id   NUMBER,
        CONSTRAINT UQ_PS_CHAVE  UNIQUE (chave),
        CONSTRAINT CK_PS_TIPO   CHECK  (tipo_valor IN (''TEXTO'',''NUMERO'',''BOOLEANO'',''DATA'',''JSON'')),
        CONSTRAINT CK_PS_EDIT   CHECK  (editavel IN (0,1))
      )';
  END IF;
END;
/

-- ============================================================
-- SEEDS
-- ============================================================

-- Feature flag da migração additive (ADR-006 + ADR-010)
-- editavel=0: não editável via UI; alterado apenas pelo Tech Lead via SQL
INSERT INTO PARAMETROS_SISTEMA (chave, valor, tipo_valor, descricao, editavel)
  SELECT 'FORMULARIO_DESTINO_TABELA', 'LEGADO', 'TEXTO',
         'Destino de escrita do formulário: LEGADO=INOVACAO_INICIATIVAS, NOVO=INICIATIVAS',
         0
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PARAMETROS_SISTEMA WHERE chave = 'FORMULARIO_DESTINO_TABELA');

-- Prazo padrão de análise (ADR-010 + future-data-model.md §3.17)
INSERT INTO PARAMETROS_SISTEMA (chave, valor, tipo_valor, descricao, editavel)
  SELECT 'PRAZO_ANALISE_DIAS', '30', 'NUMERO',
         'Prazo padrão para análise de iniciativas em dias',
         1
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PARAMETROS_SISTEMA WHERE chave = 'PRAZO_ANALISE_DIAS');

-- E-mail da Assessoria para notificações (ADR-010 + future-data-model.md §3.17)
INSERT INTO PARAMETROS_SISTEMA (chave, valor, tipo_valor, descricao, editavel)
  SELECT 'EMAIL_ASSESSORIA', '', 'TEXTO',
         'E-mail da Assessoria para notificações automáticas',
         1
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PARAMETROS_SISTEMA WHERE chave = 'EMAIL_ASSESSORIA');

-- Versão atual do formulário (ADR-010 + future-data-model.md §3.17)
-- editavel=0: alterado apenas junto com deploy de nova versão do formulário
INSERT INTO PARAMETROS_SISTEMA (chave, valor, tipo_valor, descricao, editavel)
  SELECT 'VERSAO_FORMULARIO_ATUAL', 'VIA2_R0', 'TEXTO',
         'Versão atual do formulário Via 2 (ex: VIA2_R0)',
         0
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PARAMETROS_SISTEMA WHERE chave = 'VERSAO_FORMULARIO_ATUAL');

-- Valor de referência da RLC para cálculo do critério financeiro (future-data-model.md §3.17)
INSERT INTO PARAMETROS_SISTEMA (chave, valor, tipo_valor, descricao, editavel)
  SELECT 'RLC_VALOR_REFERENCIA', '0', 'NUMERO',
         'Valor atual da RLC em BRL para cálculo do critério financeiro',
         1
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PARAMETROS_SISTEMA WHERE chave = 'RLC_VALOR_REFERENCIA');

-- Percentual da RLC que aciona relevância financeira (future-data-model.md §3.17)
INSERT INTO PARAMETROS_SISTEMA (chave, valor, tipo_valor, descricao, editavel)
  SELECT 'RLC_PERCENTUAL_GATILHO', '0.0001', 'NUMERO',
         'Percentual da RLC que aciona relevância financeira',
         1
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM PARAMETROS_SISTEMA WHERE chave = 'RLC_PERCENTUAL_GATILHO');

COMMIT;
