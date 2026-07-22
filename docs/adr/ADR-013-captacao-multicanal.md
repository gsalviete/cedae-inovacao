# ADR-013 — Captação Multicanal: Consolidação das Vias 1, 2, 3 e Captação Externa

**Status:** PROPOSTA (aguarda validação da Assessoria de Inovação antes da implementação)
**Data:** 2026-07-21
**Revisão:** 2026-07-21 — Via 1 redefinida como **cadastro manual** (sem qualquer integração, importação ou leitura automática de SGE/SGP)
**Épico previsto:** E6 — Captação Multicanal (novo)
**Substitui/estende:** ADR-011 (Proponentes apenas internos no MVP); complementa ADR-001, ADR-002B, ADR-004, ADR-012
**Fontes:** `as-is-system-analysis.md`, `future-data-model.md`, `final-adrs.md`, `FINAL_ADJUSTMENTS.md`, `autenticacao-ldap.md`, `mvp-scope.md`, `epic-breakdown.md`, migrations `V01`–`V27`, código atual de `backend/src`

> Este documento é uma **especificação funcional consolidada** redigida no formato de ADR estendido. Serve como fonte oficial para a próxima etapa de implementação. Nenhum código é definido aqui — apenas comportamento, regras, entidades e critérios de aceite.

---

## 1. Visão Geral da Solução

### 1.1 O que existe hoje (linha de base real)

O sistema é, hoje, uma **esteira de captação de iniciativas de inovação da CEDAE** que implementa **apenas a Via 2** — o formulário interno de submissão ativa — mais um painel administrativo de acompanhamento e gestão do ciclo de vida.

Fatos verificados no código e nas migrations (não no que os ADRs originais planejavam):

- As iniciativas são gravadas na tabela **`INOVACAO_INICIATIVAS`** (tabela legada estendida aditivamente — migrations `V19`, `V22`, `V27`), **não** na tabela `INICIATIVAS` do modelo TO-BE de `future-data-model.md`. A migração para o schema totalmente normalizado **não** foi executada; adotou-se a estratégia aditiva do ADR-001 sobre a tabela existente.
- O ciclo de vida é gerido por um **motor de workflow orientado a dados** (`TRANSICOES_STATUS` + `WorkflowService`), com histórico em **`HISTORICO_STATUS`** e observações livres em **`INICIATIVA_OBSERVACOES`**.
- Estados terminais foram renomeados (migration `V26`): o ciclo real hoje é `SUBMETIDA → EM_ANALISE → HOMOLOGADA | DESCLASSIFICADA`.
- A autenticação **não usa JWT/senha própria**. A identidade vem de **login direto no Active Directory via LDAPS** (`autenticacao-ldap.md`), com sessão em cookie `httpOnly`; a autorização é uma **whitelist `ADMIN_USERS`** com papéis `ADM` e `CONTRIBUTOR`. O formulário Via 2 permanece público.
- A tabela **`CANAIS_CAPTACAO` já existe e já foi semeada com os quatro canais** (`VIA_1`, `VIA_2`, `VIA_3`, `MAPEAMENTO_EXTERNO`), porém **somente `VIA_2` está ativa** (`ativo = 1`) e **a tabela de iniciativas não possui vínculo com o canal** — não há coluna que registre por qual via cada iniciativa entrou.

### 1.2 O que esta especificação define

Evoluir o sistema de **canal único (Via 2)** para **captação multicanal**, na qual **quatro vias distintas de entrada alimentam uma única base consolidada de iniciativas**, preservando a **origem de cada registro** para fins de rastreabilidade, análise e governança.

**Todas as vias que não sejam a Via 2 são cadastros manuais** feitos por um analista autenticado no painel. Não há integração, importação, sincronização ou leitura automática de qualquer sistema externo. O que distingue as vias é a **procedência** da iniciativa e o **tipo de proponente**:

| Via | Nome | Natureza da entrada | Autenticação | Proponente |
|---|---|---|---|---|
| **Via 1** | Registro de Iniciativas de Sistemas Corporativos (SGE / SGP) | Cadastro manual no painel | CONTRIBUTOR/ADM | Interno |
| **Via 2** | Formulário Interno de Submissão (existente) | Autosserviço público | Nenhuma (público) | Interno |
| **Via 3** | Registro de Iniciativas de Reuniões com Áreas | Cadastro manual no painel | CONTRIBUTOR/ADM | Interno (área) |
| **Captação Externa** | Iniciativas de ICTs, universidades, empresas públicas e parceiros | Cadastro manual no painel | CONTRIBUTOR/ADM | **Externo** |

O princípio central é: **base única, origem preservada**. Todas as vias resultam em registros na mesma tabela de iniciativas, com o mesmo ciclo de vida e a mesma governança, diferenciados por um campo de **canal de origem** e pelos poucos metadados de procedência de cada via.

**Sobre a Via 1 (esclarecimento essencial):** na operação real da Assessoria, o analista **acessa manualmente** os sistemas SGE/SGP, identifica iniciativas relevantes e as **digita** no Banco de Dados de Inovação. Hoje isso é feito copiando as informações para uma planilha; o novo sistema apenas **substitui essa planilha por um cadastro centralizado**. A Via 1 é, portanto, um cadastro manual idêntico ao da Via 3 — a única diferença é que a iniciativa foi **identificada em um sistema corporativo existente**, e o formulário registra essa procedência (Sistema de Origem e, opcionalmente, o código do projeto na origem).

### 1.3 Reconciliação de nomenclatura das vias

A definição de negócio atual **redefine** os rótulos originais dos canais semeados em `V03`/`future-data-model.md`. Esta especificação passa a ser a fonte de verdade dos rótulos:

