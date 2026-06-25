# Backlog de Implementação — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24  
**Estimativas:** S = 1-2 dias | M = 3-4 dias | L = 5-7 dias

---

# ÉPICO E0 — Segurança Emergencial

**Objetivo:** Eliminar todas as vulnerabilidades críticas de segurança sem alterar comportamento funcional.  
**Dependências:** Nenhuma — pré-requisito de todos os outros épicos.  
**Critério de saída:** Nenhum segredo no repositório; nenhum log de senha; rate limiting ativo; TypeScript compilando com strict mode.

---

## E0-S01 — Remover credenciais do repositório git

**Estimativa:** S

**Descrição**  
O arquivo `.env` com credenciais reais foi incluído no commit inicial. Deve ser removido do histórico e substituído por um `.env.example` com valores placeholder documentados.

**Critérios de aceite**
- [ ] `.env` não existe no repositório (nem no histórico git após limpeza)
- [ ] `.env` e `.env.*` estão no `.gitignore`
- [ ] `.env.example` existe com todas as variáveis necessárias e valores placeholder descritivos
- [ ] README documenta o processo de obter as credenciais reais
- [ ] A aplicação sobe normalmente com as novas credenciais rotacionadas
- [ ] Senha Oracle `Cedae#2026` foi rotacionada (coordenar com DBA)

**Definição de pronto**  
Código revisado, merge na branch principal, aplicação funcional em ambiente de desenvolvimento com novas credenciais.

---

## E0-S02 — Remover logs de credenciais e adicionar rate limiting

**Estimativa:** S

**Descrição**  
`AuthService.validateCredentials()` loga senhas em texto claro. O endpoint de login não tem proteção contra força bruta. Ambos devem ser corrigidos.

**Critérios de aceite**
- [ ] Nenhum `console.log` em `auth.service.ts` contém os termos "password", "senha" ou valores de variáveis de ambiente
- [ ] `grep -r "console.log" backend/src/auth/` retorna zero ocorrências com conteúdo sensível
- [ ] `POST /api/auth/login` retorna HTTP 429 após 5 tentativas falhas consecutivas do mesmo IP em 60 segundos
- [ ] O cabeçalho `Retry-After` está presente na resposta 429
- [ ] Tentativas bem-sucedidas não são bloqueadas pelo rate limiting
- [ ] `@nestjs/throttler` está listado como dependência em `package.json`
- [ ] Os limites (TTL e max) são configuráveis via variáveis de ambiente

**Definição de pronto**  
Código revisado, testes manuais de rate limiting executados e documentados, merge.

---

## E0-S03 — Habilitar TypeScript strict mode e remover dependências mortas

**Estimativa:** M

**Descrição**  
`strictNullChecks` e `noImplicitAny` estão desabilitados. `passport-local` está instalado mas sem uso. Habilitar o strict mode pode revelar erros latentes que devem ser corrigidos.

**Critérios de aceite**
- [ ] `tsconfig.json` tem `"strictNullChecks": true` e `"noImplicitAny": true`
- [ ] `pnpm run build` completa sem erros TypeScript
- [ ] Nenhum `// @ts-ignore` foi adicionado para suprimir erros
- [ ] `passport-local` removido de `package.json` e `pnpm-lock.yaml`
- [ ] `pnpm install` e `pnpm run build` funcionam após a remoção
- [ ] O comportamento funcional da aplicação é idêntico ao pré-story

**Definição de pronto**  
Build limpo, dependências auditadas, merge.

---

## E0-S04 — Gerar JWT_SECRET forte e documentar gestão de segredos

**Estimativa:** S

**Descrição**  
O JWT_SECRET atual é um placeholder de texto. Deve ser substituído por um valor gerado aleatoriamente com no mínimo 32 caracteres. O processo de geração e rotação deve ser documentado.

**Critérios de aceite**
- [ ] `JWT_SECRET` no `.env` tem no mínimo 32 caracteres aleatórios (verificar com `echo $JWT_SECRET | wc -c`)
- [ ] O valor não contém a string "troque" ou "change"
- [ ] `README.md` ou documento equivalente descreve: como gerar um novo JWT_SECRET, quando rotacionar, impacto da rotação (sessões invalidadas)
- [ ] A aplicação sobe e o login funciona com o novo secret
- [ ] Tokens gerados antes da rotação são automaticamente invalidados (comportamento esperado do JWT)

**Definição de pronto**  
Secret rotacionado em todos os ambientes; documentação criada; merge.

---

# ÉPICO E1 — Fundação de Dados

**Objetivo:** Criar todo o schema TO-BE em paralelo ao schema legado e migrar os dados históricos.  
**Dependências:** E0 concluído.  
**Critério de saída:** Todas as tabelas TO-BE existem com dados iniciais; todos os registros históricos migrados; sistema legado funcionando sem alteração.

