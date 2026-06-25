# Plano de Release — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24  
**Horizonte:** 6 fases (~18 semanas)

---

## Visão Geral do Calendário

```
SEM  1    | SEM  2-5   | SEM  6-9   | SEM 10-12  | SEM 13-16  | SEM 17-18
──────────┼────────────┼────────────┼────────────┼────────────┼──────────
FASE 0    │ FASE 1     │ FASE 2     │ FASE 3     │ FASE 4     │ FASE 5
Segurança │ Fundação   │ Workflow   │ Auth &     │ Portfolio  │ Maturidade
Emergenc. │ de Dados   │ & Ciclo    │ RBAC       │ Avançado   │ & Legado
──────────┼────────────┼────────────┼────────────┼────────────┼──────────
E0: 4 str │ E1: 6 str  │ E2: 10 str │ E3: 5 str  │ E4: 3 str  │ E5: 3 str
```

---

## FASE 0 — Segurança Emergencial

**Duração:** 1 semana  
**Épicos:** E0  
**Stories:** E0-S01, E0-S02, E0-S03, E0-S04

### Objetivo

Eliminar todas as vulnerabilidades críticas de segurança identificadas no sistema atual sem alterar nenhum comportamento funcional. O sistema continua operando exatamente como hoje, porém sem expor credenciais, sem aceitar ataques de força bruta e com TypeScript em modo seguro.

### Entregáveis

| Entregável | Verificação |
|---|---|
| `.env` removido do repositório e histórico git | `git log --all -- .env` retorna zero commits com o arquivo |
| JWT_SECRET com 32+ chars aleatórios | `echo $JWT_SECRET \| wc -c` retorna ≥ 33 |
| Senha Oracle rotacionada | DBA confirma nova senha ativa |
| Rate limiting no login | `curl -X POST /api/auth/login` 6 vezes → 6ª retorna 429 |
| Zero logs com credenciais | Grep nos logs do container após login bem-sucedido |
| Build TypeScript strict | `pnpm run build` sem erros |
| `passport-local` removido | `grep "passport-local" package.json` retorna vazio |

### Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Rotação do JWT_SECRET invalida sessões ativas | Alta | Informar o admin antes; ele faz novo login imediatamente após |
| Strict mode TypeScript revela muitos erros | Média | Reservar 2 dias para correções; não suprimir com @ts-ignore |
| DBA indisponível para rotação da senha Oracle | Baixa | Agendar com antecedência antes de iniciar a fase |

### Critérios de saída (gate para Fase 1)

- [ ] Todos os 4 critérios de aceite das stories E0-S01 a E0-S04 verificados
- [ ] Formulário público funciona normalmente após as mudanças
- [ ] Painel admin funciona normalmente (admin faz login com JWT_SECRET novo)
- [ ] Nenhum incidente aberto relacionado às mudanças desta fase

### Critérios para iniciar Fase 1

- [ ] Gate da Fase 0 aprovado
- [ ] Lista de gerências/diretorias fornecida pela Assessoria para seed de UNIDADES_ORGANIZACIONAIS
- [ ] DBA disponível para executar scripts DDL no banco de produção
- [ ] Senha do usuário administrador inicial definida e comunicada ao responsável

---

## FASE 1 — Fundação de Dados

**Duração:** 4 semanas  
**Épicos:** E1  
**Stories:** E1-S01 a E1-S06

### Objetivo

Criar o schema TO-BE completo em paralelo ao schema legado. Migrar todos os dados históricos. Garantir que o sistema legado continua funcionando sem interrupção durante todo o processo.

### Entregáveis

| Entregável | Verificação |
|---|---|
| 15 tabelas novas criadas no banco | `SELECT table_name FROM user_tables WHERE table_name NOT LIKE 'INOVACAO%' ORDER BY 1` |
| Seed data em todas as tabelas de referência | Contagem de registros em DOMINIO_VALORES (≥30), STATUS_WORKFLOW (4), etc. |
| Usuário admin seed em USUARIOS | `SELECT id, login, ativo FROM USUARIOS WHERE perfil = 'ADMINISTRADOR'` |
| ETL executado e validado | Todas as 7 queries de validação retornam 0 |
| Relatório de curadoria revisado pela Assessoria | Documento aprovado e arquivado |
| Tabela INICIATIVAS criada com trigger de CODIGO_PUBLICO | INSERT teste gera código no formato esperado |
| Sistema legado funcionando | Submissão de formulário gera registro em INOVACAO_INICIATIVAS normalmente |

### Semana a semana

