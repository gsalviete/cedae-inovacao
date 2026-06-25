# ADR Review — CEDAE Inovação
**Versão:** 0.1  
**Data:** 2026-06-24  
**Autor da revisão:** Arquiteto de Software / Tech Lead  
**Finalidade:** Análise crítica de cada ADR para aprovação técnica, com impactos detalhados e estratégias de rollback

---

## Nota Prévia — Respostas às Discovery Questions e seu impacto nos ADRs

Antes de revisar os ADRs individualmente, é necessário registrar formalmente as respostas recebidas às perguntas de descoberta abertas, pois elas alteram o escopo de algumas decisões arquiteturais.

### DQ-005 — Ciclo de vida das iniciativas (RESPONDIDA)

**Resposta:** O fluxo é: colaborador submete → equipe do painel admin faz análise preliminar (completude, clareza, adequação ao escopo, duplicatas) → aprovação ou reprovação.

**Impacto nos ADRs:**
O ciclo de vida confirmado é mais simples do que o modelo de 9 estados inicialmente proposto. Com base nessa resposta, o ciclo de vida operacional mínimo é:

```
SUBMETIDA → EM_ANALISE → APROVADA
                      → REPROVADA
```

Estados adicionais como RASCUNHO, DEVOLVIDA, SUSPENSA e CONCLUIDA continuam válidos como extensões futuras, mas não são obrigatórios para o MVP. A tabela TRANSICOES_STATUS (ADR-004) absorve essa simplificação sem alteração de arquitetura — basta popular com menos linhas inicialmente.

**Revisão necessária no ADR-004:** A nomenclatura `HOMOLOGADA` e `DESQUALIFICADA` dos documentos anteriores deve ser substituída por `APROVADA` e `REPROVADA` para refletir a linguagem real do negócio confirmada. Os códigos internos mudam; a arquitetura não muda.

### DQ-006 — Transições reversíveis (RESPONDIDA)

**Resposta:** Não existe mapeamento atual, mas pode ser criado.

**Impacto nos ADRs:**
Isso reforça e valida o ADR-004 (workflow como dado). Como não há regras preexistentes sobre reversibilidade, a tabela TRANSICOES_STATUS começa com o conjunto mínimo validado pela equipe e é expandida conforme o processo amadurece. A equipe do painel admin terá controle sobre isso via interface de configuração — sem necessidade de desenvolvimento para cada ajuste de processo.

### DQ-009 e DQ-010 — Vias 1, 3 e Mapeamento Externo (RESPONDIDAS)

**Resposta:** Vias 1 e 3 não serão usadas. Mapeamento Externo é irrelevante para o sistema.

**Impacto nos ADRs e no modelo:**
Esta é a simplificação mais significativa recebida. Elimina toda a complexidade de múltiplos canais de captação do escopo imediato.

Consequências diretas:
- A tabela CANAIS_CAPTACAO pode ser criada com apenas um registro inicial: `VIA_2`. Estrutura preservada para extensão futura, mas sem complexidade operacional agora.
- O campo `canal_id` em INICIATIVAS é preenchido automaticamente como `VIA_2` em todas as submissões via formulário — sem escolha do usuário.
- Nenhum módulo de "inserção manual pela Assessoria" precisa ser construído por enquanto.
- A entidade PROPONENTE (tipo EXTERNO) pode ser adiada — por ora, todos os proponentes são colaboradores internos.
- O modelo de dados proposto permanece válido; apenas o escopo de uso inicial é reduzido.

**Ação requerida:** Revisar as stories E2-001 e E4-001 para remover referências a múltiplos canais do escopo do MVP.

### DQ-018 — Alinhamento com PE/Metas Globais (RESPONDIDA)

**Resposta:** Não foi encontrada fonte que defina PE/Metas Globais.

**Impacto nos ADRs:**
O campo de alinhamento estratégico (ODS + PE) é removido do escopo do MVP. A tabela METAS_ESTRATEGICAS pode ser criada como estrutura para o futuro, mas não será populada além dos 17 ODS e não haverá interface para associação no MVP.

Consequências:
- A story E4-005 (alinhamento com ODS e metas estratégicas) é movida para backlog futuro.
- A tabela INICIATIVAS_METAS não precisa ser implementada no MVP.
- O dashboard não incluirá painel de distribuição por ODS na versão inicial.

---

## ADR-001 — Schema Additive: Construção paralela do modelo TO-BE

**Status:** Proposto → **Recomendação: APROVAR**

### Problema resolvido

O sistema tem dados reais em produção e não pode ser interrompido enquanto a migração acontece. O schema atual (duas tabelas, modelo flat) é estruturalmente diferente do schema TO-BE (17+ tabelas, relacionamentos, constraints). A pergunta central é: como chegar de um lado para o outro sem derrubar o sistema?

A decisão resolve isso criando o novo schema ao lado do antigo, migrando os dados históricos via ETL, e fazendo a aplicação gradualmente "trocar de trilho" — controlado por um feature flag, não por downtime.

### Benefícios

**Para o negócio:** Zero downtime. O formulário de captação continua recebendo submissões durante toda a migração. Não existe janela de "sistema fora do ar para manutenção" que interrompa colaboradores querendo registrar iniciativas.

**Para a operação:** Rollback em qualquer fase. Se algo der errado na Fase 2, o feature flag volta para `LEGADO` e o sistema retorna ao comportamento anterior em menos de 1 minuto — sem necessidade de reverter código ou dados.

**Para a equipe técnica:** Cada fase entrega algo testável e verificável antes de avançar. Não existe um momento de "tudo ou nada" em que metade do trabalho não funciona até a outra metade estar pronta.

**Para a rastreabilidade:** Os dados históricos são migrados, não descartados. Cada iniciativa existente recebe um CODIGO_PUBLICO retroativo e um registro inicial no HISTORICO_STATUS — o portfólio histórico da Assessoria não é perdido.

### Riscos

**Risco principal — Divergência de dados durante a coexistência:** Se o feature flag ficar em posição errada por um período, parte das submissões pode ir para a tabela legada e parte para a nova. Isso cria divergência que precisa ser reconciliada manualmente.

Mitigação: monitoramento ativo de COUNT nas duas tabelas após cada mudança de estado do feature flag. Alert se COUNT de INOVACAO_INICIATIVAS crescer após a ativação do flag `NOVO`.

**Risco secundário — ETL com dados ambíguos:** Os campos de texto livre (área, proponente, notas) precisam ser curados para virar entidades normalizadas. Variações de nome ("André Martins" vs "Andre Martins") geram duplicatas.

Mitigação: relatório de curadoria gerado pelo ETL, revisado manualmente pela Assessoria antes da execução em produção.

**Risco de prazo:** Manter dois schemas por ~12 semanas adiciona overhead de contexto para qualquer desenvolvedor que precise fazer manutenção durante esse período.

Mitigação: documentação clara do estado atual em cada fase; README atualizado a cada fase concluída.

### Impacto no banco

**Cria:** 17 tabelas novas coexistindo com as 2 tabelas legadas. Nenhuma tabela existente é alterada estruturalmente até a Fase 5.

**Altera (minimamente):** A tabela `INOVACAO_INICIATIVAS` recebe colunas nullable adicionadas via ALTER TABLE (CODIGO_PUBLICO, STATUS, PROPONENTE_ID etc.). Operação segura — colunas nullable não afetam INSERTs existentes.

**Remove (apenas na Fase 5):** `INOVACAO_INICIATIVAS` renomeada para `INOVACAO_INICIATIVAS_LEGADO`. `INOVACAO_LOGS` renomeada para `INOVACAO_LOGS_LEGADO`. DROP só após 90 dias adicionais.

**Volume de storage adicional:** Estimativa conservadora com base nos 4 registros atuais: desprezível. Mesmo com crescimento de 10x, o overhead do novo schema é dominado pelas tabelas de auditoria (AUDITORIA_LOGS, HISTORICO_STATUS) — não pelas tabelas de negócio.

### Impacto no backend

**Fase 1:** Nenhuma alteração no código da aplicação. Scripts DDL e ETL são executados diretamente no banco.