---

## E1-S01 — Criar tabelas de referência sem dependências externas

**Estimativa:** M

**Descrição**  
Criar as tabelas que não dependem de nenhuma outra tabela nova: `DOMINIO_VALORES`, `STATUS_WORKFLOW`, `CANAIS_CAPTACAO`, `PERFIS_ACESSO`, `PARAMETROS_SISTEMA`. Popular com dados iniciais (seed) conforme `final-adrs.md`.

**Critérios de aceite**
- [ ] Tabelas `DOMINIO_VALORES`, `STATUS_WORKFLOW`, `CANAIS_CAPTACAO`, `PERFIS_ACESSO`, `PARAMETROS_SISTEMA` existem no banco com todas as constraints e índices documentados em `final-adrs.md`
- [ ] `DOMINIO_VALORES` contém todos os domínios e valores iniciais definidos no ADR-002 (7 domínios, ~30 valores)
- [ ] `STATUS_WORKFLOW` contém os 4 estados do MVP: SUBMETIDA, EM_ANALISE, APROVADA, REPROVADA
- [ ] `CANAIS_CAPTACAO` contém um único registro ativo: `VIA_2`
- [ ] `PERFIS_ACESSO` contém: ADMINISTRADOR, ANALISTA_ASSESSORIA, GESTOR_AREA
- [ ] `PARAMETROS_SISTEMA` contém os 4 parâmetros iniciais definidos no ADR-010
- [ ] Script DDL é idempotente (re-execução não duplica dados nem falha com erro)
- [ ] As tabelas existentes (`INOVACAO_INICIATIVAS`, `INOVACAO_LOGS`) não foram alteradas

**Definição de pronto**  
Scripts DDL e DML versionados em `database/migrations/`, executados em banco de desenvolvimento, validados.

---

## E1-S02 — Criar tabelas de identidade e usuário administrador seed

**Estimativa:** M

**Descrição**  
Criar `UNIDADES_ORGANIZACIONAIS`, `USUARIOS`, `USUARIOS_PERFIS`, `PROPONENTES`. Criar o usuário administrador inicial com senha hasheada por bcrypt. Criar a unidade organizacional "Assessoria de Inovação".

**Critérios de aceite**
- [ ] Tabelas `UNIDADES_ORGANIZACIONAIS`, `USUARIOS`, `USUARIOS_PERFIS`, `PROPONENTES` existem com constraints e índices
- [ ] Existe pelo menos um registro em `USUARIOS` com `login = 'gsalviete'` (ou o login definido pela equipe), `ativo = 1`, `origem_identidade = 'LOCAL'`
- [ ] A senha do usuário admin está armazenada como hash bcrypt (não plain text) — verificar com `SELECT LENGTH(senha_hash) FROM USUARIOS` (deve ser 60 caracteres)
- [ ] Existe registro em `USUARIOS_PERFIS` associando o usuário admin ao perfil `ADMINISTRADOR`
- [ ] Existe registro em `UNIDADES_ORGANIZACIONAIS` para a "Assessoria de Inovação"
- [ ] Script de seed é idempotente
- [ ] O sistema legado continua funcionando (login com env vars ainda funciona)

**Definição de pronto**  
Scripts executados em desenvolvimento, login do novo usuário testado (bcrypt.compare validado manualmente), merge.

---

## E1-S03 — Criar tabelas transacionais e de workflow

**Estimativa:** M

**Descrição**  
Criar `TRANSICOES_STATUS`, `HISTORICO_STATUS` (com trigger de imutabilidade), `INICIATIVAS_SUPORTES`, `INVESTIMENTOS`, `ANOTACOES`, `AUDITORIA_LOGS`. Estas tabelas ainda não têm FK para a tabela `INICIATIVAS` (que será criada em E1-S06).

**Critérios de aceite**
- [ ] Tabelas `TRANSICOES_STATUS`, `HISTORICO_STATUS`, `INICIATIVAS_SUPORTES`, `INVESTIMENTOS`, `ANOTACOES`, `AUDITORIA_LOGS` existem com constraints
- [ ] `TRANSICOES_STATUS` contém as 3 transições MVP (SUBMETIDA→EM_ANALISE, EM_ANALISE→APROVADA, EM_ANALISE→REPROVADA)
- [ ] Trigger `TRG_HS_NO_UPD_DEL` em `HISTORICO_STATUS` rejeita qualquer DELETE com erro `-20001`
- [ ] Trigger permite UPDATE apenas nos campos `anulado`, `anulado_por_id`, `anulado_em`, `motivo_anulacao`
- [ ] View `VW_HISTORICO_ATIVO` existe e filtra `anulado = 0`
- [ ] Teste do trigger: `UPDATE HISTORICO_STATUS SET status_novo = 'X' WHERE id = 1` falha com ORA-20001