| Código do canal (imutável) | Rótulo original (V03) | Rótulo desta especificação |
|---|---|---|
| `VIA_1` | Formulário Interno (Critério Financeiro) | **Registro de Sistemas Corporativos (SGE/SGP)** |
| `VIA_2` | Formulário Interno (Captação Ativa) | Formulário Interno de Submissão *(inalterado)* |
| `VIA_3` | Registro Simplificado Interno | **Registro de Reuniões com Áreas** |
| `MAPEAMENTO_EXTERNO` | Mapeamento Externo | **Captação Externa** |

Os **códigos** (`VIA_1`, `VIA_3`, `MAPEAMENTO_EXTERNO`) são mantidos por estabilidade; apenas `nome`/`descricao` são atualizados via `UPDATE` em `CANAIS_CAPTACAO`, e os três canais passam a `ativo = 1`.

---

## 2. Objetivos de Negócio

1. **Consolidar o portfólio de inovação em uma base única.** Hoje só a Via 2 alimenta o sistema; iniciativas de reuniões, de sistemas corporativos (SGE/SGP) e de parceiros externos vivem fora do sistema (planilhas, e-mails, atas). O objetivo é que **100% das iniciativas de inovação** da CEDAE estejam no sistema, independentemente da origem.
2. **Preservar a rastreabilidade da origem.** Para cada iniciativa deve ser possível responder: *de onde ela veio, por qual via, quem a registrou e quando*.
3. **Substituir a planilha da Via 1 por um cadastro centralizado.** Hoje o analista consulta SGE/SGP e copia iniciativas relevantes para uma planilha; o sistema passa a ser o repositório único desse cadastro, com procedência registrada.
4. **Formalizar a captação em reuniões (Via 3)**, dando um registro estruturado e auditável a iniciativas que hoje se perdem em atas.
5. **Abrir o portfólio à inovação aberta (Captação Externa)**, registrando iniciativas oriundas de ICTs, universidades, empresas públicas e parceiros, com identificação da instituição de origem.
6. **Fornecer indicadores por canal**, permitindo à liderança medir a efetividade de cada via de captação (volume, taxa de aprovação, tempo de análise por origem).
7. **Manter a governança e o ciclo de vida únicos**, sem bifurcar o processo de análise por origem — a origem qualifica a iniciativa, mas não cria um fluxo separado.

---

## 3. Arquitetura Funcional

### 3.1 Princípio arquitetural

```
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌────────────────────┐
   │    VIA 1      │   │    VIA 2      │   │    VIA 3      │   │  CAPTAÇÃO EXTERNA  │
   │ Cadastro de   │   │ Formulário    │   │ Cadastro de   │   │ Cadastro de        │
   │ iniciativa    │   │ público       │   │ iniciativa    │   │ iniciativa         │
   │ vista em      │   │ (autosserviço)│   │ de reunião    │   │ de parceiro        │
   │ SGE/SGP       │   │               │   │ com área      │   │ externo            │
   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘   └─────────┬──────────┘
    (painel, analista)   (público)         (painel, analista)    (painel, analista)
           │                   │                   │                     │
           ▼                   ▼                   ▼                     ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              CAMADA DE INGESTÃO (normaliza + carimba a origem)                 │
   │  • define o tipo de proponente (interno ou externo)                           │
   │  • grava CANAL_CODIGO + metadados de procedência                             │
   │  • gera CODIGO_PUBLICO                                                         │
   │  • cria evento inicial em HISTORICO_STATUS (tipo SUBMISSAO)                    │
   └───────────────────────────────────────┬───────────────────────────────────────┘
                                           ▼
                          ┌────────────────────────────────┐
                          │   BASE ÚNICA DE INICIATIVAS     │
                          │   (INOVACAO_INICIATIVAS)        │
                          └────────────────┬───────────────┘
                                           ▼
                 ┌──────────────────────────────────────────────────┐
                 │   CICLO DE VIDA ÚNICO (WorkflowService)           │
                 │   SUBMETIDA → EM_ANALISE → HOMOLOGADA/DESCLASSIF. │
                 │   + HISTORICO_STATUS + INICIATIVA_OBSERVACOES     │
                 └──────────────────────────────────────────────────┘
                                           ▼
                 ┌──────────────────────────────────────────────────┐
                 │   PAINEL ADMINISTRATIVO + INDICADORES (por canal) │
                 └──────────────────────────────────────────────────┘
```

Todas as vias — inclusive a Via 1 — são **entradas humanas**. Não há componente de integração, agendamento ou leitura de bases externas em nenhum ponto do diagrama.

### 3.2 Camada de ingestão como ponto de convergência

Todas as vias devem convergir em uma **camada de ingestão comum** (conceito, não necessariamente um único arquivo) responsável por três garantias invariantes, independentemente da via:

1. **Carimbo de origem obrigatório** — nenhum registro entra na base sem `CANAL_CODIGO` preenchido.
2. **Geração de protocolo** — `CODIGO_PUBLICO` no padrão `INOV-AAAA-NNN` é gerado para toda iniciativa, qualquer que seja a via.
3. **Evento inicial de histórico** — todo registro nasce com um evento `SUBMISSAO` em `HISTORICO_STATUS`, garantindo linha do tempo auditável desde a entrada (padrão já usado hoje em `IniciativasService.registrarSubmissao`).

A Via 2 já implementa esse contrato; as Vias 1, 3 e Externa (todas cadastros manuais no painel) devem reutilizá-lo, não recriá-lo.

### 3.3 Módulos (visão funcional)

| Módulo | Responsabilidade | Estado |
|---|---|---|
| `IniciativasModule` | Submissão Via 2 (público), consulta, detalhe | Existe — estender |
| `WorkflowModule` | Transições, histórico, observações | Existe — reutilizar sem mudança de fluxo |
| `AuthModule` (LDAP + sessão) | Identidade e whitelist `ADMIN_USERS` | Existe — reutilizar |
| `AdminModule` | KPIs, gestão de usuários, logs | Existe — estender (indicadores por canal) |
| **Endpoints de registro manual (novo)** | Vias 1, 3 e Externa — cadastro manual autenticado com procedência | **Novo** |
| **`ReferenceDataModule` (novo)** | Expor canais ativos e domínios para os formulários | **Novo (leve)** |