**Fase 2:** `IniciativasService.criar()` passa a ter lógica bifurcada: consulta PARAMETROS_SISTEMA e grava em INICIATIVAS ou INOVACAO_INICIATIVAS conforme o flag. Dois caminhos de escrita existem temporariamente no mesmo serviço.

**Fase 5:** Remoção do código do caminho legado. O serviço volta a ter um único caminho.

**Ponto de atenção:** Durante as Fases 2-4, qualquer desenvolvedor que alterar `IniciativasService.criar()` precisa estar ciente dos dois caminhos. Comentário explícito no código é obrigatório: `// Feature flag FORMULARIO_DESTINO_TABELA — remover após Fase 5`.

### Impacto no frontend

Nenhum impacto direto. O frontend não sabe qual tabela recebe os dados — isso é detalhe de implementação do backend. A única mudança perceptível pelo frontend é o retorno do `codigo_publico` na resposta de submissão bem-sucedida (story E2-001).

### Estratégia de rollback

| Fase | Como reverter | Tempo de recuperação | Perda de dados |
|---|---|---|---|
| Fase 1 (schema additive) | DROP das tabelas novas | < 5 minutos | Nenhuma — tabelas legadas intactas |
| Fase 2 (feature flag NOVO) | Alterar PARAMETROS_SISTEMA para LEGADO | < 1 minuto | Submissões feitas enquanto flag estava NOVO ficam apenas em INICIATIVAS — precisam ser migradas de volta manualmente |
| Fase 3-4 | Não aplicável — não afetam o destino das submissões | — | — |
| Fase 5 (rename legado) | Renomear de volta (`INOVACAO_INICIATIVAS_LEGADO` → `INOVACAO_INICIATIVAS`) | < 5 minutos | Nenhuma — dados preservados |

**Janela sem rollback limpo:** Após DROP das tabelas legadas (90 dias pós-rename), o rollback completo para o estado original deixa de ser possível. Esse momento deve ter aprovação formal e dump de arquivamento obrigatório.

---

## ADR-002 — DOMINIO_VALORES: Tabela única para todos os enums

**Status:** Proposto → **Recomendação: APROVAR com ressalva**

### Problema resolvido

O sistema atual aceita qualquer string nos campos categóricos (estágio de maturidade, dimensão de inovação, grau de impacto etc.) — sem validação no banco. Isso significa que um bug na aplicação pode gravar `"IDEACAOOO"` e o sistema persiste sem reclamar. A decisão resolve isso introduzindo uma fonte única de verdade para todos os valores controlados, gerenciável pela própria Assessoria sem intervenção técnica.

### Benefícios

**Evolução sem deploy:** Quando a Assessoria quiser adicionar uma nova dimensão de inovação (ex: "Inovação Regulatória"), o administrador insere um registro em DOMINIO_VALORES via interface. Nenhum desenvolvedor precisa ser acionado.

**Consistência garantida:** Todos os dropdowns do formulário e do painel admin consomem a mesma fonte. Não existe o problema de "o formulário tem 5 opções mas o painel mostra 4" por divergência de hardcoding em diferentes partes do código.

**Rótulos configuráveis por contexto:** O mesmo código interno (`PILOTO`) pode ter rótulo diferente no formulário ("Teste / Piloto (MVP)") e no painel da Assessoria ("Teste-Piloto-MVP") via campo `rotulo_pt` e metadados. Sem duplicação de listas no código.

**Metadados extensíveis:** O campo `metadados` (JSON) permite adicionar propriedades como cor do badge, ícone ou equivalência legada sem alterar o schema.

### Riscos

**Risco principal — FK sem discriminação de domínio:** Este é o calcanhar de Aquiles da abordagem. O Oracle não suporta FK parcial. Não há como dizer `estagio_maturidade_id REFERENCES DOMINIO_VALORES WHERE dominio = 'ESTAGIO_MATURIDADE'`. Em teoria, um bug poderia gravar o ID de um valor de `GRAU_IMPACTO` no campo `estagio_maturidade_id`.

Mitigação aplicada: validação obrigatória na camada de serviço ao criar/atualizar iniciativas. A função Oracle `get_dominio(id)` em CHECK CONSTRAINT nos campos mais críticos. Testes de integração cobrindo tentativas de atribuição cruzada.

**Risco secundário — Performance de queries com múltiplos JOINs:** Uma query que precisa exibir estágio, dimensão e impacto de uma iniciativa faz 3 JOINs em DOMINIO_VALORES. Com volume baixo, imperceptível. Com crescimento, pode afetar o dashboard.

Mitigação: views materializadas para as queries frequentes do dashboard. Cache de TTL curto para a lista de domínios (esses dados raramente mudam).

**Ressalva para aprovação:** A complexidade de garantir integridade de domínio sem suporte nativo do banco é real. Recomendo que, para os campos de STATUS da iniciativa (que são os mais críticos operacionalmente), seja criada uma tabela separada `STATUS_WORKFLOW` ao invés de usar DOMINIO_VALORES. Os status de ciclo de vida têm semântica de máquina de estados — não é apenas uma lista de valores, é uma entidade com regras de transição. Misturá-los com "dimensão de inovação" e "tipo de suporte" em DOMINIO_VALORES reduz a clareza do modelo.

### Impacto no banco

**Cria:** Uma tabela DOMINIO_VALORES com ~40-60 registros iniciais distribuídos por ~8-10 domínios.

**Altera:** A tabela INICIATIVAS (nova) usa `estagio_maturidade_id`, `dimensao_inovacao_id`, `grau_impacto_id` como FKs para DOMINIO_VALORES em vez de VARCHAR2. A tabela legada INOVACAO_INICIATIVAS mantém os campos VARCHAR2 originais intactos.

**Views criadas:** `VW_ESTAGIOS_MATURIDADE`, `VW_DIMENSOES_INOVACAO`, `VW_GRAUS_IMPACTO`, `VW_TIPOS_SUPORTE` — cada uma como `SELECT * FROM DOMINIO_VALORES WHERE dominio = '{X}' AND ativo = 1 ORDER BY ordem`. Essas views simplificam as queries e isolam o discriminador.

**Indexação necessária:** Índice composto em `(dominio, ativo, ordem)` para que as queries de dropdown sejam index scans, não full table scans.

### Impacto no backend

**ReferenceDataModule (novo):** Endpoints `GET /api/reference/:domain` retornam os valores ativos de um domínio ordenados. Esses endpoints são públicos (o formulário precisa carregar os dropdowns sem autenticação) ou autenticados opcionalmente.

**Validação nos DTOs:** `CreateIniciativaDto` passa a validar `estagio_maturidade_id` contra a lista de IDs válidos do domínio `ESTAGIO_MATURIDADE`. Isso exige uma query de validação no momento do parsing do DTO — considerar cache em memória com TTL de 5 minutos para não onerar o banco a cada request do formulário.

**Serviços existentes:** `IniciativasService` passa a fazer JOINs com DOMINIO_VALORES para enriquecer o payload de retorno com os rótulos. As queries SQL embutidas nos services precisam ser atualizadas.

### Impacto no frontend

**Formulário:** Os campos de seleção (estágio, dimensão, impacto, suporte) que hoje têm opções hardcoded em HTML passam a ser carregados dinamicamente via `GET /api/reference/{domain}` no carregamento da página. A tela mostra um loader até os dados chegarem.

**Painel admin:** Os filtros de listagem (filtrar por estágio, por dimensão) também passam a ser populados dinamicamente. Isso elimina qualquer divergência futura entre as opções do formulário e os filtros do painel.

**Impacto de falha:** Se a API de referência falhar, os dropdowns ficam vazios e o formulário não pode ser submetido. Mitigação: cache local no frontend com valores do último carregamento bem-sucedido (localStorage com TTL de 24h).

### Estratégia de rollback

Não há rollback individual para este ADR — ele está intrinsecamente ligado ao ADR-001 (schema additive). Se a decisão de usar DOMINIO_VALORES for revertida, seria necessário converter os campos FK de INICIATIVAS de volta para VARCHAR2. Isso é uma mudança DDL com migração de dados.

