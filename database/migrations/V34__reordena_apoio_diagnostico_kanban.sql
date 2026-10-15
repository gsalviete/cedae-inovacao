-- V34__reordena_apoio_diagnostico_kanban.sql
-- Reordenação do Quadro Kanban: "Apoio diagnóstico" (antiga 12) passa a ser a
-- etapa 6, logo depois de "Homologação da iniciativa"; as etapas que estavam
-- de 6 a 11 descem uma posição. Rótulos, status vinculado e etapas
-- desativadas não mudam.
--
--      Ordem  Etapa                                            Status vinculado
--      ─────  ───────────────────────────────────────────────  ────────────────
--        1    Recebimento                                      SUBMETIDA
--        2    Análise inicial                                  EM_ANALISE
--        3    Agendamento de reuniões                          EM_ANALISE
--        4    Reuniões agendadas                               EM_ANALISE
--        5    Homologação da iniciativa                        EM_ANALISE
--        6    Apoio diagnóstico                                HOMOLOGADA
--        7    Monitoramento corporativo                        HOMOLOGADA
--        8    Estruturar projeto futuro                        HOMOLOGADA
--        9    Modelagem de instrumentos técnicos e jurídicos   HOMOLOGADA
--       10    Conexão com academia/universidades               HOMOLOGADA
--       11    Conexão com mercado/startups                     HOMOLOGADA
--       12    Sinergia interna/conexão interdepartamental      HOMOLOGADA
--       13    Desqualificados                                  DESCLASSIFICADA
--
-- Efeito colateral: a homologação leva a iniciativa para a 1ª etapa (menor
-- ordem) do status HOMOLOGADA, que passa a ser "Apoio diagnóstico".
--
-- ATENÇÃO: não reexecute a V32 nem a V33 depois desta — o seed delas restaura
-- a ordem antiga.
--
-- Resolução de schema: mesma abordagem da V31/V32/V33.
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema alvo: CEDAE_INOVACAO

DECLARE
  c_schema_padrao CONSTANT VARCHAR2(128) := 'CEDAE_INOVACAO';

  v_owner  VARCHAR2(128);
  v_etapas VARCHAR2(300);   -- "OWNER"."ETAPAS_KANBAN"

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
    DBMS_OUTPUT.PUT_LINE('[V34] ' || p_msg);
  END informar;

  PROCEDURE ordenar(p_codigo VARCHAR2, p_ordem NUMBER) IS
  BEGIN
    EXECUTE IMMEDIATE
      'UPDATE ' || v_etapas || '
          SET ordem = :1, atualizado_em = SYSTIMESTAMP
        WHERE codigo = :2 AND ordem <> :3'
      USING p_ordem, p_codigo, p_ordem;
  END ordenar;

BEGIN
  -- ── 0. Resolução de schema ───────────────────────────────────────────────
  v_owner := dono_de('ETAPAS_KANBAN');
  IF v_owner IS NULL THEN
    RAISE_APPLICATION_ERROR(-20034,
      'V34 abortada: ETAPAS_KANBAN não visível para esta sessão (a V32 foi aplicada?) | ' ||
      'conectado como ' || SYS_CONTEXT('USERENV', 'SESSION_USER') || ', schema corrente ' ||
      SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') || '.');
  END IF;

  v_etapas := '"' || v_owner || '"."ETAPAS_KANBAN"';
  informar('alvo: schema ' || v_owner);

  -- ── 1. Nova ordem (1 a 5 e 13 não mudam) ─────────────────────────────────
  ordenar('APOIO_DIAGNOSTICO',          6);
  ordenar('MONITORAMENTO_CORPORATIVO',  7);
  ordenar('ESTRUTURAR_PROJETO_FUTURO',  8);
  ordenar('MODELAGEM_INSTRUMENTOS',     9);
  ordenar('CONEXAO_ACADEMIA',          10);
  ordenar('CONEXAO_MERCADO',           11);
  ordenar('SINERGIA_INTERNA',          12);

  COMMIT;
  informar('ordem das etapas ajustada; concluída com sucesso.');
END;
/
