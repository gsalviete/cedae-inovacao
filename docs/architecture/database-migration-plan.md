# Plano de Migração de Banco de Dados — Fase 1
**Versão:** 1.0  
**Data:** 2026-06-24  
**Banco:** Oracle 19c+  
**Schema:** Owner `CEDAE_INOVACAO`

---

## 1. Princípios de Execução

1. **Scripts numerados e sequenciais:** Cada script tem prefixo `V{N}__` para garantir ordem de execução e rastreabilidade.
2. **Idempotência obrigatória:** Todo script usa `CREATE TABLE IF NOT EXISTS` ou verifica existência antes de criar. Re-execução não causa erro nem duplicação.
3. **Zero alteração nas tabelas legadas exceto E1-S04:** `INOVACAO_INICIATIVAS` e `INOVACAO_LOGS` não são tocadas além da adição de colunas nullable.
4. **Validação antes de avançar:** Cada subgrupo tem queries de validação que devem retornar resultado esperado antes de executar o próximo.
5. **Execução em horário de baixo tráfego:** Os scripts de ALTER TABLE (E1-S04) e o ETL devem ser executados fora do horário de pico (preferencialmente domingo ou madrugada).

---

## 2. Ordem de Criação das Tabelas

```
GRUPO 1 — Sem dependências externas
├── V01__create_dominio_valores.sql
├── V02__create_status_workflow.sql
├── V03__create_canais_captacao.sql
├── V04__create_perfis_acesso.sql
└── V05__create_parametros_sistema.sql

GRUPO 2 — Depende de GRUPO 1
├── V06__create_unidades_organizacionais.sql   (self-referenciada)
└── V07__seed_unidades_organizacionais.sql

GRUPO 3 — Depende de GRUPO 2
├── V08__create_usuarios.sql
├── V09__create_usuarios_perfis.sql
└── V10__seed_usuario_admin.sql

GRUPO 4 — Depende de GRUPO 3
└── V11__create_proponentes.sql

GRUPO 5 — Tabelas transacionais (sem FK para INICIATIVAS ainda)
├── V12__create_transicoes_status.sql
├── V13__seed_transicoes_status_mvp.sql
├── V14__create_historico_status.sql          (+ trigger + view)
├── V15__create_investimentos.sql
├── V16__create_anotacoes.sql
├── V17__create_iniciativas_suportes.sql
└── V18__create_auditoria_logs.sql

GRUPO 6 — Alterações na tabela legada
└── V19__alter_inovacao_iniciativas_add_columns.sql

GRUPO 7 — ETL
├── V20__etl_unidades_organizacionais.sql
├── V21__etl_proponentes.sql
├── V22__etl_codigos_publicos.sql
├── V23__etl_status_e_historico.sql
├── V24__etl_suportes.sql
├── V25__etl_investimentos.sql
├── V26__etl_anotacoes.sql
└── V27__etl_auditoria_logs_legado.sql

GRUPO 8 — Tabela central e FKs finais
├── V28__create_iniciativas.sql               (+ trigger CODIGO_PUBLICO)
└── V29__add_fks_to_support_tables.sql

GRUPO 9 — Views analíticas
├── V30__create_views_dominio.sql
└── V31__create_view_historico_ativo.sql
```

---

## 3. DDL Esperado por Script

### V01 — DOMINIO_VALORES

