# Quebra de Tarefas Técnicas — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24  
**Legenda:** [BE] Backend | [FE] Frontend | [DB] Database | [OPS] DevOps | [TEST] Testes

---

## E0-S01 — Remover credenciais do repositório

```
E0-S01
├── [OPS] Executar git filter-branch ou BFG Repo-Cleaner para remover .env do histórico
├── [OPS] Adicionar .env e .env.* ao .gitignore (verificar se já existe entrada)
├── [OPS] Criar .env.example com todas as variáveis e valores placeholder descritivos
├── [OPS] Rotacionar senha Oracle Cedae#2026 (coordenar com DBA) — nova senha documentada de forma segura
├── [BE]  Verificar que a aplicação sobe com as novas credenciais
├── [OPS] Atualizar README com instruções de configuração do ambiente local
└── [TEST] Verificar com `git log --all -- .env` que nenhum commit contém o arquivo
```

## E0-S02 — Rate limiting e remoção de logs de credenciais

```
E0-S02
├── [BE]  Remover todos os console.log de auth.service.ts que contenham username/password/env vars
├── [BE]  Instalar @nestjs/throttler: `pnpm add @nestjs/throttler`
├── [BE]  Configurar ThrottlerModule no AppModule com parâmetros via env: RATE_LIMIT_TTL, RATE_LIMIT_MAX
├── [BE]  Aplicar @Throttle() no AuthController.login()
├── [BE]  Verificar que resposta 429 inclui header Retry-After
├── [BE]  Adicionar RATE_LIMIT_TTL=60 e RATE_LIMIT_MAX=5 no .env.example
└── [TEST] Teste manual: 6 POSTs consecutivos para /api/auth/login com credenciais inválidas → 6ª deve ser 429
```

## E0-S03 — TypeScript strict mode e limpeza de dependências

```
E0-S03
├── [BE]  Habilitar em tsconfig.json: "strictNullChecks": true, "noImplicitAny": true
├── [BE]  Executar `pnpm run build` e listar todos os erros TypeScript emergentes
├── [BE]  Corrigir erros: adicionar verificações de null em resultados Oracle, tipar parâmetros any
│         Nota: tipicamente 20-50 correções pontuais; não suprimir com @ts-ignore
├── [BE]  Remover passport-local de package.json e pnpm-lock.yaml
├── [BE]  Executar `pnpm install` após remoção
└── [TEST] `pnpm run build` deve completar sem erros; `grep "ts-ignore" backend/src/**/*.ts` deve retornar vazio
```

## E0-S04 — Gerar JWT_SECRET forte

```
E0-S04
├── [OPS] Gerar secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
├── [OPS] Atualizar .env com o valor gerado (não commitar)
├── [OPS] Documentar no README: como gerar novo secret, impacto da rotação (invalida todos os tokens ativos)
├── [BE]  Verificar que JWT_EXPIRES_IN está configurável via env (já deveria estar)
└── [TEST] Subir aplicação, fazer login, verificar que token é gerado; antigo token (se existir) deve ser inválido
```

---

## E1-S01 — Tabelas de referência

```
E1-S01
├── [DB]  Criar V01__create_dominio_valores.sql com DDL + seed completo (todos os domínios do MVP)
├── [DB]  Criar V02__create_status_workflow.sql com DDL + seed (4 estados: SUBMETIDA, EM_ANALISE, APROVADA, REPROVADA)
├── [DB]  Criar V03__create_canais_captacao.sql com DDL + seed (VIA_2 apenas)
├── [DB]  Criar V04__create_perfis_acesso.sql com DDL + seed (3 perfis)
├── [DB]  Criar V05__create_parametros_sistema.sql com DDL + seed (4 parâmetros iniciais)
├── [DB]  Executar todos os scripts no banco de desenvolvimento
├── [DB]  Verificar idempotência: re-executar todos os scripts — nenhum deve falhar ou duplicar
└── [TEST] SELECT COUNT(*) para cada tabela: DOMINIO_VALORES ≥ 30, STATUS_WORKFLOW = 4, CANAIS_CAPTACAO = 1, etc.
```

