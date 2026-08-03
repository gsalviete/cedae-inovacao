# ADR-015 — Relevância Estratégica, Classificação Ação/Projeto, Reversão de Decisão Terminal e Ajustes da Captação Externa

**Status:** IMPLEMENTADO (2026-07-28)
**Data:** 2026-07-28
**Épico previsto:** E8 — Qualificação Estratégica da Base e Correção de Decisões
**Substitui/estende:** complementa ADR-001 (Schema aditivo), ADR-002 (Domínio de valores), ADR-004 (Workflow como dado), ADR-005 (Histórico imutável), ADR-008 (Auditoria em duas camadas), ADR-013 (Captação multicanal), ADR-014 (Interface, permissões, exportação, e-mail e termos)
**Fontes verificadas:** código atual de `backend/src`, `frontend/`, migrations `V01`–`V30`

> Especificação técnica no formato de ADR estendido: registra **o que** foi decidido, **como** foi implementado em cada camada e **por quê**, incluindo os pontos em que o enunciado admitia mais de uma leitura.

---

## 1. Contexto

Após a entrega do ADR-014 a base já consolida as quatro vias de captação (ADR-013) e a esteira `SUBMETIDA → EM_ANALISE → HOMOLOGADA | DESCLASSIFICADA` (ADR-012). Três lacunas apareceram no uso real:

1. **Não há como qualificar estrategicamente uma iniciativa.** O acervo cresce, mas nada distingue o que tem retorno financeiro, o que já consta do Planejamento Estratégico e o que ainda não foi avaliado.
2. **A decisão terminal era irreversível.** `HOMOLOGADA` e `DESCLASSIFICADA` não tinham nenhuma transição de saída — um erro de homologação só se corrigia no banco.
3. **A edição administrativa divergia do formulário público.** Campos que no formulário são condicionais e mascarados apareciam na modal de edição como texto livre, permitindo estados que o formulário nunca produziria (macrodimensão descrita sem "Outros" selecionado, suporte digitado à mão com `|`, valores monetários com letras).

Some-se a isso o amadurecimento da Captação Externa, cujo domínio de instituições não refletia mais a realidade (startups e empresas privadas) e cuja exigência de proponente não correspondia ao fluxo de trabalho (a iniciativa é identificada antes do contato).

### 1.1 Achados relevantes da análise (fatos, não suposições)

1. **`HISTORICO_STATUS.CK_HS_TIPO` restringe `tipo_evento`** ao conjunto definido na V26. Qualquer evento novo exige alterar a constraint antes de a aplicação gravá-lo.
2. **`TRANSICOES_STATUS` está vazia para os status terminais** — nenhuma linha com `status_origem IN ('HOMOLOGADA','DESCLASSIFICADA')`. `WorkflowService.transicionar` consulta essa tabela e rejeita o que não estiver lá; sem seed, nenhuma reversão passaria.
3. **`NOME_COLABORADOR` e `CANAL_CONTATO` são `NOT NULL`** desde o `create_tables.sql` original. Como o Oracle trata string vazia como `NULL`, o INSERT da Captação Externa sem proponente quebraria com ORA-01400 — mesmo caso já resolvido para `SOLUCAO_PROPOSTA` na V27.
4. **`TIPO_INSTITUICAO` tem CHECK constraint** (`CK_INI_TIPO_INST`, V28) contendo `PARCERIA`. Há registros gravados com esse valor.
5. **A listagem exibia dois selos de origem para a Captação Externa:** `canalBadge('MAPEAMENTO_EXTERNO')` renderiza "Externa" e `externoTag` renderizava "Externo" logo ao lado. Como RN-02 amarra `PROPONENTE_TIPO='EXTERNO'` exatamente ao canal `MAPEAMENTO_EXTERNO`, o segundo selo nunca carregou informação nova.
6. **A máscara monetária estava triplicada:** `app.js` (formulário público), `captacao.js` (cadastro manual) e **ausente** na modal de edição, cujos campos eram `<input type="text">` livre e `<input type="number">`.
7. **`select.form-input` (painel) não tinha estilo próprio** — usava a seta nativa do sistema operacional, colada à borda; só `select.field-input` (formulários) tinha a seta customizada, a 12px da borda.

---

## 2. Relevância Estratégica

### 2.1 Decisão

Nova coluna `RELEVANCIA_ESTRATEGICA VARCHAR2(40)` em `INOVACAO_INICIATIVAS`, com quatro valores de domínio:

| Código | Rótulo na UI |
|---|---|
| `FINANCEIRO` | Sim, por retorno financeiro |
| `PLANEJAMENTO_ESTRATEGICO` | Sim, por estar presente no Planejamento Estratégico |
| `INDETERMINADA` | Ainda não é possível determinar |
| `SEM_RELEVANCIA` | Não possui relevância estratégica |

O domínio vive em `backend/src/iniciativas/dominio-iniciativa.ts` (fonte única para DTOs, serviço e exportação) e é espelhado em `frontend/static/js/api.js` para os rótulos. A CHECK constraint `CK_INI_RELEVANCIA` reforça o domínio no banco, mantendo o padrão do ADR-002 (validação primária na aplicação, reforço no schema).

**RN-14 — Via 1 é carimbada pelo sistema.** Toda iniciativa registrada pela Via 1 (SGE/SGP) nasce como `PLANEJAMENTO_ESTRATEGICO`, sem intervenção do usuário. A regra é aplicada **no serviço** (`IniciativasService.criarManual`), não na UI: o formulário apenas reflete a decisão exibindo o campo travado. Qualquer valor que o cliente envie para a Via 1 é descartado.

O backfill da V31 estende a regra ao acervo já cadastrado — as iniciativas Via 1 existentes recebem o mesmo valor.

### 2.2 Ponto de interpretação — o formulário público (Via 2)

O enunciado diz que a informação deve estar "no cadastro e na edição" e que, fora da Via 1, "deverá ser escolhida normalmente". Isso admite duas leituras: incluir o campo também no formulário público, ou tratá-lo como avaliação interna.

**Decisão: a relevância estratégica é uma avaliação da Assessoria, não do proponente.** Três razões:

1. Uma das opções é *"por estar presente no Planejamento Estratégico"* — o colaborador que submete uma melhoria da sua área não tem como saber se ela consta do PE da companhia.
2. Outra é *"ainda não é possível determinar (não existe conhecimento suficiente da iniciativa para essa avaliação)"* — está redigida do ponto de vista de quem **analisa** a iniciativa, não de quem a propõe.
3. O formulário público é o ponto de contato com o colaborador e o ADR-014 tratou sua fluidez como requisito; acrescentar ali um juízo de valor que o respondente não tem como emitir produziria ruído — e dados de baixa confiança.

Consequência prática: submissões da Via 2 nascem como `INDETERMINADA` (que é literalmente o estado real: ainda não avaliada) e o ADM define o valor na edição administrativa. Nenhuma informação se perde e nenhuma via fica sem a classificação.

O campo continua **selecionável no cadastro** das vias em que quem preenche é o próprio analista (Via 3 e Captação Externa) e **editável para todas as vias**, inclusive Via 2 e Via 1 — um carimbo automático não impede a correção posterior por um administrador.

### 2.3 Camadas

| Camada | Alteração |
|---|---|
| Banco | `V31` — coluna, CHECK `CK_INI_RELEVANCIA`, backfill (Via 1 → `PLANEJAMENTO_ESTRATEGICO`; demais → `INDETERMINADA`) |
| DTO | `CreateManualIniciativaDto.relevancia_estrategica` (`@IsIn`), `UpdateIniciativaDto.relevancia_estrategica` (`@IsIn`) |
| Serviço | `criar` (Via 2) fixa o padrão; `criarManual` aplica RN-14 e `normalizarRelevancia`; `listar`/`getById` devolvem a coluna |
| Frontend | `registrar.html` (select, travado na Via 1), `iniciativa.html` (detalhe + modal), `api.js` (`RELEVANCIA_LABEL`) |
| Exportação | Nova coluna na planilha Excel |

---

## 3. Classificação Ação/Projeto

Nova coluna `CLASSIFICACAO_INICIATIVA VARCHAR2(20)`, domínio `ACAO | PROJETO`, **nullable por decisão**: nem toda iniciativa foi classificada, e forçar um dos dois valores no cadastro produziria dado inventado.

**Administrada exclusivamente por ADM, apenas na edição** — não aparece no cadastro nem no formulário público, conforme o escopo. A rota `PATCH /api/iniciativas/:id` já é ADM-only (ADR-014), então não foi preciso criar nova barreira de autorização.

**Controle escolhido: segmentado de três posições** (`Não definido · Ação · Projeto`), não um toggle binário. Um switch de dois estados não consegue representar "ainda não classificado" sem mentir sobre um dos valores; o segmentado mantém a ergonomia de um toggle (clique único, estados mutuamente exclusivos, `role="radiogroup"`) e preserva o nulo. Visualmente segue o design system (`--gray-100` de trilho, estado ativo em branco com borda `--blue-100`).