**Definição de pronto**  
Scripts executados, triggers testados manualmente, merge.

---

## E1-S04 — Adicionar colunas de migração na tabela INOVACAO_INICIATIVAS

**Estimativa:** S

**Descrição**  
Adicionar colunas nullable na tabela legada `INOVACAO_INICIATIVAS` para suportar o ETL e o período de coexistência. Nenhuma coluna existente é alterada.

**Critérios de aceite**
- [ ] As seguintes colunas existem em `INOVACAO_INICIATIVAS`: `CODIGO_PUBLICO VARCHAR2(20)`, `STATUS VARCHAR2(50)`, `PROPONENTE_ID NUMBER`, `AREA_ID NUMBER`, `ANALISTA_ID NUMBER`, `ATUALIZADO_EM DATE`
- [ ] Todas as colunas são nullable (sem NOT NULL sem DEFAULT)
- [ ] O INSERT existente do sistema (`IniciativasService.criar()`) ainda funciona sem alteração
- [ ] Teste: submeter o formulário e verificar que o registro foi criado com as novas colunas nulas

**Definição de pronto**  
ALTER TABLE executado, INSERT legado testado, merge.

---

## E1-S05 — ETL: Migração de dados históricos

**Estimativa:** L

**Descrição**  
Script de migração que transforma os dados das tabelas legadas nas entidades normalizadas do novo modelo. Deve ser idempotente, gerar relatório de curadoria e validar integridade pós-execução.

**Critérios de aceite**
- [ ] Todos os registros de `INOVACAO_INICIATIVAS` têm `CODIGO_PUBLICO` preenchido no formato `INOV-AAAA-NNN`
- [ ] Todos os registros têm `PROPONENTE_ID` apontando para registro em `PROPONENTES`
- [ ] Todos os valores de `SUPORTE_NECESSARIO` foram explodidos para registros individuais em `INICIATIVAS_SUPORTES`
- [ ] Todos os registros com `VALOR_APORTE` não-nulo têm registro correspondente em `INVESTIMENTOS`
- [ ] `COMENTARIOS_ADICIONAIS` migrados para `ANOTACOES` (tipo `NOTA_TECNICA`, visibilidade `INTERNA`)
- [ ] Existe um registro em `HISTORICO_STATUS` para cada iniciativa (tipo `SUBMISSAO`, `data_hora = CRIADO_EM`)
- [ ] Status legado mapeado: `[Homologada]` → `APROVADA`, `[Desqualificada]` → `REPROVADA`, `[Em Análise]` → `EM_ANALISE`, sem status → `SUBMETIDA`
- [ ] Logs de `INOVACAO_LOGS` migrados para `AUDITORIA_LOGS`
- [ ] Re-execução do script não cria duplicatas (idempotência verificada)
- [ ] Relatório de curadoria gerado listando: proponentes deduplicados, áreas normalizadas, casos ambíguos para revisão manual
- [ ] Query de validação final: `SELECT COUNT(*) FROM INOVACAO_INICIATIVAS WHERE CODIGO_PUBLICO IS NULL` retorna 0

**Definição de pronto**  
Script executado em banco de desenvolvimento com dados reais; relatório de curadoria revisado pela Assessoria; validações passando; documentação do script em `database/migrations/`.

---

## E1-S06 — Criar tabela INICIATIVAS com estrutura TO-BE completa

**Estimativa:** M

**Descrição**  
Criar a tabela `INICIATIVAS` com estrutura completa do modelo TO-BE, incluindo trigger de geração de `CODIGO_PUBLICO`, sequence e FKs para todas as tabelas de referência. Adicionar FKs que faltavam nas tabelas de suporte (HISTORICO_STATUS, ANOTACOES etc.).

**Critérios de aceite**
- [ ] Tabela `INICIATIVAS` existe com todos os campos definidos em `future-data-model.md` (contexto de captação + contexto de gestão)
- [ ] Trigger `TRG_INICIATIVAS_BEF_INS` gera `CODIGO_PUBLICO` automaticamente no formato `INOV-AAAA-NNN`
- [ ] A sequence para CODIGO_PUBLICO está inicializada com valor maior que o último código gerado no ETL (sem risco de colisão)
- [ ] FKs ativas: `proponente_id → PROPONENTES`, `area_proponente_id → UNIDADES_ORGANIZACIONAIS`, `canal_id → CANAIS_CAPTACAO`, `status_id → STATUS_WORKFLOW`, `estagio_maturidade_id → DOMINIO_VALORES`, `dimensao_inovacao_id → DOMINIO_VALORES`, `grau_impacto_id → DOMINIO_VALORES`
- [ ] FKs adicionadas em tabelas de suporte: `HISTORICO_STATUS.iniciativa_id → INICIATIVAS`, `ANOTACOES.iniciativa_id → INICIATIVAS`, `INVESTIMENTOS.iniciativa_id → INICIATIVAS`, `INICIATIVAS_SUPORTES.iniciativa_id → INICIATIVAS`
- [ ] Tabela está vazia — dados serão inseridos pela aplicação via feature flag (E2)
- [ ] Teste do trigger: INSERT em INICIATIVAS sem CODIGO_PUBLICO → trigger preenche automaticamente