## E1-S02 — Tabelas de identidade e seed do admin

```
E1-S02
├── [DB]  Criar V06__create_unidades_organizacionais.sql (self-referenciada: criar sem FK primeiro, add FK depois)
├── [DB]  Criar V07__seed_unidades_organizacionais.sql com a lista de gerências/diretorias fornecida pela Assessoria
├── [DB]  Criar V08__create_usuarios.sql
├── [DB]  Criar V09__create_usuarios_perfis.sql
├── [BE]  Criar script utilitário backend/scripts/generate-bcrypt-hash.ts para gerar hash da senha admin
├── [DB]  Criar V10__seed_usuario_admin.sql com INSERT do admin (hash gerado pelo script utilitário)
├── [DB]  Criar V11__create_proponentes.sql
├── [DB]  Executar todos os scripts no banco de desenvolvimento
└── [TEST] Verificar hash com `node -e "const b=require('bcrypt'); b.compare('senha', 'hash').then(console.log)"` → true
```

## E1-S03 — Tabelas transacionais e triggers

```
E1-S03
├── [DB]  Criar V12__create_transicoes_status.sql (sem seed ainda)
├── [DB]  Criar V13__seed_transicoes_status_mvp.sql (3 transições do MVP)
├── [DB]  Criar V14__create_historico_status.sql com trigger TRG_HS_NO_UPD_DEL e view VW_HISTORICO_ATIVO
├── [DB]  Criar V15__create_investimentos.sql
├── [DB]  Criar V16__create_anotacoes.sql
├── [DB]  Criar V17__create_iniciativas_suportes.sql
├── [DB]  Criar V18__create_auditoria_logs.sql
├── [DB]  Executar todos os scripts
├── [TEST] Testar trigger: INSERT em HISTORICO_STATUS, depois tentar UPDATE → deve falhar com ORA-20001
└── [TEST] Testar trigger: tentar DELETE em HISTORICO_STATUS → deve falhar com ORA-20002
```

## E1-S04 — Colunas de migração em INOVACAO_INICIATIVAS

```
E1-S04
├── [DB]  Criar V19__alter_inovacao_iniciativas_add_columns.sql com procedure idempotente
├── [DB]  Executar em desenvolvimento
├── [TEST] Verificar que colunas existem: SELECT column_name FROM user_tab_columns WHERE table_name='INOVACAO_INICIATIVAS'
└── [TEST] Submeter formulário e verificar que INSERT legado ainda funciona (colunas novas ficam nulas)
```

## E1-S05 — ETL de migração histórica

```
E1-S05
├── [DB]  Criar tabela ETL_CURADORIA_LOG para registrar casos ambíguos durante o ETL
├── [DB]  Criar V20__etl_unidades_organizacionais.sql (extrair áreas únicas de INOVACAO_INICIATIVAS)
├── [DB]  Criar V21__etl_proponentes.sql (criar PROPONENTES de NOME_COLABORADOR + CANAL_CONTATO)
├── [DB]  Criar V22__etl_codigos_publicos.sql (gerar CODIGO_PUBLICO para todos os registros)
├── [DB]  Criar V23__etl_status_e_historico.sql (mapear status e criar HISTORICO_STATUS inicial)
│         Nota: usar arquivo de referência da Assessoria para mapeamento [Homologada]→APROVADA etc.
├── [DB]  Criar V24__etl_suportes.sql (explodir SUPORTE_NECESSARIO pipe-delimited)
├── [DB]  Criar V25__etl_investimentos.sql (migrar VALOR_APORTE para INVESTIMENTOS)
├── [DB]  Criar V26__etl_anotacoes.sql (migrar COMENTARIOS_ADICIONAIS para ANOTACOES)
├── [DB]  Criar V27__etl_auditoria_logs_legado.sql (migrar INOVACAO_LOGS para AUDITORIA_LOGS)
├── [DB]  Criar script de validação com as 7 queries documentadas em database-migration-plan.md
├── [DB]  Executar ETL no banco de desenvolvimento
├── [DB]  Executar queries de validação — todas devem retornar 0
├── [DB]  Gerar relatório de curadoria a partir de ETL_CURADORIA_LOG
├── [BE]  (Aguardar aprovação da Assessoria sobre o relatório de curadoria)
└── [DB]  Executar ETL em produção após aprovação da Assessoria
```