**Recomendação:** Este ADR deve ser tratado como irreversível após a Fase 2 estar em produção. A decisão de adotá-lo ou não deve ser tomada conscientemente antes do início da Fase 1.

---

## ADR-003 — Separação Identidade / Autenticação / Autorização

**Status:** Proposto → **Recomendação: APROVAR — decisão crítica para o futuro**

### Problema resolvido

O sistema atual tem um único usuário admin definido por variáveis de ambiente. Não existe entidade de usuário no banco. Quando a integração com Active Directory vier (e ela virá — é requisito da CEDAE como empresa pública), qualquer sistema que use `login` como chave em suas tabelas de auditoria e histórico vai precisar de uma migração dolorosa para atualizar registros históricos.

Esta decisão resolve o problema na raiz: o `id` interno do usuário (um número inteiro gerado pelo banco) nunca muda. O `login` é apenas um atributo que pode ser atualizado. Quando o Active Directory chegar, a única operação necessária é `UPDATE USUARIOS SET login = 'novo_upn', origem_identidade = 'AD' WHERE id = 1` — e absolutamente nada mais precisa mudar.

### Benefícios

**Imunidade à migração de autenticação:** Esta é a razão de ser do ADR. Mudar de autenticação local para AD muda apenas duas colunas em USUARIOS. Nenhuma FK em HISTORICO_STATUS, ANOTACOES, AUDITORIA_LOGS ou qualquer outra tabela precisa ser tocada.

**Múltiplos usuários com perfis distintos:** Com a tabela USUARIOS e USUARIOS_PERFIS, a Assessoria pode ter analistas com contas individuais, cada um com seus próprios registros de auditoria. Hoje, tudo aparece como "o admin fez isso".

**Escopo de dados por área:** O campo `area_id` em USUARIOS é a âncora para o row-level security. Um gestor de área cujo `area_id = 5` só vê iniciativas onde `area_proponente_id = 5` (ou subordinadas). Isso é implementável na camada de aplicação sem Oracle VPD.

**Rastreabilidade de verdade:** Cada transição de status, cada anotação, cada mudança auditada tem um `usuario_id` real. "Quem aprovou INOV-2026-003?" retorna "Ana Lima, analista, em 15/07/2026 às 14:32" — não "o admin".

### Riscos

**Risco principal — Sincronização de perfis na migração para AD:** Quando o AD for integrado, os usuários existentes (criados agora com `origem_identidade = 'LOCAL'`) precisarão ser mapeados para contas do AD. Se o `login` atual (ex: "gsalviete") não corresponder ao UPN do AD (ex: "gsalviete@cedae.gov.br"), a vinculação será manual.

Mitigação: armazenar desde agora o UPN esperado do AD como segundo campo em USUARIOS (`login_ad` ou `matricula_corp`). Mesmo que não seja usado para autenticação ainda, facilita o mapeamento futuro.

**Risco de consistência no período de transição (E3):** Durante a Fase 3, enquanto o mecanismo duplo de autenticação estiver ativo (ADR-007), tokens gerados pelo caminho legado e pelo novo caminho precisam ter o mesmo formato de payload para que os guards funcionem com ambos.

Mitigação: isso é coberto pelo ADR-007 — ambos os caminhos geram tokens com o novo payload estruturado.

**Risco operacional — Usuário bloqueado:** Se o único usuário ADMINISTRADOR for desativado acidentalmente, ninguém consegue fazer login. O sistema fica operacional para submissões (formulário público) mas o painel admin fica inacessível.

Mitigação: constraint no banco que impede desativação do último usuário com perfil ADMINISTRADOR. Interface mostra aviso explícito antes de qualquer operação que reduza o número de administradores ativos para zero.

### Impacto no banco

**Cria:**
- Tabela `USUARIOS` com `id` (BIGINT PK), `login`, `email`, `area_id`, `ativo`, `origem_identidade`, `ultimo_acesso`
- Tabela `PERFIS_ACESSO` com os perfis iniciais (ADMINISTRADOR, ANALISTA_ASSESSORIA, GESTOR_AREA)
- Tabela `USUARIOS_PERFIS` associativa com `concedido_em`, `concedido_por_id`, `valido_ate` (nullable para perfis sem expiração)

**Referenciado por:** HISTORICO_STATUS, ANOTACOES, AUDITORIA_LOGS, INVESTIMENTOS, INICIATIVAS_METAS, INICIATIVAS_SUPORTES — todas as tabelas transacionais usam `usuario_id` (FK para USUARIOS) em vez de texto.

**Não cria constraint de NOT NULL imediata em FKs históricas:** Os registros criados pelo ETL (Fase 1) referenciam o usuário admin criado no seed. Registros futuros sempre têm usuário identificado.

### Impacto no backend

**AuthModule — alterações na Fase 3:**
- `AuthService.validateCredentials()`: query em USUARIOS + bcrypt.compare() substituindo comparação com env vars
- `AuthService.generateToken()`: payload novo com `{ sub: user_id, login, perfis: [], area_id }`
- `JwtStrategy`: extração e validação do novo payload
- `AdminGuard` removido; substituído por `RolesGuard` genérico que lê `perfis[]` do payload

**UsersModule (novo):** CRUD de usuários para a tela de gestão. Endpoints sob `/api/admin/users` protegidos por perfil ADMINISTRADOR.

**Guards:**
- `JwtAuthGuard` (já existe mas inativo): ativado como guard padrão global
- `RolesGuard` (novo): `@RequireRole('ANALISTA_ASSESSORIA')` aplicado aos endpoints que exigem perfil específico
- `AdminGuard` (atual): removido após E3-003

**Atenção — breaking change coordenada:** A mudança do payload JWT é uma breaking change. Qualquer código que leia `payload.is_admin` diretamente vai quebrar quando `is_admin` for removido do payload. Precisa ser coordenada em um único deploy: mudança de `generateToken()` + mudança de todos os guards + atualização do frontend que lê sessionStorage.

### Impacto no frontend

**sessionStorage:** Hoje guarda `{ token, is_admin, username }`. Após E3, passa a guardar `{ token, user_id, login, perfis: [], area_id }`. O frontend precisa interpretar `perfis.includes('ADMINISTRADOR')` no lugar de `is_admin === true`.

**Tela de login:** Sem mudança visual. Apenas o processamento da resposta muda.

**Tela de gestão de usuários (nova):** Lista, criação, edição e desativação de usuários. Acessível apenas para perfil ADMINISTRADOR.

**Controle de visibilidade por perfil:** Botões de ação no painel (ex: "Aprovar iniciativa") ficam visíveis apenas para perfis que têm a transição correspondente em TRANSICOES_STATUS. O frontend precisa receber a lista de transições disponíveis para o perfil atual e renderizar apenas os botões correspondentes.

### Estratégia de rollback

| Cenário | Como reverter | Impacto |
|---|---|---|
| Antes do deploy E3 | Tabela USUARIOS existe mas não é consultada — remover é trivial | Nenhum |
| Durante o mecanismo duplo (E3-001) | Desabilitar o novo mecanismo via feature flag; sistema volta a usar env vars | Usuários criados em USUARIOS ficam sem acesso até a próxima tentativa de implementação |
| Após E3-005 (legado removido) | Reintroduzir validação via env vars no código + deploy | Usuários criados em USUARIOS continuam funcionando; rollback é apenas para recuperação de emergência |

**Rollback crítico:** Após E3-005, se o administrador perder o acesso, o procedimento de recuperação é: (1) acesso direto ao banco, (2) UPDATE na senha do usuário admin com hash bcrypt gerado manualmente. Esse procedimento deve estar documentado antes do deploy de E3-005.

---

## ADR-004 — Workflow como dado (TRANSICOES_STATUS configurável)

**Status:** Proposto → **Recomendação: APROVAR — validado pela resposta DQ-005**

### Problema resolvido