```sql
-- Verificação de existência antes de criar
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables 
  WHERE table_name = 'DOMINIO_VALORES';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE DOMINIO_VALORES (
        id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
        CONSTRAINT CK_DV_ATIVO   CHECK (ativo IN (0,1))
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_DV_DOMINIO ON DOMINIO_VALORES (dominio, ativo)';
  END IF;
END;
/

-- SEED: Domínio ESTAGIO_MATURIDADE
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'ESTAGIO_MATURIDADE', 'IDEACAO', 'Ideação', 1
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='ESTAGIO_MATURIDADE' AND codigo='IDEACAO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'ESTAGIO_MATURIDADE', 'PILOTO', 'Teste / Piloto (MVP)', 2
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='ESTAGIO_MATURIDADE' AND codigo='PILOTO');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'ESTAGIO_MATURIDADE', 'ESCALA', 'Escala / Operação Ativa', 3
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='ESTAGIO_MATURIDADE' AND codigo='ESCALA');

-- SEED: Domínio DIMENSAO_INOVACAO
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO','TECNOLOGICA','Inovação Tecnológica',1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='DIMENSAO_INOVACAO' AND codigo='TECNOLOGICA');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO','OPERACIONAL','Inovação Operacional',2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='DIMENSAO_INOVACAO' AND codigo='OPERACIONAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO','GERENCIAL','Inovação Gerencial / Administrativa',3
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='DIMENSAO_INOVACAO' AND codigo='GERENCIAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO','SOCIAL_AMBIENTAL','Inovação Social e Ambiental',4
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='DIMENSAO_INOVACAO' AND codigo='SOCIAL_AMBIENTAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'DIMENSAO_INOVACAO','MULTIDIMENSIONAL','Multidimensional / Outro',5
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='DIMENSAO_INOVACAO' AND codigo='MULTIDIMENSIONAL');

-- SEED: Domínio GRAU_IMPACTO
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'GRAU_IMPACTO','INCREMENTAL','Incremental',1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='GRAU_IMPACTO' AND codigo='INCREMENTAL');

INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'GRAU_IMPACTO','RADICAL','Radical / Disruptivo',2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='GRAU_IMPACTO' AND codigo='RADICAL');

-- SEED: Domínio TIPO_SUPORTE
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','MODELAGEM_TR_ACT','Modelagem de TR/ACT',1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='MODELAGEM_TR_ACT');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','CONEXAO_ICT','Conexão com Academia / ICTs',2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='CONEXAO_ICT');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','CONEXAO_MERCADO','Conexão com Mercado / Startups',3
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='CONEXAO_MERCADO');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','CONEXAO_INTERSETORIAL','Sinergia Interna / Conexão Interdepartamental',4
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='CONEXAO_INTERSETORIAL');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','MONITORAMENTO','Apenas Monitoramento Corporativo',5
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='MONITORAMENTO');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','APOIO_DIAGNOSTICO','Apoio Diagnóstico / Mentoria',6
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='APOIO_DIAGNOSTICO');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_SUPORTE','OUTRO','Outro',7
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_SUPORTE' AND codigo='OUTRO');

-- SEED: Domínio QUALIFICACAO
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'QUALIFICACAO','PROJETO_COMPLEXO','Projeto — Metodologia Complexa',1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='QUALIFICACAO' AND codigo='PROJETO_COMPLEXO');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'QUALIFICACAO','ACAO_SIMPLIFICADA','Ação — Rito Simplificado',2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='QUALIFICACAO' AND codigo='ACAO_SIMPLIFICADA');

-- SEED: Domínio TIPO_ANOTACAO
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_ANOTACAO','COMENTARIO_PROPONENTE','Comentário do Proponente',1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_ANOTACAO' AND codigo='COMENTARIO_PROPONENTE');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_ANOTACAO','NOTA_TECNICA','Nota Técnica (interna)',2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_ANOTACAO' AND codigo='NOTA_TECNICA');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'TIPO_ANOTACAO','COMUNICADO','Comunicado ao Proponente',3
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='TIPO_ANOTACAO' AND codigo='COMUNICADO');

-- SEED: Domínio VISIBILIDADE_ANOTACAO
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'VISIBILIDADE_ANOTACAO','PUBLICA','Pública',1
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='VISIBILIDADE_ANOTACAO' AND codigo='PUBLICA');
INSERT INTO DOMINIO_VALORES (dominio, codigo, rotulo_pt, ordem)
  SELECT 'VISIBILIDADE_ANOTACAO','INTERNA','Interna',2
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM DOMINIO_VALORES WHERE dominio='VISIBILIDADE_ANOTACAO' AND codigo='INTERNA');

COMMIT;
```

### V02 — STATUS_WORKFLOW

```sql
CREATE TABLE STATUS_WORKFLOW (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo        VARCHAR2(50)   NOT NULL,
  rotulo_pt     VARCHAR2(200)  NOT NULL,
  descricao     CLOB,
  terminal      NUMBER(1)      DEFAULT 0 NOT NULL,
  ordem         NUMBER(5)      DEFAULT 0 NOT NULL,
  ativo         NUMBER(1)      DEFAULT 1 NOT NULL,
  criado_em     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  atualizado_em TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT UQ_SW_CODIGO  UNIQUE (codigo),
  CONSTRAINT CK_SW_ATIVO   CHECK (ativo IN (0,1)),
  CONSTRAINT CK_SW_TERM    CHECK (terminal IN (0,1))
);

-- Seed MVP
INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'SUBMETIDA', 'Submetida', 0, 1 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo='SUBMETIDA');
INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'EM_ANALISE', 'Em Análise', 0, 2 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo='EM_ANALISE');
INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'APROVADA', 'Aprovada', 1, 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo='APROVADA');
INSERT INTO STATUS_WORKFLOW (codigo, rotulo_pt, terminal, ordem)
  SELECT 'REPROVADA', 'Reprovada', 1, 4 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM STATUS_WORKFLOW WHERE codigo='REPROVADA');
COMMIT;
```

