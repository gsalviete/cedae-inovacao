# Épicos — CEDAE Inovação
**Versão:** 0.1  
**Data:** 2026-06-24  
**Organização:** Ordem de execução

---

## Convenção

Cada épico representa um incremento coerente de valor que pode ser entregue e validado independentemente das fases seguintes. Os critérios de aceite são comportamentais — o que deve ser verdade após a conclusão do épico, não como o código deve ser escrito.

---

## E0 — Eliminação de Riscos Críticos de Segurança

**Fase:** 0  
**Duração estimada:** 1 semana  
**Prioridade:** BLOQUEANTE — precede todos os outros épicos

### Objetivo

Eliminar as vulnerabilidades de segurança identificadas no sistema atual sem alterar nenhum comportamento funcional. O sistema deve continuar operando exatamente como hoje, porém sem expor credenciais, sem aceitar ataques de força bruta e sem dependências desnecessárias.

### Motivação

O sistema atual possui credenciais reais de banco de dados Oracle commitadas no repositório git, uma senha de administrador sendo logada em texto claro no console de produção e um JWT_SECRET com valor placeholder não substituído. Qualquer pessoa com acesso ao repositório pode, hoje, acessar o banco de dados de produção. Esses problemas não aguardam planejamento de funcionalidades.

### Impacto

- **Segurança:** Eliminação de três vetores críticos de comprometimento de credenciais.
- **Compliance:** Redução de exposição antes que o sistema receba mais usuários e dados sensíveis.
- **Operacional:** Nenhuma mudança de comportamento para usuários finais ou administradores.

### Dependências

Nenhuma. Este épico é pré-requisito para todos os demais, mas não depende de nenhum deles.

### Riscos

- **Risco 1:** A rotação do JWT_SECRET invalida todos os tokens JWT ativos. O administrador será desconectado do painel. Mitigação: comunicar o administrador e providenciar novo login imediatamente após o deploy.
- **Risco 2:** A remoção das dependências mortas (`passport-local`) pode conflitar com lock files. Mitigação: re-executar `pnpm install` e validar build após remoção.
- **Risco 3:** Habilitar `strictNullChecks` e `noImplicitAny` pode revelar erros TypeScript latentes que precisam ser corrigidos antes do build. Mitigação: tratar como tarefa separada dentro do épico; erros de tipo não entram em produção antes de corrigidos.

### Critérios de Aceite

- [ ] Nenhuma credencial (senha, token, chave) existe no repositório git ou em qualquer arquivo commitado
- [ ] O processo de gestão de segredos está documentado (como gerar, onde armazenar, como compartilhar com a equipe)
- [ ] `POST /api/auth/login` retorna 429 após 5 tentativas falhas consecutivas do mesmo IP em 60 segundos
- [ ] Nenhum log em produção contém a palavra "password", "senha" ou qualquer valor de credencial
- [ ] O JWT_SECRET tem no mínimo 32 caracteres aleatórios e não está hardcoded em nenhum arquivo
- [ ] A aplicação compila com `strictNullChecks: true` e `noImplicitAny: true` sem erros
- [ ] `passport-local` não está presente em `package.json`
- [ ] O comportamento funcional do formulário e do painel admin é idêntico ao pré-épico

---

## E1 — Fundação de Dados e Migração Histórica

**Fase:** 1  
**Duração estimada:** 4 semanas  
**Prioridade:** Alta — habilita todos os épicos de funcionalidade

### Objetivo

Construir o schema de banco de dados do modelo TO-BE em paralelo ao schema existente, migrar os dados históricos para as novas estruturas e garantir que o sistema legado continue funcionando sem interrupção durante todo o processo.

### Motivação

Toda funcionalidade nova do sistema depende da existência das tabelas, constraints, índices e dados iniciais do modelo TO-BE. Sem a tabela USUARIOS não há autenticação robusta. Sem DOMINIO_VALORES não há enums controlados. Sem ETL não há rastreabilidade histórica. Este épico é a fundação que torna possíveis todos os demais.

O modelo de dados atual tem problemas estruturais sérios: suporte armazenado como texto pipe-delimited, valores monetários como string, enums sem validação no banco e ausência de auditoria. Esses problemas devem ser resolvidos no banco antes de serem resolvidos no código.