**Definição de pronto**  
Scripts executados, trigger testado, FKs validadas com `USER_CONSTRAINTS`, merge.

---

# ÉPICO E2 — Ciclo de Vida das Iniciativas

**Objetivo:** Implementar o workflow completo de gestão de iniciativas e migrar o formulário para o novo schema.  
**Dependências:** E1 concluído.  
**Critério de saída:** Assessoria consegue gerenciar o ciclo de vida no painel; formulário exibe protocolo; GET /api/iniciativas protegido.

---

## E2-S01 — WorkflowModule: serviço de transição de status

**Estimativa:** M

**Descrição**  
Criar o `WorkflowModule` com `WorkflowService.transicionar()` que valida e executa transições de status consultando `TRANSICOES_STATUS`. Único ponto de entrada para mudanças de status no sistema.

**Critérios de aceite**
- [ ] `WorkflowService.transicionar(iniciativaId, novoStatus, usuario, justificativa)` existe e funciona
- [ ] Rejeita com exceção tipada `WorkflowTransitionException` quando: (a) transição não existe em TRANSICOES_STATUS, (b) perfil do usuário é insuficiente, (c) justificativa ausente quando obrigatória
- [ ] Transição válida: atualiza `INICIATIVAS.status_id` e insere em `HISTORICO_STATUS` em transação única
- [ ] Cache de TRANSICOES_STATUS com TTL de 2 minutos implementado
- [ ] Nenhum outro service/controller faz UPDATE direto em `INICIATIVAS.status_id` — verificado via grep
- [ ] Testes unitários para os três cenários de rejeição e para o cenário de sucesso

**Definição de pronto**  
Testes unitários passando, code review, merge.

---

## E2-S02 — IniciativasService: gravar em INICIATIVAS com feature flag

**Estimativa:** M

**Descrição**  
Refatorar `IniciativasService.criar()` para gravar em `INICIATIVAS` quando o feature flag `FORMULARIO_DESTINO_TABELA = 'NOVO'`. Manter o caminho legado enquanto o flag for `LEGADO`. O response passa a incluir `codigo_publico`.

**Critérios de aceite**
- [ ] Com flag `LEGADO`: comportamento idêntico ao atual (grava em `INOVACAO_INICIATIVAS`)
- [ ] Com flag `NOVO`: grava em `INICIATIVAS`, cria registros em `INICIATIVAS_SUPORTES` (suporte como array), cria registro inicial em `HISTORICO_STATUS` (tipo `SUBMISSAO`)
- [ ] Response sempre inclui `{ id, codigo_publico, message }` independente do flag
- [ ] O campo `canal_id` é preenchido automaticamente com o ID do canal `VIA_2`
- [ ] Comentário no código: `// Feature flag FORMULARIO_DESTINO_TABELA — TODO: remover após Fase 5`
- [ ] Mudança de flag de LEGADO para NOVO e vice-versa funciona sem reinicialização

**Definição de pronto**  
Testado com ambos os valores do flag, code review, merge.

---

## E2-S03 — Endpoint PATCH /api/iniciativas/:id/status

**Estimativa:** S

**Descrição**  
Criar endpoint para transição de status de uma iniciativa. Delega 100% para `WorkflowService`. Protegido por autenticação.

**Critérios de aceite**
- [ ] `PATCH /api/iniciativas/:id/status` com `{ status: "EM_ANALISE" }` e token válido de ANALISTA retorna 200 com estado atualizado
- [ ] Retorna 401 sem token
- [ ] Retorna 403 quando o perfil não tem permissão para a transição
- [ ] Retorna 422 com mensagem descritiva quando: transição inválida, justificativa ausente, iniciativa não existe
- [ ] O body de sucesso inclui: `{ iniciativa_id, status_anterior, status_novo, data_hora, codigo_publico }`
- [ ] O endpoint está documentado no README da API

**Definição de pronto**  
Testes manuais dos cenários de erro e sucesso, merge.

---

## E2-S04 — Endpoint GET /api/iniciativas/:id/historico

**Estimativa:** S

**Descrição**  
Endpoint que retorna a timeline de eventos de uma iniciativa via `VW_HISTORICO_ATIVO`.

**Critérios de aceite**
- [ ] `GET /api/iniciativas/3/historico` retorna array ordenado cronologicamente com: `tipo_evento`, `status_anterior`, `status_novo`, `usuario_nome`, `data_hora`, `justificativa`
- [ ] Retorna 401 sem token
- [ ] Retorna 404 se a iniciativa não existe
- [ ] Retorna array vazio (não 404) se a iniciativa existe mas não tem histórico
- [ ] Registros com `anulado = 1` não aparecem no retorno (filtrado pela view)