Com a resposta ao DQ-005, confirmamos que o ciclo de vida atual é: submissão → análise preliminar → aprovação ou reprovação. Simples hoje — mas processos evoluem. O ADR-004 resolve o problema de como implementar esse workflow de forma que quando o processo mudar (e vai mudar), a mudança seja uma operação de configuração, não um deploy.

O problema concreto que evita: em 6 meses, a Assessoria decide que uma iniciativa reprovada pode ser "devolvida para complementação" antes de ser reprovada definitivamente. Se o workflow estiver hardcoded, isso é um ticket de desenvolvimento, uma sprint de trabalho e um deploy em produção. Com TRANSICOES_STATUS, é inserir duas linhas na tabela.

### Benefícios

**O processo vira documentação:** A tabela TRANSICOES_STATUS é a especificação viva do workflow. Qualquer pessoa pode consultar: "quais transições estão disponíveis? Quem pode executar cada uma?" — sem precisar ler o código.

**Mudanças de processo sem deploy:** A Assessoria ganha autonomia para ajustar o fluxo de trabalho via interface admin. Isso é especialmente valioso em uma empresa pública onde mudanças regulatórias podem exigir ajustes de processo com urgência.

**Auditoria de configuração:** Toda mudança em TRANSICOES_STATUS gera registro em AUDITORIA_LOGS. É possível responder: "quando foi adicionada a possibilidade de suspender uma iniciativa homologada? Quem fez isso?"

**Validação centralizada:** O `WorkflowService` tem um único ponto de entrada para todas as transições. Não existe o risco de um endpoint fazer uma transição "pela porta dos fundos" sem passar pelas validações.

**Ciclo de vida inicial simplificado (impacto DQ-005 e DQ-006):**

Com base nas respostas recebidas, o conjunto inicial de TRANSICOES_STATUS pode ser mínimo:

| status_origem | status_destino | perfil_requerido | justificativa_obrig | notificar |
|---|---|---|---|---|
| SUBMETIDA | EM_ANALISE | ANALISTA_ASSESSORIA | Não | Não |
| EM_ANALISE | APROVADA | ANALISTA_ASSESSORIA | Não | Sim |
| EM_ANALISE | REPROVADA | ANALISTA_ASSESSORIA | Sim | Sim |

Isso é suficiente para o MVP. Estados e transições adicionais (DEVOLVIDA, SUSPENSA, CONCLUIDA) são adicionados via INSERT quando o processo amadurecer — sem nenhuma mudança de código.

### Riscos

**Risco principal — Regras complexas além da tabela:** Algumas validações não cabem em uma tabela de configuração simples. Exemplo: "só pode aprovar se o campo `analista_responsavel_id` estiver preenchido". Essa é uma pré-condição condicional que não é expressável como linha em TRANSICOES_STATUS.

Mitigação: aceitar que pré-condições complexas ficam no `WorkflowService` como validações explícitas, documentadas com comentário referenciando a regra de negócio. A tabela TRANSICOES_STATUS cobre as regras estruturais (quem pode fazer o quê); o serviço cobre as regras contextuais (quando pode fazer).

**Risco secundário — Configuração inválida pelo administrador:** Um administrador pode inserir uma transição que crie ciclos no grafo de estados (ex: APROVADA → SUBMETIDA → APROVADA infinitamente) ou remover uma transição essencial (ex: remover SUBMETIDA → EM_ANALISE congela todo o portfólio).

Mitigação: validação na interface de administração de transições. Alertas para: "remover esta transição bloqueará N iniciativas que estão em status SUBMETIDA". Não permitir remoção de transições que têm iniciativas no status de origem.

**Risco de cache stale:** Se `WorkflowService` cachear as transições em memória por eficiência, uma mudança na tabela pode levar até o TTL do cache para ser refletida.

Mitigação: TTL curto (1-2 minutos) para o cache de TRANSICOES_STATUS. Para ambientes de desenvolvimento, opção de desativar o cache.

### Impacto no banco

**Cria:** Tabela `TRANSICOES_STATUS` com as colunas: `id`, `status_origem`, `status_destino`, `perfil_requerido`, `justificativa_obrig` (NUMBER(1)), `notificar_proponente` (NUMBER(1)), `descricao`, `ativo`.

**Constraint importante:** `UNIQUE(status_origem, status_destino, perfil_requerido)` — não podem existir duas regras idênticas para a mesma transição e perfil.

**Índice:** `(status_origem, ativo)` — a query mais frequente é "quais transições saem deste status e estão ativas?".

**Dados iniciais (MVP):** As 3 linhas descritas acima na seção de benefícios. Expansíveis sem DDL.

### Impacto no backend

**WorkflowModule (novo):** Serviço central `WorkflowService.transicionar(iniciativaId, novoStatus, usuario, justificativa)` que:
1. Consulta TRANSICOES_STATUS para validar a transição (com cache)
2. Verifica perfil do usuário contra `perfil_requerido`
3. Verifica justificativa quando `justificativa_obrig = 1`
4. Executa UPDATE em `INICIATIVAS.status_id` em transação
5. Insere em `HISTORICO_STATUS`
6. Retorna o novo estado ou lança exceção tipada

**Endpoint `PATCH /api/iniciativas/:id/status`:** Único ponto de entrada para transições. Delega 100% para `WorkflowService`. Não há lógica de validação de workflow fora deste serviço.

**Proibição explícita:** Nenhum outro serviço ou controller pode fazer UPDATE direto em `INICIATIVAS.status_id` sem passar pelo `WorkflowService`. Isso deve ser documentado como regra de desenvolvimento e verificado em code review.

### Impacto no frontend

**Botões de ação dinâmicos:** A tela de detalhe da iniciativa exibe apenas os botões de transição que o usuário atual pode executar. Isso exige que o backend retorne, junto com os dados da iniciativa, a lista de transições disponíveis para o perfil do usuário logado.

Endpoint sugerido: `GET /api/iniciativas/:id` retorna `{ ...dados, transicoes_disponiveis: ['EM_ANALISE', 'REPROVADA'] }`. O frontend renderiza um botão para cada item dessa lista, com o rótulo correspondente em DOMINIO_VALORES.

**Modal de justificativa:** Para transições com `justificativa_obrig = true`, o frontend abre modal com textarea obrigatório antes de confirmar a ação.

**Atualização reativa:** Após uma transição bem-sucedida, o frontend deve recarregar os dados da iniciativa (incluindo `transicoes_disponiveis` atualizado) para refletir o novo estado sem recarregar a página inteira.

### Estratégia de rollback

TRANSICOES_STATUS é uma tabela de configuração. Rollback é simples: restaurar os dados iniciais via DELETE/INSERT. Se uma transição foi adicionada erroneamente, DELETE da linha. Se uma transição foi removida erroneamente, INSERT para restaurá-la.

Para o WorkflowModule em si: se um bug no serviço causar transições incorretas, o rollback é o deploy da versão anterior do código. Os registros em HISTORICO_STATUS gerados por transições erradas são marcados com `anulado = true` pelo administrador (conforme ADR-005).

---

## ADR-005 — HISTORICO_STATUS imutável com campo `anulado`

**Status:** Proposto → **Recomendação: APROVAR**

### Problema resolvido

O problema central é de confiança na trilha de auditoria. Se os registros de HISTORICO_STATUS puderem ser deletados ou modificados livremente, eles perdem o valor como evidência. Para uma empresa pública sujeita a auditoria da AGENERSA, um histórico que pode ser apagado não é um histórico — é uma ficção.

Ao mesmo tempo, erros acontecem. Um bug pode inserir uma transição incorreta. A imutabilidade absoluta tornaria esse erro impossível de corrigir sem bypass do banco por um DBA. O campo `anulado` resolve esse dilema: o registro errado permanece visível (o erro é parte do histórico), mas é marcado como inválido, e um registro de correção documenta quem fez o quê e por quê.

### Benefícios

**Confiabilidade da trilha de auditoria:** Uma auditoria externa pode confiar que o que está em HISTORICO_STATUS reflete o que aconteceu de fato — nenhuma linha foi deletada para encobrir uma decisão.

**Correção de erros com rastreabilidade:** Um registro errado pode ser anulado, mas o erro e sua correção ficam documentados. Isso é mais honesto do que simplesmente deletar a linha errada.