Não há módulo de importação/integração. As três vias manuais compartilham o mesmo endpoint de registro autenticado, diferindo apenas nos campos de procedência.

---

## 4. Fluxo Completo de Captação

### 4.1 Via 2 — Formulário Interno (existente, referência do contrato)

1. Colaborador acessa o formulário público (sem login).
2. Preenche os blocos (identificação, problema, solução, classificação, suporte).
3. `POST /api/iniciativas` grava em `INOVACAO_INICIATIVAS` com `STATUS = 'SUBMETIDA'`.
4. Camada de ingestão gera `CODIGO_PUBLICO` e cria evento `SUBMISSAO` em `HISTORICO_STATUS`.
5. Tela de sucesso exibe o protocolo ao proponente.
6. **Mudança nesta especificação:** gravar `CANAL_CODIGO = 'VIA_2'` e `PROPONENTE_TIPO = 'INTERNO'`.

### 4.2 Via 1 — Registro de Iniciativas de Sistemas Corporativos (SGE/SGP) (novo, cadastro manual)

1. O analista (papel `CONTRIBUTOR` ou `ADM`), **autenticado**, consulta **manualmente** o SGE ou o SGP (fora do sistema) e identifica uma iniciativa relevante.
2. Acessa "Registrar Iniciativa — SGE/SGP" no painel.
3. Preenche **manualmente** todos os dados da iniciativa (mesmos campos da Via 2), acrescidos apenas dos campos de **procedência**:
   - **Sistema de Origem** — `SGE` ou `SGP` (obrigatório nesta via).
   - **Código/Identificador do projeto na origem** — opcional, texto livre, apenas para rastreabilidade (permite ao analista voltar ao SGE/SGP e localizar o projeto original).
4. `POST /api/admin/iniciativas` com `CANAL_CODIGO = 'VIA_1'`, `PROPONENTE_TIPO = 'INTERNO'`, `SISTEMA_ORIGEM`, `CODIGO_ORIGEM` (opcional) e `REGISTRADO_POR_LOGIN` = login do analista.
5. Camada de ingestão idêntica à Via 2 (protocolo + evento inicial `SUBMISSAO`). O evento inicial registra o `usuario_login` do analista que fez o cadastro.

> A Via 1 **não** lê, importa nem sincroniza dados de SGE/SGP. Todos os dados são digitados pelo analista. `SISTEMA_ORIGEM` e `CODIGO_ORIGEM` são apenas anotações de procedência.

### 4.3 Via 3 — Registro de Reuniões com Áreas (novo, cadastro manual)

1. Analista (papel `CONTRIBUTOR` ou `ADM`), **autenticado**, acessa "Registrar Iniciativa (Reunião)" no painel.
2. Preenche manualmente um formulário equivalente ao da Via 2, acrescido do contexto de reunião (data da reunião, área participante).
3. `POST /api/admin/iniciativas` com `CANAL_CODIGO = 'VIA_3'`, `PROPONENTE_TIPO = 'INTERNO'`, `REGISTRADO_POR_LOGIN` = login do analista.
4. Camada de ingestão idêntica à Via 2 (protocolo + evento inicial). O evento inicial registra o `usuario_login` do analista que fez o registro.

### 4.4 Captação Externa (novo, cadastro manual)

1. Analista **autenticado** acessa "Captação Externa" no painel.
2. Preenche manualmente o formulário com os dados da iniciativa **e da instituição de origem**: nome da instituição, tipo (`ICT`, `UNIVERSIDADE`, `EMPRESA_PUBLICA`, `PARCERIA`, `OUTRO`), contato do proponente externo.
3. `POST /api/admin/iniciativas` com `CANAL_CODIGO = 'MAPEAMENTO_EXTERNO'`, `PROPONENTE_TIPO = 'EXTERNO'`, `ORGANIZACAO_EXTERNA`, `TIPO_INSTITUICAO`, `REGISTRADO_POR_LOGIN`.
4. Camada de ingestão idêntica (protocolo + evento inicial).

### 4.5 Convergência

A partir do momento em que a iniciativa está na base, **o fluxo é idêntico para todas as vias**: aparece nas listagens, é analisada, transita de status, recebe observações e entra nos indicadores. A origem é um **atributo** da iniciativa, não um fluxo paralelo. As Vias 1, 3 e Externa são o **mesmo cadastro manual autenticado**, distinguindo-se apenas pelos campos de procedência e pelo tipo de proponente.

---

## 5. Origem dos Dados

| Via | Como o dado chega | Autoria registrada | Procedência anotada |
|---|---|---|---|
| Via 1 | Analista consulta SGE/SGP manualmente e **digita** a iniciativa | Login do analista (`REGISTRADO_POR_LOGIN`) | `SISTEMA_ORIGEM` (SGE/SGP) + `CODIGO_ORIGEM` (opcional) |
| Via 2 | Colaborador preenche o formulário público (autosserviço) | Nome informado no formulário | — |
| Via 3 | Analista **digita** a iniciativa levantada em reunião | Login do analista (`REGISTRADO_POR_LOGIN`) | Data/área da reunião |
| Captação Externa | Analista **digita** a iniciativa trazida por parceiro externo | Login do analista (`REGISTRADO_POR_LOGIN`) | `ORGANIZACAO_EXTERNA` + `TIPO_INSTITUICAO` |

Em todas as vias os dados da iniciativa são **inseridos por uma pessoa** — não há fonte automática. A diferença está apenas em **quem digita** (colaborador na Via 2; analista nas demais) e em **qual procedência é anotada**.