## E1-S06 — Tabela INICIATIVAS e FKs finais

```
E1-S06
├── [DB]  Criar V28__create_iniciativas.sql com trigger TRG_INICIATIVAS_BEF_INS para CODIGO_PUBLICO
│         Calcular START WITH da sequence: SELECT MAX(TO_NUMBER(SUBSTR(CODIGO_PUBLICO,10)))+1 FROM INOVACAO_INICIATIVAS
├── [DB]  Criar V29__add_fks_to_support_tables.sql
│         ALTER TABLE HISTORICO_STATUS ADD CONSTRAINT FK_HS_INICIATIVA FOREIGN KEY (iniciativa_id) REFERENCES INICIATIVAS(id)
│         (e demais FKs para ANOTACOES, INVESTIMENTOS, INICIATIVAS_SUPORTES)
├── [DB]  Criar V30__create_views_dominio.sql (VW_ESTAGIOS_MATURIDADE, VW_DIMENSOES_INOVACAO, etc.)
├── [DB]  Executar scripts
├── [TEST] Testar trigger: INSERT em INICIATIVAS sem CODIGO_PUBLICO → trigger preenche automaticamente
└── [TEST] Verificar que INICIATIVAS está vazia: SELECT COUNT(*) FROM INICIATIVAS → 0
```

---

## E2-S01 — WorkflowModule

```
E2-S01
├── [BE]  Criar backend/src/workflow/workflow.module.ts
├── [BE]  Criar backend/src/workflow/workflow.service.ts com método transicionar()
│         Incluir: validação contra TRANSICOES_STATUS, verificação de perfil, verificação de justificativa
├── [BE]  Implementar cache de TRANSICOES_STATUS com TTL de 2 minutos (Map em memória)
├── [BE]  Criar WorkflowTransitionException com campos: motivo, statusAtual, statusDesejado, perfilRequerido
├── [BE]  WorkflowService.transicionar() deve executar em transação: UPDATE INICIATIVAS + INSERT HISTORICO_STATUS
├── [TEST] Teste unitário: transição válida → sucesso, registro em HISTORICO_STATUS criado
├── [TEST] Teste unitário: transição inválida (não existe em TRANSICOES_STATUS) → WorkflowTransitionException
├── [TEST] Teste unitário: perfil insuficiente → WorkflowTransitionException
└── [TEST] Teste unitário: justificativa ausente quando obrigatória → WorkflowTransitionException
```

## E2-S02 — IniciativasService com feature flag

```
E2-S02
├── [BE]  Injetar ParametrosService em IniciativasService
├── [BE]  Criar IniciativasRepository (backend/src/iniciativas/iniciativas.repository.ts) com queries SQL para INICIATIVAS
├── [BE]  Refatorar criar() para bifurcar com base no flag: 'LEGADO' → INOVACAO_INICIATIVAS; 'NOVO' → INICIATIVAS
│         Adicionar comentário: // Feature flag FORMULARIO_DESTINO_TABELA — TODO: remover após Fase 5
├── [BE]  Caminho NOVO: criar PROPONENTE se não existir, criar INICIATIVA, criar INICIATIVAS_SUPORTES (array), criar HISTORICO_STATUS inicial
├── [BE]  Response sempre inclui codigo_publico (vindo de RETURNING no INSERT ou do campo legado)
├── [BE]  Criar ParametrosService (backend/src/parametros/parametros.service.ts) com cache TTL 1min
└── [TEST] Teste com flag LEGADO: INSERT em INOVACAO_INICIATIVAS, response tem codigo_publico do ETL
       Teste com flag NOVO: INSERT em INICIATIVAS, response tem codigo_publico gerado pelo trigger
```

