# CEDAE Inovação — Dicionário de Dados

**Versão:** 1.0
**Data:** 2026-07-29
**Banco:** Oracle 19c — schema `CEDAE_INOVACAO`
**Estado descrito:** migrations `V01`–`V31` aplicadas

> Documento de referência do modelo de dados: o que cada tabela guarda, o que cada
> coluna significa, quais valores são aceitos e de onde o dado vem.
> Para o entendimento de negócio, ver [`visao-geral-do-produto.md`](visao-geral-do-produto.md).

---

## 1. Como ler este documento

**Convenções de tipo.** `VARCHAR2(n)` = texto até *n* caracteres. `CLOB` = texto
longo. `NUMBER(15,2)` = numérico com 2 casas decimais. `DATE` = data e hora com
precisão de segundo. `TIMESTAMP` = data e hora com fração de segundo.

**Obrigatoriedade.** A coluna **Obrig.** indica a exigência *no banco* (`NOT NULL`).
Muitos campos são nullable no banco mas **obrigatórios por regra de negócio**,
validados na aplicação — isso está registrado na coluna **Regras**. É uma decisão
consciente do projeto: a validação primária vive na aplicação, e o banco reforça
os casos críticos com `CHECK`.

**Fuso horário.** Timestamps de auditoria (`HISTORICO_STATUS.DATA_HORA`,
`INICIATIVA_OBSERVACOES.CRIADO_EM`, `TERMOS_ACEITES.REGISTRADO_EM`) são gravados em
**UTC**. Datas de negócio (`INOVACAO_INICIATIVAS.CRIADO_EM`, `ATUALIZADO_EM`) usam
`SYSDATE` — o fuso do servidor de banco. Exibição é sempre convertida para
`America/Sao_Paulo`.

**Notação de origem do dado:**

| Marca | Significado |
|---|---|
| 📝 | Preenchido por pessoa (formulário público ou cadastro no painel) |
| ⚙️ | Gerado ou carimbado pelo sistema |
| 🔒 | Imutável após a criação pela operação normal |

---

## 2. Mapa das tabelas

### 2.1 Tabelas em uso pela aplicação