**Rastreabilidade mínima por registro:** `CANAL_CODIGO`, `PROPONENTE_TIPO`, `CRIADO_EM`, `REGISTRADO_POR_LOGIN` (Vias 1/3/Externa), `SISTEMA_ORIGEM` + `CODIGO_ORIGEM` (Via 1), `ORGANIZACAO_EXTERNA` + `TIPO_INSTITUICAO` (Externa).

---

## 6. Diferenças Entre Cada Via

| Dimensão | Via 1 (SGE/SGP) | Via 2 (Formulário) | Via 3 (Reuniões) | Captação Externa |
|---|---|---|---|---|
| Como entra | Cadastro manual (painel) | Autosserviço (público) | Cadastro manual (painel) | Cadastro manual (painel) |
| Quem digita | Analista | Colaborador | Analista | Analista |
| Autenticação | Sim (CONTRIBUTOR/ADM) | Não (público) | Sim (CONTRIBUTOR/ADM) | Sim (CONTRIBUTOR/ADM) |
| Proponente | Interno | Interno (autoinformado) | Interno (área) | **Externo** |
| Procedência anotada | `SISTEMA_ORIGEM` + `CODIGO_ORIGEM` (opcional) | — | Data/área da reunião | `ORGANIZACAO_EXTERNA` + `TIPO_INSTITUICAO` |
| Status de entrada | `SUBMETIDA` | `SUBMETIDA` | `SUBMETIDA` | `SUBMETIDA` |

O que **não** difere: a estrutura da iniciativa na base, o ciclo de vida, as regras de transição, o histórico e os indicadores. As Vias 1, 3 e Externa são operacionalmente o mesmo cadastro manual, variando só nos campos de procedência.

---

## 7. Entidades Envolvidas

### 7.1 Entidades existentes (reutilizadas)

- **Iniciativa** (`INOVACAO_INICIATIVAS`) — a base única consolidada. Central para todas as vias.
- **Canal de Captação** (`CANAIS_CAPTACAO`) — catálogo das vias; já existe e semeado, passa a ser efetivamente vinculado.
- **Histórico de Status** (`HISTORICO_STATUS`) — linha do tempo imutável (com exceção de janela de edição de 2h já implementada).
- **Observação** (`INICIATIVA_OBSERVACOES`) — anotações livres durante a tramitação.
- **Transição de Status** (`TRANSICOES_STATUS`) — regras de workflow como dado.
- **Status de Workflow** (`STATUS_WORKFLOW`) — catálogo de estados.
- **Usuário Administrativo** (`ADMIN_USERS`) — whitelist de acesso ao painel (papéis `ADM`/`CONTRIBUTOR`).

### 7.2 Conceito de Proponente (nesta fase, atributos na própria iniciativa)

O `future-data-model.md` previa uma tabela `PROPONENTES` normalizada (que foi criada e depois marcada como não usada em `FINAL_ADJUSTMENTS.md`). Coerentemente com a estratégia aditiva atual (dados na `INOVACAO_INICIATIVAS`), **esta especificação NÃO reintroduz a tabela `PROPONENTES` no MVP multicanal**. O proponente é representado por atributos na iniciativa:

- Interno: `NOME_COLABORADOR`, `EMAIL_PROPONENTE`, `AREA_PROPONENTE`, `CANAL_CONTATO`.
- Externo: acima + `ORGANIZACAO_EXTERNA`, `TIPO_INSTITUICAO`.

> Normalizar o proponente em tabela própria fica como **evolução futura** (§16), quando houver necessidade de acompanhar o portfólio por proponente/instituição recorrente.

### 7.3 Nenhuma entidade nova de integração

Não há tabela de lotes, execuções ou logs de importação — a Via 1 é cadastro manual e não gera artefatos de integração. As únicas mudanças estruturais são colunas de procedência na iniciativa (§12.1).

---

## 8. Regras de Negócio

**RN-01 — Origem obrigatória.** Toda iniciativa deve ter `CANAL_CODIGO` preenchido com um código de canal existente em `CANAIS_CAPTACAO`. Registros legados sem canal recebem `VIA_2` no *backfill* (regra RN-12).

**RN-02 — Canal define o tipo de proponente padrão.** `VIA_1`, `VIA_2`, `VIA_3` ⇒ `PROPONENTE_TIPO = 'INTERNO'`; `MAPEAMENTO_EXTERNO` ⇒ `PROPONENTE_TIPO = 'EXTERNO'`.

**RN-03 — Proponente externo exige instituição.** Se `PROPONENTE_TIPO = 'EXTERNO'`, `ORGANIZACAO_EXTERNA` e `TIPO_INSTITUICAO` são obrigatórios.

**RN-04 — Via 1 exige sistema de origem.** Se `CANAL_CODIGO = 'VIA_1'`, `SISTEMA_ORIGEM` é obrigatório e deve ser `SGE` ou `SGP`. `CODIGO_ORIGEM` é opcional (texto livre, apenas rastreabilidade — não é validado, não é chave e não impõe unicidade).

**RN-05 — Autoria da entrada.** As vias de cadastro manual (1, 3 e Externa) exigem `REGISTRADO_POR_LOGIN` = login autenticado do analista. A Via 2 não tem autoria autenticada (público) — mantém o nome autoinformado.

**RN-06 — Vias manuais exigem papel.** Registro por Via 1, Via 3 e Captação Externa exige papel `CONTRIBUTOR` ou `ADM`. Não há operação exclusiva de ADM na captação (a gestão de canais, sim — RN-11).

**RN-07 — Protocolo único.** Toda iniciativa recebe `CODIGO_PUBLICO` único no padrão `INOV-AAAA-NNN`, independentemente da via.

**RN-08 — Evento inicial obrigatório.** Toda iniciativa nasce com um evento `SUBMISSAO` em `HISTORICO_STATUS`, com o `usuario_login` de quem cadastrou (nas vias manuais) ou nulo (Via 2 pública).

**RN-09 — Ciclo de vida único.** A origem **não** altera as transições permitidas. Todas as vias seguem `SUBMETIDA → EM_ANALISE → HOMOLOGADA | DESCLASSIFICADA` (estado atual real; ver §9). Todas entram em `SUBMETIDA`.