**Semana 2:** E1-S01 (tabelas de referência) + E1-S02 (identidade + seed admin)  
**Semana 3:** E1-S03 (transacionais + trigger) + E1-S04 (ALTER TABLE legado)  
**Semana 4:** E1-S05 (ETL — execução no banco de desenvolvimento) + curadoria com a Assessoria  
**Semana 5:** E1-S06 (tabela INICIATIVAS) + validação final + ETL em produção

### Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| ETL gera proponentes duplicados | Alta | Relatório de curadoria + revisão manual antes de produção |
| ALTER TABLE em produção exige downtime | Baixa | Colunas nullable são instantâneas em Oracle; executar em horário de baixo tráfego |
| Assessoria não disponível para curadoria na semana 4 | Média | Agendar na semana 2; não prosseguir para produção sem aprovação |

### Critérios de saída (gate para Fase 2)

- [ ] Todas as queries de validação pós-ETL retornam 0
- [ ] Relatório de curadoria do ETL aprovado pela Assessoria
- [ ] Sistema legado funcionando normalmente após todas as mudanças de banco
- [ ] Tabela INICIATIVAS vazia e pronta para receber dados
- [ ] Feature flag `FORMULARIO_DESTINO_TABELA = 'LEGADO'` confirmado em PARAMETROS_SISTEMA

### Critérios para iniciar Fase 2

- [ ] Gate da Fase 1 aprovado
- [ ] Ciclo de vida MVP validado com a equipe do painel admin (estados e transições confirmados)
- [ ] Ambiente de desenvolvimento apontando para o novo schema

---

## FASE 2 — Workflow e Ciclo de Vida

**Duração:** 4 semanas  
**Épicos:** E2  
**Stories:** E2-S01 a E2-S10

### Objetivo

Implementar o ciclo de vida completo das iniciativas. A Assessoria passa a gerenciar o portfólio no sistema (não mais na planilha). O formulário exibe número de protocolo. O endpoint de listagem é protegido.

### Entregáveis

| Entregável | Verificação |
|---|---|
| WorkflowModule funcional | Transições SUBMETIDA→EM_ANALISE, EM_ANALISE→APROVADA, EM_ANALISE→REPROVADA funcionando |
| Feature flag NOVO ativo em produção | Novas submissões gravadas em INICIATIVAS (não INOVACAO_INICIATIVAS) |
| CODIGO_PUBLICO exibido no formulário | Submissão de teste → tela de sucesso mostra "INOV-2026-00X" |
| Tela de detalhe no painel admin | Clique em iniciativa → tela completa com timeline |
| Controles de workflow funcionando | ANALISTA consegue aprovar e reprovar no painel |
| KPIs via SQL | Verificar EXPLAIN PLAN do endpoint /api/admin/kpis |
| GET /api/iniciativas protegido | curl sem token retorna 401 |
| Dropdown de área no formulário | Campo populado com áreas do banco |

### Semana a semana

**Semana 6:** E2-S01 (WorkflowModule) + E2-S02 (IniciativasService com flag)  
**Semana 7:** E2-S03 (PATCH status) + E2-S04 (GET histórico) + E2-S05 (listar refatorado) + E2-S06 (KPIs SQL) + E2-S10 (reference endpoint)  
**Semana 8:** E2-S07 (frontend formulário) + E2-S08 (tela detalhe + workflow)  
**Semana 9:** E2-S09 (proteger GET + coordenar deploy) + ativação do flag `NOVO` + monitoramento 24h

### Deploy crítico da Fase 2

E2-S08 e E2-S09 devem ser deployadas no mesmo ciclo de release. A proteção do endpoint e a atualização do frontend que envia o token são inseparáveis. Deploy separado quebraria o painel admin.

### Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Feature flag NOVO redireciona submissões erradas | Média | Monitorar COUNT de INICIATIVAS por 24h; rollback se não crescer |
| Workflow não reflete o processo real da Assessoria | Média | Workshop de validação antes de implementar E2-S01 |
| Deploy de E2-S08+E2-S09 incompleto (um deploy, não dois) | Alta (risco de processo) | CI/CD garante que os dois fazem parte do mesmo merge request |

### Critérios de saída (gate para Fase 3)

- [ ] Feature flag `NOVO` ativo em produção por 48h sem incidentes
- [ ] Pelo menos 1 iniciativa real aprovada/reprovada pela Assessoria usando o novo sistema
- [ ] COUNT de INOVACAO_INICIATIVAS não cresceu após ativação do flag
- [ ] Planilha Excel confirmada como "somente leitura" pela Assessoria — sistema é agora a fonte de verdade