**Definição de pronto**  
Testado com iniciativa com histórico e sem histórico, merge.

---

## E2-S05 — Refatorar IniciativasService.listar() com paginação e filtros

**Estimativa:** M

**Descrição**  
Refatorar a listagem para suportar paginação e filtros básicos. Eliminar a duplicação com `AdminService.listarIniciativas()`.

**Critérios de aceite**
- [ ] `GET /api/iniciativas?page=1&limit=20` retorna objeto `{ data: [...], total, page, totalPages }`
- [ ] Filtros suportados: `status`, `area_id`, `dimensao_inovacao_id` (todos opcionais)
- [ ] `AdminService.listarIniciativas()` foi removido — o AdminModule consome `IniciativasModule`
- [ ] Query usa a tabela `INICIATIVAS` (não `INOVACAO_INICIATIVAS`) quando flag é `NOVO`
- [ ] Nenhuma agregação em memória JavaScript — tudo resolvido na query SQL

**Definição de pronto**  
Testado com diferentes combinações de filtros, duplicação eliminada, merge.

---

## E2-S06 — Refatorar AdminService.getKpis() para GROUP BY SQL

**Estimativa:** S

**Descrição**  
Substituir a lógica JavaScript de agregação em memória por queries SQL com GROUP BY.

**Critérios de aceite**
- [ ] `GET /api/admin/kpis` retorna: `total_iniciativas`, `por_status` (array de `{status, count}`), `por_dimensao` (array de `{dimensao, count}`)
- [ ] Nenhuma operação de agregação acontece no código JavaScript — tudo é GROUP BY SQL
- [ ] Os dados vêm da tabela `INICIATIVAS` (não `INOVACAO_INICIATIVAS`)
- [ ] O tempo de resposta não piora em relação à implementação atual para o volume de dados existente

**Definição de pronto**  
Query SQL revisada em EXPLAIN PLAN, resultado verificado, merge.

---

## E2-S07 — Frontend: exibir CODIGO_PUBLICO e dropdown de área no formulário

**Estimativa:** M

**Descrição**  
Atualizar o formulário para exibir o número de protocolo após submissão e carregar o dropdown de área via API.

**Critérios de aceite**
- [ ] Após submissão bem-sucedida, a tela exibe: "Protocolo registrado: **INOV-2026-005**. Guarde este número."
- [ ] O código é selecionável para cópia (não imagem)
- [ ] O campo "Área Proponente" é um `<select>` populado por `GET /api/reference/areas`
- [ ] Enquanto a API carrega, o campo exibe "Carregando áreas..."
- [ ] Se a API falhar, o campo exibe mensagem de erro e habilita input de texto como fallback
- [ ] O payload enviado ao backend inclui `area_id` (não texto livre)
- [ ] Suporte é enviado como array: `["MODELAGEM_TR_ACT", "CONEXAO_ICT"]` (não string pipe-delimited)

**Definição de pronto**  
Testado no formulário com submissão real, CODIGO_PUBLICO visível na tela de sucesso, merge.

---

## E2-S08 — Frontend: tela de detalhe e controles de workflow no painel admin

**Estimativa:** L

**Descrição**  
Implementar a tela de detalhe da iniciativa no painel admin com visualização completa dos dados e controles de transição de status.

**Critérios de aceite**
- [ ] Clicar em uma iniciativa na listagem navega para `/admin-panel/iniciativas/{id}`
- [ ] A tela exibe todos os campos de captação (somente leitura) e campos de gestão
- [ ] O status atual é exibido com badge colorido
- [ ] Apenas os botões de transição válidos para o perfil e status atual são exibidos (vindos de `transicoes_disponiveis` na API)
- [ ] Clicar em "Reprovar" abre modal com textarea obrigatório "Motivo da reprovação"
- [ ] Após transição bem-sucedida, o badge de status e a lista de botões atualizam sem recarregar a página
- [ ] A timeline de histórico é exibida em ordem cronológica no rodapé da tela
- [ ] Endpoint `GET /api/iniciativas/:id` retorna `transicoes_disponiveis: string[]` baseado no perfil do usuário logado

**Definição de pronto**  
Testado com usuário ANALISTA executando aprovação e reprovação, timeline visível, merge.

---

## E2-S09 — Proteger GET /api/iniciativas e atualizar frontend (deploy coordenado)

**Estimativa:** S

**Descrição**  
Adicionar `JwtAuthGuard` ao endpoint de listagem de iniciativas e atualizar o `admin.js` para enviar o token Bearer. Deploy único obrigatório — backend e frontend juntos.