## E2-S03 — Endpoint PATCH status

```
E2-S03
├── [BE]  Adicionar método atualizarStatus() no IniciativasController
├── [BE]  Criar PatchStatusDto com campos: status (obrigatório), justificativa (opcional)
├── [BE]  Controller delega para WorkflowService.transicionar()
├── [BE]  Mapear WorkflowTransitionException para resposta HTTP 422 com mensagem clara
├── [BE]  Aplicar JwtAuthGuard no endpoint
├── [BE]  Criar endpoint GET /api/iniciativas/:id/transicoes-disponiveis que retorna as transições válidas para o perfil do usuário
└── [TEST] curl com token de ANALISTA → 200; sem token → 401; com GESTOR_AREA → 403
```

## E2-S04 — Endpoint GET histórico

```
E2-S04
├── [BE]  Adicionar método listarHistorico() no IniciativasController
├── [BE]  Query: SELECT via VW_HISTORICO_ATIVO com JOIN em USUARIOS para nome
├── [BE]  Aplicar JwtAuthGuard
└── [TEST] Retorna array vazio para iniciativa sem histórico (não 404); retorna 404 para iniciativa inexistente
```

## E2-S05 — Refatorar listar() com paginação

```
E2-S05
├── [BE]  Atualizar ListarIniciativasDto com: page (default 1), limit (default 20), status?, area_id?, dimensao_inovacao_id?
├── [BE]  Criar query SQL com WHERE dinâmico e OFFSET/FETCH NEXT no Oracle
├── [BE]  Response: { data: IniciativaDto[], total: number, page: number, totalPages: number }
├── [BE]  Remover AdminService.listarIniciativas() — AdminModule passa a importar IniciativasModule
└── [TEST] GET /api/iniciativas?page=1&limit=5 retorna no máximo 5 itens e total correto
```

## E2-S06 — KPIs via GROUP BY SQL

```
E2-S06
├── [BE]  Substituir a lógica JS de getKpis() por 2 queries SQL:
│         Query 1: SELECT sw.rotulo_pt, COUNT(*) FROM INICIATIVAS i JOIN STATUS_WORKFLOW sw... GROUP BY sw.rotulo_pt
│         Query 2: SELECT dv.rotulo_pt, COUNT(*) FROM INICIATIVAS i JOIN DOMINIO_VALORES dv... GROUP BY dv.rotulo_pt
├── [BE]  Adicionar campo investimento_total: SELECT SUM(valor) FROM INVESTIMENTOS WHERE versao = MAX...
└── [TEST] EXPLAIN PLAN das queries não deve ter FULL TABLE SCAN nos índices principais
```

## E2-S07 — Frontend: formulário com CODIGO_PUBLICO e dropdown de área

```
E2-S07
├── [FE]  Criar função loadAreas() que chama GET /api/reference/areas e popula <select id="area_proponente">
├── [FE]  Chamar loadAreas() no DOMContentLoaded do formulário
├── [FE]  Adicionar estado de loading e tratamento de erro no dropdown de área
├── [FE]  Atualizar collectFormData() para incluir area_id (do select) em vez de texto area_proponente
├── [FE]  Atualizar collectFormData() para enviar suporte_necessario como array: ['MODELAGEM_TR_ACT', 'CONEXAO_ICT']
├── [FE]  Atualizar submitForm() para ler response.codigo_publico da resposta do backend
├── [FE]  Atualizar tela de sucesso para exibir: "Protocolo: INOV-2026-005" com botão de cópia
└── [TEST] Submeter formulário → verificar CODIGO_PUBLICO exibido na tela; verificar no banco que area_id está preenchido
```

