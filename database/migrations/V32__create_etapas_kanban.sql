-- V32__create_etapas_kanban.sql
-- Etapas operacionais do Quadro Kanban.
--
-- O quadro deixa de ter uma coluna por STATUS e passa a ter uma coluna por
-- ETAPA — 15 etapas de trabalho da Assessoria. O STATUS continua existindo e
-- continua sendo a decisão formal (ADR-002B/ADR-012): cada etapa está vinculada
-- a exatamente um status, e o status da iniciativa é sempre o da etapa em que
-- ela está.
--
--   Etapa                                                   Status vinculado
--   ─────────────────────────────────────────────────────── ────────────────
--    1 Recebimento                                          SUBMETIDA
--    2 Verificação de lacunas, preenchimento e consolidação EM_ANALISE
--    3 Análise inicial                                      EM_ANALISE
--    4 Agendamento de reuniões                              EM_ANALISE
--    5 Reuniões agendadas                                   EM_ANALISE
--    6 Identificação da necessidade de articulações         EM_ANALISE
--    7 Acompanhamento após homologação                      HOMOLOGADA
--    8 Estruturar projeto futuro                            HOMOLOGADA
--    9 Modelagem de instrumentos técnicos e jurídicos       HOMOLOGADA
--   10 Conexão com academia/universidades                   HOMOLOGADA
--   11 Conexão com mercado/startups                         HOMOLOGADA
--   12 Sinergia interna/conexão interdepartamental          HOMOLOGADA
--   13 Monitoramento corporativo                            HOMOLOGADA
--   14 Apoio diagnóstico                                    HOMOLOGADA
--   15 Desqualificados                                      DESCLASSIFICADA
--
-- Mover entre etapas do MESMO status é livre (ADM e CONTRIBUTOR). Mover para
-- uma etapa de OUTRO status é uma tramitação de status e segue o catálogo
-- TRANSICOES_STATUS e as regras de perfil do WorkflowService (homologar,
-- desclassificar e reverter continuam exclusivos de ADM).
--
-- Estratégia aditiva (ADR-001):
--   1. ETAPAS_KANBAN      — catálogo (workflow como dado, ADR-004)
--   2. HISTORICO_ETAPA    — trilha das movimentações (quem, quando, de/para)
--   3. INOVACAO_INICIATIVAS.ETAPA_CODIGO — etapa atual (nullable)
--   4. Backfill: cada iniciativa vai para a 1ª etapa do seu status
--   5. DEFAULT 'RECEBIMENTO' na coluna — novas submissões nascem em Recebimento
--
-- Resolução de schema: mesma abordagem da V31 (dono resolvido em tempo de
-- execução via ALL_TABLES, DDL qualificado). Pode rodar conectado como
-- CEDAE_INOVACAO ou como usuário com privilégio sobre o schema.
--
-- Relatório por DBMS_OUTPUT (SQL Developer: aba "Saída do DBMS").
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema alvo: CEDAE_INOVACAO