**RN-10 — Imutabilidade da origem.** Após criada, `CANAL_CODIGO`, `SISTEMA_ORIGEM`, `CODIGO_ORIGEM`, `ORGANIZACAO_EXTERNA` e `TIPO_INSTITUICAO` de uma iniciativa **não** são editáveis pela operação normal (apenas correção administrativa auditável).

**RN-11 — Canais ativos são configuráveis.** Somente canais com `ativo = 1` aparecem como opção de registro manual e como filtro. Ativar/desativar canal é operação de ADM.

**RN-12 — Backfill do legado.** Todas as iniciativas existentes (todas Via 2 por definição, já que só a Via 2 operou) recebem `CANAL_CODIGO = 'VIA_2'` e `PROPONENTE_TIPO = 'INTERNO'` na migration de introdução do campo.

**RN-13 — Preservação total (princípio de ouro do ADR-001).** Nenhum dado é descartado; informações adicionais de contexto que não têm campo próprio (ex.: detalhe da reunião, observação sobre o projeto de origem) vão para `INICIATIVA_OBSERVACOES`.

---

## 9. Estados Possíveis de uma Iniciativa

Estado **real atual** (após `V26`), fonte de verdade `STATUS_WORKFLOW` + código:

| Código | Rótulo | Terminal | Observação |
|---|---|---|---|
| `SUBMETIDA` | Submetida | Não | Estado de entrada padrão de todas as vias |
| `EM_ANALISE` | Em Análise | Não | Em avaliação pela Assessoria |
| `HOMOLOGADA` | Homologada | **Sim** | Aprovação (era `APROVADA` no ADR-012) |
| `DESCLASSIFICADA` | Desclassificada | **Sim** | Reprovação (era `REPROVADA` no ADR-012); exige justificativa |

> Nota de inconsistência conhecida a resolver na implementação: o `AdminService.getKpis()` referencia um bucket `EM_OBSERVACAO` que **não** existe como estado ativo em `STATUS_WORKFLOW`. Esta especificação **não** adiciona `EM_OBSERVACAO` como estado — observações são registros em `INICIATIVA_OBSERVACOES`, não um status. A implementação deve alinhar o KPI aos estados reais.

Estados previstos no schema mas **inativos** (backlog, ADR-012/`mvp-scope.md`): `RASCUNHO`, `DEVOLVIDA`, `SUSPENSA`, `CONCLUIDA`, `CANCELADA`. A captação multicanal **não** os ativa.

---

## 10. Ciclo de Vida Completo da Iniciativa

```
   [Entrada por qualquer via]
            │
            ▼
      ┌───────────┐   iniciar análise (CONTRIBUTOR/ADM)   ┌────────────┐
      │ SUBMETIDA │ ────────────────────────────────────► │ EM_ANALISE │
      └───────────┘                                        └─────┬──────┘
                                                                 │
                            homologar ┌───────────────┐          │
                          ◄───────────┤  HOMOLOGADA   │◄─────────┤
                                      └───────────────┘  (terminal)
                                                                 │
                       desclassificar ┌────────────────────┐     │
                          (justif.    │  DESCLASSIFICADA   │◄────┘
                          obrigatória)└────────────────────┘  (terminal)
```

- **Entrada:** SUBMETIDA (para as quatro vias). Evento `SUBMISSAO`.
- **Triagem/Análise:** SUBMETIDA → EM_ANALISE (evento `TRIAGEM`).
- **Desfecho positivo:** EM_ANALISE → HOMOLOGADA (evento `HOMOLOGACAO`; `notificar_proponente = 1`).
- **Desfecho negativo:** EM_ANALISE → DESCLASSIFICADA (evento `DESCLASSIFICACAO`; justificativa obrigatória; `notificar_proponente = 1`).
- **Correções pontuais:** janela de 2h de edição de observações e de justificativa de eventos pelo próprio autor (já implementada em `WorkflowService`).
- **Notificações:** a flag `notificar_proponente` existe mas o motor de envio ainda não é construído (fora de escopo — §16).

A captação multicanal **não altera** este ciclo. Não há estados nem transições específicos por via — inclusive a Via 1 entra em `SUBMETIDA` como as demais.

---

## 11. Papéis e Permissões

Modelo de autorização **real** hoje: whitelist `ADMIN_USERS` (papéis `ADM`, `CONTRIBUTOR`) sobre identidade LDAP; público para o formulário. Os perfis do ADR-003 (`ANALISTA_ASSESSORIA`, `GESTOR_AREA`, `ADMINISTRADOR`) existem apenas como texto em `TRANSICOES_STATUS.perfil_requerido` e **não** são efetivamente aplicados (o `WorkflowService` autoriza tanto `ADM` quanto `CONTRIBUTOR`).

Matriz de permissões proposta para a captação multicanal:

| Ação | Anônimo (público) | CONTRIBUTOR | ADM |
|---|---|---|---|
| Submeter Via 2 | ✅ | ✅ | ✅ |
| Registrar Via 1 (SGE/SGP) | ❌ | ✅ | ✅ |
| Registrar Via 3 (reunião) | ❌ | ✅ | ✅ |
| Registrar Captação Externa | ❌ | ✅ | ✅ |
| Configurar/ativar canais | ❌ | ❌ | ✅ |
| Ver listagem/detalhe/histórico | ❌ | ✅ | ✅ |
| Transitar status | ❌ | ✅ | ✅ |
| Adicionar observação | ❌ | ✅ | ✅ |
| Ver indicadores por canal | ❌ | ✅ | ✅ |
| Gerir `ADMIN_USERS` | ❌ | ❌ | ✅ |

> Recomendação (não bloqueante): alinhar `TRANSICOES_STATUS.perfil_requerido` à realidade `ADM`/`CONTRIBUTOR`, ou implementar de fato o mapeamento de perfis. Enquanto não houver, manter a regra atual (ambos os papéis podem registrar e transitar).