**Critérios de aceite**
- [ ] `GET /api/iniciativas` sem token retorna 401
- [ ] `GET /api/iniciativas` com token válido de qualquer perfil retorna a lista
- [ ] `admin.js → loadIniciativas()` envia `Authorization: Bearer {token}` no cabeçalho
- [ ] O painel admin continua carregando a listagem normalmente após o deploy
- [ ] O formulário público de submissão (`POST /api/iniciativas`) não é afetado (continua sem autenticação)
- [ ] **Esta story e E2-S08 devem ser deployadas no mesmo ciclo de release**

**Definição de pronto**  
Testado com e sem token, painel funcionando com token, merge coordenado com E2-S08.

---

## E2-S10 — Criar endpoint GET /api/reference/:domain

**Estimativa:** S

**Descrição**  
Criar o `ReferenceDataModule` com endpoint público que retorna os valores ativos de um domínio em `DOMINIO_VALORES` e as áreas organizacionais ativas.

**Critérios de aceite**
- [ ] `GET /api/reference/areas` retorna `[{ id, sigla, nome }]` das unidades ativas, ordenadas por nome
- [ ] `GET /api/reference/dominios/ESTAGIO_MATURIDADE` retorna `[{ id, codigo, rotulo_pt }]` ordenados por `ordem`
- [ ] `GET /api/reference/dominios/DIMENSAO_INOVACAO` retorna valores ativos do domínio
- [ ] Endpoints são públicos (sem autenticação) — o formulário precisa deles
- [ ] Domínio inexistente retorna array vazio (não 404)
- [ ] Cache de 5 minutos implementado no serviço

**Definição de pronto**  
Testado com curl sem token, valores corretos retornados, merge.

---

# ÉPICO E3 — Autenticação Robusta e RBAC

**Objetivo:** Substituir autenticação via env vars por USUARIOS + bcrypt. Implementar RBAC completo.  
**Dependências:** E2 concluído.  
**Critério de saída:** Múltiplos usuários com perfis individuais; autenticação via banco; legado removido.

---

## E3-S01 — AuthService: autenticação via USUARIOS com mecanismo duplo

**Estimativa:** M

**Descrição**  
Migrar `validateCredentials()` para consultar USUARIOS + bcrypt. Manter fallback para env vars com log de warning por 1 semana.

**Critérios de aceite**
- [ ] Login com credenciais do usuário seed em `USUARIOS` funciona e retorna JWT
- [ ] Login com credenciais legadas (env vars) ainda funciona mas produz log `[WARN] Autenticação via credencial legada`
- [ ] Login com credenciais inválidas retorna 401
- [ ] O JWT gerado por ambos os caminhos tem o payload do ADR-003: `{ sub, login, perfis[], area_id }`
- [ ] O fallback consulta `USUARIOS` pelo campo `login` para obter o `user_id` antes de gerar o token
- [ ] Comentário no código: `// TEMPORÁRIO: remover em E3-S05 — prazo máximo: [data]`

**Definição de pronto**  
Ambos os caminhos testados, log de warning verificado nos logs do container, merge.

---

## E3-S02 — RolesGuard e atualização de JwtStrategy

**Estimativa:** M

**Descrição**  
Criar `RolesGuard` genérico baseado em perfis. Atualizar `JwtStrategy` para extrair o novo payload. Ativar `JwtAuthGuard` como guard global padrão.

**Critérios de aceite**
- [ ] `RolesGuard` rejeita com 403 quando `payload.perfis` não inclui o perfil requerido pelo decorator `@RequireRole()`
- [ ] `JwtAuthGuard` está ativo globalmente — todos os endpoints protegidos funcionam sem `@UseGuards()` explícito
- [ ] `AdminGuard` foi removido do codebase — verificar via `grep -r "AdminGuard" backend/src/`
- [ ] `AdminController` usa `@RequireRole('ANALISTA_ASSESSORIA')` (ou perfil equivalente) no lugar do `AdminGuard`
- [ ] `JwtStrategy` extrai corretamente: `sub → user_id`, `login`, `perfis`, `area_id`
- [ ] Endpoints públicos (formulário, /api/reference) têm `@Public()` decorator e não exigem token

**Definição de pronto**  
Guards testados com tokens de diferentes perfis, merge.

---

## E3-S03 — UsersModule: CRUD de usuários

**Estimativa:** L

**Descrição**  
Criar `UsersModule` com endpoints de gestão de usuários. Tela de gestão no painel admin.