### Impacto

- **Dados:** Todos os registros históricos são preservados e enriquecidos com metadados que hoje não existem (código público, proponente como entidade, suportes normalizados).
- **Arquitetural:** O sistema passa a ter dois schemas coexistindo. A aplicação gradualmente migra de um para o outro.
- **Operacional:** Zero impacto para usuários finais durante a Fase 1. A aplicação continua lendo e escrevendo nas tabelas legadas.

### Dependências

- **E0** deve estar concluído (credenciais seguras antes de qualquer alteração de schema em produção)
- Lista de gerências/diretorias fornecida pela Assessoria (para popular UNIDADES_ORGANIZACIONAIS)
- Decisão sobre o padrão de ID público (`INOV-AAAA-NNN` com reset anual ou sequência global) deve ser tomada antes da subetapa 1.4

### Riscos

- **Risco 1 (Alto):** ETL gera PROPONENTES duplicados para variações de nome do mesmo colaborador (ex: "André Martins" vs "Andre Martins"). Mitigação: script de deduplicação + revisão manual com a Assessoria antes de executar em produção.
- **Risco 2 (Médio):** Adição de colunas nullable em INOVACAO_INICIATIVAS pode exigir lock de tabela em Oracle dependendo do volume de dados. Mitigação: executar em horário de baixo tráfego; operação de ALTER TABLE é rápida para colunas nullable.
- **Risco 3 (Baixo):** Dados inconsistentes no campo SUPORTE_NECESSARIO (pipe-delimited com variações) dificultam o ETL. Mitigação: análise de qualidade de dados antes do ETL; casos ambíguos vão para campo `legado_texto`.

### Critérios de Aceite

- [ ] Todas as tabelas do modelo TO-BE existem no banco com constraints e índices conforme especificado em `future-data-model.md`
- [ ] DOMINIO_VALORES está populado com todos os valores iniciais documentados
- [ ] TRANSICOES_STATUS está populado com o workflow inicial (9 estados, N transições)
- [ ] Existe pelo menos um registro em USUARIOS com perfil ADMINISTRADOR e senha hasheada por bcrypt
- [ ] Todos os registros de INOVACAO_INICIATIVAS têm CODIGO_PUBLICO preenchido no formato `INOV-AAAA-NNN`
- [ ] Todos os registros de INOVACAO_INICIATIVAS têm PROPONENTE_ID apontando para um registro válido em PROPONENTES
- [ ] Todos os valores de SUPORTE_NECESSARIO foram explodidos para registros individuais em INICIATIVAS_SUPORTES
- [ ] Todos os valores de VALOR_APORTE foram migrados para registros em INVESTIMENTOS onde aplicável
- [ ] Existe um registro em HISTORICO_STATUS para cada iniciativa existente (estado inicial)
- [ ] A aplicação existente continua funcionando sem alteração após o ETL (formulário submete, painel carrega)
- [ ] Scripts de migração são idempotentes (podem ser re-executados sem duplicação de dados)
- [ ] Query de validação confirma que zero registros foram perdidos na migração

---

## E2 — Ciclo de Vida das Iniciativas

**Fase:** 2  
**Duração estimada:** 4 semanas  
**Prioridade:** Alta — entrega o maior valor de negócio isolado do épico

### Objetivo

Implementar o ciclo de vida completo das iniciativas no sistema, permitindo que a Assessoria gerencie o progresso de cada iniciativa (da submissão à conclusão) com rastreabilidade total e sem depender de planilhas externas.

### Motivação

O sistema atual captura iniciativas mas não tem nenhum mecanismo para gerenciá-las depois. A Assessoria precisa manter a planilha Excel em paralelo para saber quais iniciativas estão em análise, quais foram homologadas e quais foram desqualificadas. Isso cria divergência entre o sistema e a realidade, perde rastreabilidade e impede qualquer automação futura.

O ciclo de vida com estados explícitos, transições validadas e histórico imutável é o núcleo do valor de negócio do sistema.

### Impacto

- **Negócio:** A Assessoria passa a ter um sistema como instrumento principal de gestão, não como repositório secundário.
- **Usuário final (proponente):** Passa a receber um número de protocolo ao submeter a iniciativa.
- **Dados:** O campo STATUS da tabela INICIATIVAS passa a refletir a realidade operacional em tempo real.
- **Técnico:** O backend passa a gravar em INICIATIVAS (não em INOVACAO_INICIATIVAS), controlado por feature flag.