### Critérios para iniciar Fase 3

- [ ] Gate da Fase 2 aprovado
- [ ] Confirmação de que o usuário admin seed em USUARIOS funciona para login (E3-S01 pré-requisito)
- [ ] Senha do usuário admin em USUARIOS conhecida pelo responsável técnico

---

## FASE 3 — Autenticação Robusta e RBAC

**Duração:** 3 semanas  
**Épicos:** E3  
**Stories:** E3-S01 a E3-S05

### Objetivo

Substituir autenticação via env vars por USUARIOS + bcrypt. Implementar RBAC com perfis individuais. Múltiplos analistas da Assessoria passam a ter contas individuais rastreáveis.

### Entregáveis

| Entregável | Verificação |
|---|---|
| Login via USUARIOS + bcrypt funcional | Login com conta seed em USUARIOS funciona |
| Mecanismo duplo ativo (1 semana) | Log de warning aparece ao usar credenciais legadas |
| RolesGuard ativo, AdminGuard removido | `grep -r "AdminGuard" backend/src/` retorna vazio |
| JWT com novo payload | Decodificar token: ver `sub`, `perfis[]`, `area_id` |
| Tela de usuários no painel admin | ADMINISTRADOR consegue criar e desativar contas |
| Mecanismo legado removido | Login com env vars retorna 401 |

### Semana a semana

**Semana 10:** E3-S01 (mecanismo duplo) + E3-S02 (RolesGuard + JwtStrategy)  
**Semana 11:** E3-S03 (UsersModule backend) + E3-S04 (tela de usuários frontend)  
**Semana 12:** Monitoramento de 1 semana do mecanismo duplo → E3-S05 (remoção do legado)

### Prazo crítico

E3-S05 tem prazo máximo de 1 semana após E3-S01 em produção. O comentário `// TEMPORÁRIO: remover em E3-S05` deve ter data explícita no código.

### Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Admin perde acesso durante transição | Baixa | Mecanismo duplo garante que credenciais legadas ainda funcionam durante a semana |
| Mudança de payload JWT quebra frontend | Média | Deploy coordenado: backend (novo payload) + frontend (novo sessionStorage) juntos |
| E3-S05 postergado indefinidamente | Média | Data limite explícita no ticket antes de deployar E3-S01 |

### Critérios de saída (gate para Fase 4)

- [ ] Zero ocorrências de `[WARN] Autenticação via credencial legada` nos logs das últimas 24h
- [ ] `ADMIN_USERNAME` e `ADMIN_PASSWORD` não existem em nenhum arquivo do repositório
- [ ] Pelo menos 2 usuários (além do admin) com contas individuais e perfis distintos criados
- [ ] Todos os acessos ao painel são rastreados por `usuario_id` específico em AUDITORIA_LOGS

### Critérios para iniciar Fase 4

- [ ] Gate da Fase 3 aprovado
- [ ] Lista de ODS fornecida (se relevante) ou confirmação de exclusão do MVP

---

## FASE 4 — Portfólio Avançado

**Duração:** 4 semanas  
**Épicos:** E4  
**Stories:** E4-S01, E4-S02, E4-S03

### Objetivo

Adicionar gestão financeira estruturada, anotações com visibilidade controlada e administração de dados de referência sem intervenção técnica. A Assessoria tem controle total sobre os dados do sistema.

### Entregáveis

| Entregável | Verificação |
|---|---|
| Gestão de investimento com versão | Nova versão de orçamento criada na tela de detalhe |
| Anotações com visibilidade | Nota interna não visível para GESTOR_AREA |
| Dashboard com investimento total | `/api/admin/kpis` inclui `investimento_total` |
| Gestão de DOMINIO_VALORES no admin | Admin adiciona novo tipo de suporte → aparece no formulário |
| Gestão de UNIDADES_ORGANIZACIONAIS | Admin adiciona nova área → aparece no dropdown do formulário |

### Semana a semana

**Semana 13:** E4-S01 (investimentos)  
**Semana 14:** E4-S02 (anotações)  
**Semana 15-16:** E4-S03 (gestão de dados de referência — maior esforço)

### Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Gestão de referência com validação insuficiente | Média | Constraint de integridade no banco antes de permitir desativação |
| Versionamento de investimento confuso para usuário | Baixa | UI mostra claramente "versão atual" vs "histórico" |

### Critérios de saída (gate para Fase 5)