### V13 — TRANSICOES_STATUS (seed MVP)

```sql
INSERT INTO TRANSICOES_STATUS 
  (status_origem, status_destino, perfil_requerido, justificativa_obrig, notificar_proponente, descricao)
  SELECT 'SUBMETIDA','EM_ANALISE','ANALISTA_ASSESSORIA',0,0,'Iniciar análise da iniciativa'
  FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM TRANSICOES_STATUS 
    WHERE status_origem='SUBMETIDA' AND status_destino='EM_ANALISE' AND perfil_requerido='ANALISTA_ASSESSORIA'
  );

INSERT INTO TRANSICOES_STATUS 
  (status_origem, status_destino, perfil_requerido, justificativa_obrig, notificar_proponente, descricao)
  SELECT 'EM_ANALISE','APROVADA','ANALISTA_ASSESSORIA',0,1,'Aprovar iniciativa'
  FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM TRANSICOES_STATUS 
    WHERE status_origem='EM_ANALISE' AND status_destino='APROVADA' AND perfil_requerido='ANALISTA_ASSESSORIA'
  );

INSERT INTO TRANSICOES_STATUS 
  (status_origem, status_destino, perfil_requerido, justificativa_obrig, notificar_proponente, descricao)
  SELECT 'EM_ANALISE','REPROVADA','ANALISTA_ASSESSORIA',1,1,'Reprovar iniciativa (justificativa obrigatória)'
  FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM TRANSICOES_STATUS 
    WHERE status_origem='EM_ANALISE' AND status_destino='REPROVADA' AND perfil_requerido='ANALISTA_ASSESSORIA'
  );

COMMIT;
```

### V14 — HISTORICO_STATUS (trigger e view)

```sql
CREATE TABLE HISTORICO_STATUS (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iniciativa_id    NUMBER        NOT NULL,
  status_anterior  VARCHAR2(50),
  status_novo      VARCHAR2(50)  NOT NULL,
  tipo_evento      VARCHAR2(30)  NOT NULL,
  usuario_id       NUMBER        NOT NULL,
  data_hora        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  justificativa    CLOB,
  anulado          NUMBER(1)     DEFAULT 0 NOT NULL,
  anulado_por_id   NUMBER,
  anulado_em       TIMESTAMP,
  motivo_anulacao  CLOB,
  CONSTRAINT CK_HS_ANULADO   CHECK (anulado IN (0,1)),
  CONSTRAINT CK_HS_TIPO      CHECK (tipo_evento IN (
    'SUBMISSAO','TRIAGEM','ANALISE','APROVACAO','REPROVACAO','CORRECAO'
  )),
  CONSTRAINT CK_HS_ANULADO_COMPLETO CHECK (
    anulado = 0 OR (
      anulado_por_id IS NOT NULL AND anulado_em IS NOT NULL AND motivo_anulacao IS NOT NULL
    )
  )
  -- FKs para INICIATIVAS e USUARIOS adicionadas em V29 (após criação das tabelas referenciadas)
);
CREATE INDEX IDX_HS_INICIATIVA ON HISTORICO_STATUS (iniciativa_id, data_hora);
CREATE INDEX IDX_HS_USUARIO    ON HISTORICO_STATUS (usuario_id);

-- Trigger de imutabilidade
CREATE OR REPLACE TRIGGER TRG_HS_NO_UPD_DEL
BEFORE UPDATE OR DELETE ON HISTORICO_STATUS
FOR EACH ROW
DECLARE
  v_allowed_update BOOLEAN := FALSE;
BEGIN
  IF UPDATING THEN
    -- Permitir UPDATE apenas nos campos de anulação
    IF UPDATING('ANULADO') OR UPDATING('ANULADO_POR_ID') OR 
       UPDATING('ANULADO_EM') OR UPDATING('MOTIVO_ANULACAO') THEN
      v_allowed_update := TRUE;
    END IF;
    IF NOT v_allowed_update THEN
      RAISE_APPLICATION_ERROR(-20001, 
        'HISTORICO_STATUS é imutável. Apenas campos de anulação podem ser atualizados.');
    END IF;
  END IF;
  IF DELETING THEN
    RAISE_APPLICATION_ERROR(-20002, 
      'DELETE em HISTORICO_STATUS não é permitido. Use anulado=1 para invalidar registros.');
  END IF;
END;
/

-- View para uso pela aplicação
CREATE OR REPLACE VIEW VW_HISTORICO_ATIVO AS
  SELECT 
    hs.id, hs.iniciativa_id, hs.status_anterior, hs.status_novo,
    hs.tipo_evento, hs.usuario_id, hs.data_hora, hs.justificativa
  FROM HISTORICO_STATUS hs
  WHERE hs.anulado = 0
  ORDER BY hs.data_hora ASC;
```