## E2-S08 — Frontend: tela de detalhe e workflow

```
E2-S08
├── [BE]  Atualizar GET /api/iniciativas/:id para retornar objeto completo com:
│         todos os campos + proponente_nome + area_nome + status_rotulo + transicoes_disponiveis[]
├── [FE]  Criar frontend/admin-detalhe.html (ou seção dinâmica em admin.html)
├── [FE]  Criar função loadDetalheIniciativa(id) que chama GET /api/iniciativas/:id
├── [FE]  Renderizar todos os campos da iniciativa em seções organizadas por bloco
├── [FE]  Renderizar badge de status com cor baseada no código (SUBMETIDA=azul, EM_ANALISE=amarelo, APROVADA=verde, REPROVADA=vermelho)
├── [FE]  Renderizar botões de ação baseados em transicoes_disponiveis[] — somente os disponíveis
├── [FE]  Criar modal de confirmação de transição com campo de justificativa (obrigatório quando justificativa_obrig=true)
├── [FE]  Após transição bem-sucedida: chamar loadDetalheIniciativa(id) novamente para atualizar a tela
├── [FE]  Criar função loadHistorico(id) que chama GET /api/iniciativas/:id/historico e renderiza timeline
└── [TEST] Fluxo completo: clicar em iniciativa → ver detalhe → clicar Iniciar Análise → status muda → Reprovar → justificativa obrigatória
```

## E2-S09 — Proteger GET /api/iniciativas (deploy coordenado)

```
E2-S09
├── [BE]  Aplicar JwtAuthGuard em GET /api/iniciativas (remover @Public() se existir)
├── [FE]  Atualizar admin.js → loadIniciativas() para incluir header Authorization: Bearer ${token}
├── [FE]  Verificar que o token é lido de sessionStorage corretamente antes de chamar o endpoint
├── [TEST] GET /api/iniciativas sem token → 401
├── [TEST] GET /api/iniciativas com token válido → 200 com lista
├── [TEST] Painel admin carrega a listagem normalmente com o token
└── [OPS] ** DEPLOY ÚNICO com E2-S08 — nunca deployar este sem o frontend atualizado **
```

## E2-S10 — ReferenceDataModule

```
E2-S10
├── [BE]  Criar backend/src/reference-data/reference-data.module.ts
├── [BE]  Criar ReferenceDataController com endpoints:
│         GET /api/reference/areas → UNIDADES_ORGANIZACIONAIS WHERE ativo=1 ORDER BY nome
│         GET /api/reference/dominios/:dominio → DOMINIO_VALORES WHERE dominio=:dominio AND ativo=1 ORDER BY ordem
├── [BE]  Implementar cache TTL 5min para ambos os endpoints
├── [BE]  Marcar endpoints com @Public() — sem autenticação necessária
└── [TEST] curl sem token: GET /api/reference/areas → 200 com lista; GET /api/reference/dominios/GRAU_IMPACTO → 200
```

---

## E3-S01 — AuthService mecanismo duplo

```
E3-S01
├── [BE]  Criar backend/src/auth/auth.repository.ts com query: findUserByLogin(login) → retorna {id, login, senha_hash, perfis[], area_id, ativo}
├── [BE]  Refatorar validateCredentials():
│         1. Tentar query findUserByLogin()
│         2. Se encontrado e ativo: bcrypt.compare(password, senha_hash)
│         3. Se bcrypt retornar true: retornar user object com {id, login, perfis, area_id}
│         4. Se falhar: tentar ADMIN_USERNAME/ADMIN_PASSWORD env vars (FALLBACK)
│         5. Se fallback funcionar: logar [WARN] + consultar USUARIOS para obter user_id
│         6. Se tudo falhar: lançar UnauthorizedException
│         Adicionar comentário: // TEMPORÁRIO: remover em E3-S05 — data limite: {DD/MM/AAAA}
├── [BE]  Atualizar generateToken() com novo payload: { sub: user.id, login, perfis: user.perfis, area_id: user.area_id }
├── [TEST] Login com conta seed em USUARIOS → JWT gerado; decodificar JWT → verificar campos sub, login, perfis, area_id
└── [TEST] Login com ADMIN_USERNAME env → funciona com log [WARN] nos logs do container
```