| Tabela | Papel | Volume esperado |
|---|---|---|
| [`INOVACAO_INICIATIVAS`](#31-inovacao_iniciativas) | Base única de iniciativas — tabela central | Cresce com o portfólio |
| [`HISTORICO_STATUS`](#32-historico_status) | Linha do tempo imutável de cada iniciativa | ~2 a 5 linhas por iniciativa |
| [`INICIATIVA_OBSERVACOES`](#33-iniciativa_observacoes) | Anotações livres durante a tramitação | Variável |
| [`CANAIS_CAPTACAO`](#34-canais_captacao) | Catálogo das vias de captação | 4 linhas |
| [`TRANSICOES_STATUS`](#35-transicoes_status) | Regras do workflow como dado configurável | 5 linhas |
| [`ADMIN_USERS`](#36-admin_users) | Lista de autorização de acesso ao painel | Dezenas |
| [`TERMOS_ACEITES`](#37-termos_aceites) | Aceite/recusa dos Termos de Uso, versionado | 1+ por usuário/versão |
| [`INOVACAO_LOGS`](#38-inovacao_logs) | Trilha técnica de auditoria | Cresce continuamente |

### 2.2 Objeto externo consultado

| Objeto | Papel |
|---|---|
| `CONSCORP.vw_ad_user` | View corporativa do Active Directory — somente leitura. Usada para buscar nome, e-mail e login ao cadastrar um usuário do painel |

### 2.3 Tabelas criadas e **não utilizadas** pela aplicação

Existem no schema por terem sido criadas em migrations iniciais, mas **nenhuma
consulta da aplicação as referencia**. Não foram removidas por segurança. Não
devem ser tomadas como fonte de verdade.

| Tabela | Migration | Por que não é usada |
|---|---|---|
| `DOMINIO_VALORES` | V01 | Os domínios de valor vivem na aplicação (`dominio-iniciativa.ts`) e são reforçados por `CHECK` no banco |
| `STATUS_WORKFLOW` | V02 | Catálogo de estados; a aplicação lê os estados de `TRANSICOES_STATUS` e das constantes de código |
| `PERFIS_ACESSO` | V04 | Substituída pelos papéis `ADM`/`CONTRIBUTOR` em `ADMIN_USERS` |
| `PARAMETROS_SISTEMA` | V05 | Configuração via variáveis de ambiente |
| `UNIDADES_ORGANIZACIONAIS` | V06 | Área do proponente permanece como texto na iniciativa |
| `USUARIOS` | V08 | Substituída por identidade no Active Directory + `ADMIN_USERS` |
| `USUARIOS_PERFIS` | V09 | Junto com `USUARIOS` |

> **Atenção ao consultar o banco diretamente:** um relatório que leia
> `DOMINIO_VALORES` ou `STATUS_WORKFLOW` estará lendo catálogos que a aplicação não
> mantém sincronizados.

### 2.4 Relacionamentos

```
                        ┌───────────────────────┐
                        │   CANAIS_CAPTACAO     │
                        │   (catálogo de vias)  │
                        └───────────┬───────────┘
                                    │ codigo  (vínculo lógico, sem FK)
                                    ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                    INOVACAO_INICIATIVAS                        │
   │                     (base única, PK: ID)                       │
   └──────────┬──────────────────────────────────┬──────────────────┘
              │ iniciativa_id                    │ iniciativa_id
              ▼                                  ▼
   ┌──────────────────────┐          ┌──────────────────────────┐
   │  HISTORICO_STATUS    │          │  INICIATIVA_OBSERVACOES  │
   │  (imutável)          │          │  (editável por 2h)       │
   └──────────────────────┘          └──────────────────────────┘

   ┌──────────────────────┐          ┌──────────────────────────┐
   │  TRANSICOES_STATUS   │          │      ADMIN_USERS         │
   │  (regras do fluxo)   │          │  (autorização, PK: id)   │
   └──────────────────────┘          └────────────┬─────────────┘
                                                  │ login (lógico)
                                     ┌────────────┴─────────────┐
                                     ▼                          ▼
                        ┌──────────────────────┐   ┌──────────────────────┐
                        │   TERMOS_ACEITES     │   │    INOVACAO_LOGS     │
                        └──────────────────────┘   └──────────────────────┘
```

**Não há foreign keys declaradas entre as tabelas.** Os vínculos
(`iniciativa_id`, `canal_codigo`, `login`) são **lógicos**, garantidos pela
aplicação. Consequência prática para quem consulta o banco diretamente: um `JOIN`
pode encontrar órfãos se dados forem inseridos fora da aplicação.

---

## 3. Tabelas

### 3.1 `INOVACAO_INICIATIVAS`

**Finalidade.** A base única do portfólio. Uma linha = uma iniciativa de inovação,
de qualquer origem. É a tabela central do sistema.

**Estratégia.** Tabela legada estendida **aditivamente**: colunas novas sempre
nullable, nada é removido ou renomeado. Por isso o acervo antigo continua legível
a cada nova entrega — e por isso algumas colunas têm valor nulo em registros
anteriores à sua criação.

#### Bloco — Identificação e chaves

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária, gerada por `SEQ_INICIATIVA` | ⚙️ 🔒 Identificador interno; não é o número mostrado ao proponente |
| `CODIGO_PUBLICO` | VARCHAR2(20) | — | Protocolo da iniciativa, padrão `INOV-AAAA-NNN` (ex.: `INOV-2026-014`) | ⚙️ 🔒 Gerado na criação, dentro da mesma transação. Numeração sequencial **por ano**. Registros anteriores à V28 receberam protocolo retroativo |

#### Bloco 0 — Proponente

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `NOME_COLABORADOR` | VARCHAR2(255) | — | Nome de quem propõe | 📝 Obrigatório em todas as vias **exceto Captação Externa**, onde a iniciativa costuma ser identificada antes do contato formal. `NOT NULL` removido na V31 |
| `CANAL_CONTATO` | VARCHAR2(255) | — | Meio de contato informado (telefone, ramal, etc.) | 📝 Mesma regra de `NOME_COLABORADOR` |
| `EMAIL_PROPONENTE` | VARCHAR2(255) | — | E-mail do proponente | 📝 Obrigatório e validado no formulário público (Via 2) — é o destino do e-mail de confirmação. Opcional nas vias de cadastro manual |
| `PROPONENTE_TIPO` | VARCHAR2(10) | — | Se o proponente é da CEDAE ou externo | ⚙️ 🔒 Derivado do canal, nunca digitado. `MAPEAMENTO_EXTERNO` → `EXTERNO`; demais → `INTERNO`. **Domínio:** `INTERNO`, `EXTERNO` (`CK_INI_PROP_TIPO`) |

#### Bloco I — Dados complementares

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `TITULO_INICIATIVA` | VARCHAR2(500) | ✅ | Título da iniciativa | 📝 |
| `AREA_PROPONENTE` | VARCHAR2(255) | ✅ | Área/gerência proponente | 📝 Texto livre. Fonte conhecida de variação de grafia — ver §6 |
| `LOCAL_APLICACAO` | VARCHAR2(255) | ✅ | Onde a iniciativa é (ou será) aplicada | 📝 |

#### Bloco II — Engenharia do escopo

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `PROBLEMA_PRATICO` | CLOB | ✅ | Qual problema real a iniciativa resolve | 📝 |
| `SOLUCAO_PROPOSTA` | CLOB | — | Solução proposta | 📝 Deixou de ser obrigatória na V27: nem todo proponente sabe a solução ao descrever o problema |
| `RISCO_MITIGADO` | CLOB | — | Risco que a solução reduz | 📝 |
| `ESTAGIO_DESENVOLVIMENTO` | VARCHAR2(100) | — | Maturidade atual | 📝 **Domínio:** `ideacao`, `piloto`, `escala`, `paralisada` — ver [§4.1](#41-estagio_desenvolvimento) |

#### Bloco III — Metadados conceituais e orçamento

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `MACRODIMENSAO` | VARCHAR2(100) | — | Natureza da inovação | 📝 **Domínio:** `tecnologica`, `operacional`, `gerencial`, `social_ambiental`, `outros` — ver [§4.2](#42-macrodimensao) |
| `MACRODIMENSAO_OBSERVACAO` | VARCHAR2(2000) | — | Texto livre da macrodimensão | 📝 Só faz sentido quando `MACRODIMENSAO = 'outros'`. Existe para que a opção "Outros" não vire um campo classificatório poluído |
| `PERFIL_IMPACTO` | VARCHAR2(50) | — | Grau de ruptura da solução | 📝 **Domínio:** `incremental`, `radical` |
| `APORTE_FINANCEIRO` | VARCHAR2(10) | — | Se a iniciativa requer investimento | 📝 **Domínio:** `sim`, `nao` |
| `VALOR_APORTE` | VARCHAR2(255) | — | Valor do aporte necessário | 📝 ⚠️ **Armazenado como texto formatado em BRL** (ex.: `"R$ 10.000,00"`), não como número. Ver §6 |
| `RETORNO_ECONOMICO` | NUMBER(15,2) | — | Estimativa de retorno/economia anual (R$/ano) | 📝 Numérico — este sim agregável |

#### Bloco IV — Suporte e considerações

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `SUPORTE_NECESSARIO` | VARCHAR2(1000) | — | Tipos de apoio da Assessoria considerados críticos | 📝 ⚠️ **Múltiplos valores separados por `\|` (pipe)** em uma única coluna. Ex.: `academia\|sinergia_interna`. **Domínio:** ver [§4.3](#43-suporte_necessario). Obrigatório no formulário público (ao menos uma opção) |
| `DIAGNOSTICO_OBSERVACAO` | VARCHAR2(2000) | — | Detalhamento do apoio diagnóstico | 📝 Preenchido quando `SUPORTE_NECESSARIO` contém `diagnostico` |
| `COMENTARIOS_ADICIONAIS` | CLOB | — | Considerações livres do proponente | 📝 |

#### Bloco — Origem e procedência

Introduzido na V28. É o que permite o princípio "base única, origem preservada".

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `CANAL_CODIGO` | VARCHAR2(30) | — | Via pela qual a iniciativa entrou | ⚙️ 🔒 **Domínio:** `VIA_1`, `VIA_2`, `VIA_3`, `MAPEAMENTO_EXTERNO`. Nunca nulo em registros novos; o acervo legado recebeu `VIA_2` no backfill da V28 |
| `SISTEMA_ORIGEM` | VARCHAR2(20) | — | Sistema corporativo onde a iniciativa foi identificada | 📝 🔒 **Obrigatório quando `CANAL_CODIGO = 'VIA_1'`. Domínio:** `SGE`, `SGP` (`CK_INI_SIST_ORIGEM`) |
| `CODIGO_ORIGEM` | VARCHAR2(100) | — | Identificador do projeto no sistema de origem | 📝 🔒 **Sempre opcional**, texto livre, sem validação e sem unicidade. Serve apenas para o analista voltar ao SGE/SGP e localizar o projeto |
| `ORGANIZACAO_EXTERNA` | VARCHAR2(300) | — | Instituição parceira de origem | 📝 🔒 **Obrigatório quando `CANAL_CODIGO = 'MAPEAMENTO_EXTERNO'`** |
| `TIPO_INSTITUICAO` | VARCHAR2(30) | — | Natureza da instituição externa | 📝 🔒 **Obrigatório na Captação Externa. Domínio:** ver [§4.5](#45-tipo_instituicao) (`CK_INI_TIPO_INST`) |
| `REGISTRADO_POR_LOGIN` | VARCHAR2(100) | — | Login do analista que fez o cadastro manual | ⚙️ 🔒 Preenchido nas Vias 1, 3 e Externa. **Nulo na Via 2** — o formulário público não tem autoria autenticada |

#### Bloco — Qualificação da Assessoria

Introduzido na V31. São **avaliações internas**, não informadas pelo proponente.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `RELEVANCIA_ESTRATEGICA` | VARCHAR2(40) | — | Por que (ou se) a iniciativa importa estrategicamente | ⚙️/📝 **Domínio:** ver [§4.6](#46-relevancia_estrategica) (`CK_INI_RELEVANCIA`). Via 1 é carimbada automaticamente como `PLANEJAMENTO_ESTRATEGICO`; Via 2 nasce `INDETERMINADA`; Vias 3 e Externa o analista escolhe. **Editável por ADM em todas as vias** |
| `CLASSIFICACAO_INICIATIVA` | VARCHAR2(20) | — | Se é uma ação pontual ou um projeto estruturado | 📝 **Domínio:** `ACAO`, `PROJETO` (`CK_INI_CLASSIFICACAO`). **Nullable por decisão** — nem toda iniciativa foi classificada, e forçar um dos dois valores produziria dado inventado. Definida **apenas por ADM, apenas na edição** |

#### Bloco — Estado e controle

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `STATUS` | VARCHAR2(50) | — | Situação atual no ciclo de vida | ⚙️ Default `SUBMETIDA`. **Domínio:** `SUBMETIDA`, `EM_ANALISE`, `HOMOLOGADA`, `DESCLASSIFICADA` — ver [§4.7](#47-status). Alterado **exclusivamente** via workflow, nunca por edição direta |
| `CRIADO_EM` | DATE | ✅ | Data/hora do registro | ⚙️ 🔒 Default `SYSDATE`. Base da numeração anual do protocolo |
| `ATUALIZADO_EM` | DATE | — | Data/hora da última alteração | ⚙️ Atualizado a cada edição administrativa e a cada transição de status |
| `ANALISTA_ID` | NUMBER | — | Analista responsável | ⚠️ **Coluna legada, nunca escrita pela aplicação.** Vestígio do modelo com tabela `USUARIOS`. Sempre nula. Não usar |

#### Índices

| Índice | Colunas | Finalidade |
|---|---|---|
| `IDX_INIC_CRIADO` | `CRIADO_EM` | Ordenação padrão da listagem (mais recentes primeiro) |
| `IDX_INIC_AREA` | `AREA_PROPONENTE` | Filtro por área |
| `IDX_INI_CANAL` | `CANAL_CODIGO` | Filtro e indicadores por via de captação |

#### Constraints de domínio

| Constraint | Regra |
|---|---|
| `CK_INI_PROP_TIPO` | `PROPONENTE_TIPO` nulo ou em (`INTERNO`, `EXTERNO`) |
| `CK_INI_SIST_ORIGEM` | `SISTEMA_ORIGEM` nulo ou em (`SGE`, `SGP`) |
| `CK_INI_TIPO_INST` | `TIPO_INSTITUICAO` nulo ou em (`ICT`, `UNIVERSIDADE`, `EMPRESA_PUBLICA`, `PARCERIA`, `STARTUP`, `EMPRESA_PRIVADA`, `OUTRO`) |
| `CK_INI_RELEVANCIA` | `RELEVANCIA_ESTRATEGICA` nulo ou em (`FINANCEIRO`, `PLANEJAMENTO_ESTRATEGICO`, `INDETERMINADA`, `SEM_RELEVANCIA`) |
| `CK_INI_CLASSIFICACAO` | `CLASSIFICACAO_INICIATIVA` nulo ou em (`ACAO`, `PROJETO`) |

> Os `CHECK` são **reforço**, não a validação primária — todos admitem `NULL` para
> não quebrar o acervo legado. A regra efetiva (obrigatoriedade condicional por
> canal, por exemplo) é aplicada na camada de serviço.

---

### 3.2 `HISTORICO_STATUS`

**Finalidade.** A linha do tempo de cada iniciativa. É a resposta institucional a
"quem decidiu isso, quando e por quê" — e o principal ganho sobre a planilha, onde
mudar o status apagava o estado anterior.

**Princípio.** Registro **imutável**: nada é apagado, nada é sobrescrito. Cada
tramitação **acrescenta** uma linha. Reverter uma decisão não desfaz o evento
anterior — cria um evento novo do tipo `REVERSAO`.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária (identity) | ⚙️ |
| `INICIATIVA_ID` | NUMBER | ✅ | Iniciativa a que o evento se refere | ⚙️ Vínculo lógico com `INOVACAO_INICIATIVAS.ID` — sem FK declarada |
| `STATUS_ANTERIOR` | VARCHAR2(50) | — | Estado de onde saiu | ⚙️ **Nulo no evento de submissão** — não havia estado anterior |
| `STATUS_NOVO` | VARCHAR2(50) | ✅ | Estado para onde foi | ⚙️ |
| `TIPO_EVENTO` | VARCHAR2(30) | ✅ | Natureza do evento | ⚙️ **Domínio:** ver [§4.8](#48-tipo_evento) (`CK_HS_TIPO`) |
| `USUARIO_LOGIN` | VARCHAR2(100) | — | Quem executou | ⚙️ **Nulo no evento de submissão da Via 2** (formulário público, sem autoria autenticada). Preenchido em todos os demais casos |
| `JUSTIFICATIVA` | CLOB | — | Motivo da decisão | 📝 **Obrigatória** na desclassificação e em qualquer reversão |
| `DATA_HORA` | TIMESTAMP | ✅ | Quando ocorreu | ⚙️ Gravado em **UTC** |
| `EDITADO_EM` | TIMESTAMP | — | Quando a justificativa foi corrigida | ⚙️ Nulo se nunca editado. Marca visível de que houve correção |
| `USUARIO_ID` | NUMBER | — | Autor no modelo antigo | ⚠️ **Coluna legada, não mais escrita.** Conserva dados históricos. Use `USUARIO_LOGIN` |

**Janela de correção.** Eventos dos tipos `TRIAGEM`, `HOMOLOGACAO` e
`DESCLASSIFICACAO` podem ter a **justificativa** corrigida pelo **próprio autor**,
em até **2 horas** após o registro. Nenhum outro campo é editável, e a correção
marca `EDITADO_EM`. É a única exceção prevista à imutabilidade.

**Nota sobre a trigger de imutabilidade.** O plano de migração prevê a trigger
`TRG_HS_NO_UPD_DEL`, que bloqueia `UPDATE`/`DELETE` na tabela. Ela **não é criada
por nenhuma migration aplicada** — a V26 apenas a manipula defensivamente, caso
exista. Na configuração atual a imutabilidade é garantida pela aplicação. Se a
trigger vier a ser criada, ela precisará excluir a janela de correção de 2h, ou
essa funcionalidade deixará de operar.

**Índices:** `IDX_HS_INICIATIVA` (`iniciativa_id, data_hora`), `IDX_HS_DATA`
(`data_hora`), `IDX_HS_LOGIN` (`usuario_login`).

---

### 3.3 `INICIATIVA_OBSERVACOES`

**Finalidade.** Anotações livres registradas durante a tramitação. É onde vai o
contexto que não cabe nos campos estruturados — sem contaminar os campos que
alimentam indicadores.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária (identity) | ⚙️ |
| `INICIATIVA_ID` | NUMBER | ✅ | Iniciativa comentada | ⚙️ Vínculo lógico |
| `USUARIO_LOGIN` | VARCHAR2(100) | ✅ | Autor da observação | ⚙️ |
| `TEXTO` | CLOB | ✅ | Conteúdo | 📝 Não pode ser vazio |
| `CRIADO_EM` | TIMESTAMP | ✅ | Quando foi registrada | ⚙️ UTC |
| `EDITADO_EM` | TIMESTAMP | — | Quando foi corrigida | ⚙️ Nulo se nunca editada |

**Edição:** apenas pelo **autor**, em até **2 horas** após o registro.

**Uso automático pelo sistema:** o contexto de reunião da Via 3 (data e área) é
gravado aqui como observação inicial, autoria do analista que cadastrou — em vez
de criar colunas específicas para uma única via. É a aplicação do princípio de
preservação total: a informação não se perde nem força uma mudança de estrutura.

---

### 3.4 `CANAIS_CAPTACAO`

**Finalidade.** Catálogo das vias de captação. É **configuração como dado**:
ativar, desativar ou renomear uma via é uma operação de administração, não uma
alteração de software. Acrescentar um canal novo (hackathon, edital, caixa de
ideias) não exige mudança de estrutura.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária (identity) | ⚙️ |
| `CODIGO` | VARCHAR2(30) | ✅ | Código estável da via | 🔒 **Único** (`UQ_CANAIS_CODIGO`). **Imutável por decisão** — é a chave gravada em cada iniciativa. Nunca exibir na interface |
| `NOME` | VARCHAR2(200) | ✅ | Rótulo exibido na interface | 📝 Editável por ADM |
| `DESCRICAO` | CLOB | — | Explicação da via | 📝 Editável por ADM |
| `ATIVO` | NUMBER(1) | ✅ | 1 = disponível para registro e filtro; 0 = oculto | 📝 Default 1. Só canais ativos aparecem como opção |
| `REQUER_FORMULARIO` | NUMBER(1) | ✅ | Flag herdada do modelo original | Default 0; sem efeito no comportamento atual |
| `CRIADO_EM` / `ATUALIZADO_EM` | TIMESTAMP | ✅ | Controle | ⚙️ |

**Conteúdo atual (todos ativos):**

| `CODIGO` | `NOME` | Natureza |
|---|---|---|
| `VIA_1` | Registro de Sistemas Corporativos (SGE/SGP) | Cadastro manual autenticado |
| `VIA_2` | Formulário Interno de Submissão | Autosserviço público |
| `VIA_3` | Registro de Reuniões com Áreas | Cadastro manual autenticado |
| `MAPEAMENTO_EXTERNO` | Captação Externa | Cadastro manual autenticado |

> **Cuidado com os códigos.** Os códigos preservam a nomenclatura original das
> vias, que foi redefinida pelo negócio depois. `VIA_1` já significou "critério
> financeiro" e `MAPEAMENTO_EXTERNO` já significou "mapeamento externo". Os
> códigos foram mantidos por estabilidade dos dados já gravados; **o significado
> corrente é o da coluna `NOME`**.

---

### 3.5 `TRANSICOES_STATUS`

**Finalidade.** As regras do ciclo de vida, expressas como dado. Uma transição só
é permitida se existir uma linha aqui — o software não tem o fluxo codificado.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária (identity) | ⚙️ |
| `STATUS_ORIGEM` | VARCHAR2(50) | ✅ | Estado de partida | |
| `STATUS_DESTINO` | VARCHAR2(50) | ✅ | Estado de chegada | |
| `PERFIL_REQUERIDO` | VARCHAR2(50) | ✅ | Perfil exigido | ⚠️ Ver nota abaixo |
| `JUSTIFICATIVA_OBRIG` | NUMBER(1) | ✅ | 1 = exige justificativa | Default 0 |
| `NOTIFICAR_PROPONENTE` | NUMBER(1) | ✅ | 1 = deveria notificar o proponente | ⚠️ **Flag registrada mas ainda não acionada** — o envio automático de e-mail em mudança de status não está implementado |
| `DESCRICAO` | VARCHAR2(200) | — | Rótulo da ação na interface | |

**Unicidade:** `UQ_TS_ORIG_DEST_PERF` sobre (`status_origem`, `status_destino`, `perfil_requerido`).

**Conteúdo atual:**

| Origem | Destino | Perfil registrado | Justificativa | Ação |
|---|---|---|:---:|---|
| `SUBMETIDA` | `EM_ANALISE` | `ANALISTA_ASSESSORIA` | Não | Iniciar análise |
| `EM_ANALISE` | `HOMOLOGADA` | `ANALISTA_ASSESSORIA` | Não | Homologar |
| `EM_ANALISE` | `DESCLASSIFICADA` | `ANALISTA_ASSESSORIA` | **Sim** | Desclassificar |
| `HOMOLOGADA` | `EM_ANALISE` | `ADM` | **Sim** | Reverter homologação |
| `DESCLASSIFICADA` | `EM_ANALISE` | `ADM` | **Sim** | Reverter desclassificação |

> ⚠️ **`PERFIL_REQUERIDO` não é a autorização efetiva.** Os valores
> `ANALISTA_ASSESSORIA` são resquício de um modelo de perfis que não foi adotado.
> A autorização real é aplicada na aplicação, sobre os papéis `ADM`/`CONTRIBUTOR`:
> ambos podem iniciar análise; **apenas ADM** homologa, desclassifica ou reverte.
> A obrigatoriedade de justificativa na reversão também é imposta pela aplicação,
> independentemente do que a linha do catálogo diga. Divergência conhecida e
> registrada.

---

### 3.6 `ADMIN_USERS`

**Finalidade.** Lista de autorização de acesso ao painel administrativo. Quem não
estiver aqui (ou estiver inativo) é tratado como colaborador comum: usa o
formulário público, não vê o painel.

**Não é uma tabela de autenticação.** Não guarda senha — a identidade vem do
Active Directory. Esta tabela responde apenas "este login pode entrar no painel, e
com qual papel".

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária (identity) | ⚙️ |
| `LOGIN` | VARCHAR2(100) | ✅ | Login de domínio, normalizado | 🔒 **Único** (`UQ_AU_LOGIN`). Chave de vínculo com todo o resto do sistema |
| `NOME` | VARCHAR2(200) | — | Nome exibível | 📝/⚙️ Resolvido do Active Directory no cadastro |
| `EMAIL` | VARCHAR2(200) | — | E-mail corporativo | ⚙️ Resolvido do Active Directory |
| `ROLE` | VARCHAR2(20) | ✅ | Papel de acesso | **Domínio:** `ADM`, `CONTRIBUTOR` — ver [§4.9](#49-role) |
| `ATIVO` | NUMBER(1) | ✅ | 1 = acesso liberado; 0 = revogado | Default 1. Revogar é desativar, **não excluir** — preserva a atribuição histórica dos registros feitos pela pessoa |
| `CRIADO_EM` | TIMESTAMP | ✅ | Data do cadastro | ⚙️ |

**Regras de proteção:**

- Ninguém altera o próprio usuário (nem o status, nem o papel).
- O **último `ADM` ativo** não pode ser desativado.
- O papel só muda por **promoção** (`CONTRIBUTOR` → `ADM`). O sistema não rebaixa.

---

### 3.7 `TERMOS_ACEITES`

**Finalidade.** Estado autoritativo do aceite ou recusa dos Termos e Condições de
Uso, **por usuário e por versão dos termos**.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária (identity) | ⚙️ |
| `LOGIN` | VARCHAR2(100) | ✅ | Usuário que se manifestou | ⚙️ |
| `VERSAO_TERMOS` | VARCHAR2(20) | ✅ | Versão vigente no momento da manifestação | ⚙️ Vem da configuração da aplicação |
| `ACAO` | VARCHAR2(10) | ✅ | Manifestação | **Domínio:** `ACEITE`, `RECUSA` (`CK_TA_ACAO`) |
| `IP` | VARCHAR2(45) | — | Endereço de origem | ⚙️ Comprimento suporta IPv6 |
| `USER_AGENT` | VARCHAR2(400) | — | Navegador/dispositivo | ⚙️ Truncado em 400 caracteres |
| `REGISTRADO_EM` | TIMESTAMP | ✅ | Quando | ⚙️ UTC |

**Semântica.** A tabela é **append-only**: cada manifestação gera uma linha nova.
O estado corrente é a linha **mais recente** para aquele login **naquela versão**.
Consequências:
- Uma recusa posterior a um aceite volta a exigir manifestação.
- Publicar uma versão nova dos termos faz todos os usuários voltarem a ser
  perguntados, sem apagar as manifestações anteriores.
- Se a consulta falhar, o sistema assume "não aceito" (comportamento *fail-safe*).

**Índice:** `IDX_TA_LOGIN_VERSAO` (`login, versao_termos`).

---

### 3.8 `INOVACAO_LOGS`

**Finalidade.** Trilha técnica de auditoria. É a **segunda camada** do modelo de
auditoria: enquanto `HISTORICO_STATUS` registra a *história de negócio* da
iniciativa, esta tabela registra *operações no sistema* — quem entrou, quem
submeteu, quem editou, quem consentiu.

| Coluna | Tipo | Obrig. | Descrição | Regras |
|---|---|:---:|---|---|
| `ID` | NUMBER | ✅ | Chave primária, gerada por `SEQ_LOG` | ⚙️ |
| `USERNAME` | VARCHAR2(100) | ✅ | Quem realizou a ação | ⚙️ Login autenticado nas ações do painel; **nome autoinformado** na submissão pública |
| `ACAO` | VARCHAR2(100) | ✅ | Tipo de operação | ⚙️ **Domínio:** ver [§4.10](#410-acao-de-auditoria) |
| `DETALHE` | VARCHAR2(1000) | — | Contexto: protocolo, ID, valores alterados | ⚙️ Truncado no limite da coluna |
| `CRIADO_EM` | DATE | ✅ | Quando | ⚙️ `SYSDATE` |

**Comportamento.** A gravação é **assíncrona e não-bloqueante**: uma falha ao
registrar o log nunca invalida a operação de negócio. Consequência aceita: em caso
de indisponibilidade do banco no instante do registro, um evento pode não ser
gravado. Por isso a auditoria de negócio (`HISTORICO_STATUS`) é escrita de forma
síncrona, na mesma transação da mudança.

**Índices:** `IDX_LOG_USERNAME` (`username`), `IDX_LOG_CRIADO` (`criado_em`).

---

## 4. Domínios de valor

Todos os domínios abaixo têm **fonte única na aplicação**. Os `CHECK` do banco
reforçam os críticos.

### 4.1 `ESTAGIO_DESENVOLVIMENTO`

| Valor | Rótulo | Significado |
|---|---|---|
| `ideacao` | Ideação | A ideia está estruturada, mas ainda não foi testada na prática |
| `piloto` | Teste / Piloto (MVP) | Em teste inicial ou protótipo, em ambiente restrito |
| `escala` | Escala / Operação Ativa | Já implementada e rodando na rotina da área |
| `paralisada` | Paralisada | Foi iniciada, mas está interrompida ou travada |

### 4.2 `MACRODIMENSAO`

| Valor | Rótulo | Abrange |
|---|---|---|
| `tecnologica` | Inovação Tecnológica | Software, IA, sensores, IoT, automação de equipamentos |
| `operacional` | Inovação Operacional | Distribuição, tratamento de água, eficiência energética |
| `gerencial` | Inovação Gerencial / Administrativa | Desburocratização, digitalização, novos modelos de compra |
| `social_ambiental` | Inovação Social e Ambiental | Saneamento verde, mananciais, comunidades vulneráveis |
| `outros` | Outros / Multidimensionais | Híbridas ou não classificáveis — abre `MACRODIMENSAO_OBSERVACAO` |

### 4.3 `SUPORTE_NECESSARIO`

Múltipla escolha, gravada como valores separados por `|`.

| Valor | Rótulo |
|---|---|
| `instrumentos_juridicos` | Modelagem de Instrumentos Técnicos e Jurídicos (TR, ACT) |
| `academia` | Conexão com a Academia / Universidades |
| `mercado_startups` | Conexão com o Mercado / Startups |
| `sinergia_interna` | Sinergia Interna / Conexão Interdepartamental |
| `monitoramento` | Apenas Monitoramento Corporativo |
| `diagnostico` | Apoio Diagnóstico — abre `DIAGNOSTICO_OBSERVACAO` |

### 4.4 `PERFIL_IMPACTO` e `APORTE_FINANCEIRO`

| Coluna | Valores |
|---|---|
| `PERFIL_IMPACTO` | `incremental` (ajuste de processo existente) · `radical` (método ou tecnologia inédita na companhia) |
| `APORTE_FINANCEIRO` | `sim` (requer investimento orçamentário) · `nao` (recursos já existentes) |

### 4.5 `TIPO_INSTITUICAO`

| Valor | Rótulo | Aceito em novos cadastros |
|---|---|:---:|
| `ICT` | ICT (Instituição Científica, Tecnológica e de Inovação) | ✅ |
| `UNIVERSIDADE` | Universidade | ✅ |
| `EMPRESA_PUBLICA` | Empresa Pública | ✅ |
| `EMPRESA_PRIVADA` | Empresa Privada | ✅ |
| `STARTUP` | Startup | ✅ |
| `OUTRO` | Outro | ✅ |
| `PARCERIA` | Parceria (legado) | ❌ |

> `PARCERIA` saiu do domínio de novos cadastros, mas **permanece no `CHECK` e no
> mapa de rótulos** porque existem registros gravados com esse valor. Relatórios
> que agrupem por tipo de instituição precisam contemplá-lo.

### 4.6 `RELEVANCIA_ESTRATEGICA`

| Valor | Rótulo na interface |
|---|---|
| `FINANCEIRO` | Sim, por retorno financeiro |
| `PLANEJAMENTO_ESTRATEGICO` | Sim, por estar no Planejamento Estratégico |
| `INDETERMINADA` | Ainda não é possível determinar |
| `SEM_RELEVANCIA` | Não possui relevância estratégica |

**Como o valor é atribuído:**

| Via | Valor inicial | Editável por ADM |
|---|---|:---:|
| Via 1 (SGE/SGP) | `PLANEJAMENTO_ESTRATEGICO` — carimbo automático do sistema | ✅ |
| Via 2 (formulário) | `INDETERMINADA` — é uma avaliação da Assessoria, não do proponente | ✅ |
| Via 3 e Captação Externa | Escolhido pelo analista; `INDETERMINADA` se não informado | ✅ |

> `INDETERMINADA` não é "sem dado": é o estado real de uma iniciativa ainda não
> avaliada. O backfill da V31 atribuiu esse valor ao acervo legado, que
> literalmente nunca passou por essa avaliação.

### 4.7 `STATUS`

| Valor | Rótulo | Terminal |
|---|---|:---:|
| `SUBMETIDA` | Submetida | Não |
| `EM_ANALISE` | Em Análise | Não |
| `HOMOLOGADA` | Homologada | Sim (reversível por ADM) |
| `DESCLASSIFICADA` | Desclassificada | Sim (reversível por ADM) |

> **Valores históricos.** `HOMOLOGADA` e `DESCLASSIFICADA` chamavam-se `APROVADA` e
> `REPROVADA`. A V26 renomeou os valores em toda a base — iniciativas, histórico e
> catálogo de transições. Consultas antigas que filtrem por `APROVADA`/`REPROVADA`
> não retornam nada.
>
> **Estados inativos.** O schema comporta `RASCUNHO`, `DEVOLVIDA`, `SUSPENSA`,
> `CONCLUIDA` e `CANCELADA`, mas nenhum está em uso — não há transição cadastrada
> para eles.

### 4.8 `TIPO_EVENTO`

| Valor | Quando é gerado |
|---|---|
| `SUBMISSAO` | Criação da iniciativa, por qualquer via |
| `TRIAGEM` | Submetida → Em Análise |
| `HOMOLOGACAO` | Em Análise → Homologada |
| `DESCLASSIFICACAO` | Em Análise → Desclassificada |
| `REVERSAO` | Homologada ou Desclassificada → Em Análise |
| `ANALISE` | Genérico — destino sem mapeamento específico |
| `CORRECAO` | Previsto no domínio; sem uso corrente |

> `REVERSAO` existe justamente para que desfazer uma decisão seja distinguível de
> uma triagem comum na linha do tempo. Sem esse tipo, a reversão apareceria como
> `TRIAGEM` e o rastro se perderia.

### 4.9 `ROLE`

| Valor | Alcance |
|---|---|
| `CONTRIBUTOR` | Opera toda a esteira: cadastra pelas vias manuais, consulta, inicia análise, comenta, exporta, vê indicadores. **Não decide** |
| `ADM` | Tudo do `CONTRIBUTOR`, mais: homologar, desclassificar, reverter decisão, editar dados da iniciativa, definir relevância e classificação, gerir canais e usuários |

### 4.10 `ACAO` de auditoria

| Valor | Evento registrado |
|---|---|
| `login` | Autenticação bem-sucedida no painel |
| `submit_formulario` | Submissão pelo formulário público (Via 2) |
| `ciencia_privacidade` | Confirmação de ciência do aviso de privacidade (LGPD) na submissão |
| `registrar_iniciativa` | Cadastro manual por analista (Vias 1, 3 ou Externa) |
| `editar_iniciativa` | Edição administrativa dos dados de uma iniciativa |
| `classificar_iniciativa` | Alteração de relevância estratégica ou classificação Ação/Projeto — **uma entrada por campo, com valor anterior e novo** |
| `reverter_decisao` | Reversão de homologação ou desclassificação, com a justificativa |
| `termos_aceite` | Aceite dos Termos e Condições de Uso |
| `termos_recusa` | Recusa dos Termos e Condições de Uso |

> Tramitações normais da esteira **não** geram entrada aqui — já estão auditadas em
> `HISTORICO_STATUS`. Só a reversão, por ser ato administrativo excepcional, é
> registrada nas duas camadas.

---

## 5. Regras de negócio sobre os dados

Consolidação das regras que a aplicação garante e que o banco, sozinho, não
garantiria.

| # | Regra |
|---|---|
| **1** | Toda iniciativa tem `CANAL_CODIGO` preenchido — nenhum registro entra na base sem origem |
| **2** | O canal define o tipo de proponente: `MAPEAMENTO_EXTERNO` → `EXTERNO`; demais → `INTERNO`. Nunca é escolhido pelo usuário |
| **3** | Proponente externo exige `ORGANIZACAO_EXTERNA` e `TIPO_INSTITUICAO` |
| **4** | Via 1 exige `SISTEMA_ORIGEM` (`SGE` ou `SGP`); `CODIGO_ORIGEM` é sempre opcional e livre |
| **5** | Vias 1, 3 e Externa exigem `REGISTRADO_POR_LOGIN` (analista autenticado). A Via 2 não tem autoria autenticada |
| **6** | Toda iniciativa recebe `CODIGO_PUBLICO` único no padrão `INOV-AAAA-NNN`, gerado na mesma transação da criação |
| **7** | Toda iniciativa nasce com um evento `SUBMISSAO` em `HISTORICO_STATUS`, na mesma transação |
| **8** | O ciclo de vida é único: a origem não altera as transições permitidas |
| **9** | Origem e procedência são imutáveis pela operação normal |
| **10** | Somente canais com `ATIVO = 1` aparecem como opção de registro e de filtro |
| **11** | Nenhum dado é descartado: contexto sem campo próprio vira observação registrada |
| **12** | Proponente (`NOME_COLABORADOR`, `CANAL_CONTATO`) é obrigatório em todas as vias **exceto** a Captação Externa |
| **13** | Via 1 é carimbada como `PLANEJAMENTO_ESTRATEGICO`; qualquer valor de relevância enviado pelo cliente é descartado |
| **14** | Desclassificação e reversão exigem justificativa não-vazia |
| **15** | Homologar, desclassificar e reverter são exclusivos de `ADM` |
| **16** | Observações e justificativas são editáveis **apenas pelo autor**, **apenas em 2 horas** |
| **17** | O `STATUS` só muda por transição de workflow — nunca por edição administrativa de dados |
| **18** | A submissão pública exige confirmação de ciência do aviso de privacidade, validada no servidor |

---

## 6. Pontos de atenção do modelo

Registrados para quem for consultar o banco, construir relatórios ou evoluir o
sistema. Nenhum é bloqueante; todos têm impacto conhecido.

| Item | Situação | Impacto prático |
|---|---|---|
| **`SUPORTE_NECESSARIO` pipe-delimited** | Múltiplos valores em uma coluna, separados por `\|` | Contar por tipo de suporte exige separar a string. Um `GROUP BY` direto conta combinações, não tipos |
| **`VALOR_APORTE` como texto** | Valor monetário gravado formatado (`"R$ 10.000,00"`) | Não é somável nem comparável em SQL sem conversão. `RETORNO_ECONOMICO`, em contraste, é numérico |
| **`AREA_PROPONENTE` como texto livre** | Não há catálogo de unidades organizacionais em uso | Variação de grafia entre registros. É o resquício mais relevante do problema de inconsistência que o sistema combate |
| **Ausência de foreign keys** | Vínculos garantidos apenas pela aplicação | Inserções feitas fora da aplicação podem criar órfãos. Não confiar em integridade referencial do banco |
| **`PERFIL_REQUERIDO` desatualizado** | Guarda `ANALISTA_ASSESSORIA`, perfil que não existe na prática | A autorização efetiva está na aplicação (`ADM`/`CONTRIBUTOR`). Não usar essa coluna para inferir permissões |
| **`NOTIFICAR_PROPONENTE` sem efeito** | Flag registrada, motor de envio não implementado | Nenhum e-mail é disparado em mudança de status |
| **Colunas legadas** | `ANALISTA_ID` (iniciativas) e `USUARIO_ID` (histórico) não são mais escritas | Sempre nulas em registros novos. Não usar em consultas |
| **Trigger de imutabilidade ausente** | `TRG_HS_NO_UPD_DEL` está no plano, não em migration aplicada | Imutabilidade garantida pela aplicação. Ver §3.2 |
| **Catálogos não sincronizados** | `DOMINIO_VALORES`, `STATUS_WORKFLOW` e outros existem mas não são mantidos | Relatórios não devem lê-los. Os domínios corretos estão na §4 deste documento |
| **Renomeação de status na V26** | `APROVADA`/`REPROVADA` → `HOMOLOGADA`/`DESCLASSIFICADA`, em toda a base | Consultas e relatórios antigos com os nomes antigos retornam vazio |
| **Listagem sem autenticação** | O endpoint de listagem de iniciativas responde sem sessão | Ajuste conhecido e pendente. Detalhe, histórico, edição, tramitação e exportação exigem autenticação |

---

## 7. Consultas de referência

Exemplos prontos, já contemplando as particularidades acima.

**Portfólio por canal, com rótulo legível:**
```sql
SELECT c.nome AS canal, COUNT(*) AS total
  FROM INOVACAO_INICIATIVAS i
  LEFT JOIN CANAIS_CAPTACAO c ON c.codigo = NVL(i.CANAL_CODIGO, 'VIA_2')
 GROUP BY c.nome
 ORDER BY total DESC;
```

**Taxa de homologação por canal:**
```sql
SELECT NVL(CANAL_CODIGO, 'VIA_2')                              AS canal,
       COUNT(*)                                                AS total,
       SUM(CASE WHEN STATUS = 'HOMOLOGADA' THEN 1 ELSE 0 END)  AS homologadas,
       ROUND(100 * SUM(CASE WHEN STATUS = 'HOMOLOGADA' THEN 1 ELSE 0 END)
             / COUNT(*), 1)                                    AS taxa_pct
  FROM INOVACAO_INICIATIVAS
 GROUP BY NVL(CANAL_CODIGO, 'VIA_2');
```

**Linha do tempo completa de uma iniciativa:**
```sql
SELECT h.DATA_HORA, h.TIPO_EVENTO, h.STATUS_ANTERIOR, h.STATUS_NOVO,
       h.USUARIO_LOGIN, DBMS_LOB.SUBSTR(h.JUSTIFICATIVA, 4000, 1) AS justificativa,
       h.EDITADO_EM
  FROM HISTORICO_STATUS h
  JOIN INOVACAO_INICIATIVAS i ON i.ID = h.INICIATIVA_ID
 WHERE i.CODIGO_PUBLICO = 'INOV-2026-014'
 ORDER BY h.DATA_HORA;
```

**Contagem por tipo de suporte (desfazendo o pipe):**
```sql
SELECT REGEXP_SUBSTR(SUPORTE_NECESSARIO, '[^|]+', 1, lvl) AS suporte,
       COUNT(*)                                           AS total
  FROM INOVACAO_INICIATIVAS
 CROSS JOIN LATERAL (
   SELECT LEVEL AS lvl FROM DUAL
   CONNECT BY LEVEL <= REGEXP_COUNT(SUPORTE_NECESSARIO, '\|') + 1
 )
 WHERE SUPORTE_NECESSARIO IS NOT NULL
 GROUP BY REGEXP_SUBSTR(SUPORTE_NECESSARIO, '[^|]+', 1, lvl)
 ORDER BY total DESC;
```

**Iniciativas que tiveram decisão revertida:**
```sql
SELECT i.CODIGO_PUBLICO, i.TITULO_INICIATIVA, i.STATUS AS status_atual,
       h.STATUS_ANTERIOR AS decisao_revertida, h.USUARIO_LOGIN, h.DATA_HORA,
       DBMS_LOB.SUBSTR(h.JUSTIFICATIVA, 4000, 1) AS justificativa
  FROM HISTORICO_STATUS h
  JOIN INOVACAO_INICIATIVAS i ON i.ID = h.INICIATIVA_ID
 WHERE h.TIPO_EVENTO = 'REVERSAO'
 ORDER BY h.DATA_HORA DESC;
```

---

## 8. Histórico de evolução do schema

| Migration | O que introduziu |
|---|---|
| `create_tables.sql` | `INOVACAO_INICIATIVAS` e `INOVACAO_LOGS` — modelo original |
| `V01`–`V09` | Catálogos e tabelas do modelo normalizado planejado (hoje **não utilizados** — ver §2.3) |
| `V12`, `V13` | `TRANSICOES_STATUS` e as três transições iniciais do ciclo de vida |
| `V14` | `HISTORICO_STATUS` — linha do tempo imutável |
| `V19` | `CODIGO_PUBLICO`, `STATUS`, `ATUALIZADO_EM`, `ANALISTA_ID` na iniciativa |
| `V20` | `ADMIN_USERS` — autorização de acesso ao painel |
| `V21` | `USUARIO_LOGIN` no histórico (substitui `USUARIO_ID`) |
| `V22` | `EMAIL_PROPONENTE` e `DIAGNOSTICO_OBSERVACAO` |
| `V23` | `INICIATIVA_OBSERVACOES` |
| `V24` | `EDITADO_EM` em observações e histórico — janela de correção de 2h |
| `V25` | `EMAIL` em `ADMIN_USERS` |
| `V26` | Renomeação dos status terminais: `APROVADA`/`REPROVADA` → `HOMOLOGADA`/`DESCLASSIFICADA` |
| `V27` | `SOLUCAO_PROPOSTA` deixa de ser obrigatória; `MACRODIMENSAO_OBSERVACAO` |
| `V28` | **Captação multicanal:** colunas de origem e procedência, backfill do acervo para `VIA_2`, protocolo retroativo, índice por canal |
| `V29` | Rótulos oficiais dos quatro canais e ativação das quatro vias |
| `V30` | `TERMOS_ACEITES` |
| `V31` | `RELEVANCIA_ESTRATEGICA`, `CLASSIFICACAO_INICIATIVA`, proponente opcional na Captação Externa, ampliação do domínio de instituição, evento `REVERSAO` e transições de reversão |

**Princípio observado em toda a evolução:** aditiva e idempotente. Colunas novas
sempre nullable, nenhuma coluna removida ou renomeada, nenhum dado descartado,
migrations seguras para reexecutar.
