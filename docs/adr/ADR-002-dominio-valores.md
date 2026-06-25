## ADR-002 — DOMINIO_VALORES: Tabela Única para Enums (exceto status de workflow)

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1

### Decisão

Criar uma tabela `DOMINIO_VALORES` única para gerenciar todos os campos categóricos do sistema, com exceção dos status do ciclo de vida das iniciativas. Status de workflow são gerenciados pela tabela `STATUS_WORKFLOW` (ADR-002-B).

### Domínios gerenciados por DOMINIO_VALORES (MVP)

| dominio | Valores iniciais |
|---|---|
| `ESTAGIO_MATURIDADE` | IDEACAO, PILOTO, ESCALA |
| `DIMENSAO_INOVACAO` | TECNOLOGICA, OPERACIONAL, GERENCIAL, SOCIAL_AMBIENTAL, MULTIDIMENSIONAL |
| `GRAU_IMPACTO` | INCREMENTAL, RADICAL |
| `TIPO_SUPORTE` | MODELAGEM_TR_ACT, CONEXAO_ICT, CONEXAO_MERCADO, CONEXAO_INTERSETORIAL, MONITORAMENTO, APOIO_DIAGNOSTICO, OUTRO |
| `QUALIFICACAO` | PROJETO_COMPLEXO, ACAO_SIMPLIFICADA |
| `TIPO_ANOTACAO` | COMENTARIO_PROPONENTE, NOTA_TECNICA, COMUNICADO |
| `VISIBILIDADE_ANOTACAO` | PUBLICA, INTERNA |

### Por que NÃO usar para status de workflow

Status de workflow têm semântica de máquina de estados: têm transições, regras de quem pode executar cada transição e lógica de validação de pré-condição. Misturá-los com "tipos de suporte" e "estágios de maturidade" reduz a clareza do modelo e cria ambiguidade sobre onde aplicar validações.

### Regras de implementação

1. Integridade de domínio validada na camada de aplicação (serviço) ao criar/atualizar
2. FK de `INICIATIVAS` aponta para `DOMINIO_VALORES.id`; o domínio correto é validado pelo serviço
3. Views por domínio: `VW_ESTAGIOS_MATURIDADE`, `VW_DIMENSOES_INOVACAO`, etc.
4. Cache de TTL 5 minutos no backend para listas de domínio
5. Frontend carrega listas de domínio via `GET /api/reference/:domain` no load da página

### Schema

```sql
CREATE TABLE DOMINIO_VALORES (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio     VARCHAR2(50)   NOT NULL,
  codigo      VARCHAR2(50)   NOT NULL,
  rotulo_pt   VARCHAR2(200)  NOT NULL,
  descricao   CLOB,
  ordem       NUMBER(5)      DEFAULT 0 NOT NULL,
  ativo       NUMBER(1)      DEFAULT 1 NOT NULL,
  metadados   VARCHAR2(4000),
  criado_em   TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  atualizado_em TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT UQ_DV_DOM_COD UNIQUE (dominio, codigo),
  CONSTRAINT CK_DV_ATIVO   CHECK  (ativo IN (0,1))
);
CREATE INDEX IDX_DV_DOMINIO ON DOMINIO_VALORES (dominio, ativo);
```

---