**Separação de responsabilidades:** Apenas o perfil ADMINISTRADOR pode anular registros de histórico. Analistas não têm esse poder — não podem "reescrever o passado" de uma iniciativa.

**Conformidade implícita:** A imutabilidade com `anulado` atende ao espírito de qualquer exigência regulatória de trilha de auditoria sem exigir documentação adicional — o próprio schema conta a história.

### Riscos

**Risco principal — Trigger pode ser bypassado por DBA:** Um DBA com acesso direto ao banco pode desabilitar o trigger e fazer UPDATEs ou DELETEs diretamente. Isso está fora do alcance do sistema de aplicação.

Mitigação: este é um risco de governança, não técnico. A política de acesso ao banco de produção deve exigir que qualquer operação direta no banco seja logada, auditada e aprovada. Isso não é responsabilidade deste ADR — é responsabilidade da política de segurança de banco de dados da CEDAE.

**Risco secundário — Abuso do poder de anulação:** Um administrador pode anular registros legítimos de histórico para encobrir decisões. Com `anulado` mas sem `anulado_por_id` e `anulado_em`, o abuso seria invisível.

Mitigação: o campo `anulado` deve ser acompanhado de `anulado_por_id` (FK → USUARIOS), `anulado_em` (TIMESTAMP) e `motivo_anulacao` (CLOB obrigatório). Toda anulação gera registro em AUDITORIA_LOGS. O administrador que anula fica registrado.

**Risco de confusão em queries:** Queries que esquecem de filtrar `anulado = 0` mostrarão registros inválidos na timeline. Um desenvolvedor descuidado pode exibir um histórico incorreto.

Mitigação: a view `VW_HISTORICO_COMPLETO` aplica o filtro automaticamente. Todo acesso ao histórico via aplicação deve usar essa view, nunca a tabela diretamente. Documentar isso como regra de desenvolvimento.

### Impacto no banco

**Cria:** Tabela `HISTORICO_STATUS` com campos de imutabilidade:
- `anulado` NUMBER(1) DEFAULT 0
- `anulado_por_id` BIGINT → FK USUARIOS (nullable)
- `anulado_em` TIMESTAMP (nullable)
- `motivo_anulacao` CLOB (nullable; obrigatório quando `anulado = 1`)

**Trigger `TRG_HS_NO_UPD_DEL`:** BEFORE UPDATE OR DELETE. Permite UPDATE apenas no campo `anulado` (e seus campos associados). Bloqueia DELETE completamente com `RAISE_APPLICATION_ERROR(-20001, 'HISTORICO_STATUS é imutável')`.

**View `VW_HISTORICO_COMPLETO`:** `SELECT * FROM HISTORICO_STATUS WHERE anulado = 0 ORDER BY data_hora ASC`. Toda consulta da aplicação usa esta view.

**Constraint adicional:** `CHECK (anulado IN (0, 1))`. E: quando `anulado = 1`, `anulado_por_id` e `anulado_em` e `motivo_anulacao` devem ser NOT NULL (enforced via trigger, não via CHECK, pois envolve múltiplas colunas).

### Impacto no backend

**WorkflowService:** Após inserir em HISTORICO_STATUS, nunca mais atualiza aquele registro. Ponto final.

**HistoricoService (ou método em WorkflowService):** Método `anulaRegistro(historico_id, motivo, usuario_id)` que faz o UPDATE controlado no campo `anulado` + campos associados. Disponível apenas para código chamado por usuário com perfil ADMINISTRADOR.

**Endpoint de anulação:** `DELETE /api/admin/historico/:id` (semântica REST para "remover" um registro, mas a implementação faz UPDATE para `anulado = 1`). Protegido por perfil ADMINISTRADOR. Body obrigatório com `{ motivo: string }`.

**Consultas:** Todo service que consulta o histórico usa `VW_HISTORICO_COMPLETO`, nunca `SELECT * FROM HISTORICO_STATUS` diretamente.

### Impacto no frontend

**Timeline da iniciativa:** Exibe apenas registros com `anulado = 0` (filtrado pela view no backend). Se um registro foi anulado, ele simplesmente não aparece na linha do tempo do usuário comum.

**Interface de administração do histórico:** O perfil ADMINISTRADOR tem uma seção "Histórico Completo" que exibe todos os registros, incluindo os anulados (com indicação visual de "anulado" e motivo). Essa tela é administrativa — não é a mesma timeline que o analista vê.

### Estratégia de rollback

Não há rollback para registros já inseridos — essa é a natureza do ADR. O "rollback" de um registro incorreto É o uso do campo `anulado`. O processo é:

1. Identificar o registro incorreto pelo `id`
2. Chamar o endpoint de anulação com motivo documentado
3. Inserir o registro correto via nova transição de status (que, por sua vez, passa pelo `WorkflowService` normalmente)
4. O histórico mostrará: [registro errado — anulado], [registro correto]

Para o trigger em si: se o trigger causar problemas operacionais inesperados (ex: bug que impede uma atualização legítima), o DBA pode desabilitá-lo temporariamente. Isso deve ser um procedimento de emergência com aprovação formal e prazo definido para reabilitação.

---

## ADR-006 — Feature Flag em PARAMETROS_SISTEMA

**Status:** Proposto → **Recomendação: APROVAR**

### Problema resolvido

Durante a Fase 2, o endpoint de submissão precisa ser migrado para gravar na nova tabela INICIATIVAS sem causar downtime e com capacidade de rollback instantâneo. Isso requer uma "chave" que a aplicação consulta para decidir qual caminho seguir — sem precisar de um novo deploy para mudar o comportamento.

O ADR também resolve um problema mais amplo: parâmetros de negócio que mudam com frequência (prazos, limiares, flags de funcionalidade) não deveriam exigir deploy ou reinicialização de container para serem ajustados.

### Benefícios

**Rollback sem deploy:** O administrador altera um valor na tabela via interface ou SQL e, em até 1 minuto (TTL do cache), o sistema muda de comportamento. Nenhum desenvolvedor precisa ser acordado às 3h.

**Controle operacional da Assessoria:** Parâmetros como "prazo padrão de análise em dias" ou "e-mail de notificação da Assessoria" são gerenciáveis pela equipe operacional sem chamado à TI.

**Rastreabilidade de configuração:** Toda mudança em PARAMETROS_SISTEMA gera registro em AUDITORIA_LOGS. "Quando o prazo de análise mudou de 30 para 45 dias? Quem fez isso?" — respondível.

**Separação clara entre configuração e segredo:** Parâmetros de negócio em PARAMETROS_SISTEMA; segredos de infraestrutura (JWT_SECRET, string de conexão Oracle) em variáveis de ambiente. Essa separação é intencional e documentada.

### Riscos

**Risco principal — Parâmetro crítico com valor inválido:** Um administrador configura `FORMULARIO_DESTINO_TABELA = 'INVALIDO'` (erro de digitação). A aplicação lê o valor, não reconhece, e pode falhar silenciosamente ou lançar exceção não tratada.

Mitigação: validação no código ao ler parâmetros com lista de valores aceitos. Para o feature flag específico: `if (!['LEGADO', 'NOVO'].includes(valor)) { usar 'LEGADO' como fallback seguro + log de erro }`. A interface de admin valida o tipo antes de salvar.

**Risco secundário — Cache stale em múltiplas instâncias:** Se o sistema evoluir para múltiplas instâncias do container (horizontal scaling), cada instância tem seu próprio cache em memória. Uma mudança no parâmetro pode levar até o TTL (5 min) para se propagar para todas as instâncias.

Mitigação: para o MVP com uma única instância, não é problema. Quando houver múltiplas instâncias, considerar cache distribuído (Redis) ou reduzir TTL. Documentar essa limitação como dívida técnica conhecida.

**Risco de segurança:** Um parâmetro como "email de notificação" pode ser modificado para redirecionar notificações para um endereço malicioso.

Mitigação: acesso à tela de PARAMETROS_SISTEMA restrito a perfil ADMINISTRADOR. Toda mudança auditada.