## E3-S02 — RolesGuard e JwtStrategy

```
E3-S02
├── [BE]  Criar backend/src/auth/roles.guard.ts: verifica payload.perfis.includes(perfilRequerido)
├── [BE]  Criar decorator @RequireRole('NOME_PERFIL') 
├── [BE]  Criar decorator @Public() para marcar endpoints que não precisam de autenticação
├── [BE]  Atualizar JwtStrategy.validate() para retornar: { userId, login, perfis, areaId }
├── [BE]  Configurar JwtAuthGuard como guard global em AppModule (usando APP_GUARD)
├── [BE]  Aplicar @Public() em: POST /api/auth/login, POST /api/iniciativas, GET /api/reference/*
├── [BE]  Aplicar @RequireRole('ANALISTA_ASSESSORIA') nos endpoints do AdminController
├── [BE]  Remover AdminGuard: `rm backend/src/auth/admin.guard.ts`
└── [TEST] Token de ANALISTA → acessa admin endpoints; Token de GESTOR_AREA → 403; Sem token em endpoint público → 200
```

## E3-S03 — UsersModule backend

```
E3-S03
├── [BE]  Criar backend/src/users/users.module.ts, users.controller.ts, users.service.ts, users.repository.ts
├── [BE]  Implementar GET /api/admin/users com paginação básica
├── [BE]  Implementar POST /api/admin/users:
│         Gerar senha aleatória (12 chars, `crypto.randomBytes(6).toString('hex')`)
│         Hash com bcrypt
│         INSERT em USUARIOS + INSERT em USUARIOS_PERFIS para cada perfil
│         Retornar a senha gerada UMA VEZ no response
├── [BE]  Implementar PATCH /api/admin/users/:id (nome, email, area_id, perfis)
├── [BE]  Implementar PATCH /api/admin/users/:id/status (ativo: boolean)
│         Validações: não pode desativar a si mesmo; não pode ser o último ADMINISTRADOR ativo
├── [BE]  Aplicar @RequireRole('ADMINISTRADOR') em todos os endpoints do UsersController
└── [TEST] Criar usuário → senha no response; tentar desativar último admin → 422; tentar desativar si mesmo → 422
```

## E3-S04 — Tela de usuários frontend

```
E3-S04
├── [FE]  Criar seção "Usuários" no menu do painel admin (visível apenas se perfis inclui ADMINISTRADOR)
├── [FE]  Criar função loadUsuarios() que chama GET /api/admin/users e renderiza tabela
├── [FE]  Criar modal de novo usuário com campos: login, nome, email, área (dropdown), perfis (checkboxes)
├── [FE]  Após criação bem-sucedida: exibir modal com senha gerada + botão "Copiar senha" + aviso de única exibição
├── [FE]  Botão de desativar com modal de confirmação (não exibir para o usuário logado)
└── [TEST] Criar usuário no painel → senha exibida; fechar modal → senha não recuperável; desativar usuário → some da listagem ativa
```

## E3-S05 — Remover mecanismo legado

