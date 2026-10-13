-- V33__ajuste_etapas_kanban_e_observacoes_automaticas.sql
-- Revisão do catálogo de etapas do Quadro Kanban e observações automáticas.
--
-- 1. Etapas
--    - Saem do quadro (ativo = 0, catálogo preservado para o histórico):
--        VERIFICACAO_LACUNAS        (antiga 2)
--        ACOMPANHAMENTO_POS_HOMOLOG (antiga 7)
--    - IDENTIFICACAO_ARTICULACOES passa a se chamar "Homologação da iniciativa".
--    - MONITORAMENTO_CORPORATIVO (antiga 13) assume o lugar da antiga 7.
--    - A ordem é renumerada em sequência (o quadro exibe a ordem como número):
--
--      Ordem  Etapa                                            Status vinculado
--      ─────  ───────────────────────────────────────────────  ────────────────
--        1    Recebimento                                      SUBMETIDA
--        2    Análise inicial                                  EM_ANALISE
--        3    Agendamento de reuniões                          EM_ANALISE
--        4    Reuniões agendadas                               EM_ANALISE
--        5    Homologação da iniciativa                        EM_ANALISE
--        6    Monitoramento corporativo                        HOMOLOGADA
--        7    Estruturar projeto futuro                        HOMOLOGADA
--        8    Modelagem de instrumentos técnicos e jurídicos   HOMOLOGADA
--        9    Conexão com academia/universidades               HOMOLOGADA
--       10    Conexão com mercado/startups                     HOMOLOGADA
--       11    Sinergia interna/conexão interdepartamental      HOMOLOGADA
--       12    Apoio diagnóstico                                HOMOLOGADA
--       13    Desqualificados                                  DESCLASSIFICADA
--
--    - Iniciativas paradas nas etapas desativadas são realocadas, sem mudar de
--      status: Verificação de lacunas → Análise inicial; Acompanhamento após
--      homologação → Monitoramento corporativo. A realocação fica registrada em
--      HISTORICO_ETAPA e como observação automática.
--
-- 2. INICIATIVA_OBSERVACOES.ORIGEM
--    Distingue a anotação livre (MANUAL) das observações que o sistema grava
--    sozinho: EDICAO (alteração de campos na tela de detalhe) e MOVIMENTACAO
--    (mudança de etapa no quadro). Observações automáticas são trilha de
--    auditoria e não podem ser editadas.
--
-- ATENÇÃO: não reexecute a V32 depois desta — o seed dela reativa as etapas e
-- restaura rótulos e ordem antigos.
--
-- Resolução de schema: mesma abordagem da V31/V32.
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema alvo: CEDAE_INOVACAO