---

## 12. Impacto no Banco de Dados

Estratégia: **aditiva, colunas nullable** (ADR-001), sobre `INOVACAO_INICIATIVAS` — coerente com o que já está em produção. Nenhuma tabela é dropada; nenhuma coluna existente é removida ou renomeada; nenhuma tabela nova de integração é criada.

### 12.1 Novas colunas em `INOVACAO_INICIATIVAS` (migration nova, ex.: `V28`)

| Coluna | Tipo | Regra |
|---|---|---|
| `CANAL_CODIGO` | VARCHAR2(30) | Origem; default lógico `VIA_2`; backfill nos existentes (RN-12) |
| `PROPONENTE_TIPO` | VARCHAR2(10) | `INTERNO`/`EXTERNO`; default `INTERNO` |
| `ORGANIZACAO_EXTERNA` | VARCHAR2(300) | Obrigatória se `EXTERNO` (validada na aplicação) |
| `TIPO_INSTITUICAO` | VARCHAR2(30) | `ICT`/`UNIVERSIDADE`/`EMPRESA_PUBLICA`/`PARCERIA`/`OUTRO` (Externa) |
| `SISTEMA_ORIGEM` | VARCHAR2(20) | `SGE`/`SGP`; obrigatório se `VIA_1` (validado na aplicação) |
| `CODIGO_ORIGEM` | VARCHAR2(100) | Código/identificador do projeto na origem; **opcional**, texto livre, só rastreabilidade |
| `REGISTRADO_POR_LOGIN` | VARCHAR2(100) | Login do analista que registrou (Vias 1/3/Externa) |

Índice recomendado:
- `IDX_INI_CANAL` em (`CANAL_CODIGO`) — filtros e indicadores por via.

Não há constraint de unicidade de origem (a Via 1 não é integração e `CODIGO_ORIGEM` é livre e não único). A validação de domínio (`SISTEMA_ORIGEM ∈ {SGE, SGP}`, `PROPONENTE_TIPO`, `TIPO_INSTITUICAO`) segue o padrão do projeto de validar na camada de serviço (ADR-002 §Regras), podendo ser reforçada por `CHECK` se desejado.

### 12.2 Atualização de `CANAIS_CAPTACAO` (dados)

- `UPDATE` de `nome`/`descricao` conforme §1.3.
- `UPDATE ... SET ativo = 1` para `VIA_1`, `VIA_3`, `MAPEAMENTO_EXTERNO`.

### 12.3 O que **não** muda

- Tabelas `HISTORICO_STATUS`, `INICIATIVA_OBSERVACOES`, `TRANSICOES_STATUS`, `STATUS_WORKFLOW`, `ADMIN_USERS` permanecem como estão.
- Nenhuma tabela de importação/lote é criada.
- Nenhuma reintrodução de `PROPONENTES`/`USUARIOS` (marcadas como não usadas em `FINAL_ADJUSTMENTS.md`).

---

## 13. Impacto no Painel Administrativo

1. **Novas telas de registro manual** (mesmo layout base, blocos de procedência distintos):
   - "Registrar Iniciativa — SGE/SGP" — Via 1 (com Sistema de Origem e código opcional do projeto).
   - "Registrar Iniciativa (Reunião)" — Via 3 (com data/área da reunião).
   - "Captação Externa" — com bloco de instituição de origem.