```
E3-S05
├── [BE]  Verificar nos logs: ausência de [WARN] Autenticação via credencial legada nas últimas 24h
├── [BE]  Remover o bloco de fallback de validateCredentials() (código marcado como TEMPORÁRIO)
├── [BE]  Remover referências a ADMIN_USERNAME e ADMIN_PASSWORD do código
├── [OPS] Remover ADMIN_USERNAME e ADMIN_PASSWORD do .env (e do .env.example)
├── [TEST] `grep -r "ADMIN_USERNAME\|ADMIN_PASSWORD" backend/src/` → vazio
└── [TEST] Login com as credenciais antigas (env vars) → 401
```

---

## E4-S01 — Gestão de investimento

```
E4-S01
├── [BE]  Criar backend/src/investimentos/investimentos.module.ts, controller, service, repository
├── [BE]  Implementar GET /api/iniciativas/:id/investimentos (lista todas as versões, ordenadas por versao DESC)
├── [BE]  Implementar POST /api/iniciativas/:id/investimentos (cria nova versão; versao = MAX(versao)+1)
├── [BE]  Atualizar getKpis() para incluir: SELECT SUM(valor) FROM INVESTIMENTOS WHERE versao = (SELECT MAX...)
├── [FE]  Na tela de detalhe: adicionar seção "Financeiro" com investimento corrente e toggle "Ver histórico"
├── [FE]  Modal de novo investimento com campos: valor, moeda (default BRL), ano_referencia, fonte (select), tipo (select)
└── [TEST] Criar 3 versões de investimento para mesma iniciativa → apenas a mais recente mostrada como corrente; histórico mostra as 3
```

## E4-S02 — Anotações com visibilidade

```
E4-S02
├── [BE]  Criar backend/src/anotacoes/anotacoes.module.ts, controller, service, repository
├── [BE]  Implementar GET /api/iniciativas/:id/anotacoes com filtro de visibilidade baseado no perfil do usuário logado
│         ADMINISTRADOR/ANALISTA → PUBLICA + INTERNA; GESTOR_AREA → apenas PUBLICA
├── [BE]  Implementar POST /api/iniciativas/:id/anotacoes com tipo e visibilidade obrigatórios
│         Validação: COMENTARIO_PROPONENTE só pode ter visibilidade PUBLICA (CK já existe no banco)
├── [FE]  Na tela de detalhe: seção "Notas Internas" (INTERNA) separada de "Comunicados" (PUBLICA)
├── [FE]  Botão "Nova anotação" com modal: tipo (select), visibilidade (select), texto (textarea)
└── [TEST] ANALISTA cria nota INTERNA; logar como GESTOR_AREA (área correta) → nota não aparece
```

## E4-S03 — Gestão de dados de referência

```
E4-S03
├── [BE]  Adicionar endpoints em ReferenceDataModule:
│         GET  /api/admin/reference/dominios (lista todos os domínios e seus valores)
│         POST /api/admin/reference/dominios (cria novo valor em DOMINIO_VALORES)
│         PATCH /api/admin/reference/dominios/:id (edita rotulo_pt, ordem)
│         PATCH /api/admin/reference/dominios/:id/status (ativa/desativa)
│         GET/POST/PATCH para UNIDADES_ORGANIZACIONAIS e CANAIS_CAPTACAO (mesma estrutura)
├── [BE]  Validação na desativação: verificar se valor está em uso em INICIATIVAS — retornar contagem em caso positivo
├── [BE]  Todos os endpoints de escrita: @RequireRole('ADMINISTRADOR') + registro em AUDITORIA_LOGS
├── [FE]  Seção "Dados de Referência" no menu admin com 3 sub-telas: Domínios, Áreas, Canais
├── [FE]  Cada sub-tela: tabela com valores, botão adicionar, botão editar, botão desativar (com aviso de impacto)
└── [TEST] Admin adiciona novo tipo de suporte → dropdown no formulário o mostra após cache expirar (5min)
       Admin tenta desativar valor em uso → exibe "N iniciativas afetadas" e permite ou bloqueia conforme regra
```

---

## E5-S01 — Connection pool Oracle