### V19 — ALTER TABLE INOVACAO_INICIATIVAS

```sql
-- Adicionar colunas de migração (todas nullable — não quebram INSERTs existentes)
DECLARE
  PROCEDURE add_col_if_not_exists(p_col VARCHAR2, p_def VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tab_columns
    WHERE table_name='INOVACAO_INICIATIVAS' AND column_name=UPPER(p_col);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE INOVACAO_INICIATIVAS ADD '||p_col||' '||p_def;
    END IF;
  END;
BEGIN
  add_col_if_not_exists('CODIGO_PUBLICO', 'VARCHAR2(20)');
  add_col_if_not_exists('STATUS',         'VARCHAR2(50)');
  add_col_if_not_exists('PROPONENTE_ID',  'NUMBER');
  add_col_if_not_exists('AREA_ID',        'NUMBER');
  add_col_if_not_exists('ANALISTA_ID',    'NUMBER');
  add_col_if_not_exists('ATUALIZADO_EM',  'DATE DEFAULT SYSDATE');
END;
/
COMMIT;
```

---

## 4. Estratégia ETL

### Mapeamento de status legado

O campo de status não existe na tabela legada. O ETL infere o status com base nos dados da planilha de referência:

| Critério | Status atribuído |
|---|---|
| Registro identificado como `[Homologada]` na planilha | `APROVADA` |
| Registro identificado como `[Desqualificada]` na planilha | `REPROVADA` |
| Registro identificado como `[Em Análise]` na planilha | `EM_ANALISE` |
| Todos os demais | `SUBMETIDA` |

**Nota:** O mapeamento exato depende de um arquivo de referência fornecido pela Assessoria antes da execução do ETL em produção.

### Geração de CODIGO_PUBLICO

```sql
-- Gerar CODIGO_PUBLICO para registros sem um
UPDATE INOVACAO_INICIATIVAS
SET CODIGO_PUBLICO = 
  'INOV-' || TO_CHAR(CRIADO_EM, 'YYYY') || '-' || 
  LPAD(ROWNUM, 3, '0')
WHERE CODIGO_PUBLICO IS NULL;
COMMIT;
```

### Explosão de SUPORTE_NECESSARIO

```sql
-- Para cada iniciativa com SUPORTE_NECESSARIO, criar registros em INICIATIVAS_SUPORTES
-- A lógica de split por '|' é feita em PL/SQL
DECLARE
  CURSOR c_ini IS
    SELECT ID, SUPORTE_NECESSARIO FROM INOVACAO_INICIATIVAS
    WHERE SUPORTE_NECESSARIO IS NOT NULL AND PROPONENTE_ID IS NOT NULL;
  v_sup    VARCHAR2(1000);
  v_item   VARCHAR2(100);
  v_pos1   NUMBER;
  v_pos2   NUMBER;
  v_dv_id  NUMBER;
BEGIN
  FOR r IN c_ini LOOP
    v_sup := r.SUPORTE_NECESSARIO || '|';
    v_pos1 := 1;
    LOOP
      v_pos2 := INSTR(v_sup, '|', v_pos1);
      EXIT WHEN v_pos2 = 0;
      v_item := TRIM(SUBSTR(v_sup, v_pos1, v_pos2 - v_pos1));
      IF LENGTH(v_item) > 0 THEN
        -- Mapear valor legado para código em DOMINIO_VALORES
        SELECT id INTO v_dv_id FROM DOMINIO_VALORES
        WHERE dominio = 'TIPO_SUPORTE'
          AND (codigo = UPPER(v_item) OR UPPER(rotulo_pt) LIKE '%'||UPPER(v_item)||'%')
          AND ativo = 1
          AND ROWNUM = 1;
        INSERT INTO INICIATIVAS_SUPORTES 
          (iniciativa_legado_id, tipo_suporte_id, status, registrado_em)
          SELECT r.ID, v_dv_id, 'SOLICITADO', SYSTIMESTAMP
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1 FROM INICIATIVAS_SUPORTES 
            WHERE iniciativa_legado_id = r.ID AND tipo_suporte_id = v_dv_id
          );
      END IF;
      v_pos1 := v_pos2 + 1;
    END LOOP;
  END LOOP;
  COMMIT;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    -- Registrar item não mapeado no relatório de curadoria
    INSERT INTO ETL_CURADORIA_LOG (tabela, registro_id, campo, valor, observacao, criado_em)
    VALUES ('INOVACAO_INICIATIVAS', r.ID, 'SUPORTE_NECESSARIO', v_item, 
            'Valor não mapeado em DOMINIO_VALORES', SYSTIMESTAMP);
    COMMIT;
    CONTINUE;
END;
/
```

