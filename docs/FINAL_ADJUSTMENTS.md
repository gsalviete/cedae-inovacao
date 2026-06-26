# FINAL_ADJUSTMENTS.md
**Versão:** MVP-1  
**Data:** 2026-06-25  
**Status:** Pronto para testes manuais

---

## 1. Escopo implementado (MVP-1)

| Funcionalidade | Status |
|---|---|
| Login (dual auth: DB + env-var fallback) | ✅ |
| Seed automático do usuário admin na inicialização | ✅ |
| Cadastro de iniciativa (formulário público) | ✅ |
| Listagem de iniciativas no painel admin | ✅ |
| Detalhamento de iniciativa (`/admin-detalhe?id=X`) | ✅ |
| Workflow: SUBMETIDA → EM_ANALISE → APROVADA/REPROVADA | ✅ |
| Histórico imutável de transições (HISTORICO_STATUS) | ✅ |
| Gestão de usuários (criar, listar, ativar/desativar) | ✅ |
| KPIs com distribuição por status de workflow | ✅ |

---

## 2. Migrações criadas nesta fase (E1-S01 + MVP)

| Arquivo | Tabela | Observação |
|---|---|---|
| V01 | DOMINIO_VALORES | Seeds: 7 domínios, 24 valores |
| V02 | STATUS_WORKFLOW | Seeds: 4 estados |
| V03 | CANAIS_CAPTACAO | Seeds: 4 canais (apenas VIA_2 ativo) |
| V04 | PERFIS_ACESSO | Seeds: 5 perfis |
| V05 | PARAMETROS_SISTEMA | Seeds: 6 parâmetros, incl. FORMULARIO_DESTINO_TABELA='LEGADO' |
| V06 | UNIDADES_ORGANIZACIONAIS | Tabela vazia (seed após dados da Assessoria) |
| V08 | USUARIOS | Inclui senha_hash (bcrypt) — ADR-003 |
| V09 | USUARIOS_PERFIS | FKs para USUARIOS + PERFIS_ACESSO |
| V12 | TRANSICOES_STATUS | Regras de workflow como dados |
| V13 | (seed) | 3 transições MVP: SUBMETIDA→EM_ANALISE, EM_ANALISE→{APROVADA,REPROVADA} |
| V14 | HISTORICO_STATUS | Trigger imutabilidade + view VW_HISTORICO_ATIVO |
| V19 | (ALTER) | Adiciona STATUS, ANALISTA_ID, ATUALIZADO_EM, CODIGO_PUBLICO ao INOVACAO_INICIATIVAS |

**Ordem de execução obrigatória:** V01→V02→V03→V04→V05→V06→V08→V09→V12→V13→V14→V19

---

## 3. Decisões de arquitetura desta fase

### 3.1 FORMULARIO_DESTINO_TABELA = 'LEGADO'
Mantido. IniciativasService ainda grava em INOVACAO_INICIATIVAS. Não altera ADR-006.

### 3.2 Autenticação dual (temporária)
AuthService tenta USUARIOS primeiro. Se o usuário não existe no banco (tabela ainda não criada ou sem registro), cai no fallback de env-var `ADMIN_USERNAME/ADMIN_PASSWORD`.  
**Remoção planejada:** E3-S05.

### 3.3 JWT Payload ampliado
`{ sub: string|number, login: string, perfis: string[], is_admin: boolean }`  
Compatível retroativamente: tokens legados (apenas `sub`, `is_admin`) continuam sendo aceitos; `perfis` vira `[]` e `login` vira `String(sub)` no `jwt.strategy.ts`.

### 3.4 WorkflowService: ADMINISTRADOR sobrepõe perfil requerido
Se `perfis.includes('ADMINISTRADOR')`, qualquer transição válida na tabela TRANSICOES_STATUS é permitida, independente do `perfil_requerido`. Decisão de MVP para o usuário admin da env-var.

### 3.5 HISTORICO_STATUS.usuario_id nullable
Submissões via formulário público geram `usuario_id = NULL`. Aceitável para MVP; FK formal adicionada em V29.

### 3.6 seedAdminIfEmpty em OnModuleInit
Se a tabela USUARIOS existir e o login `ADMIN_USERNAME` não existir, o usuário é criado com bcrypt hash da `ADMIN_PASSWORD`. Falhas são silenciosas (log de warning apenas) — não impedem o boot.

### 3.7 Tela de detalhe usa mapeamento estático de transições
`detalhe.js` usa um mapa fixo `SUBMETIDA→[EM_ANALISE], EM_ANALISE→[APROVADA,REPROVADA]` para renderizar os botões de ação. O endpoint `PATCH /api/iniciativas/:id/status` ainda valida as regras reais em TRANSICOES_STATUS (segurança no backend). MVP simples sem chamar `getTransicoesDisponiveis()` do servidor.