- [ ] Pelo menos 3 iniciativas com dados financeiros registrados no sistema
- [ ] Assessoria confirma que consegue gerenciar todos os dados de referência sem chamar TI
- [ ] Nenhuma escrita em tabelas legadas há pelo menos 7 dias (verificar com query de MAX(CRIADO_EM))

### Critérios para iniciar Fase 5

- [ ] Gate da Fase 4 aprovado
- [ ] 30 dias sem nenhum INSERT em `INOVACAO_INICIATIVAS`
- [ ] Aprovação formal da Assessoria para arquivamento das tabelas legadas
- [ ] Dump de arquivamento das tabelas legadas criado e verificado

---

## FASE 5 — Maturidade Operacional

**Duração:** 2 semanas  
**Épicos:** E5  
**Stories:** E5-S01, E5-S02, E5-S03

### Objetivo

Finalizar a infraestrutura operacional (connection pool, CI/CD) e encerrar o schema legado de forma controlada.

### Entregáveis

| Entregável | Verificação |
|---|---|
| Connection pool Oracle ativo | Log no startup: `[DatabaseModule] Pool Oracle inicializado` |
| Pipeline CI/CD executando | GitLab mostra pipeline verde em push para main |
| Tabelas legadas renomeadas | `SELECT table_name FROM user_tables WHERE table_name LIKE '%LEGADO%'` retorna 2 linhas |
| Código sem referências às tabelas legadas | `grep -r "INOVACAO_INICIATIVAS\b" backend/src/` retorna vazio |
| Dashboard completo | KPIs incluem: total, por status, por dimensão, investimento total, tempo médio de análise |

### Semana a semana

**Semana 17:** E5-S01 (connection pool) + E5-S02 (CI/CD)  
**Semana 18:** E5-S03 (arquivamento) — apenas após 30 dias confirmados

### Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Rename das tabelas legadas causa erro em query residual | Baixa | Grep obrigatório antes do rename |
| DROP prematuro antes do prazo de quarentena | Baixa | Data de DROP só definida após rename + 90 dias |

### Critérios de saída (MVP completo)

- [ ] Todas as stories de E5 completas e verificadas
- [ ] `grep -r "INOVACAO_INICIATIVAS\b\|INOVACAO_LOGS\b" backend/src/` retorna vazio (exceto scripts de migration)
- [ ] Pipeline CI/CD verde há pelo menos 5 dias consecutivos
- [ ] Connection pool funcionando sem erros por 48h
- [ ] Dump das tabelas legadas arquivado em local documentado e verificado
- [ ] Data de DROP programada: +90 dias a partir da data do rename
- [ ] Documento de "Encerramento de MVP" assinado pela Assessoria

---

## Checklist de Pré-Deploy por Fase

### Antes de qualquer deploy em produção

- [ ] Deploy testado em ambiente de desenvolvimento/staging
- [ ] Nenhum teste manual de regressão falhou
- [ ] Backup do banco confirmado pelo DBA nas últimas 24h
- [ ] Responsável técnico disponível nos 30 minutos após o deploy para monitoramento
- [ ] Plano de rollback documentado e comunicado ao time

### Deploy de alto risco (coordenação extra)

| Deploy | Por que é alto risco | Verificação extra |
|---|---|---|
| E1-S04 (ALTER TABLE) | Operação DDL em tabela com dados | DBA presente; executar em horário de baixo tráfego |
| E1-S05 (ETL) | Modifica dados históricos | Executar em desenvolvimento primeiro; relatório de curadoria aprovado |
| E2-S09 (proteger GET + frontend) | Breaking change coordenada | Backend e frontend no mesmo deploy; testar painel antes de confirmar |
| E3-S01 (mecanismo duplo) | Mudança no fluxo de autenticação | Admin testa login com USUARIOS antes de confirmar o deploy |
| E3-S05 (remover legado auth) | Único caminho de autenticação | Confirmação documentada de login via USUARIOS nas últimas 24h |
| E5-S03 (rename tabelas) | Irreversível sem trabalho | Grep obrigatório; dump obrigatório; aprovação formal |

---

## Mapa de Dependências entre Releases

```
FASE 0
  └─► FASE 1
         └─► FASE 2
                └─► FASE 3
                       └─► FASE 4
                              └─► (30 dias sem escrita em legado)
                                     └─► FASE 5
```

Não há paralelismo obrigatório entre fases. Dentro de cada fase, stories podem ser desenvolvidas em paralelo quando não houver dependência sequencial entre elas (ex: E1-S01 e E1-S02 podem ser desenvolvidas por pessoas diferentes simultaneamente).