### Dependências

- **E1** concluído (tabelas INICIATIVAS, HISTORICO_STATUS, TRANSICOES_STATUS devem existir)
- Ciclo de vida validado com a Assessoria (estados e transições aprovados — ver DQ-005 e DQ-006)
- Decisão sobre visibilidade do GET /api/iniciativas deve ser tomada (coordenação com E3)

### Riscos

- **Risco 1 (Crítico):** Feature flag incorreto faz submissões do formulário público não serem gravadas. Mitigação: monitorar COUNT da tabela INICIATIVAS por 24h após ativar o flag; rollback imediato se não crescer.
- **Risco 2 (Alto):** Transições de status não refletem o processo real da Assessoria. Mitigação: workshop de validação do workflow com analistas antes de implementar; TRANSICOES_STATUS como tabela configurável permite ajuste sem deploy.
- **Risco 3 (Médio):** Endpoint GET /api/iniciativas precisa de autenticação (coordenado com E3), mas a tela de listagem do admin usa esse endpoint sem token. Mitigação: implementar a proteção do endpoint e a atualização do frontend como deploy único neste épico (não separados).

### Critérios de Aceite

- [ ] Ao submeter o formulário Via 2, o usuário vê na tela de sucesso o CODIGO_PUBLICO gerado (ex: `INOV-2026-005`)
- [ ] O painel administrativo exibe a tela de detalhe de cada iniciativa com todos os campos do modelo TO-BE
- [ ] Um analista da Assessoria consegue transitar uma iniciativa de SUBMETIDA para EM_ANALISE
- [ ] Um supervisor consegue transitar uma iniciativa de EM_ANALISE para HOMOLOGADA
- [ ] Uma transição para DESQUALIFICADA exige campo de justificativa obrigatório
- [ ] Cada transição de status gera um registro imutável em HISTORICO_STATUS com usuário, timestamp e justificativa
- [ ] A timeline de histórico de uma iniciativa é visível no painel de detalhe
- [ ] Transições inválidas (ex: RASCUNHO → HOMOLOGADA) são rejeitadas pelo sistema com mensagem de erro clara
- [ ] Um perfil sem permissão para uma transição recebe erro 403 ao tentar executá-la
- [ ] `AdminService.getKpis()` usa GROUP BY SQL (não agregação em memória JavaScript)
- [ ] O endpoint `GET /api/iniciativas` exige autenticação e o painel admin envia token Bearer
- [ ] O formulário público ainda funciona sem autenticação para submissão via Via 2

---

## E3 — Identidade e Autenticação Robusta

**Fase:** 3  
**Duração estimada:** 3 semanas  
**Prioridade:** Alta — pré-requisito para múltiplos usuários e RBAC

### Objetivo

Substituir a autenticação baseada em variáveis de ambiente por autenticação via tabela USUARIOS com senha hasheada por bcrypt, implementar RBAC com múltiplos perfis, e preparar a arquitetura de identidade para futura integração com Active Directory ou SSO.

### Motivação

O sistema atual tem um único usuário administrador definido por variáveis de ambiente. Isso impede múltiplos analistas da Assessoria de ter contas individuais, impossibilita auditoria por usuário específico e é fundamentalmente incompatível com futuras integrações corporativas de identidade.

O modelo proposto separa claramente Identidade (quem é), Autenticação (como prova que é) e Autorização (o que pode fazer). Essa separação é a âncora para a futura migração para AD/LDAP/SSO sem reescrita do sistema.

### Impacto

- **Segurança:** Credenciais de administrador saem das variáveis de ambiente e vão para o banco com hash seguro.
- **Operacional:** A Assessoria pode ter múltiplos analistas com contas individuais e perfis distintos.
- **Auditoria:** Cada ação no sistema é rastreável a um usuário específico (não apenas "o admin").
- **Arquitetural:** O JWT payload muda — todos os guards precisam ser atualizados coordenadamente.

### Dependências

- **E1** concluído (tabela USUARIOS e USUARIOS_PERFIS devem existir com dados iniciais)
- **E2** concluído (endpoints protegidos revisados antes de mudar a estrutura dos guards)
- Usuário administrador criado na Fase 1 com senha conhecida pelo time