**Critérios de aceite**
- [ ] `GET /api/admin/users` lista usuários com: id, login, nome, email, perfis, area, ativo
- [ ] `POST /api/admin/users` cria usuário com senha gerada aleatoriamente (12+ chars, alfanumérico)
- [ ] A senha gerada é exibida na resposta **uma única vez** — hash armazenado no banco
- [ ] `PATCH /api/admin/users/:id` atualiza nome, email, area_id, perfis
- [ ] `PATCH /api/admin/users/:id/status` ativa ou desativa usuário
- [ ] Sistema rejeita desativação do próprio usuário logado
- [ ] Sistema rejeita desativação se seria o último ADMINISTRADOR ativo
- [ ] Todos os endpoints protegidos por `@RequireRole('ADMINISTRADOR')`
- [ ] Tela `/admin-panel/usuarios` lista e permite criar/editar/desativar usuários
- [ ] Toda operação gera registro em `AUDITORIA_LOGS`

**Definição de pronto**  
CRUD completo testado, proteção do último admin verificada, merge.

---

## E3-S04 — Tela de gestão de usuários no painel admin

**Estimativa:** M

**Descrição**  
Implementar a interface frontend para gestão de usuários.

**Critérios de aceite**
- [ ] Menu do painel admin exibe "Usuários" apenas para perfil ADMINISTRADOR
- [ ] Tela lista todos os usuários com nome, login, perfis (badges), área e status
- [ ] Botão "Novo Usuário" abre modal com campos: login, nome, email, área (dropdown), perfis (checkboxes)
- [ ] Após criação, modal exibe a senha gerada com botão "Copiar senha" e aviso "Esta senha não será exibida novamente"
- [ ] Botão de desativar com confirmação: "Desativar [nome]? O usuário perderá acesso imediatamente."
- [ ] Usuário logado não vê botão de desativar em seu próprio registro

**Definição de pronto**  
CRUD testado no painel, senha exibida uma vez verificada, merge.

---

## E3-S05 — Remover mecanismo legado de autenticação

**Estimativa:** S

**Descrição**  
Após 1 semana de E3-S01 em produção sem incidentes, remover o fallback para env vars.

**Critérios de aceite**
- [ ] Confirmação documentada (issue/ticket/email) de que o admin logou com sucesso via conta em USUARIOS
- [ ] Nenhuma ocorrência de `[WARN] Autenticação via credencial legada` nos logs das últimas 24 horas
- [ ] Código do fallback removido de `AuthService.validateCredentials()`
- [ ] `ADMIN_USERNAME` e `ADMIN_PASSWORD` removidos do `.env` e do `.env.example`
- [ ] `grep -r "ADMIN_USERNAME\|ADMIN_PASSWORD" backend/src/` retorna zero resultados
- [ ] Login com as credenciais antigas retorna 401

**Definição de pronto**  
Confirmação documentada obtida, grep limpo, merge.

---

# ÉPICO E4 — Enriquecimento do Portfólio

**Objetivo:** Adicionar gestão financeira, anotações estruturadas e administração de dados de referência.  
**Dependências:** E3 concluído.  
**Critério de saída:** Assessoria gerencia dados financeiros, faz anotações internas e administra enums sem TI.

---

## E4-S01 — Gestão de investimento na tela de detalhe

**Estimativa:** M

**Descrição**  
Implementar visualização e registro de investimentos com versionamento na tela de detalhe da iniciativa.

**Critérios de aceite**
- [ ] `GET /api/iniciativas/:id/investimentos` retorna lista de versões ordenadas por `versao DESC`
- [ ] `POST /api/iniciativas/:id/investimentos` cria nova versão com: valor, moeda (default BRL), ano_referencia, fonte, status_aprov, tipo
- [ ] A tela de detalhe exibe o investimento corrente (mais recente com status ESTIMADO ou APROVADO)
- [ ] O histórico de versões é acessível via toggle "Ver histórico de revisões"
- [ ] Dashboard `/api/admin/kpis` inclui `investimento_total` (soma dos investimentos correntes)
- [ ] Protegido por autenticação; ANALISTA pode criar, GESTOR_AREA pode apenas visualizar

**Definição de pronto**  
Versionamento testado com múltiplas revisões, dashboard atualizado, merge.

---

## E4-S02 — Anotações com tipo e visibilidade

**Estimativa:** M

**Descrição**  
Implementar anotações separadas por tipo e visibilidade, substituindo o campo polimórfico de notas.

**Critérios de aceite**
- [ ] `GET /api/iniciativas/:id/anotacoes` retorna anotações filtradas pela visibilidade do perfil do usuário
- [ ] ANALISTA e ADMINISTRADOR veem: PUBLICA + INTERNA
- [ ] GESTOR_AREA vê: apenas PUBLICA
- [ ] `POST /api/iniciativas/:id/anotacoes` cria com `tipo` e `visibilidade` obrigatórios
- [ ] Anotações não podem ser deletadas — apenas adicionadas
- [ ] A tela de detalhe exibe anotações separadas visualmente: "Notas internas" (INTERNA) e "Comunicados" (PUBLICA)
- [ ] O comentário original do proponente (`comentario_proponente` da iniciativa) é exibido como anotação somente leitura do tipo COMENTARIO_PROPONENTE