```
E5-S01
├── [BE]  Refatorar DatabaseModule.onModuleInit() para usar oracledb.createPool():
│         pool = await oracledb.createPool({ user, password, connectString, poolMin, poolMax })
├── [BE]  Criar método getConnection() que chama pool.getConnection()
├── [BE]  Implementar AppModule.onModuleDestroy() que chama pool.close()
├── [BE]  Adicionar ORACLE_POOL_MIN=2 e ORACLE_POOL_MAX=10 no .env.example
├── [BE]  Logar no startup: `[DatabaseModule] Pool Oracle inicializado: min=${poolMin}, max=${poolMax}`
├── [BE]  Verificar que todos os services usam this.db.getConnection() (não oracledb.getConnection() diretamente)
└── [TEST] Subir aplicação, verificar log do pool; fazer 5 requests simultâneos, verificar que todos respondem
```

## E5-S02 — Pipeline CI/CD

```
E5-S02
├── [OPS] Criar .gitlab-ci.yml com stages: lint, typecheck, build
├── [OPS] Stage lint: `cd backend && pnpm run lint`
│         Configurar pnpm run lint no package.json: `eslint "src/**/*.ts" --max-warnings 0`
├── [OPS] Stage typecheck: `cd backend && pnpm tsc --noEmit`
├── [OPS] Stage build: `cd backend && pnpm run build`
├── [OPS] Usar cache de node_modules entre stages para velocidade
├── [OPS] Configurar regras: apenas branches main e develop + merge requests
└── [TEST] Push com erro de tipo → pipeline falha em typecheck; push limpo → pipeline verde
```

## E5-S03 — Arquivamento de tabelas legadas

```
E5-S03
├── [DB]  Verificar query: SELECT MAX(CRIADO_EM) FROM INOVACAO_INICIATIVAS → deve ser > 30 dias atrás
├── [DB]  Verificar query: SELECT MAX(CRIADO_EM) FROM INOVACAO_LOGS → deve ser > 30 dias atrás  
├── [BE]  Executar: `grep -r "INOVACAO_INICIATIVAS\b" backend/src/` → deve retornar vazio (exceto migrations)
├── [DB]  Criar dump: `expdp CEDAE_INOVACAO/... tables=INOVACAO_INICIATIVAS,INOVACAO_LOGS dumpfile=legado_backup_$(date +%Y%m%d).dmp`
├── [DB]  Verificar integridade do dump: `impdp ... sqlfile=verify_legado.sql` (apenas verifica, não importa)
├── [DB]  Executar rename: `ALTER TABLE INOVACAO_INICIATIVAS RENAME TO INOVACAO_INICIATIVAS_LEGADO`
├── [DB]  Executar rename: `ALTER TABLE INOVACAO_LOGS RENAME TO INOVACAO_LOGS_LEGADO`
├── [BE]  Subir aplicação e verificar que não há erros relacionados às tabelas legadas
├── [OPS] Documentar localização do dump e data programada de DROP: {data do rename + 90 dias}
└── [TEST] `grep -r "INOVACAO_INICIATIVAS\b\|INOVACAO_LOGS\b" backend/src/` (sem _LEGADO) → vazio
       Aplicação funcionando normalmente após o rename
```

---

## Resumo de Tarefas por Camada

| Fase | [BE] | [FE] | [DB] | [OPS] | [TEST] | Total |
|---|---|---|---|---|---|---|
| E0 | 9 | 0 | 0 | 10 | 7 | 26 |
| E1 | 3 | 0 | 35 | 0 | 12 | 50 |
| E2 | 28 | 23 | 0 | 1 | 18 | 70 |
| E3 | 22 | 9 | 0 | 2 | 12 | 45 |
| E4 | 15 | 12 | 0 | 0 | 7 | 34 |
| E5 | 8 | 0 | 8 | 5 | 6 | 27 |
| **Total** | **85** | **44** | **43** | **18** | **62** | **252** |