---

## 5. Validações Pós-Migração

Execute estas queries após o ETL. Todas devem retornar 0:

```sql
-- 1. Iniciativas sem CODIGO_PUBLICO
SELECT COUNT(*) AS sem_codigo FROM INOVACAO_INICIATIVAS WHERE CODIGO_PUBLICO IS NULL;
-- Esperado: 0

-- 2. Iniciativas sem PROPONENTE_ID
SELECT COUNT(*) AS sem_proponente FROM INOVACAO_INICIATIVAS WHERE PROPONENTE_ID IS NULL;
-- Esperado: 0

-- 3. Iniciativas sem STATUS
SELECT COUNT(*) AS sem_status FROM INOVACAO_INICIATIVAS WHERE STATUS IS NULL;
-- Esperado: 0

-- 4. Iniciativas sem HISTORICO_STATUS
SELECT COUNT(*) AS sem_historico
FROM INOVACAO_INICIATIVAS ii
WHERE NOT EXISTS (
  SELECT 1 FROM HISTORICO_STATUS hs WHERE hs.iniciativa_id = ii.ID
);
-- Esperado: 0

-- 5. CODIGO_PUBLICO duplicados
SELECT CODIGO_PUBLICO, COUNT(*) AS qtd
FROM INOVACAO_INICIATIVAS
GROUP BY CODIGO_PUBLICO
HAVING COUNT(*) > 1;
-- Esperado: zero linhas

-- 6. Conferência de totais
SELECT 
  (SELECT COUNT(*) FROM INOVACAO_INICIATIVAS) AS total_legado,
  (SELECT COUNT(*) FROM PROPONENTES)          AS total_proponentes,
  (SELECT COUNT(*) FROM HISTORICO_STATUS)     AS total_historico,
  (SELECT COUNT(*) FROM INICIATIVAS_SUPORTES) AS total_suportes,
  (SELECT COUNT(*) FROM INVESTIMENTOS)        AS total_investimentos,
  (SELECT COUNT(*) FROM ANOTACOES)            AS total_anotacoes
FROM DUAL;
-- Verificar que total_historico >= total_legado
-- Verificar que total_suportes >= qtd de registros com SUPORTE_NECESSARIO não-nulo

-- 7. Sistema legado ainda funciona (simular INSERT)
-- Executar manualmente o fluxo de submissão no formulário e verificar novo registro em INOVACAO_INICIATIVAS
```

---

## 6. Rollback por Subetapa

| Subetapa | Script de rollback | Risco de perda de dados |
|---|---|---|
| V01-V05 (referência) | `DROP TABLE dominio_valores, status_workflow, ...` em ordem reversa | Nenhum |
| V06-V11 (identidade) | `DROP TABLE proponentes, usuarios_perfis, usuarios, unidades_org` | Nenhum |
| V12-V18 (transacional) | `DROP TABLE historico_status, ...` | Nenhum |
| V19 (ALTER TABLE) | `ALTER TABLE INOVACAO_INICIATIVAS DROP COLUMN CODIGO_PUBLICO, ...` | Nenhum |
| V20-V27 (ETL) | Não há rollback de dados — re-executar ETL com flag de reset | Baixo (dados migrados apenas, originais intactos) |
| V28-V31 (INICIATIVAS + views) | `DROP TABLE iniciativas, DROP VIEW ...` | Nenhum |

**Janela sem rollback limpo:** A tabela `INOVACAO_INICIATIVAS` com os dados originais permanece intacta durante toda a Fase 1. O rollback completo para o estado anterior à Fase 1 é sempre possível até a Fase 5 (quando o rename acontece).