**Definição de pronto**  
Filtro de visibilidade testado com diferentes perfis, merge.

---

## E4-S03 — Gestão de dados de referência no painel admin

**Estimativa:** L

**Descrição**  
Tela de administração para gerenciar `DOMINIO_VALORES`, `UNIDADES_ORGANIZACIONAIS` e `CANAIS_CAPTACAO` sem intervenção técnica.

**Critérios de aceite**
- [ ] Seção "Dados de Referência" no painel admin, visível apenas para ADMINISTRADOR
- [ ] Três sub-telas: "Domínios", "Áreas Organizacionais", "Canais de Captação"
- [ ] Em Domínios: lista valores por domínio, permite adicionar novo valor (codigo + rotulo), desativar valor
- [ ] Tentativa de desativar valor em uso exibe: "Este valor está em uso por N iniciativas. Desativar impedirá novas seleções."
- [ ] Em Áreas: lista hierarquia de unidades, permite adicionar, editar nome/sigla, desativar
- [ ] Após criar novo valor em DOMINIO_VALORES, o dropdown correspondente no formulário o exibe (cache expirado)
- [ ] Endpoints protegidos por `@RequireRole('ADMINISTRADOR')`
- [ ] Toda operação gera registro em `AUDITORIA_LOGS`

**Definição de pronto**  
Fluxo completo de adicionar valor, verificar no formulário, desativar (com bloqueio se em uso), merge.

---

# ÉPICO E5 — Maturidade Operacional

**Objetivo:** Connection pool, CI/CD, dashboard completo e arquivamento do schema legado.  
**Dependências:** E4 concluído; 30 dias sem escrita nas tabelas legadas.  
**Critério de saída:** Sistema sem débito técnico pendente; schema legado arquivado.

---

## E5-S01 — Connection pool Oracle

**Estimativa:** S

**Descrição**  
Migrar `DatabaseModule` de conexões individuais para connection pool via `oracledb.createPool()`.

**Critérios de aceite**
- [ ] `DatabaseModule` usa `oracledb.createPool()` no `onModuleInit()`
- [ ] Pool configurável via variáveis de ambiente: `ORACLE_POOL_MIN` (default 2), `ORACLE_POOL_MAX` (default 10)
- [ ] Graceful shutdown: `AppModule.onModuleDestroy()` chama `pool.close()`
- [ ] Log no startup: `[DatabaseModule] Pool Oracle inicializado: min=2, max=10`
- [ ] Nenhuma chamada a `oracledb.getConnection()` direta nos services — todos usam o pool

**Definição de pronto**  
Pool testado com carga simulada, graceful shutdown verificado, merge.

---

## E5-S02 — Pipeline CI/CD básico

**Estimativa:** M

**Descrição**  
Configurar `.gitlab-ci.yml` com pipeline de lint, typecheck e build.

**Critérios de aceite**
- [ ] Pipeline executa automaticamente em todo push para `main` e `develop`
- [ ] Stage `lint`: executa `pnpm run lint` — falha em erros de lint
- [ ] Stage `typecheck`: executa `tsc --noEmit` — falha em erros de tipo
- [ ] Stage `build`: executa `pnpm run build` — falha se o build não compilar
- [ ] Um push com erro de tipo TypeScript falha o pipeline com mensagem clara no GitLab
- [ ] Um push que passa o pipeline pode ser deployado manualmente

**Definição de pronto**  
Pipeline verificado com um push intencional com erro, depois com push limpo, merge.

---

## E5-S03 — Arquivamento das tabelas legadas

**Estimativa:** M

**Descrição**  
Renomear as tabelas legadas após confirmação de 30 dias sem escrita nelas. Criar dump de arquivamento.

**Critérios de aceite**
- [ ] Query confirma zero INSERTs em `INOVACAO_INICIATIVAS` nos últimos 30 dias: `SELECT MAX(CRIADO_EM) FROM INOVACAO_INICIATIVAS` retorna data anterior a 30 dias
- [ ] Dump de arquivamento criado: `expdp` ou equivalente para arquivo documentado
- [ ] `ALTER TABLE INOVACAO_INICIATIVAS RENAME TO INOVACAO_INICIATIVAS_LEGADO` executado
- [ ] `ALTER TABLE INOVACAO_LOGS RENAME TO INOVACAO_LOGS_LEGADO` executado
- [ ] `grep -r "INOVACAO_INICIATIVAS\b" backend/src/` (sem `_LEGADO`) retorna zero resultados
- [ ] Aplicação sobe e funciona normalmente após o rename
- [ ] Data de DROP programado documentada (90 dias após o rename)
- [ ] Aprovação formal da Assessoria registrada (ticket ou email)

**Definição de pronto**  
Rename executado, grep limpo, aplicação funcionando, aprovação documentada, merge.