### Impacto no banco

**Cria:** Tabela `PARAMETROS_SISTEMA` com `(chave, valor, tipo_valor, descricao, editavel)`.

**Dados iniciais críticos:**
```
FORMULARIO_DESTINO_TABELA  | LEGADO  | TEXTO   | Feature flag da migração
PRAZO_ANALISE_DIAS         | 30      | NUMERO  | Prazo padrão de análise
EMAIL_ASSESSORIA           | (vazio) | TEXTO   | E-mail para notificações
VERSAO_FORMULARIO_ATUAL    | VIA2_R0 | TEXTO   | Versão do formulário ativo
```

O campo `editavel` (NUMBER(1)) permite marcar parâmetros como read-only via interface — útil para flags críticos que não devem ser alterados sem entender as implicações.

### Impacto no backend

**ParametrosService:** Serviço singleton com cache em memória (Map<string, string>) e TTL de 5 minutos por entrada. Método `get(chave: string, padrao?: string)` retorna o valor ou o padrão se a chave não existir.

**Uso no IniciativasService:**
```
const destino = await this.parametrosService.get('FORMULARIO_DESTINO_TABELA', 'LEGADO');
if (destino === 'NOVO') { /* gravar em INICIATIVAS */ }
else { /* gravar em INOVACAO_INICIATIVAS */ }
```

**Lifecycle hook:** No startup da aplicação, pré-carregar todos os parâmetros para o cache (warmup). Isso garante que o primeiro request não sofra latência de cache miss.

**Remoção futura:** O feature flag `FORMULARIO_DESTINO_TABELA` deve ser removido do código na Fase 5, junto com o código legado. O registro em PARAMETROS_SISTEMA pode ser mantido como histórico (com `editavel = 0` para evitar uso acidental) ou deletado.

### Impacto no frontend

**Tela de parâmetros no painel admin (Fase 4):** Lista todos os parâmetros com `editavel = 1`, permite editar valor, exibe tipo e descrição. Validação de tipo antes de salvar (número deve ser numérico, booleano deve ser 0/1).

**Sem impacto no formulário público:** Os parâmetros são consumidos pelo backend. O frontend não consulta PARAMETROS_SISTEMA diretamente.

### Estratégia de rollback

Este ADR é o mecanismo de rollback para vários outros ADRs, não o contrário. Para reverter a feature flag da migração: `UPDATE PARAMETROS_SISTEMA SET valor = 'LEGADO' WHERE chave = 'FORMULARIO_DESTINO_TABELA'` — efeito em até 1 minuto.

Para reverter o ADR em si (remover PARAMETROS_SISTEMA): substituir todas as consultas ao `ParametrosService` por valores hardcoded ou variáveis de ambiente. Isso é possível mas seria um passo atrás intencional — não há cenário realista onde isso seria necessário.

---

## ADR-007 — Mecanismo duplo de autenticação durante a transição

**Status:** Proposto → **Recomendação: APROVAR com prazo definido**

### Problema resolvido

A transição de autenticação via env vars para autenticação via tabela USUARIOS tem um momento de risco: o instante entre o deploy do novo código e a confirmação de que o administrador consegue logar pelo novo mecanismo. Se algo der errado nesse instante, o administrador fica sem acesso ao painel e o rollback exige um novo deploy.

O mecanismo duplo elimina esse risco: os dois caminhos coexistem por um período definido (1 semana), permitindo que o novo mecanismo seja validado em produção antes do legado ser removido.

### Benefícios

**Zero risco de lockout durante a transição:** O administrador pode usar as credenciais antigas enquanto testa e valida as novas. Se o novo mecanismo apresentar qualquer problema, o login legado ainda funciona.

**Validação em produção real:** O mecanismo novo é testado no ambiente real de produção — não apenas em staging — antes de ser a única opção. Isso detecta problemas de configuração de banco, rede ou JWT que podem não aparecer em staging.

**Log de warning como indicador de progresso:** O aviso "⚠️ Autenticação via credencial legada" nos logs indica que alguém ainda está usando o mecanismo antigo. Quando esses warnings desaparecem por 24h, é seguro remover o fallback.

### Riscos

**Risco principal — "Temporário" se tornar permanente:** Se o prazo de remoção do mecanismo legado não for definido e monitorado, o mecanismo duplo pode permanecer indefinidamente. Isso aumenta a superfície de ataque (duas formas de autenticar) e a complexidade do código.

Mitigação: o prazo de 1 semana deve ser formalizado como critério de aceite da story E3-005. A presença do mecanismo duplo no código deve ser identificada por comentário `// TODO: remover após E3-005 — data limite: DD/MM/AAAA`.

**Risco secundário — Tokens de origens diferentes coexistem:** Durante a semana de transição, tokens gerados pelo caminho legado e pelo novo caminho circulam simultaneamente. Ambos precisam ter o mesmo formato de payload para que todos os guards funcionem com os dois.

Mitigação: conforme decidido em ADR-003, ambos os caminhos geram tokens com o novo payload estruturado (`{ sub: user_id, login, perfis: [], area_id }`). O caminho legado consulta USUARIOS para pegar o `user_id` correspondente ao `ADMIN_USERNAME` antes de gerar o token.

**Risco de inconsistência de segurança:** Durante a semana dupla, a senha nas env vars continua sendo uma chave válida mesmo que ela seja mais fraca que a senha hasheada no banco.

Mitigação: neste momento, mudar a senha nas env vars para algo aleatório e forte (gerado especificamente para a semana de transição). Após a remoção do mecanismo legado, as env vars são deletadas.

### Impacto no banco

Nenhum impacto adicional ao que ADR-003 já define. O mecanismo duplo é implementação de código, não de schema.

### Impacto no backend

**`AuthService.validateCredentials()`** durante o período duplo:
```
1. Tentar autenticar via USUARIOS (bcrypt.compare)
2. Se USUARIOS falhar → tentar via ADMIN_USERNAME/ADMIN_PASSWORD env vars
3. Se env vars baterem → logar warning "⚠️ Autenticação via credencial legada"
   → consultar USUARIOS pelo login correspondente para obter user_id
   → gerar token com novo payload
4. Se ambos falharem → UnauthorizedException 401
```

**Ponto de atenção:** O passo 3 exige que o usuário admin já exista em USUARIOS com o mesmo login que `ADMIN_USERNAME`. Isso deve ser criado na Fase 1 (seed do usuário administrador inicial).

### Impacto no frontend

Nenhum impacto. O frontend sempre recebe um JWT com o mesmo formato, independente de qual caminho o gerou.

### Estratégia de rollback

**Rollback antes do prazo:** Remover o caminho novo de `validateCredentials()`. O sistema volta a autenticar exclusivamente via env vars. Deploy necessário mas simples.

**Rollback após E3-005:** Reintroduzir validação via env vars. Todos os usuários em USUARIOS continuam com suas contas. O rollback é apenas para recuperação de emergência — o prazo previsto é 1 semana de mecanismo duplo, não meses.

**Exigência formal:** A story E3-005 (remoção do mecanismo legado) só pode ser executada DEPOIS que o administrador confirmar explicitamente login bem-sucedido via USUARIOS. Essa confirmação deve ser registrada (ticket, email, ou equivalente) antes do deploy de E3-005.

---

## ADR-008 — Auditoria em duas camadas

**Status:** Proposto → **Recomendação: APROVAR**

### Problema resolvido

O sistema atual tem uma única tabela `INOVACAO_LOGS` que mistura registros de login com registros de submissão de formulário. Isso já é insuficiente hoje — não registra mudanças de status, edições de dados ou operações administrativas. A questão não é apenas adicionar mais eventos ao log existente, mas definir uma arquitetura de auditoria que sirva a dois propósitos radicalmente diferentes: conformidade de negócio e investigação técnica.

### Benefícios

**HISTORICO_STATUS para conformidade:** Uma auditoria regulatória pergunta "quem aprovou esta iniciativa e quando?". A resposta está em HISTORICO_STATUS em linguagem de negócio: "Ana Lima, Analista, aprovada em 15/07/2026 às 14:32, após análise de completude e adequação ao escopo". Nenhum ruído técnico.