---

## 4. Divergências ADR

| ADR | Decisão no MVP | Motivo |
|---|---|---|
| ADR-002B | STATUS em INOVACAO_INICIATIVAS (coluna bridge) em vez de tabela separada | Legado — coluna STATUS adicionada via V19; tabela INICIATIVAS completa é E2-S01 |
| ADR-003 | Perfis SUPERVISOR_ASSESSORIA e PROPONENTE_EXTERNO criados mas sem UI | Estágio dormant; UI em E3-S04 |
| ADR-010 | PARAMETROS_SISTEMA criados mas sem tela de edição | Tela de configurações é E4-S02 |

---

## 5. Ajustes técnicos Oracle

- `LISTAGG(...) WITHIN GROUP (ORDER BY ...)` com `NVL(..., '')` para USUARIOS sem perfis (evita `NULL` no split).
- `EXECUTE IMMEDIATE` com literais string dobrados (`''valor''`) em constraints CHECK (V01–V14).
- `RETURNING id INTO :N` com `{ dir: BIND_OUT, type: NUMBER }` para obter o ID gerado.
- Trigger em HISTORICO_STATUS usa acentos removidos nas mensagens de erro (Oracle rejeita acentos em mensagens RAISE_APPLICATION_ERROR sem NLS configurado).
- `ORA-00942` (tabela inexistente) capturado em `findUserByLogin` — permite boot sem as tabelas de usuários criadas.

---

## 6. Itens pendentes para próximas etapas

### Técnico (dívida)
- [ ] **E5-S01** — Migrar DatabaseService de conexão única para pool (`oracledb.createPool`). Conexão única causa contenção em produção.
- [ ] **E3-S05** — Remover fallback de autenticação por env-var; todo acesso passa pelo banco.
- [ ] **V29** — Adicionar FKs diferidas: `USUARIOS_PERFIS.concedido_por_id → USUARIOS`, `HISTORICO_STATUS.iniciativa_id → INICIATIVAS`, `PARAMETROS_SISTEMA.atualizado_por_id → USUARIOS`.
- [ ] Testes unitários e de integração (nenhum script `test` configurado).
- [ ] CSRF protection (baixo risco para MVP sem cookies de sessão; `sessionStorage` não é enviado automaticamente).

### Funcional (negócio)
- [ ] **E2-S01** — Criar tabela INICIATIVAS completa e migrar dados do legacy.
- [ ] **E2-S02** — Formulário multi-etapa com validação completa dos campos.
- [ ] **E2-S09** — Proteger `GET /api/iniciativas` com autenticação.
- [ ] **E3-S02** — Tela de perfil do usuário (alterar senha, dados).
- [ ] **E4-S02** — Tela de configurações dos PARAMETROS_SISTEMA.
- [ ] Envio de e-mail de notificação ao proponente (APROVADA/REPROVADA).
- [ ] Seed de UNIDADES_ORGANIZACIONAIS com a estrutura real da CEDAE.
- [ ] Paginação nas listagens (admin.html carrega tudo de uma vez).

---

## 7. Como executar localmente

```bash
# 1. Configurar .env (backend/)
cp backend/.env.example backend/.env
# Editar: ORACLE_*, JWT_SECRET (≥32 chars), ADMIN_USERNAME, ADMIN_PASSWORD

# 2. Executar migrações no Oracle 19c (na ordem V01→V19)
# Ferramenta: SQL*Plus, SQLcl ou DBeaver

# 3. Iniciar backend
cd backend
pnpm run start

# 4. Acessar
# Formulário público: http://localhost:8095/
# Painel admin:       http://localhost:8095/admin-panel
# Login com:          ADMIN_USERNAME / ADMIN_PASSWORD
```

---

## 8. Rotas da API (MVP-1)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | /api/auth/login | Pública | Autenticação |
| POST | /api/iniciativas | Pública | Submeter iniciativa |
| GET | /api/iniciativas | Pública* | Listar iniciativas |
| GET | /api/iniciativas/:id | AdminGuard | Detalhe da iniciativa |
| GET | /api/iniciativas/:id/historico | AdminGuard | Histórico de status |
| PATCH | /api/iniciativas/:id/status | AdminGuard | Transição de workflow |
| GET | /api/admin/kpis | AdminGuard | KPIs + por_status |
| GET | /api/admin/acessos | AdminGuard | Histórico de logins |
| GET | /api/admin/logs | AdminGuard | Log de sistema |
| GET | /api/admin/users | AdminGuard | Listar usuários |
| POST | /api/admin/users | AdminGuard | Criar usuário |
| PATCH | /api/admin/users/:id/status | AdminGuard | Ativar/desativar usuário |

*Proteção de GET /api/iniciativas planejada para E2-S09.