### Riscos

- **Risco 1 (Crítico):** Mudança no payload JWT quebra autenticação de todos os clientes que dependem do campo `is_admin`. Mitigação: mecanismo duplo de autenticação ativo durante a transição; payload novo coexiste com payload antigo por 1 semana.
- **Risco 2 (Alto):** Admin perde acesso ao painel durante a transição. Mitigação: staging completo antes do deploy em produção; conta de admin na tabela USUARIOS criada e testada antes de remover o legado.
- **Risco 3 (Médio):** RBAC muito restritivo bloqueia operações que os analistas fazem hoje. Mitigação: mapeamento dos perfis com a equipe antes de implementar; iniciar com perfis permissivos e restringir progressivamente.

### Critérios de Aceite

- [ ] O login em `POST /api/auth/login` funciona com credenciais armazenadas na tabela USUARIOS (não em variáveis de ambiente)
- [ ] Senhas são armazenadas como hash bcrypt (nenhuma senha em plain text no banco)
- [ ] O JWT contém `{ user_id, login, perfis: [...], area_id }` no payload
- [ ] O `AdminGuard` legado foi substituído por `RolesGuard` genérico
- [ ] `JwtAuthGuard` é o guard padrão ativo em todos os endpoints que exigem autenticação
- [ ] Um usuário com perfil ANALISTA_ASSESSORIA consegue acessar o painel e gerenciar iniciativas
- [ ] Um usuário com perfil GESTOR_AREA consegue visualizar apenas as iniciativas da sua unidade
- [ ] Um usuário com perfil ADMINISTRADOR consegue criar, editar e desativar outros usuários
- [ ] A tela de gestão de usuários está disponível no painel admin e funcional
- [ ] Nenhuma variável de ambiente ADMIN_USERNAME ou ADMIN_PASSWORD é consultada pelo código da aplicação
- [ ] O campo `origem_identidade = 'LOCAL'` está preenchido em todos os registros de USUARIOS criados nesta fase

---

## E4 — Enriquecimento do Portfólio

**Fase:** 4  
**Duração estimada:** 4 semanas  
**Prioridade:** Média — adiciona valor de gestão avançada sem bloquear funcionalidades básicas

### Objetivo

Adicionar as capacidades de gestão que transformam o sistema de um registro de iniciativas em uma plataforma de portfólio de inovação: dados financeiros com contexto, anotações com visibilidade controlada, alinhamento estratégico com ODS/PE, relacionamentos entre iniciativas e gestão de dados de referência sem intervenção técnica.

### Motivação

Com o ciclo de vida e a autenticação em funcionamento, a Assessoria consegue gerenciar iniciativas, mas ainda falta contexto: quanto custa? Quais são as notas internas? Está alinhado com qual ODS? Esta iniciativa é duplicata de outra? Essas informações existem na planilha mas não têm estrutura adequada no sistema.

Além disso, dados de referência como áreas organizacionais, tipos de suporte e dimensões de inovação precisam ser gerenciáveis sem deploy. Hoje, qualquer mudança nesses dados exige intervenção técnica.

### Impacto

- **Negócio:** A Assessoria consolida toda a informação de portfólio no sistema, tornando a planilha desnecessária.
- **Usuário final:** O formulário exibe dropdown de área alimentado por API (não texto livre).
- **Dados:** INVESTIMENTOS, ANOTACOES, METAS_ESTRATEGICAS e RELACIONAMENTOS_INICIATIVAS passam a ser usados ativamente.
- **Operacional:** Administradores conseguem manter dados de referência sem chamar a TI.

### Dependências

- **E3** concluído (autenticação e RBAC em funcionamento)
- Lista oficial de ODS fornecida (17 objetivos)
- Metas do Plano Estratégico corporativo fornecidas (ou confirmação de que o campo é livre inicialmente)
- Decisão sobre quem preenche alinhamento estratégico (proponente, Assessoria ou ambos) — ver DQ-018

### Riscos

