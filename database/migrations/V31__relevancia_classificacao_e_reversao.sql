-- V31__relevancia_classificacao_e_reversao.sql
-- Fonte: ADR-015 (Relevância Estratégica, Classificação Ação/Projeto, Reversão
-- de Decisão Terminal e Ajustes da Captação Externa).
--
-- Estratégia aditiva (ADR-001): apenas colunas novas (nullable), relaxamento de
-- NOT NULL e ampliação de domínios existentes. Nenhuma coluna é removida ou
-- renomeada, nenhum dado é apagado, nenhum histórico é reescrito.
--
-- Etapas:
--   0. Resolução do schema alvo (ver bloco abaixo) e garantia de que
--      TRANSICOES_STATUS existe — a V12 não foi aplicada em todos os ambientes,
--      mesma situação que a V29 tratou para CANAIS_CAPTACAO
--   1. RELEVANCIA_ESTRATEGICA e CLASSIFICACAO_INICIATIVA em INOVACAO_INICIATIVAS
--   2. Backfill da relevância (Via 1 = Planejamento Estratégico; demais =
--      "ainda não é possível determinar", que é exatamente o estado real do
--      acervo legado — nunca houve essa avaliação)
--   3. CHECK constraints de domínio das duas colunas novas
--   4. Proponente opcional (NOME_COLABORADOR / CANAL_CONTATO) — exigido pela
--      Captação Externa; a obrigatoriedade das demais vias segue na aplicação
--   5. Ampliação do domínio de TIPO_INSTITUICAO (STARTUP, EMPRESA_PRIVADA)
--   6. Novo tipo de evento REVERSAO em HISTORICO_STATUS
--   7. Transições de reversão (HOMOLOGADA/DESCLASSIFICADA → EM_ANALISE)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- RESOLUÇÃO DE SCHEMA (difere das migrations anteriores — leia antes de rodar)
--
-- As migrations V19–V30 usam as views `user_*` e DDL sem qualificação, o que
-- **exige** que a sessão esteja conectada como o dono das tabelas
-- (CEDAE_INOVACAO). Rodar como outro usuário — mesmo com grants ou synonyms —
-- faz `user_tab_columns` voltar vazio e o `ALTER TABLE` falhar com ORA-00942,
-- em cascata, sem dizer o motivo real.
--
-- Esta migration resolve o dono de cada tabela em tempo de execução (via
-- ALL_TABLES) e qualifica todo o DDL/DML com "OWNER"."TABELA". Assim ela roda
-- tanto conectada como CEDAE_INOVACAO quanto como um usuário com privilégio
-- sobre o schema. Se as tabelas não forem visíveis, aborta na primeira linha
-- com uma mensagem única dizendo exatamente o que faltou e como está conectado.
--
-- Privilégios necessários quando NÃO se conecta como CEDAE_INOVACAO:
--   ALTER ANY TABLE + SELECT/UPDATE/INSERT nas tabelas (ou o papel DBA).
--
-- Observação: DDL faz commit implícito. Cada etapa é atômica em si, mas o
-- script como um todo não é reversível por ROLLBACK — reexecutar é seguro
-- (idempotente), então uma falha no meio se corrige rodando de novo.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- O script emite um relatório por DBMS_OUTPUT dizendo o que fez em cada etapa.
-- Para vê-lo, habilite a saída antes de rodar (SQL Developer: aba "Saída do
-- DBMS"; SQLcl/SQL*Plus: SET SERVEROUTPUT ON). O comando não vai embutido aqui
-- de propósito — é comando de cliente, não SQL, e quebraria a execução por
-- Flyway/JDBC.
--
-- Oracle 19c | Idempotente (seguro reexecutar) | Schema alvo: CEDAE_INOVACAO

DECLARE
  -- Schema esperado; usado como desempate quando a sessão é de outro usuário e
  -- a tabela existe em mais de um schema visível.
  c_schema_padrao CONSTANT VARCHAR2(128) := 'CEDAE_INOVACAO';

  v_ini   VARCHAR2(300);   -- "OWNER"."INOVACAO_INICIATIVAS"
  v_hist  VARCHAR2(300);   -- "OWNER"."HISTORICO_STATUS"
  v_tran  VARCHAR2(300);   -- "OWNER"."TRANSICOES_STATUS"

  v_owner_ini  VARCHAR2(128);
  v_owner_hist VARCHAR2(128);
  v_owner_tran VARCHAR2(128);

  v_faltando VARCHAR2(400);

  -- ── Infraestrutura ────────────────────────────────────────────────────────

  /* Dono da tabela, com preferência: schema corrente → CEDAE_INOVACAO → único
     visível. Devolve NULL quando a tabela não é visível para esta sessão. */
  FUNCTION dono_de(p_tabela VARCHAR2) RETURN VARCHAR2 IS
    v_owner VARCHAR2(128);
    v_n     NUMBER;
  BEGIN
    SELECT MAX(owner) INTO v_owner
      FROM all_tables
     WHERE table_name = p_tabela
       AND owner = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');
    IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

    SELECT MAX(owner) INTO v_owner
      FROM all_tables
     WHERE table_name = p_tabela
       AND owner = c_schema_padrao;
    IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

    SELECT COUNT(*) INTO v_n FROM all_tables WHERE table_name = p_tabela;
    IF v_n = 1 THEN
      SELECT owner INTO v_owner FROM all_tables WHERE table_name = p_tabela;
      RETURN v_owner;
    END IF;

    RETURN NULL;   -- ausente (0) ou ambígua (>1 sem preferência aplicável)
  END dono_de;

  PROCEDURE informar(p_msg VARCHAR2) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE('[V31] ' || p_msg);
  END informar;

  PROCEDURE ddl(p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  END ddl;

  FUNCTION tem_coluna(p_owner VARCHAR2, p_tabela VARCHAR2, p_col VARCHAR2)
    RETURN BOOLEAN IS
    v_n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_n FROM all_tab_columns
     WHERE owner = p_owner AND table_name = p_tabela AND column_name = p_col;
    RETURN v_n > 0;
  END tem_coluna;

  FUNCTION tem_constraint(p_owner VARCHAR2, p_tabela VARCHAR2, p_nome VARCHAR2)
    RETURN BOOLEAN IS
    v_n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_n FROM all_constraints
     WHERE owner = p_owner AND table_name = p_tabela AND constraint_name = p_nome;
    RETURN v_n > 0;
  END tem_constraint;

  /* Texto da CHECK constraint (VARCHAR2, disponível a partir do 12.1). Serve
     para decidir se a constraint já contempla o domínio ampliado. */
  FUNCTION condicao_da_constraint(p_owner VARCHAR2, p_tabela VARCHAR2, p_nome VARCHAR2)
    RETURN VARCHAR2 IS
    v_cond VARCHAR2(4000);
  BEGIN
    SELECT MAX(search_condition_vc) INTO v_cond
      FROM all_constraints
     WHERE owner = p_owner AND table_name = p_tabela AND constraint_name = p_nome;
    RETURN v_cond;
  END condicao_da_constraint;

  PROCEDURE add_coluna(p_owner VARCHAR2, p_tabela VARCHAR2, p_qualificado VARCHAR2,
                       p_col VARCHAR2, p_tipo VARCHAR2) IS
  BEGIN
    IF tem_coluna(p_owner, p_tabela, p_col) THEN
      informar('coluna ' || p_col || ' já existe — nada a fazer.');
    ELSE
      ddl('ALTER TABLE ' || p_qualificado || ' ADD ' || p_col || ' ' || p_tipo);
      informar('coluna ' || p_col || ' criada.');
    END IF;
  END add_coluna;

  PROCEDURE add_check(p_owner VARCHAR2, p_tabela VARCHAR2, p_qualificado VARCHAR2,
                      p_nome VARCHAR2, p_cond VARCHAR2) IS
  BEGIN
    IF tem_constraint(p_owner, p_tabela, p_nome) THEN
      informar('constraint ' || p_nome || ' já existe — nada a fazer.');
    ELSE
      ddl('ALTER TABLE ' || p_qualificado || ' ADD CONSTRAINT ' || p_nome ||
          ' CHECK (' || p_cond || ')');
      informar('constraint ' || p_nome || ' criada.');
    END IF;
  END add_check;

  /* Recria uma CHECK existente com um domínio AMPLIADO (superconjunto).
     Só age quando `p_marcador` ainda não aparece na condição atual — o que
     torna a operação idempotente. Se o ADD falhar, a condição anterior é
     restaurada antes de propagar o erro: a tabela nunca fica sem a constraint. */
  PROCEDURE ampliar_check(p_owner VARCHAR2, p_tabela VARCHAR2, p_qualificado VARCHAR2,
                          p_nome VARCHAR2, p_cond_nova VARCHAR2, p_marcador VARCHAR2) IS
    v_cond_atual VARCHAR2(4000);
  BEGIN
    IF NOT tem_constraint(p_owner, p_tabela, p_nome) THEN
      ddl('ALTER TABLE ' || p_qualificado || ' ADD CONSTRAINT ' || p_nome ||
          ' CHECK (' || p_cond_nova || ')');
      informar('constraint ' || p_nome || ' não existia e foi criada.');
      RETURN;
    END IF;

    v_cond_atual := condicao_da_constraint(p_owner, p_tabela, p_nome);

    IF v_cond_atual IS NOT NULL AND INSTR(UPPER(v_cond_atual), UPPER(p_marcador)) > 0 THEN
      informar('constraint ' || p_nome || ' já contempla ' || p_marcador || ' — nada a fazer.');
      RETURN;
    END IF;

    ddl('ALTER TABLE ' || p_qualificado || ' DROP CONSTRAINT ' || p_nome);
    BEGIN
      ddl('ALTER TABLE ' || p_qualificado || ' ADD CONSTRAINT ' || p_nome ||
          ' CHECK (' || p_cond_nova || ')');
      informar('constraint ' || p_nome || ' recriada com o domínio ampliado.');
    EXCEPTION
      WHEN OTHERS THEN
        IF v_cond_atual IS NOT NULL THEN
          ddl('ALTER TABLE ' || p_qualificado || ' ADD CONSTRAINT ' || p_nome ||
              ' CHECK (' || v_cond_atual || ')');
          informar('FALHA ao ampliar ' || p_nome || ' — condição anterior restaurada.');
        END IF;
        RAISE;
    END;
  END ampliar_check;

  PROCEDURE tornar_nullable(p_owner VARCHAR2, p_tabela VARCHAR2, p_qualificado VARCHAR2,
                            p_col VARCHAR2) IS
    v_n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_n FROM all_tab_columns
     WHERE owner = p_owner AND table_name = p_tabela
       AND column_name = p_col AND nullable = 'N';
    IF v_n > 0 THEN
      ddl('ALTER TABLE ' || p_qualificado || ' MODIFY (' || p_col || ' NULL)');
      informar('NOT NULL removido de ' || p_col || '.');
    ELSE
      informar(p_col || ' já aceita NULL — nada a fazer.');
    END IF;
  END tornar_nullable;

  /* TRANSICOES_STATUS deveria existir desde a V12, mas — como CANAIS_CAPTACAO
     na V29 — há ambientes em que as migrations de catálogo não foram aplicadas.
     Cria a tabela com o DDL idêntico ao da V12 quando ela não existir, para que
     o seed de reversão não dependa de execução manual prévia. */
  PROCEDURE garantir_transicoes_status(p_owner VARCHAR2) IS
  BEGIN
    ddl('CREATE TABLE "' || p_owner || '"."TRANSICOES_STATUS" (
           id                   NUMBER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
           status_origem        VARCHAR2(50)   NOT NULL,
           status_destino       VARCHAR2(50)   NOT NULL,
           perfil_requerido     VARCHAR2(50)   NOT NULL,
           justificativa_obrig  NUMBER(1)      DEFAULT 0 NOT NULL,
           notificar_proponente NUMBER(1)      DEFAULT 0 NOT NULL,
           descricao            VARCHAR2(200),
           CONSTRAINT UQ_TS_ORIG_DEST_PERF UNIQUE (status_origem, status_destino, perfil_requerido),
           CONSTRAINT CK_TS_JUST  CHECK (justificativa_obrig  IN (0,1)),
           CONSTRAINT CK_TS_NOTIF CHECK (notificar_proponente IN (0,1))
         )');
    informar('TRANSICOES_STATUS não existia e foi criada (DDL da V12).');
  END garantir_transicoes_status;

  PROCEDURE seed_transicao(p_origem VARCHAR2, p_destino VARCHAR2, p_desc VARCHAR2) IS
    v_n NUMBER;
  BEGIN
    EXECUTE IMMEDIATE
      'SELECT COUNT(*) FROM ' || v_tran ||
      ' WHERE status_origem = :1 AND status_destino = :2 AND perfil_requerido = ''ADM'''
      INTO v_n USING p_origem, p_destino;

    IF v_n > 0 THEN
      informar('transição ' || p_origem || ' → ' || p_destino || ' já cadastrada.');
      RETURN;
    END IF;

    EXECUTE IMMEDIATE
      'INSERT INTO ' || v_tran ||
      ' (status_origem, status_destino, perfil_requerido, justificativa_obrig,' ||
      '  notificar_proponente, descricao)' ||
      ' VALUES (:1, :2, ''ADM'', 1, 0, :3)'
      USING p_origem, p_destino, p_desc;

    informar('transição ' || p_origem || ' → ' || p_destino || ' cadastrada.');
  END seed_transicao;

BEGIN
  -- ── 0. Resolução de schema: falha única e clara, em vez de ORA-00942 em cascata
  v_owner_ini  := dono_de('INOVACAO_INICIATIVAS');
  v_owner_hist := dono_de('HISTORICO_STATUS');
  v_owner_tran := dono_de('TRANSICOES_STATUS');

  -- Só as duas tabelas de dados são bloqueantes. TRANSICOES_STATUS é catálogo:
  -- se faltar, é criada logo abaixo (mesma postura da V29 com CANAIS_CAPTACAO).
  IF v_owner_ini IS NULL THEN v_faltando := v_faltando || 'INOVACAO_INICIATIVAS '; END IF;
  IF v_owner_hist IS NULL THEN v_faltando := v_faltando || 'HISTORICO_STATUS ';     END IF;

  IF v_faltando IS NOT NULL THEN
    RAISE_APPLICATION_ERROR(-20031,
      'V31 abortada: tabela(s) não visível(is) para esta sessão: ' || v_faltando ||
      '| conectado como ' || SYS_CONTEXT('USERENV', 'SESSION_USER') ||
      ', schema corrente ' || SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') ||
      ', banco ' || SYS_CONTEXT('USERENV', 'DB_NAME') ||
      '. Conecte-se como ' || c_schema_padrao ||
      ' (ou use ALTER SESSION SET CURRENT_SCHEMA = ' || c_schema_padrao ||
      ' com privilégio sobre o schema) e rode novamente. ' ||
      'Se as três estiverem faltando, o mais provável é conexão no banco/serviço errado.');
  END IF;

  IF v_owner_tran IS NULL THEN
    garantir_transicoes_status(v_owner_ini);
    v_owner_tran := v_owner_ini;
  END IF;

  v_ini  := '"' || v_owner_ini  || '"."INOVACAO_INICIATIVAS"';
  v_hist := '"' || v_owner_hist || '"."HISTORICO_STATUS"';
  v_tran := '"' || v_owner_tran || '"."TRANSICOES_STATUS"';

  informar('alvo: ' || v_ini || ', ' || v_hist || ', ' || v_tran);

  -- ── 1. Colunas novas (nullable) ──────────────────────────────────────────
  add_coluna(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini,
             'RELEVANCIA_ESTRATEGICA', 'VARCHAR2(40)');
  add_coluna(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini,
             'CLASSIFICACAO_INICIATIVA', 'VARCHAR2(20)');

  -- ── 2. Backfill da relevância ────────────────────────────────────────────
  -- RN-14: toda iniciativa da Via 1 (SGE/SGP) vem do Planejamento Estratégico —
  -- vale para o acervo já cadastrado, não só para os registros novos.
  EXECUTE IMMEDIATE
    'UPDATE ' || v_ini || ' SET RELEVANCIA_ESTRATEGICA = ''PLANEJAMENTO_ESTRATEGICO''' ||
    ' WHERE RELEVANCIA_ESTRATEGICA IS NULL AND CANAL_CODIGO = ''VIA_1''';
  informar('backfill Via 1: ' || SQL%ROWCOUNT || ' linha(s).');

  -- Demais vias: a avaliação ainda não foi feita. 'INDETERMINADA' é o estado
  -- honesto do legado e mantém a coluna consultável sem NULLs espalhados.
  EXECUTE IMMEDIATE
    'UPDATE ' || v_ini || ' SET RELEVANCIA_ESTRATEGICA = ''INDETERMINADA''' ||
    ' WHERE RELEVANCIA_ESTRATEGICA IS NULL';
  informar('backfill demais vias: ' || SQL%ROWCOUNT || ' linha(s).');

  COMMIT;

  -- ── 3. CHECK constraints das colunas novas ───────────────────────────────
  -- (reforço; a validação primária continua na aplicação, como nas demais colunas)
  add_check(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini, 'CK_INI_RELEVANCIA',
    q'[RELEVANCIA_ESTRATEGICA IS NULL OR RELEVANCIA_ESTRATEGICA IN ('FINANCEIRO','PLANEJAMENTO_ESTRATEGICO','INDETERMINADA','SEM_RELEVANCIA')]');

  add_check(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini, 'CK_INI_CLASSIFICACAO',
    q'[CLASSIFICACAO_INICIATIVA IS NULL OR CLASSIFICACAO_INICIATIVA IN ('ACAO','PROJETO')]');

  -- ── 4. Proponente opcional (Captação Externa) ────────────────────────────
  -- Na captação externa a iniciativa costuma ser identificada antes de existir
  -- um contato formal do responsável (ADR-015 §6). Mesmo padrão já aplicado a
  -- SOLUCAO_PROPOSTA na V27: o Oracle trata string vazia como NULL, então sem
  -- relaxar o NOT NULL o INSERT quebraria com ORA-01400.
  -- As demais vias continuam exigindo os dois campos — validação na aplicação.
  tornar_nullable(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini, 'NOME_COLABORADOR');
  tornar_nullable(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini, 'CANAL_CONTATO');

  -- ── 5. Domínio de TIPO_INSTITUICAO ───────────────────────────────────────
  -- Entram STARTUP e EMPRESA_PRIVADA. PARCERIA sai da UI (não é mais oferecida
  -- em novos cadastros), mas PERMANECE no CHECK: há registros gravados com esse
  -- valor e removê-lo do domínio invalidaria dados existentes.
  ampliar_check(v_owner_ini, 'INOVACAO_INICIATIVAS', v_ini, 'CK_INI_TIPO_INST',
    q'[TIPO_INSTITUICAO IS NULL OR TIPO_INSTITUICAO IN ('ICT','UNIVERSIDADE','EMPRESA_PUBLICA','EMPRESA_PRIVADA','STARTUP','PARCERIA','OUTRO')]',
    'STARTUP');

  -- ── 6. Novo tipo de evento REVERSAO ──────────────────────────────────────
  -- A reversão de homologação/desclassificação NÃO apaga histórico: acrescenta
  -- um evento próprio (ADR-005 permanece intacto — nada é atualizado nem
  -- removido, e a trigger de imutabilidade não precisa ser desabilitada).
  ampliar_check(v_owner_hist, 'HISTORICO_STATUS', v_hist, 'CK_HS_TIPO',
    q'[tipo_evento IN ('SUBMISSAO','TRIAGEM','ANALISE','HOMOLOGACAO','DESCLASSIFICACAO','CORRECAO','REVERSAO')]',
    'REVERSAO');

  -- ── 7. Transições de reversão (workflow como dado — ADR-004) ─────────────
  -- Destino EM_ANALISE: desfazer a decisão devolve a iniciativa à esteira, de
  -- onde ela pode ser homologada/desclassificada de novo. Justificativa
  -- obrigatória nos dois casos. O perfil requerido é ADM — a restrição efetiva
  -- é aplicada no WorkflowService (mesma abordagem de homologar/desclassificar).
  seed_transicao('HOMOLOGADA', 'EM_ANALISE',
                 'Reverter homologacao (justificativa obrigatoria)');
  seed_transicao('DESCLASSIFICADA', 'EM_ANALISE',
                 'Reverter desclassificacao (justificativa obrigatoria)');

  COMMIT;
  informar('concluída com sucesso.');
END;
/