**AUDITORIA_LOGS para segurança técnica:** Uma investigação de segurança pergunta "alguém alterou o campo `status_id` diretamente no banco, contornando o WorkflowService?". A resposta está em AUDITORIA_LOGS: `UPDATE INICIATIVAS SET status_id = 3 WHERE id = 7 — executado por sessão X às 03:47`. Isso detecta manipulação fora do sistema.

**Responsabilidade clara:** Analistas de negócio consultam HISTORICO_STATUS. DBAs e desenvolvedores consultam AUDITORIA_LOGS. Cada audiência tem sua ferramenta.

**Política de retenção diferenciada:** HISTORICO_STATUS é permanente (é a memória institucional do portfólio). AUDITORIA_LOGS tem retenção de 7 anos (LGPD + regulação). Essa diferença de política só é possível porque as tabelas são separadas.

### Riscos

**Risco principal — Volume de AUDITORIA_LOGS:** Uma tabela que registra cada INSERT/UPDATE/DELETE em todas as tabelas pode crescer muito rapidamente. Com 17 tabelas e tráfego moderado, AUDITORIA_LOGS pode ter 10-50x o volume das tabelas de negócio.

Mitigação: (1) implementar particionamento por data em Oracle (PARTITION BY RANGE em `timestamp_tz`); (2) política de retenção com DELETE automático de registros com mais de 7 anos; (3) não incluir `dados_anteriores` e `dados_novos` para todas as tabelas — apenas para as tabelas de negócio críticas (INICIATIVAS, USUARIOS, USUARIOS_PERFIS).

**Risco secundário — AUDITORIA_LOGS como gargalo de escrita:** Se implementado via trigger de banco para cada operação de escrita, pode adicionar latência mensurável em operações de alta frequência.

Mitigação: para o MVP com volume baixo, trigger de banco é adequado. Para escala futura, considerar geração de logs de auditoria na camada de aplicação (interceptor NestJS) em vez de trigger — permite operação assíncrona e não-bloqueante.

**Risco de confusão entre as duas camadas:** Desenvolvedores podem usar AUDITORIA_LOGS onde deveriam usar HISTORICO_STATUS, ou vice-versa.

Mitigação: documentação clara da responsabilidade de cada tabela. Regra explícita: "perguntas de negócio → HISTORICO_STATUS; perguntas técnicas → AUDITORIA_LOGS". ADR como referência.

### Impacto no banco

**HISTORICO_STATUS:** Criada na Fase 1 (subetapa 1.3). Trigger de imutabilidade instalado. Registros criados pelo ETL para dados históricos e pelo WorkflowService para novos eventos.

**AUDITORIA_LOGS:** Criada na Fase 1. Pode ser implementada via triggers em cada tabela de negócio (INSERT/UPDATE/DELETE), gerando registros com dados em JSON. Inicialmente aplicada apenas às tabelas mais críticas: INICIATIVAS, USUARIOS, USUARIOS_PERFIS, HISTORICO_STATUS, TRANSICOES_STATUS.

**INOVACAO_LOGS (legado):** Mantida até a Fase 5. Seus dados (logins históricos) são migrados para AUDITORIA_LOGS como registros do tipo `LOGIN` durante o ETL da Fase 1.

### Impacto no backend

**AuditModule (novo):** `AuditService.registrar(tabela, operacao, registroId, dadosAnteriores, dadosNovos, usuarioId, sessaoId)`. Chamado de forma assíncrona e não-bloqueante em todos os pontos de escrita relevantes.

**Desacoplamento de AuthService:** O `AuthService.registrarLog()` atual é o único serviço de log. Na nova arquitetura, o AuditModule é o responsável único por logging. Isso resolve o acoplamento atual onde `IniciativasController` importa `AuthService` apenas para logging.

**Interceptor global (opcional para Fase 5):** Um `AuditInterceptor` NestJS pode automaticamente registrar todas as operações de escrita (POST, PATCH, DELETE) sem código explícito em cada controller. Para o MVP, chamadas explícitas no serviço são suficientes.

### Impacto no frontend

Nenhum impacto direto. A auditoria é transparente para o usuário final. O painel admin pode eventualmente ter uma tela de "Logs de Auditoria" que exibe AUDITORIA_LOGS filtrado e paginado — mas isso é funcionalidade, não impacto de arquitetura.

### Estratégia de rollback

**Para HISTORICO_STATUS:** Sem rollback — é o coração da auditoria de negócio. Uma vez com dados, não deve ser removida.

**Para AUDITORIA_LOGS:** Pode ser truncada em caso de problemas de volume (dados de auditoria técnica têm menor criticidade de negócio que dados históricos de workflow). O truncamento deve ser documentado como evento de administração.

**Para a separação em si:** Se a decisão de ter duas tabelas for revertida, os dados de HISTORICO_STATUS e AUDITORIA_LOGS podem ser consolidados em uma única tabela com campo discriminador `tipo_auditoria`. Isso é uma migração de dados, não trivial, mas possível.

---

## ADR-009 — Manter NestJS e OracleDB thin mode; não trocar de stack

**Status:** Proposto → **Recomendação: APROVAR — decisão de pragmatismo correto**

### Problema resolvido

Refatorações são momentos tentadores para "fazer direito de vez" — adicionar um ORM, reescrever o frontend em React, trocar de banco. O ADR-009 resolve o problema de escopo: define explicitamente o que NÃO está no escopo desta refatoração, para que a energia seja focada nos problemas de negócio que precisam ser resolvidos.

### Benefícios

**Risco controlado:** Cada mudança de stack é um risco independente. Combinar refatoração de negócio (17 novas tabelas, novo workflow, novo RBAC) com modernização de stack (ORM, framework frontend) multiplica os vetores de falha. Qualquer bug pode ser de negócio, de stack, ou da interação entre os dois — difícil de diagnosticar.

**Velocidade:** A equipe conhece NestJS, OracleDB thin mode e HTML/CSS/JS. Não há curva de aprendizado. A refatoração pode avançar no ritmo máximo da equipe.

**Decisões reversíveis:** Adicionar TypeORM depois de ter o schema estável é mais simples do que adicioná-lo enquanto o schema está em mutação. A decisão de ORM é melhor tomada quando o modelo de dados está consolidado.

**Preservação do investimento existente:** O CSS responsivo do formulário, a estrutura de módulos NestJS, o setup Docker — tudo isso tem valor e funciona. Jogá-lo fora por preferência tecnológica seria desperdício.

### Riscos

**Risco principal — Queries SQL como strings são propensas a erros:** Sem ORM, queries de 5-6 JOINs em texto puro são difíceis de manter e refatorar. Um alias errado, uma coluna renomeada — o erro só aparece em runtime.

Mitigação aceita: centralizar todas as queries em arquivos de repositório dedicados (ex: `iniciativas.repository.ts`) em vez de embutidas diretamente nos services. Isso não é um ORM, mas oferece rastreabilidade e facilidade de manutenção. Todos os campos são listados explicitamente — nunca `SELECT *`.

**Risco secundário — Frontend em HTML/CSS/JS puro sem estado gerenciado:** À medida que o painel admin cresce (tela de detalhe, timeline, modais de transição, gestão de usuários), a manutenção de estado em JavaScript vanilla se torna complexa.

Mitigação aceita: componentização manual — funções JavaScript com responsabilidade clara, sem framework. Para o MVP do painel admin, isso é suficiente. A decisão de framework frontend é adiada para quando a complexidade justificar.

**Risco de débito técnico acumulado:** Decidir não modernizar agora significa que essa decisão precisará ser tomada no futuro, provavelmente com maior volume de código legado para migrar.

Mitigação: documentar explicitamente no backlog as decisões adiadas: "ADR futuro: avaliar TypeORM após Fase 5"; "ADR futuro: avaliar React para o painel admin após estabilização funcional". Não são esquecidas — são adiadas conscientemente.

### Impacto no banco

Nenhum impacto. O banco Oracle com OracleDB thin mode é a decisão atual e permanece.