- **Risco 1 (Médio):** Gestão de DOMINIO_VALORES sem validações robustas pode gerar valores inválidos que quebram o formulário. Mitigação: validações de integridade referencial no banco; interface de admin com confirmação antes de desativar valores em uso.
- **Risco 2 (Baixo):** RELACIONAMENTOS_INICIATIVAS com tipos incorretos (ex: marcar uma iniciativa como duplicata da errada) é difícil de corrigir. Mitigação: confirmação explícita ao criar relacionamento; capacidade de remover relacionamentos com justificativa.

### Critérios de Aceite

- [ ] O campo de área no formulário Via 2 é um dropdown alimentado por `GET /api/reference/areas`
- [ ] A tela de detalhe da iniciativa exibe e permite editar dados de INVESTIMENTO com versão, fonte e status de aprovação
- [ ] A tela de detalhe exibe anotações separadas por tipo (comentário do proponente, nota técnica, etc.)
- [ ] Notas com visibilidade INTERNA não são visíveis para o proponente
- [ ] A Assessoria consegue associar uma iniciativa a um ou mais ODS/metas do PE
- [ ] O administrador consegue criar, editar e desativar valores em DOMINIO_VALORES, UNIDADES_ORGANIZACIONAIS e CANAIS_CAPTACAO via interface
- [ ] Não é possível desativar um valor de DOMINIO_VALORES que está referenciado em pelo menos uma iniciativa ativa
- [ ] O administrador consegue vincular duas iniciativas com um tipo de relacionamento
- [ ] O dashboard exibe retorno econômico total projetado do portfólio (soma de INVESTIMENTOS.retorno_economico_anual)

---

## E5 — Maturidade Operacional e Encerramento do Legado

**Fase:** 5  
**Duração estimada:** 3 semanas  
**Prioridade:** Baixa-Média — consolida a arquitetura e prepara para o futuro

### Objetivo

Elevar a qualidade operacional do sistema com connection pool, pipeline de CI/CD, views analíticas otimizadas, dashboard completo e encerramento controlado das tabelas legadas — completando a transição do sistema antigo para o novo.

### Motivação

O sistema evoluiu em 4 fases incrementais e agora está funcional no modelo TO-BE. Esta fase de consolidação elimina os últimos resquícios do modelo antigo, adiciona infraestrutura de qualidade que deveria estar presente desde o início e garante que o time tem visibilidade operacional do sistema em produção.

### Impacto

- **Performance:** Connection pool elimina overhead de abertura de conexão por request.
- **Qualidade:** CI/CD impede que código com erros de tipo ou testes quebrados chegue à produção.
- **Dados:** O schema legado é arquivado de forma controlada, encerrando a coexistência de dois schemas.
- **Governança:** Dashboard completo permite à liderança da Assessoria acompanhar o portfólio de inovação em tempo real.

### Dependências

- **E4** concluído
- Confirmação de que nenhum dado novo está sendo escrito nas tabelas legadas há pelo menos 30 dias
- Aprovação formal da Assessoria para encerrar o legado (assinatura ou registro formal)

### Riscos

- **Risco 1 (Médio):** Drop prematuro de tabelas legadas com dados ainda sendo referenciados. Mitigação: aguardar 30 dias + dump antes do DROP + rename antes do drop (período de quarentena de 90 dias).
- **Risco 2 (Baixo):** Mudanças no Docker Compose quebram serving do frontend. Mitigação: testar em ambiente de staging com rebuild completo antes de aplicar em produção.

### Critérios de Aceite

- [ ] O backend usa connection pool Oracle (`oracledb.createPool()`) com mínimo 2, máximo 10 conexões
- [ ] Pipeline CI/CD executa automaticamente em todo push: lint, type-check, build (sem testes de integração ainda)
- [ ] Dashboard exibe: total de iniciativas, por status, por dimensão, por canal, investimento total, retorno projetado total, tempo médio de análise
- [ ] Nenhuma query de negócio usa `SELECT *` — todos os campos são listados explicitamente
- [ ] INOVACAO_INICIATIVAS renomeada para INOVACAO_INICIATIVAS_LEGADO
- [ ] INOVACAO_LOGS renomeada para INOVACAO_LOGS_LEGADO
- [ ] Dump das tabelas legadas arquivado em local documentado
- [ ] Nenhum código da aplicação faz referência às tabelas legadas (grep confirma)
- [ ] Volume Docker do frontend usa caminho absoluto ou baseado em variável de ambiente