---

## 4. Reversão de homologação/desclassificação

### 4.1 Decisão

A reversão é modelada como **mais uma transição do workflow**, não como uma operação especial. Isso mantém o ADR-004 (workflow como dado) e o ADR-005 (histórico imutável) inteiramente válidos: nada é apagado nem atualizado — apenas se acrescenta um evento.

Duas linhas novas em `TRANSICOES_STATUS`:

| Origem | Destino | Perfil | Justificativa |
|---|---|---|---|
| `HOMOLOGADA` | `EM_ANALISE` | `ADM` | obrigatória |
| `DESCLASSIFICADA` | `EM_ANALISE` | `ADM` | obrigatória |

**Destino `EM_ANALISE`, não `SUBMETIDA`:** desfazer a decisão devolve a iniciativa ao ponto em que a decisão foi tomada, de onde ela pode ser homologada ou desclassificada novamente. Voltar para `SUBMETIDA` fingiria que a triagem nunca ocorreu.

### 4.2 Novo tipo de evento

`HISTORICO_STATUS.tipo_evento` ganha o valor `REVERSAO` (ampliação de `CK_HS_TIPO` na V31). Sem ele o evento seria gravado como `TRIAGEM` — indistinguível de uma triagem comum na timeline, o que anularia o requisito de rastreabilidade.

`WorkflowService.mapTipoEvento` mapeia por destino; a reversão é detectada pela **origem** (status terminal) e escapa desse mapa.

### 4.3 Autorização e auditoria

- **Exclusiva de ADM.** A regra existente (`STATUS_EXCLUSIVOS_ADM`) cobria apenas o *destino*; foi estendida para também barrar a *saída* de um status terminal. Quem não pode homologar não pode desfazer uma homologação. Validação primária no backend; a UI apenas oculta o botão.
- **Justificativa obrigatória**, garantida em duas frentes: `justificativa_obrig = 1` no catálogo **e** uma checagem explícita no serviço (`ehReversao`) — a exigência é regra de negócio, não configuração, e não pode ser afrouxada editando `TRANSICOES_STATUS`. (A *existência* da transição, essa sim, depende do seed da V31: sem ele o `WorkflowService` rejeita a reversão como transição inválida.)
- **Auditoria dupla (ADR-008):** o evento entra em `HISTORICO_STATUS` (usuário, data/hora UTC, status anterior e novo, justificativa) e uma entrada `reverter_decisao` é gravada em `INOVACAO_LOGS` com o texto da justificativa. A esteira normal não gera log geral; a reversão gera, por ser ato administrativo excepcional.
- **Eventos `REVERSAO` não entram em `EVENTOS_EDITAVEIS`.** A janela de edição de 2h do ADR-014 se aplica a triagens, homologações e desclassificações; a justificativa de uma reversão é registro definitivo.

---

## 5. Paridade entre a edição administrativa e o formulário público

O princípio: **a modal de edição não pode produzir um estado que o formulário público não produziria.**

| Item | Antes | Depois |
|---|---|---|
| Descrição da Macrodimensão | campo sempre visível | visível só com `macrodimensao = 'outros'`; limpo ao ocultar |
| Suporte Necessário | `<input type="text">` com dica "valores separados por \|" | mesmos 6 checkboxes do Bloco IV, montados a partir de `SUPORTE_OPCOES` |
| Apoio Diagnóstico | textarea sempre visível | visível só com a opção "Apoio Diagnóstico" marcada; limpo ao ocultar |
| Valor do Aporte | texto livre | máscara BRL compartilhada |
| Retorno Econômico | `<input type="number">` | máscara BRL compartilhada |

### 5.1 Máscara monetária — implementação única

As três cópias foram substituídas por `window.CedaeMoney`, em `frontend/static/js/ui.js` — o único script carregado tanto pelo formulário público quanto pelo shell administrativo. A API é `attach/initAll/value/setValue/formatBRL`; `app.js` e `captacao.js` passaram a delegar.

O valor canônico fica em `dataset.cents` (inteiro, em centavos) e o texto é só apresentação — evita o parse frágil de string formatada, que dependia de casar o espaço não-quebrável (U+00A0) que o `Intl.NumberFormat` insere entre `R$` e o número.

Efeitos colaterais **positivos** e intencionais da unificação:

- o `retorno_economico` do formulário público passou a bloquear letras no `keydown` (antes só as removia no `input`) e a limpar o campo quando esvaziado (antes ficava exibindo `R$ 0,00`);
- colagem de texto com letras passou a ser sanitizada em todos os campos monetários;
- a edição administrativa não envia mais `''` para `retorno_economico` (que era rejeitado pelo `@IsNumber` do DTO — defeito latente): envia `null`, que o serviço grava como `NULL`.

---

## 6. Captação Externa

| Mudança | Decisão |
|---|---|
| Remover `PARCERIA` | Removido do domínio da aplicação (`TIPOS_INSTITUICAO`) e do select. **Mantido no CHECK do banco e no mapa de rótulos** — há registros gravados com esse valor, e tirá-lo do domínio invalidaria dados existentes, contrariando o ADR-001. O rótulo exibe "Parceria (legado)". |
| Adicionar `STARTUP` e `EMPRESA_PRIVADA` | Novos valores no domínio, no select e no CHECK. |
| Proponente opcional | **Apenas** para `MAPEAMENTO_EXTERNO` (RN-15). As demais vias continuam exigindo nome e canal de contato. |

**RN-15 é aplicada no serviço, não no DTO.** `nome_colaborador` e `canal_contato` passaram a `@IsOptional` no `CreateManualIniciativaDto` porque a obrigatoriedade depende do canal — uma validação cruzada, no mesmo lugar onde RN-03 e RN-04 já vivem (`criarManual`). O DTO sozinho não tem como decidir.

No banco, o `NOT NULL` das duas colunas foi relaxado (V31 §4). A obrigatoriedade das outras vias deixa de ser garantida pelo schema e passa a ser garantida pela aplicação — mesma troca já feita na V27 para `SOLUCAO_PROPOSTA`, e coerente com a estratégia aditiva: um `CHECK` condicional por canal engessaria o schema legado sem ganho real.

---

## 6-bis. Aviso de Privacidade (LGPD) e ciência inequívoca

Texto jurídico aprovado substituindo o placeholder que o ADR-014 §12-bis deixou em aberto. Ele aparece em **duas modais**, porque os públicos e os efeitos são diferentes:

| Onde | Quem vê | Papel |
|---|---|---|
| Modal de Termos (`termos-overlay`) | usuário autenticado no AD **sem** perfil administrativo, no primeiro acesso | aceite formal, persistido em `TERMOS_ACEITES` + `INOVACAO_LOGS` |
| Modal do Aviso (`aviso-modal`) | **todos**, inclusive anônimos, sob demanda | leitura do aviso que o checkbox de ciência referencia |

**O aviso não fica dentro do formulário.** Chegou a ser implementado como etapa 0 do wizard e foi revertido: a esteira com barra de progresso é área de preenchimento, e um bloco de texto jurídico no meio dela é ruído — o proponente conta as etapas que faltam, não espera uma delas ser leitura. O texto vive apenas na modal.

Para que "disponível no início do formulário" (frase do checkbox) continue verdadeiro, há uma chamada discreta no **hero**, acima do formulário e fora do wizard: *"Seus dados serão tratados conforme a LGPD — leia o aviso de privacidade"*. Os dois links (hero e checkbox) abrem a mesma modal.

**`TERMOS_VERSAO` foi de `1.0` para `2.0`.** O conteúdo dos Termos mudou de forma substantiva; manter a versão faria com que quem já aceitou a redação anterior nunca visse a nova. Com o incremento, o aceite é solicitado novamente e fica registrado contra a versão correta — que é a razão de a coluna `versao_termos` existir na `TERMOS_ACEITES`.

### Checkbox de ciência

Último campo do formulário, dentro do Bloco IV (a última etapa), imediatamente antes do envio. Obrigatório em **duas camadas**:

- no cliente (`validateForm`), para o proponente não perder o preenchimento;
- no servidor, via `@Equals(true)` em `CreateIniciativaDto.ciencia_privacidade` — a manifestação não pode ser contornada por quem chame a API diretamente.

A confirmação gera entrada própria em `INOVACAO_LOGS` (ação `ciencia_privacidade`), com autor, data/hora e o protocolo a que se refere. **Não foi criada coluna nem tabela**: a camada de log geral do ADR-008 já dá o registro auditável exigido, e uma migration a mais só para um booleano seria desproporcional.

### Impacto no wizard

`wizard.js` transforma **todo** `.form-block` do formulário em uma etapa — daí duas restrições de implementação:

1. o aviso não pode ser um bloco solto dentro do `<form>`: como `.form-block` viraria etapa, e como qualquer outra coisa ficaria visível em **todas** as etapas. Por isso está fora do formulário, na modal;
2. o checkbox **não** ganhou bloco próprio — viraria uma sexta etapa sem título. Ficou como último `field-group` do Bloco IV.

O wizard permanece com as 5 etapas originais.

### Detalhes de comportamento da modal

- `Esc` e clique no overlay fecham; ao fechar, o foco volta ao link que a abriu.
- O link do checkbox vive dentro do `<label>`, então o clique exige `preventDefault()` + `stopPropagation()`. Sem isso, ler o aviso marcaria a caixa de ciência sozinho — o usuário "confirmaria" sem ter lido.
- A modal do Aviso é dispensável por `Esc`; a de Termos **não**, porque ali a decisão (aceitar/recusar) é obrigatória.

### Formatação do rótulo de ciência

`.checkbox-option div strong` é `display: block` no design system. Qualquer elemento **irmão** do `<strong>` (o asterisco de obrigatório, um `<p>` com o link) cai numa linha própria abaixo do texto. A frase inteira — link do aviso e asterisco inclusive — precisa ficar **dentro** do `<strong>`, com o link inline sobre as palavras "aviso de privacidade".

---

## 7. Correções de UX/UI

### 7.1 Cabeçalho da iniciativa

O layout anterior colocava título/protocolo à esquerda e uma coluna com badges + botão à direita. Com título longo ou rótulo de via extenso ("Registro de Sistemas Corporativos (SGE/SGP)"), o `flex-wrap: wrap` empurrava a coluna inteira para baixo, deslocando o botão.

Reestruturado:

- os **badges migraram para junto do texto** (abaixo do protocolo), onde podem quebrar livremente sem disputar espaço com a ação;
- o bloco de texto recebeu `min-width: 0` + `overflow-wrap: anywhere`, para encolher e quebrar em vez de estourar;
- a coluna da direita recebeu `flex: 0 0 auto` — nunca encolhe, o botão fica sempre alinhado ao topo;
- abaixo de 640px o botão desce para uma linha própria, em largura total.

### 7.2 Badge duplicado

Removido o selo `externoTag` da listagem (e o CSS `.badge-externo-tag`, que ficou órfão). A origem passa a ter **uma única** identificação visual: o badge de canal.

### 7.3 Selects

`select.field-input` teve a seta afastada de 12px → 14px (alinhada ao padding do texto), com `padding-right` de 38px → 40px. `select.form-input` (painel administrativo) **não tinha estilo próprio** e usava a seta nativa: recebeu a mesma seta SVG e o mesmo espaçamento, além de estado `:disabled` — necessário para o campo de relevância travado na Via 1.

---

## 8. Migration V31

`V31__relevancia_classificacao_e_reversao.sql`, aditiva e idempotente (Oracle 19c):

1. colunas `RELEVANCIA_ESTRATEGICA` e `CLASSIFICACAO_INICIATIVA` (nullable);
2. backfill da relevância (Via 1 → PE; demais → indeterminada);
3. CHECKs `CK_INI_RELEVANCIA` e `CK_INI_CLASSIFICACAO`;
4. `NOT NULL` removido de `NOME_COLABORADOR` e `CANAL_CONTATO`;
5. `CK_INI_TIPO_INST` recriado com `STARTUP` e `EMPRESA_PRIVADA` (e `PARCERIA` preservada);
6. `CK_HS_TIPO` recriado com `REVERSAO`;
7. seed das duas transições de reversão.

Nenhuma coluna é removida ou renomeada, nenhuma linha de histórico é reescrita e a trigger de imutabilidade `TRG_HS_NO_UPD_DEL` **não é desabilitada** — diferentemente da V26, esta migration não precisa tocar em dados de auditoria.

### 8.1 Resolução de schema — desvio deliberado do padrão das V19–V30

As migrations anteriores usam as views `user_*` e DDL sem qualificação de schema. Isso funciona **apenas** quando a sessão está conectada como dona das tabelas (`CEDAE_INOVACAO`). Numa sessão de outro usuário — ou apontada para outro banco/serviço — `user_tab_columns` volta vazio, o `IF v_count = 0` conclui que a coluna não existe e o `ALTER TABLE` seguinte falha com `ORA-00942`, em cascata, sem indicar a causa real. Foi exatamente esse o sintoma na primeira tentativa de aplicar a V31.

A V31 passa a:

1. **resolver o dono de cada tabela em tempo de execução** (`ALL_TABLES`, com preferência schema corrente → `CEDAE_INOVACAO` → único visível) e qualificar todo o DDL/DML com `"OWNER"."TABELA"`;
2. **abortar na etapa 0 com uma mensagem única e acionável** (`ORA-20031`) informando o que não foi encontrado, o usuário conectado, o schema corrente e o banco — em vez de oito `ORA-00942` seguidos;
3. **criar `TRANSICOES_STATUS` se ela não existir**, com o DDL da V12 — mesma postura que a V29 adotou para `CANAIS_CAPTACAO`, já que as migrations de catálogo não foram aplicadas em todos os ambientes.

Consequência: toda a migration virou **um único bloco PL/SQL anônimo**, porque o nome qualificado precisa ser montado em variável e reutilizado por todas as etapas. O DDL continua com commit implícito — o script não é reversível por `ROLLBACK`, mas é idempotente, então uma falha no meio se corrige reexecutando.

Nenhum comando de cliente (`SET SERVEROUTPUT ON`) foi embutido: quebraria a execução via Flyway/JDBC. O relatório por `DBMS_OUTPUT` fica disponível para quem habilitar a saída no cliente.

As etapas 5 e 6 fazem `DROP` + `ADD` da constraint apenas quando o domínio ainda não contempla o valor novo (detectado em `search_condition_vc`), e restauram a condição anterior se o `ADD` falhar — a tabela nunca fica sem a constraint. O `ADD` revalida as linhas existentes, todas dentro do domínio ampliado, que é um superconjunto do anterior.

---

## 9. Auditoria

| Operação | `HISTORICO_STATUS` | `INOVACAO_LOGS` |
|---|---|---|
| Alterar relevância estratégica | — | `classificar_iniciativa` — "Iniciativa #N — Relevância estratégica: antes → depois" |
| Alterar Ação/Projeto | — | `classificar_iniciativa` — "Iniciativa #N — Classificação: antes → depois" |
| Reverter homologação | evento `REVERSAO` (usuário, data/hora UTC, `HOMOLOGADA → EM_ANALISE`, justificativa) | `reverter_decisao` com a justificativa |
| Reverter desclassificação | evento `REVERSAO` (idem, `DESCLASSIFICADA → EM_ANALISE`) | `reverter_decisao` com a justificativa |

O "antes" das duas primeiras é lido **na mesma conexão da escrita**, imediatamente antes do `UPDATE`, para que o log descreva a transição efetivamente aplicada. Campos não enviados ou sem mudança real não geram entrada — o log registra alterações, não tentativas.

`INOVACAO_LOGS.DETALHE` é `VARCHAR2(1000)`: o texto é truncado antes do insert (`limitarDetalhe`). Sem isso, uma justificativa longa faria o insert falhar silenciosamente — `AuthService.registrarLog` engole exceções por desenho, para nunca derrubar a operação principal.

---

## 10. Itens fora do escopo

- Relevância estratégica no formulário público (§2.2).
- Filtro/agrupamento por relevância ou por Ação/Projeto no dashboard e na listagem.
- Reversão a partir de `EM_ANALISE` (voltar para `SUBMETIDA`) — só as duas decisões terminais foram pedidas.
- Notificação por e-mail ao proponente quando uma decisão é revertida.
- Normalização retroativa de `TIPO_INSTITUICAO = 'PARCERIA'` para os novos valores — é decisão de negócio, caso a caso.

---

## 11. Consequências

**Positivas**
- A base ganha duas dimensões de qualificação estratégica sem nenhuma quebra de compatibilidade.
- Um erro de homologação deixa de exigir intervenção no banco, e a correção fica rastreável.
- A máscara monetária tem uma implementação, não três — e um defeito latente no `retorno_economico` da edição foi eliminado.
- A modal de edição deixa de ser um caminho para estados inconsistentes.

**Negativas / dívidas assumidas**
- A obrigatoriedade de `NOME_COLABORADOR`/`CANAL_CONTATO` nas vias não-externas passou a depender exclusivamente da aplicação. Uma inserção direta no banco (fora da API) pode gravar iniciativa sem proponente em qualquer via.
- `PARCERIA` permanece no CHECK do banco por compatibilidade, então o domínio da aplicação e o do schema divergem de propósito. Está documentado nos dois lados.
- Iniciativas da Via 2 chegam com relevância `INDETERMINADA` e dependem de curadoria ativa do ADM para sair desse estado. Sem um filtro por relevância (fora do escopo), esse backlog não é visível no painel.