DECLARE
  c_schema_padrao CONSTANT VARCHAR2(128) := 'CEDAE_INOVACAO';

  v_owner  VARCHAR2(128);
  v_ini    VARCHAR2(300);   -- "OWNER"."INOVACAO_INICIATIVAS"
  v_etapas VARCHAR2(300);   -- "OWNER"."ETAPAS_KANBAN"
  v_hist   VARCHAR2(300);   -- "OWNER"."HISTORICO_ETAPA"
  v_obs    VARCHAR2(300);   -- "OWNER"."INICIATIVA_OBSERVACOES"
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
    DBMS_OUTPUT.PUT_LINE('[V33] ' || p_msg);
  END informar;

  FUNCTION tem_coluna(p_tabela VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
    v_c NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_c FROM all_tab_columns
     WHERE owner = v_owner AND table_name = p_tabela AND column_name = p_col;
    RETURN v_c > 0;
  END tem_coluna;

  FUNCTION tem_constraint(p_nome VARCHAR2) RETURN BOOLEAN IS
    v_c NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_c FROM all_constraints
     WHERE owner = v_owner AND constraint_name = p_nome;
    RETURN v_c > 0;
  END tem_constraint;

  PROCEDURE ajustar_etapa(p_codigo VARCHAR2, p_rotulo VARCHAR2, p_ordem NUMBER,
                          p_ativo NUMBER) IS
  BEGIN
    EXECUTE IMMEDIATE
      'UPDATE ' || v_etapas || '
          SET rotulo_pt = :1, ordem = :2, ativo = :3, atualizado_em = SYSTIMESTAMP
        WHERE codigo = :4'
      USING p_rotulo, p_ordem, p_ativo, p_codigo;
  END ajustar_etapa;

  /* Leva para p_destino as iniciativas paradas em p_origem, registrando a
     movimentação no histórico de etapas e como observação automática. */
  PROCEDURE realocar(p_origem VARCHAR2, p_destino VARCHAR2,
                     p_rot_origem VARCHAR2, p_rot_destino VARCHAR2) IS
    v_motivo VARCHAR2(400) :=
      'Etapa "' || p_rot_origem || '" removida do quadro (V33); realocação automática.';
  BEGIN
    EXECUTE IMMEDIATE
      'INSERT INTO ' || v_hist || '
         (iniciativa_id, etapa_anterior, etapa_nova, usuario_login, justificativa, data_hora)
       SELECT ID, :1, :2, ''sistema'', :3, SYS_EXTRACT_UTC(SYSTIMESTAMP)
         FROM ' || v_ini || ' WHERE ETAPA_CODIGO = :4'
      USING p_origem, p_destino, v_motivo, p_origem;

    EXECUTE IMMEDIATE
      'INSERT INTO ' || v_obs || ' (iniciativa_id, usuario_login, texto, origem, criado_em)
       SELECT ID, ''sistema'', :1, ''MOVIMENTACAO'', SYS_EXTRACT_UTC(SYSTIMESTAMP)
         FROM ' || v_ini || ' WHERE ETAPA_CODIGO = :2'
      USING 'Etapa alterada: "' || p_rot_origem || '" → "' || p_rot_destino || '"' ||
            CHR(10) || 'Motivo: ' || v_motivo,
            p_origem;

    EXECUTE IMMEDIATE
      'UPDATE ' || v_ini || ' SET ETAPA_CODIGO = :1, ATUALIZADO_EM = SYSDATE
        WHERE ETAPA_CODIGO = :2'
      USING p_destino, p_origem;
    informar(SQL%ROWCOUNT || ' iniciativa(s) realocadas de ' || p_origem || ' para ' || p_destino || '.');
  END realocar;

BEGIN
  -- ── 0. Resolução de schema ───────────────────────────────────────────────
  v_owner := dono_de('ETAPAS_KANBAN');
  IF v_owner IS NULL THEN
    RAISE_APPLICATION_ERROR(-20033,
      'V33 abortada: ETAPAS_KANBAN não visível para esta sessão (a V32 foi aplicada?) | ' ||
      'conectado como ' || SYS_CONTEXT('USERENV', 'SESSION_USER') || ', schema corrente ' ||
      SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') || '.');
  END IF;

  v_ini    := '"' || v_owner || '"."INOVACAO_INICIATIVAS"';
  v_etapas := '"' || v_owner || '"."ETAPAS_KANBAN"';
  v_hist   := '"' || v_owner || '"."HISTORICO_ETAPA"';
  v_obs    := '"' || v_owner || '"."INICIATIVA_OBSERVACOES"';
  informar('alvo: schema ' || v_owner);

  -- ── 1. Origem das observações ────────────────────────────────────────────
  IF tem_coluna('INICIATIVA_OBSERVACOES', 'ORIGEM') THEN
    informar('coluna ORIGEM já existe — nada a fazer.');
  ELSE
    -- Com DEFAULT + NOT NULL o Oracle preenche o acervo existente com MANUAL.
    EXECUTE IMMEDIATE 'ALTER TABLE ' || v_obs ||
                      ' ADD ORIGEM VARCHAR2(20) DEFAULT ''MANUAL'' NOT NULL';
    informar('coluna ORIGEM criada (acervo existente = MANUAL).');
  END IF;

  IF NOT tem_constraint('CK_IO_ORIGEM') THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || v_obs || ' ADD CONSTRAINT CK_IO_ORIGEM ' ||
                      'CHECK (ORIGEM IN (''MANUAL'',''EDICAO'',''MOVIMENTACAO''))';
    informar('constraint CK_IO_ORIGEM criada.');
  END IF;

  -- ── 2. Catálogo de etapas ────────────────────────────────────────────────
  ajustar_etapa('RECEBIMENTO',                'Recebimento',                                     1, 1);
  ajustar_etapa('ANALISE_INICIAL',            'Análise inicial',                                 2, 1);
  ajustar_etapa('AGENDAMENTO_REUNIOES',       'Agendamento de reuniões',                         3, 1);
  ajustar_etapa('REUNIOES_AGENDADAS',         'Reuniões agendadas',                              4, 1);
  ajustar_etapa('IDENTIFICACAO_ARTICULACOES', 'Homologação da iniciativa',                       5, 1);
  ajustar_etapa('MONITORAMENTO_CORPORATIVO',  'Monitoramento corporativo',                       6, 1);
  ajustar_etapa('ESTRUTURAR_PROJETO_FUTURO',  'Estruturar projeto futuro',                       7, 1);
  ajustar_etapa('MODELAGEM_INSTRUMENTOS',     'Modelagem de instrumentos técnicos e jurídicos',  8, 1);
  ajustar_etapa('CONEXAO_ACADEMIA',           'Conexão com academia/universidades',              9, 1);
  ajustar_etapa('CONEXAO_MERCADO',            'Conexão com mercado/startups',                   10, 1);
  ajustar_etapa('SINERGIA_INTERNA',           'Sinergia interna/conexão interdepartamental',    11, 1);
  ajustar_etapa('APOIO_DIAGNOSTICO',          'Apoio diagnóstico',                              12, 1);
  ajustar_etapa('DESQUALIFICADOS',            'Desqualificados',                                13, 1);
  -- Desativadas: ordem alta para não colidir com as ativas caso sejam reativadas.
  ajustar_etapa('VERIFICACAO_LACUNAS',        'Verificação de lacunas, preenchimento e consolidação', 90, 0);
  ajustar_etapa('ACOMPANHAMENTO_POS_HOMOLOG', 'Acompanhamento após homologação',                      91, 0);
  informar('catálogo de etapas ajustado (13 ativas).');

  -- ── 3. Realocação das iniciativas nas etapas removidas ───────────────────
  realocar('VERIFICACAO_LACUNAS', 'ANALISE_INICIAL',
           'Verificação de lacunas, preenchimento e consolidação', 'Análise inicial');
  realocar('ACOMPANHAMENTO_POS_HOMOLOG', 'MONITORAMENTO_CORPORATIVO',
           'Acompanhamento após homologação', 'Monitoramento corporativo');

  COMMIT;
  informar('concluída com sucesso.');
END;
/