### Impacto no backend

**O que muda apesar do ADR:** A organização do código melhora sem trocar de stack:
- Queries SQL centralizadas em `*.repository.ts` por entidade
- `DatabaseModule` atualizado com connection pool (exceção documentada no ADR — é API do mesmo driver)
- TypeScript strict mode habilitado (E0-004) — melhoria dentro da stack atual

**O que NÃO muda:** OracleDB thin mode, NestJS v10, estrutura de módulos, DTOs com class-validator.

### Impacto no frontend

**O que muda apesar do ADR:** Componentização de elementos reutilizáveis (modal de confirmação, badge de status, timeline) como funções JavaScript — sem framework, mas com organização.

**O que NÃO muda:** HTML/CSS/JS puro, sem bundler, sem npm no frontend.

### Estratégia de rollback

Este ADR não introduz nenhuma mudança técnica que precise de rollback — é uma decisão de não fazer algo. Se a decisão for revertida no futuro (ex: decidir adotar TypeORM na Fase 6), isso será um novo ADR que substitui o ADR-009.

---

## ADR-010 — PARAMETROS_SISTEMA como configuração sem deploy

**Status:** Proposto → **Recomendação: APROVAR**

### Problema resolvido

Hoje, qualquer ajuste operacional que envolva um valor configurável — prazo de análise, e-mail de notificação, versão do formulário — exige um desenvolvedor, um deploy e uma janela de manutenção. Para uma equipe de inovação que quer agilidade operacional, isso é um gargalo desnecessário. O ADR-010 resolve isso separando a configuração operacional (que muda com frequência e deve ser gerenciável pela equipe da Assessoria) dos segredos de infraestrutura (que nunca mudam sem aprovação técnica).

### Benefícios

**Autonomia operacional da Assessoria:** A equipe de gestão da inovação pode ajustar prazos, e-mails de notificação e flags de funcionalidade sem abrir chamado à TI. Isso elimina dependência operacional da equipe de desenvolvimento para tarefas de configuração rotineiras.

**Rastreabilidade de configuração:** Cada mudança em PARAMETROS_SISTEMA gera registro em AUDITORIA_LOGS. "Quem mudou o prazo de análise de 30 para 45 dias?" — respondível com data e usuário.

**Feature flags para funcionalidades em rollout gradual:** Além do `FORMULARIO_DESTINO_TABELA` da migração, o padrão pode ser usado para qualquer funcionalidade nova que precise de rollout controlado (ex: habilitar notificações por e-mail apenas após configurar o servidor SMTP).

**Separação de responsabilidades clara:**
- Variáveis de ambiente: segredos de infraestrutura (JWT_SECRET, string Oracle, credenciais)
- PARAMETROS_SISTEMA: configuração de negócio (prazos, e-mails, flags)

### Riscos

**Risco principal (reiterado do ADR-006):** Valor inválido configurado pelo administrador pode causar comportamento inesperado na aplicação.

Mitigação: validação de tipo no `ParametrosService` ao ler valores. Interface admin com validação antes de salvar. Valores com `editavel = 0` não aparecem na interface para edição — usados apenas internamente.

**Risco de proliferação descontrolada:** Sem governança, a tabela pode acumular dezenas de parâmetros mal documentados com semântica obscura.

Mitigação: o campo `descricao` é obrigatório em todo INSERT. Revisão de parâmetros no início de cada fase para remover os que não são mais necessários (ex: `FORMULARIO_DESTINO_TABELA` na Fase 5).

**Risco de inconsistência entre instâncias (cache em memória):** Já endereçado no ADR-006. Documentado como limitação conhecida para múltiplas instâncias.

### Impacto no banco

**Cria:** Tabela `PARAMETROS_SISTEMA` com `(id, chave UNIQUE, valor, tipo_valor, descricao, editavel, atualizado_em, atualizado_por_id)`.

**Volume:** Estimativa de 10-20 parâmetros no MVP. Cresce lentamente. Sem preocupação de performance.

**Índice:** `UNIQUE(chave)` — toda consulta é por chave exata.

### Impacto no backend

**ParametrosService:** Singleton com cache Map<string, {valor, timestamp}>. Método `get(chave, padrao)` com lógica de cache/refresco. Método `set(chave, valor, usuarioId)` para atualização via interface admin — valida tipo antes de persistir.

**Inicialização:** No `AppModule.onModuleInit()`, pré-carregar todos os parâmetros para o cache (warmup de 1 query, não N queries). Registrar em log: `[ParametrosService] N parâmetros carregados`.

**Consumo nos services:** `WorkflowService`, `IniciativasService`, `NotificacoesService` consultam `ParametrosService.get()` ao invés de ler env vars ou ter valores hardcoded.

### Impacto no frontend

**Tela de parâmetros (Fase 4):** Seção "Configurações do Sistema" no painel admin, visível apenas para ADMINISTRADOR. Lista parâmetros com `editavel = 1`. Campo de edição com validação de tipo (número, booleano, texto, e-mail). Botão "Salvar" com confirmação. Exibe `atualizado_em` e `atualizado_por` para cada parâmetro.

**Sem impacto no formulário público:** Parâmetros são transparentes para o usuário final.

### Estratégia de rollback

Alterar o valor do parâmetro via SQL direto ou via interface admin. Efeito em até 5 minutos (TTL do cache). Para reverter uma mudança específica: `UPDATE PARAMETROS_SISTEMA SET valor = 'valor_anterior' WHERE chave = 'CHAVE'`. A AUDITORIA_LOGS registra o valor anterior, facilitando a identificação do valor correto para rollback.

---

## Matriz de Aprovação — Resumo Executivo

| ADR | Decisão | Recomendação | Dependências |
|---|---|---|---|
| ADR-001 | Schema additive | **APROVAR** | Nenhuma — pré-requisito de todos |
| ADR-002 | DOMINIO_VALORES | **APROVAR com ressalva** | STATUS em tabela separada; ver ressalva |
| ADR-003 | Identidade / Auth / Authz | **APROVAR** | ADR-001 (tabela USUARIOS precisa existir) |
| ADR-004 | Workflow como dado | **APROVAR** | ADR-001, ADR-002, resposta DQ-005 ✓ |
| ADR-005 | Histórico imutável | **APROVAR** | ADR-004 (HISTORICO_STATUS inserido pelo WorkflowService) |
| ADR-006 | Feature flag em PARAMETROS | **APROVAR** | ADR-001 (tabela precisa existir antes do uso) |
| ADR-007 | Mecanismo duplo de auth | **APROVAR com prazo** | ADR-003 (tabela USUARIOS com seed) |
| ADR-008 | Auditoria em duas camadas | **APROVAR** | ADR-003 (USUARIOS como FK em logs) |
| ADR-009 | Manter stack atual | **APROVAR** | Nenhuma |
| ADR-010 | PARAMETROS_SISTEMA | **APROVAR** | ADR-001 (tabela precisa existir) |

**Ressalva pendente de decisão (ADR-002):** Recomendar que os STATUS do ciclo de vida da iniciativa (SUBMETIDA, EM_ANALISE, APROVADA, REPROVADA) sejam gerenciados em tabela separada `STATUS_WORKFLOW`, e não em DOMINIO_VALORES. Todos os demais valores categóricos (estágios de maturidade, dimensões, tipos de suporte) permanecem em DOMINIO_VALORES. Essa separação reflete a diferença semântica fundamental: status de workflow tem lógica de máquina de estados; os demais são simplesmente listas de opções.

**Atualizações de nomenclatura obrigatórias em todos os documentos anteriores (impacto DQ-005):**
- `HOMOLOGADA` → `APROVADA`
- `DESQUALIFICADA` → `REPROVADA`
- Remover estados: RASCUNHO, DEVOLVIDA, SUSPENSA, CONCLUIDA, CANCELADA do MVP (mantidos no backlog para evolução futura via ADR-004)
- Remover: toda referência a Vias 1, 3 e Mapeamento Externo do MVP
- Remover do MVP: METAS_ESTRATEGICAS, INICIATIVAS_METAS, alinhamento ODS/PE