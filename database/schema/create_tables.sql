-- ============================================================
--  CEDAE Inovação — Modelagem de Dados (Oracle)
--  Execute como DBA ou com privilégio CREATE TABLE / SEQUENCE
-- ============================================================

-- ── Sequências ───────────────────────────────────────────────
CREATE SEQUENCE SEQ_INICIATIVA
    START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;

CREATE SEQUENCE SEQ_LOG
    START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;

-- ── Tabela principal: Iniciativas ────────────────────────────
CREATE TABLE INOVACAO_INICIATIVAS (
    ID                      NUMBER          DEFAULT SEQ_INICIATIVA.NEXTVAL PRIMARY KEY,

    -- Bloco 0: Identificação
    NOME_COLABORADOR        VARCHAR2(255)   NOT NULL,
    CANAL_CONTATO           VARCHAR2(255)   NOT NULL,
    EMAIL_PROPONENTE        VARCHAR2(255),

    -- Bloco I: Dados Complementares
    TITULO_INICIATIVA       VARCHAR2(500)   NOT NULL,
    AREA_PROPONENTE         VARCHAR2(255)   NOT NULL,
    LOCAL_APLICACAO         VARCHAR2(255)   NOT NULL,

    -- Bloco II: Engenharia do Escopo
    PROBLEMA_PRATICO        CLOB            NOT NULL,
    SOLUCAO_PROPOSTA        CLOB            NOT NULL,
    RISCO_MITIGADO          CLOB,
    ESTAGIO_DESENVOLVIMENTO VARCHAR2(100),   -- ideacao | piloto | escala

    -- Bloco III: Metadados & Orçamento
    MACRODIMENSAO           VARCHAR2(100),
    PERFIL_IMPACTO          VARCHAR2(50),    -- incremental | radical
    APORTE_FINANCEIRO       VARCHAR2(10),    -- nao | sim
    VALOR_APORTE            VARCHAR2(255),
    RETORNO_ECONOMICO       NUMBER(15, 2),

    -- Bloco IV: Suporte
    SUPORTE_NECESSARIO      VARCHAR2(1000),  -- valores separados por "|"
    DIAGNOSTICO_OBSERVACAO  VARCHAR2(2000),  -- preenchido quando SUPORTE_NECESSARIO contém "diagnostico"
    COMENTARIOS_ADICIONAIS  CLOB,

    -- Auditoria
    CRIADO_EM               DATE            DEFAULT SYSDATE NOT NULL
);

-- ── Tabela de logs de auditoria ───────────────────────────────
CREATE TABLE INOVACAO_LOGS (
    ID          NUMBER          DEFAULT SEQ_LOG.NEXTVAL PRIMARY KEY,
    USERNAME    VARCHAR2(100)   NOT NULL,
    ACAO        VARCHAR2(100)   NOT NULL,  -- login | submit_formulario
    DETALHE     VARCHAR2(1000),
    CRIADO_EM   DATE            DEFAULT SYSDATE NOT NULL
);

COMMENT ON TABLE  INOVACAO_LOGS          IS 'Log de auditoria de acessos e ações no sistema';
COMMENT ON COLUMN INOVACAO_LOGS.ACAO     IS 'login | submit_formulario';

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IDX_INIC_CRIADO   ON INOVACAO_INICIATIVAS (CRIADO_EM);
CREATE INDEX IDX_INIC_AREA     ON INOVACAO_INICIATIVAS (AREA_PROPONENTE);
CREATE INDEX IDX_LOG_USERNAME  ON INOVACAO_LOGS (USERNAME);
CREATE INDEX IDX_LOG_CRIADO    ON INOVACAO_LOGS (CRIADO_EM);