2. **Listagem de iniciativas:**
   - Nova coluna/*badge* de **origem** (via + interno/externo).
   - Novo **filtro por canal**.
3. **Tela de detalhe da iniciativa:**
   - Bloco "Origem": via, tipo de proponente, instituição (se externo), sistema/código de origem (se Via 1), quem registrou (se Vias 1/3/Externa).
4. **Gestão de canais** (ADM): ativar/desativar e editar rótulos de `CANAIS_CAPTACAO`.

Não há tela de importação. Reutiliza-se o `AdminGuard` e a identidade LDAP existentes — sem novo mecanismo de auth.

---

## 14. Impacto nos Indicadores

Nova **dimensão transversal: canal/origem**. KPIs a acrescentar (via `GROUP BY` no Oracle — corrigindo o cálculo em memória atual, conforme já apontado no `as-is` e `mvp-scope`):

- **Volume por canal** (Via 1 / Via 2 / Via 3 / Externa) — absoluto e percentual.
- **Interno vs. Externo** — participação da inovação aberta no portfólio.
- **Taxa de homologação por canal** — homologadas / total por via (efetividade da via).
- **Tempo médio de análise por canal** — `EM_ANALISE`→desfecho, por origem.
- **Captação externa por tipo de instituição** — ICT / universidade / empresa pública / parceria.
- **Via 1 por sistema de origem** — SGE vs. SGP.
- **Funil por via** — SUBMETIDA → EM_ANALISE → desfecho, segmentado por canal.

Os KPIs existentes (total, por estágio, por dimensão, por status) permanecem e ganham recorte opcional por canal.

---

## 15. Impacto na Navegação e na Experiência do Usuário

### 15.1 Navegação (painel autenticado)

Novo agrupamento de menu "Captação":
- Registrar Iniciativa — SGE/SGP (Via 1)
- Registrar Iniciativa (Reunião) — Via 3
- Captação Externa

E, nas telas existentes: filtro por canal na listagem; bloco de origem no detalhe; recorte por canal no dashboard. Não há item de menu de importação.

### 15.2 Experiência do usuário

- **Proponente (Via 2):** sem mudança perceptível além de continuar recebendo o protocolo. A origem é registrada de forma transparente.
- **Analista (Vias 1/3/Externa):** os três formulários de registro reaproveitam o mesmo layout base da Via 2, reduzindo a curva de aprendizado; cada um adiciona apenas o seu bloco de procedência (Via 1: sistema/código de origem; Via 3: reunião; Externa: instituição). Substitui a planilha atual por um cadastro guiado.
- **Todos:** a iniciativa passa a exibir claramente **de onde veio**, aumentando confiança e governança.
- **Consistência visual:** *badges* de origem com cores/rótulos estáveis por canal; nunca expor códigos crus (`MAPEAMENTO_EXTERNO`) na UI — usar rótulos ("Captação Externa").

---

## 16. Novos Módulos Necessários

| Módulo | Escopo | Prioridade |
|---|---|---|
| **Endpoints de registro manual (Vias 1/3/Externa)** | `POST /api/admin/iniciativas` com canal + tipo de proponente + procedência; validação por papel | Alta |
| **ReferenceDataModule** | `GET /api/reference/canais` (canais ativos) para alimentar dropdowns e filtros | Média |
| **Extensão de indicadores** | Agregações por canal via SQL | Média |
| **Telas de painel** | Registro manual (3 vias), filtros e detalhe de origem, gestão de canais | Alta |

Reaproveitados sem reescrita: `WorkflowModule`, `AuthModule` (LDAP+sessão), `AdminModule` (base), `IniciativasModule` (contrato de ingestão da Via 2). **Nenhum módulo de importação/integração é necessário.**

---

## 17. Possíveis Integrações Futuras

> Fora do escopo desta especificação. Registrado apenas como direção possível, **não** como compromisso.

- **Integração real com SGE/SGP** (se um dia a Assessoria quiser importação automática) — hoje explicitamente **não** existe; a Via 1 é manual.
- **Normalização de Proponente/Instituição** em tabela própria, para portfólio por parceiro recorrente.
- **Motor de notificações** (e-mail ao proponente/analista) — a flag `notificar_proponente` já existe.
- **Novos canais** (ex.: hackathons, editais, caixa de ideias) — o catálogo `CANAIS_CAPTACAO` já suporta; basta inserir e ativar.
- **Alinhamento estratégico** (ODS/PE) por iniciativa — previsto em `future-data-model.md`, fora deste escopo.
- **Exportação de relatórios** por canal (PDF/Excel).
- **Migração de identidade para SSO** — a arquitetura de sessão já isola isso.

---

## 18. Requisitos Funcionais

- **RF-01** Registrar `CANAL_CODIGO` em toda iniciativa criada, por qualquer via.
- **RF-02** Via 2 continua pública e passa a gravar `VIA_2` + `INTERNO`.
- **RF-03** Permitir a analista autenticado registrar manualmente uma iniciativa identificada em SGE/SGP (`VIA_1`), informando `SISTEMA_ORIGEM` (obrigatório) e `CODIGO_ORIGEM` (opcional).
- **RF-04** Permitir a analista autenticado registrar iniciativa de reunião (`VIA_3`).
- **RF-05** Permitir a analista autenticado registrar captação externa (`MAPEAMENTO_EXTERNO`) com instituição e tipo.
- **RF-06** Gravar `REGISTRADO_POR_LOGIN` = login do analista nas vias manuais (1, 3, Externa).
- **RF-07** Gerar `CODIGO_PUBLICO` e evento inicial `SUBMISSAO` para todas as vias.
- **RF-08** Exibir origem na listagem (badge) e no detalhe (bloco de origem).
- **RF-09** Filtrar iniciativas por canal.
- **RF-10** Calcular indicadores por canal via SQL (incluindo Via 1 por sistema de origem e Externa por tipo de instituição).
- **RF-11** Permitir a ADM ativar/desativar e editar rótulos de canais.
- **RF-12** Aplicar a matriz de permissões da §11 a cada ação.
- **RF-13** Fazer *backfill* de `VIA_2`/`INTERNO` em todos os registros legados.
- **RF-14** Rejeitar registro externo sem `ORGANIZACAO_EXTERNA`/`TIPO_INSTITUICAO` e registro Via 1 sem `SISTEMA_ORIGEM`.

---

## 19. Requisitos Não Funcionais

- **RNF-01 (Compatibilidade)** Migrações aditivas e idempotentes (padrão `V01`–`V27`); nenhuma quebra do fluxo Via 2 existente.
- **RNF-02 (Rastreabilidade)** 100% das iniciativas com origem identificável; histórico imutável preservado; toda entrada por via manual atribuível a um login.
- **RNF-03 (Segurança)** Vias 1/3/Externa exigem sessão autenticada; herda as diretrizes de segurança do E0; nenhum segredo em repositório. **Não** há credenciais de SGE/SGP no sistema, pois não há acesso a essas bases.
- **RNF-04 (Simplicidade)** Nenhum componente de integração, agendamento ou processamento em lote é introduzido; a superfície do sistema permanece a de uma aplicação de cadastro + workflow.
- **RNF-05 (Desempenho)** Cadastros são operações unitárias e interativas; indicadores por `GROUP BY` (não em memória).
- **RNF-06 (Auditabilidade)** Toda entrada por Via 1/3/Externa é atribuível a um login; a procedência (sistema/instituição) fica registrada no próprio registro.
- **RNF-07 (Manutenibilidade)** Adicionar um novo canal não exige alteração de schema — apenas dados em `CANAIS_CAPTACAO` (ADR-004/ADR-010, workflow/config como dado).
- **RNF-08 (Stack)** Mantém NestJS + OracleDB thin mode + frontend vanilla (ADR-009); nenhuma nova stack.
- **RNF-09 (Privacidade)** Dados de proponentes externos tratados como dados de terceiros; expor apenas o necessário no painel.

---

## 20. Critérios de Aceite

- [ ] `INOVACAO_INICIATIVAS` possui as colunas de origem (§12.1) e todos os registros **legados** têm `CANAL_CODIGO = 'VIA_2'` e `PROPONENTE_TIPO = 'INTERNO'`.
- [ ] Uma submissão pela Via 2 grava `CANAL_CODIGO = 'VIA_2'` sem qualquer mudança perceptível para o colaborador (protocolo continua sendo exibido).
- [ ] `CANAIS_CAPTACAO` tem `VIA_1`, `VIA_2`, `VIA_3`, `MAPEAMENTO_EXTERNO` **ativos** e com os rótulos da §1.3.
- [ ] Um analista autenticado (CONTRIBUTOR/ADM) registra manualmente uma iniciativa Via 1, com todos os dados digitados por ele, `SISTEMA_ORIGEM` = `SGE` ou `SGP`, `CODIGO_ORIGEM` opcional e `REGISTRADO_POR_LOGIN` preenchido.
- [ ] O registro Via 1 **não** dispara nenhuma leitura de SGE/SGP — é puramente um formulário de cadastro.
- [ ] Um registro Via 1 sem `SISTEMA_ORIGEM` é rejeitado; com `CODIGO_ORIGEM` vazio é aceito.
- [ ] Um analista registra uma iniciativa de reunião (`VIA_3`) com `REGISTRADO_POR_LOGIN` preenchido.
- [ ] Um analista registra uma captação externa com `PROPONENTE_TIPO = 'EXTERNO'`, `ORGANIZACAO_EXTERNA` e `TIPO_INSTITUICAO`; a ausência de instituição é rejeitada.
- [ ] Toda iniciativa criada por qualquer via nasce com evento `SUBMISSAO` em `HISTORICO_STATUS`.
- [ ] Uma iniciativa de qualquer via percorre `SUBMETIDA → EM_ANALISE → HOMOLOGADA/DESCLASSIFICADA` sem regras específicas por origem; desclassificação exige justificativa.
- [ ] A listagem exibe a origem (badge) e permite filtrar por canal.
- [ ] O detalhe exibe o bloco de origem completo conforme a via (incl. sistema/código de origem na Via 1).
- [ ] O dashboard exibe volume por canal, interno vs. externo e taxa de homologação por canal, calculados por SQL.
- [ ] Um usuário sem papel (público) **não** consegue registrar Via 1/3/Externa (403).
- [ ] Somente ADM consegue gerir canais.
- [ ] O formulário público e o painel continuam funcionando exatamente como antes para os fluxos já existentes.

---

## 21. Questões em Aberto (para validação antes da implementação)

- **QA-1 — Campos do formulário Via 1.** Além de Sistema de Origem (SGE/SGP) e código do projeto, a Assessoria quer registrar algum outro dado de procedência (ex.: data em que foi identificada, responsável pelo projeto na origem)? Ou os campos padrão da iniciativa + esses dois bastam?
- **QA-2 — `CODIGO_ORIGEM` livre vs. estruturado.** O identificador do projeto no SGE/SGP tem um formato conhecido/validável, ou deve mesmo ser texto livre?
- **QA-3 — Contexto da Via 3.** Data e área da reunião devem ser campos próprios da iniciativa ou basta registrá-los como observação inicial?
- **QA-4 — Tipos de instituição externa.** A lista `ICT/UNIVERSIDADE/EMPRESA_PUBLICA/PARCERIA/OUTRO` cobre os casos reais da Assessoria?
- **QA-5 — Perfis efetivos.** Manter `ADM`/`CONTRIBUTOR` como está, ou implementar de fato os perfis do ADR-003 referenciados em `TRANSICOES_STATUS`?
- **QA-6 — Duplicidade entre vias.** É possível que a mesma iniciativa seja cadastrada por mais de uma via (ex.: já submetida por Via 2 e também vista no SGE/SGP)? Se sim, isso é aceitável, ou é preciso algum aviso de possível duplicidade no cadastro? *(vínculo formal entre iniciativas — `RELACIONAMENTOS_INICIATIVAS` — segue fora de escopo.)*

---

## 22. Decisão

Adotar o modelo de **captação multicanal com base única e origem preservada**, evoluindo aditivamente o sistema atual (Via 2) para contemplar Via 1 (registro manual de iniciativas identificadas em SGE/SGP), Via 3 (registro de reuniões) e Captação Externa. **Todas as vias que não são a Via 2 são cadastros manuais autenticados no painel**, idênticos no fluxo e distintos apenas nos campos de procedência e no tipo de proponente. Não há integração, importação ou leitura automática de nenhum sistema. O ciclo de vida não é bifurcado, a stack não é trocada e o schema TO-BE normalizado não adotado não é reintroduzido. A origem passa a ser um atributo rastreável de cada iniciativa (`CANAL_CODIGO` + metadados de procedência), e os canais permanecem configuráveis como dado.

**Alternativas rejeitadas:**
- **Integração automática com SGE/SGP (importação/ETL) na Via 1.** Rejeitada — **não corresponde ao processo real**: o analista consulta esses sistemas manualmente e cadastra a iniciativa à mão. Construir integração seria resolver um problema que não existe e adicionar um ponto de falha desnecessário.
- **Uma tabela de iniciativas por via.** Rejeitada — fragmenta o portfólio, duplica workflow e indicadores, e viola o princípio de base única.
- **Migrar agora para o schema TO-BE (`INICIATIVAS`/`PROPONENTES` normalizados)** como pré-requisito. Rejeitada — o sistema em produção já consolidou a estratégia aditiva sobre `INOVACAO_INICIATIVAS`; normalizar agora é risco e custo sem valor incremental para a captação multicanal.
- **Tratar a origem apenas como texto livre.** Rejeitada — impede indicadores confiáveis por canal.

**Consequências:**
- Ganho de rastreabilidade e de indicadores por canal; portfólio consolidado; a planilha da Via 1 é substituída por cadastro centralizado.
- Custo de implementação baixo: as Vias 1, 3 e Externa compartilham o mesmo endpoint e formulário base, variando só nos campos de procedência — sem integração para construir ou manter.
- Reforço da estratégia aditiva do ADR-001; débito de normalização (proponente/instituição) adiado conscientemente para evolução futura.