DECLARE
  c_schema_padrao CONSTANT VARCHAR2(128) := 'CEDAE_INOVACAO';

  v_owner  VARCHAR2(128);
  v_ini    VARCHAR2(300);   -- "OWNER"."INOVACAO_INICIATIVAS"
  v_etapas VARCHAR2(300);   -- "OWNER"."ETAPAS_KANBAN"
  v_hist   VARCHAR2(300);   -- "OWNER"."HISTORICO_ETAPA"
  v_n      NUMBER;

  FUNCTION dono_de(p_tabela VARCHAR2) RETURN VARCHAR2 IS
    v_o VARCHAR2(128);
    v_c NUMBER;
  BEGIN
    SELECT MAX(owner) INTO v_o FROM all_tables
     WHERE table_name = p_tabela AND owner = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');
    IF v_o IS NOT NULL THEN RETURN v_o; END IF;

    SELECT MAX(owner) INTO v_o FROM all_tables
     WHERE table_name = p_tabela AND owner = c_schema_padrao;
    IF v_o IS NOT NULL THEN RETURN v_o; END IF;

    SELECT COUNT(*) INTO v_c FROM all_tables WHERE table_name = p_tabela;
    IF v_c = 1 THEN
      SELECT owner INTO v_o FROM all_tables WHERE table_name = p_tabela;
      RETURN v_o;
    END IF;
    RETURN NULL;
  END dono_de;

  PROCEDURE informar(p_msg VARCHAR2) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE('[V32] ' || p_msg);
  END informar;

  FUNCTION tem_tabela(p_tabela VARCHAR2) RETURN BOOLEAN IS
    v_c NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_c FROM all_tables WHERE owner = v_owner AND table_name = p_tabela;
    RETURN v_c > 0;
  END tem_tabela;

  FUNCTION tem_coluna(p_tabela VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
    v_c NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_c FROM all_tab_columns
     WHERE owner = v_owner AND table_name = p_tabela AND column_name = p_col;
    RETURN v_c > 0;
  END tem_coluna;

  FUNCTION tem_indice(p_nome VARCHAR2) RETURN BOOLEAN IS
    v_c NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_c FROM all_indexes WHERE owner = v_owner AND index_name = p_nome;
    RETURN v_c > 0;
  END tem_indice;

  /* Upsert de uma etapa: reexecutar a migration realinha rótulo, ordem e
     status vinculado com esta fonte — o catálogo é mantido aqui. */
  PROCEDURE seed_etapa(p_codigo VARCHAR2, p_rotulo VARCHAR2, p_status VARCHAR2,
                       p_ordem NUMBER) IS
  BEGIN
    EXECUTE IMMEDIATE
      'MERGE INTO ' || v_etapas || ' e
       USING (SELECT :1 AS codigo, :2 AS rotulo_pt, :3 AS status_vinculado, :4 AS ordem FROM DUAL) s
          ON (e.codigo = s.codigo)
       WHEN MATCHED THEN UPDATE SET
            e.rotulo_pt = s.rotulo_pt, e.status_vinculado = s.status_vinculado,
            e.ordem = s.ordem, e.ativo = 1, e.atualizado_em = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (codigo, rotulo_pt, status_vinculado, ordem)
            VALUES (s.codigo, s.rotulo_pt, s.status_vinculado, s.ordem)'
      USING p_codigo, p_rotulo, p_status, p_ordem;
  END seed_etapa;

BEGIN
  -- ── 0. Resolução de schema ───────────────────────────────────────────────
  v_owner := dono_de('INOVACAO_INICIATIVAS');
  IF v_owner IS NULL THEN
    RAISE_APPLICATION_ERROR(-20032,
      'V32 abortada: INOVACAO_INICIATIVAS não visível para esta sessão | conectado como ' ||
      SYS_CONTEXT('USERENV', 'SESSION_USER') || ', schema corrente ' ||
      SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') || '. Conecte-se como ' || c_schema_padrao ||
      ' (ou ALTER SESSION SET CURRENT_SCHEMA = ' || c_schema_padrao || ') e rode novamente.');
  END IF;

  v_ini    := '"' || v_owner || '"."INOVACAO_INICIATIVAS"';
  v_etapas := '"' || v_owner || '"."ETAPAS_KANBAN"';
  v_hist   := '"' || v_owner || '"."HISTORICO_ETAPA"';
  informar('alvo: schema ' || v_owner);

  -- ── 1. Catálogo de etapas ────────────────────────────────────────────────
  IF tem_tabela('ETAPAS_KANBAN') THEN
    informar('ETAPAS_KANBAN já existe — nada a fazer.');
  ELSE
    EXECUTE IMMEDIATE 'CREATE TABLE ' || v_etapas || ' (
        id               NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        codigo           VARCHAR2(50)   NOT NULL,
        rotulo_pt        VARCHAR2(200)  NOT NULL,
        status_vinculado VARCHAR2(50)   NOT NULL,
        ordem            NUMBER(5)      DEFAULT 0 NOT NULL,
        ativo            NUMBER(1)      DEFAULT 1 NOT NULL,
        criado_em        TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        atualizado_em    TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT UQ_EK_CODIGO UNIQUE (codigo),
        CONSTRAINT CK_EK_ATIVO  CHECK (ativo IN (0,1)),
        CONSTRAINT CK_EK_STATUS CHECK (status_vinculado IN
          (''SUBMETIDA'',''EM_ANALISE'',''HOMOLOGADA'',''DESCLASSIFICADA''))
      )';
    informar('ETAPAS_KANBAN criada.');
  END IF;

  seed_etapa('RECEBIMENTO',                'Recebimento',                                          'SUBMETIDA',        1);
  seed_etapa('VERIFICACAO_LACUNAS',        'Verificação de lacunas, preenchimento e consolidação', 'EM_ANALISE',       2);
  seed_etapa('ANALISE_INICIAL',            'Análise inicial',                                      'EM_ANALISE',       3);
  seed_etapa('AGENDAMENTO_REUNIOES',       'Agendamento de reuniões',                              'EM_ANALISE',       4);
  seed_etapa('REUNIOES_AGENDADAS',         'Reuniões agendadas',                                   'EM_ANALISE',       5);
  seed_etapa('IDENTIFICACAO_ARTICULACOES', 'Identificação da necessidade de articulações',         'EM_ANALISE',       6);
  seed_etapa('ACOMPANHAMENTO_POS_HOMOLOG', 'Acompanhamento após homologação',                      'HOMOLOGADA',       7);
  seed_etapa('ESTRUTURAR_PROJETO_FUTURO',  'Estruturar projeto futuro',                            'HOMOLOGADA',       8);
  seed_etapa('MODELAGEM_INSTRUMENTOS',     'Modelagem de instrumentos técnicos e jurídicos',       'HOMOLOGADA',       9);
  seed_etapa('CONEXAO_ACADEMIA',           'Conexão com academia/universidades',                   'HOMOLOGADA',      10);
  seed_etapa('CONEXAO_MERCADO',            'Conexão com mercado/startups',                         'HOMOLOGADA',      11);
  seed_etapa('SINERGIA_INTERNA',           'Sinergia interna/conexão interdepartamental',          'HOMOLOGADA',      12);
  seed_etapa('MONITORAMENTO_CORPORATIVO',  'Monitoramento corporativo',                            'HOMOLOGADA',      13);
  seed_etapa('APOIO_DIAGNOSTICO',          'Apoio diagnóstico',                                    'HOMOLOGADA',      14);
  seed_etapa('DESQUALIFICADOS',            'Desqualificados',                                      'DESCLASSIFICADA', 15);
  COMMIT;
  informar('15 etapas cadastradas/atualizadas.');

  -- ── 2. Histórico de movimentação entre etapas ────────────────────────────
  -- Tabela própria: HISTORICO_STATUS é imutável e registra decisões de status
  -- (ADR-005); mover um cartão dentro do mesmo status não é uma decisão.
  IF tem_tabela('HISTORICO_ETAPA') THEN
    informar('HISTORICO_ETAPA já existe — nada a fazer.');
  ELSE
    EXECUTE IMMEDIATE 'CREATE TABLE ' || v_hist || ' (
        id              NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        iniciativa_id   NUMBER         NOT NULL,
        etapa_anterior  VARCHAR2(50),
        etapa_nova      VARCHAR2(50)   NOT NULL,
        usuario_login   VARCHAR2(100),
        justificativa   CLOB,
        data_hora       TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
      )';
    informar('HISTORICO_ETAPA criada.');
  END IF;

  IF NOT tem_indice('IDX_HE_INICIATIVA') THEN
    EXECUTE IMMEDIATE 'CREATE INDEX "' || v_owner || '"."IDX_HE_INICIATIVA" ON ' ||
                      v_hist || ' (iniciativa_id, data_hora)';
    informar('índice IDX_HE_INICIATIVA criado.');
  END IF;

  -- ── 3. Etapa atual da iniciativa ─────────────────────────────────────────
  IF tem_coluna('INOVACAO_INICIATIVAS', 'ETAPA_CODIGO') THEN
    informar('coluna ETAPA_CODIGO já existe — nada a fazer.');
  ELSE
    -- Sem DEFAULT aqui: com DEFAULT o Oracle preencheria todo o acervo com
    -- RECEBIMENTO, inclusive homologadas. O backfill abaixo decide por status.
    EXECUTE IMMEDIATE 'ALTER TABLE ' || v_ini || ' ADD ETAPA_CODIGO VARCHAR2(50)';
    informar('coluna ETAPA_CODIGO criada.');
  END IF;

  -- ── 4. Backfill: 1ª etapa (menor ordem) do status atual ──────────────────
  -- Status fora da esteira (legado) ficam sem etapa: o quadro os mostra numa
  -- coluna própria em vez de escondê-los.
  EXECUTE IMMEDIATE
    'UPDATE ' || v_ini || ' i
        SET i.ETAPA_CODIGO = (
              SELECT MIN(e.codigo) KEEP (DENSE_RANK FIRST ORDER BY e.ordem)
                FROM ' || v_etapas || ' e
               WHERE e.status_vinculado = NVL(i.STATUS, ''SUBMETIDA'') AND e.ativo = 1)
      WHERE i.ETAPA_CODIGO IS NULL';
  v_n := SQL%ROWCOUNT;
  COMMIT;
  informar('backfill: ' || v_n || ' iniciativa(s) posicionadas na etapa inicial do seu status.');

  -- ── 5. Novas submissões nascem em Recebimento ────────────────────────────
  EXECUTE IMMEDIATE 'ALTER TABLE ' || v_ini || ' MODIFY (ETAPA_CODIGO DEFAULT ''RECEBIMENTO'')';
  informar('DEFAULT ''RECEBIMENTO'' aplicado em ETAPA_CODIGO.');

  informar('concluída com sucesso.');
END;
/
