# MVP Scope — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24  
**Baseado em:** final-adrs.md, adr-review.md (respostas DQ-005, 006, 009, 010, 018)

---

## Premissa

O MVP é a menor entrega que resolve o problema central da Assessoria de Inovação: **registrar iniciativas de colaboradores com rastreabilidade, gerenciar o ciclo de aprovação e substituir a planilha como instrumento principal de gestão**.

Tudo que está IN resolve esse problema central. Tudo que está OUT é valor real mas não é bloqueante para o objetivo central.

---

## IN — O que entra no MVP

### Segurança (Fase 0)

| Item | Justificativa |
|---|---|
| Remoção de credenciais do repositório git | Vulnerabilidade ativa; não aguarda planejamento |
| Remoção de `console.log` de senhas | Exposição de credenciais em logs de produção |
| Rotação de JWT_SECRET e senha Oracle | Segredos comprometidos devem ser rotacionados |
| Rate limiting no endpoint de login (5 tentativas/60s) | Endpoint sem proteção contra força bruta |
| TypeScript strict mode (`strictNullChecks`, `noImplicitAny`) | Erros silenciosos em compilação viram bugs em produção |
| Remoção de `passport-local` (dependência morta) | Superfície de ataque desnecessária |

### Banco de dados — Schema novo (Fase 1)

| Tabela | Justificativa |
|---|---|
| `DOMINIO_VALORES` | Fonte única de verdade para enums; habilita dropdowns dinâmicos |
| `STATUS_WORKFLOW` | Gerencia os estados do ciclo de vida separadamente dos enums |
| `CANAIS_CAPTACAO` | Rastreabilidade de origem; populada com VIA_2 apenas |
| `PARAMETROS_SISTEMA` | Feature flag da migração + configurações operacionais |
| `UNIDADES_ORGANIZACIONAIS` | Área proponente como entidade controlada (substitui texto livre) |
| `PERFIS_ACESSO` | Define os papéis disponíveis no RBAC |
| `USUARIOS` | Identidade persistida; âncora para autenticação e auditoria |
| `USUARIOS_PERFIS` | Associação N:M entre usuários e perfis |
| `PROPONENTES` | Identidade do proponente como entidade (tipo INTERNO apenas) |
| `TRANSICOES_STATUS` | Regras do workflow como dado configurável |
| `INICIATIVAS` | Tabela central com estrutura TO-BE completa |
| `HISTORICO_STATUS` | Auditoria imutável do ciclo de vida |
| `INICIATIVAS_SUPORTES` | Substitui SUPORTE_NECESSARIO pipe-delimited |
| `INVESTIMENTOS` | Substitui VALOR_APORTE como texto livre |
| `ANOTACOES` | Separa comentários do proponente de notas internas da Assessoria |
| `AUDITORIA_LOGS` | Auditoria técnica de operações de escrita |
| Colunas nullable em `INOVACAO_INICIATIVAS` | Bridge entre schema legado e novo durante coexistência |

### ETL — Migração de dados históricos (Fase 1)

| Item | Justificativa |
|---|---|
| Geração de CODIGO_PUBLICO retroativo para registros existentes | Rastreabilidade de iniciativas já registradas |
| Criação de PROPONENTES a partir de texto livre existente | Normalização do histórico |
| Criação de UNIDADES_ORGANIZACIONAIS a partir de texto livre | Normalização do histórico |
| Explosão de SUPORTE_NECESSARIO pipe-delimited para INICIATIVAS_SUPORTES | Dados estruturados recuperáveis |
| Migração de VALOR_APORTE para INVESTIMENTOS | Dados financeiros com semântica |
| Migração de COMENTARIOS_ADICIONAIS para ANOTACOES | Separação de autoria e visibilidade |
| Registro inicial em HISTORICO_STATUS para cada iniciativa existente | Linha do tempo auditável desde o início |
| Mapeamento de status legado → APROVADA/REPROVADA/EM_ANALISE | Ciclo de vida retroativo |

### Formulário público Via 2 (Fase 2)

| Item | Justificativa |
|---|---|
| Exibição de CODIGO_PUBLICO após submissão | Proponente precisa de número de protocolo |
| Campo de área como dropdown alimentado por API | Elimina texto livre inconsistente |
| Suporte como array no payload (não string pipe-delimited) | Normalização dos dados na entrada |
| Gravação em tabela INICIATIVAS controlada por feature flag | Core da migração additive |

### Painel administrativo — Ciclo de vida (Fase 2)

| Item | Justificativa |
|---|---|
| Tela de listagem de iniciativas com filtros e paginação | Gestão básica do portfólio |
| Tela de detalhe da iniciativa com todos os campos | Visualização completa para análise |
| Controles de transição de status (Iniciar Análise, Aprovar, Reprovar) | Núcleo do workflow da Assessoria |
| Campo de justificativa obrigatório na reprovação | Regra de negócio confirmada |
| Timeline do histórico de status | Rastreabilidade da decisão |
| KPIs via SQL GROUP BY (não em memória JS) | Corrige problema de performance atual |
| Endpoint GET /api/iniciativas protegido por autenticação | Dado sensível não deve ser público |

### Autenticação e RBAC (Fase 3)

| Item | Justificativa |
|---|---|
| Autenticação via tabela USUARIOS + bcrypt | Substitui autenticação frágil via env vars |
| JWT payload com `user_id`, `perfis[]`, `area_id` | Suporta RBAC e rastreabilidade por usuário |
| RolesGuard substituindo AdminGuard | Guard unificado, correto e baseado em perfis |
| Mecanismo duplo de autenticação por 1 semana | Transição sem risco de lockout |
| Remoção do mecanismo legado após validação | Elimina superfície de ataque dupla |
| Tela de gestão de usuários no painel admin | Administrador cria e gerencia contas sem TI |
| Perfis: ADMINISTRADOR, ANALISTA_ASSESSORIA, GESTOR_AREA | Suficiente para o MVP |

### Enriquecimento do portfólio (Fase 4)

| Item | Justificativa |
|---|---|
| Gestão de investimento com versão, fonte e status | Dados financeiros com contexto real |
| Anotações com tipo e visibilidade (pública/interna) | Notas da Assessoria separadas de comentários do proponente |
| Gestão de dados de referência via painel admin | Assessoria gerencia enums sem intervenção técnica |
| ANOTACAO tipo COMUNICADO visível ao proponente | Canal de comunicação básico com o proponente |

### Maturidade operacional (Fase 5)

| Item | Justificativa |
|---|---|
| Connection pool Oracle | Elimina overhead de conexão por request |
| Pipeline CI/CD básico (lint, typecheck, build) | Qualidade mínima de entrega |
| Arquivamento controlado das tabelas legadas | Encerra a coexistência de schemas |
| Dashboard com métricas completas do portfólio | Visibilidade executiva para a Assessoria |

---

## OUT — O que fica para backlog futuro

### Estados adicionais do ciclo de vida

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| Estado RASCUNHO (formulário incompleto) | Processo atual não tem rascunho; formulário é submit-ou-nada | Quando houver demanda de "salvar e continuar depois" |
| Estado DEVOLVIDA para complementação | Não está no fluxo confirmado (DQ-005) | Quando a Assessoria precisar solicitar informações adicionais formalmente |
| Estado SUSPENSA | Não está no fluxo confirmado | Quando houver casos de suspensão de iniciativas |
| Estado CONCLUIDA | Não está no fluxo confirmado | Quando o processo de encerramento positivo for definido |
| Estado CANCELADA | Não está no fluxo confirmado | Junto com estado RASCUNHO |
| Reabertura de iniciativa REPROVADA | Caso excepcional; não há demanda confirmada | Quando houver primeiro caso real |

### Canais de captação

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| Via 1 (critério financeiro) | Confirmado que não será usado (DQ-010) | Se houver mudança de escopo |
| Via 3 (rito simplificado) | Confirmado que não será usado (DQ-010) | Se houver mudança de escopo |
| Mapeamento Externo | Confirmado como irrelevante (DQ-009) | Se houver parceiros externos que precisem submeter iniciativas |
| Proponentes tipo EXTERNO | Sem canal externo, sem necessidade de proponentes externos | Junto com Mapeamento Externo |

### Alinhamento estratégico

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| METAS_ESTRATEGICAS (tabela) | Estrutura pode ser criada, mas sem interface no MVP | Quando o PE for publicado e formalizado |
| INICIATIVAS_METAS (associativa) | Sem METAS_ESTRATEGICAS ativas, sem associação | Junto com METAS_ESTRATEGICAS |
| Painel ODS no dashboard | Sem dados, sem painel | Junto com METAS_ESTRATEGICAS |
| Alinhamento com Plano Estratégico | Fonte de PE não identificada (DQ-018) | Quando PE for documentado e formalizado |

### Relacionamentos entre iniciativas

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| RELACIONAMENTOS_INICIATIVAS | Útil mas não urgente; sem demanda confirmada no MVP | Quando houver primeiro caso de iniciativa duplicada que precise ser vinculada |

### Identidade e autenticação avançada

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| Integração com LDAP/Active Directory | Ainda não há prazo ou plano da TI corporativa | Quando TI definir o roadmap de identidade |
| Integração com SSO | Após LDAP/AD | Após integração LDAP/AD |
| Just-in-time provisioning | Depende de AD | Junto com integração LDAP/AD |
| Acesso do proponente ao sistema pós-submissão | Não confirmado como requisito (DQ-013 não respondida) | Quando houver demanda de acompanhamento pelo proponente |

### Notificações

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| Notificação por e-mail ao proponente em mudança de status | `notificar_proponente` existe em TRANSICOES_STATUS mas o motor de envio não é construído | Quando servidor SMTP e template de e-mail forem definidos |
| Notificação por e-mail ao analista em nova submissão | Mesma razão | Junto com o motor de notificações |

### Infraestrutura avançada

| Item | Justificativa da exclusão | Quando revisar |
|---|---|---|
| Testes automatizados (unitários e de integração) | Não existe cobertura atual; pipeline básico sem testes é o primeiro passo | Fase seguinte ao MVP estável |
| Versionamento de formulário (TEMPLATE_FORMULARIO) | Sem múltiplas versões ativas, sem necessidade | Quando o formulário Via 2 precisar de uma versão 2 |
| Exportação de relatórios (PDF, Excel) | Sem demanda confirmada | Quando a Assessoria precisar de relatórios formais |
| Oracle VPD (row-level security no banco) | Implementado na camada de aplicação por ora; VPD é mais robusto mas exige trabalho de DBA | Quando o volume de usuários e dados justificar |
| Particionamento de AUDITORIA_LOGS | Sem volume que justifique agora | Quando o volume de logs ultrapassar 1M de registros |

---

## Resumo Quantitativo

| Categoria | IN | OUT | Total |
|---|---|---|---|
| Segurança | 6 | 0 | 6 |
| Schema (tabelas) | 16 | 3 | 19 |
| ETL | 8 | 0 | 8 |
| Formulário | 4 | 0 | 4 |
| Painel admin | 7 | 0 | 7 |
| Autenticação/RBAC | 7 | 5 | 12 |
| Enriquecimento | 4 | 7 | 11 |
| Maturidade | 5 | 8 | 13 |
| **Total** | **57** | **23** | **80** |

**71% dos itens identificados entram no MVP.** Os 29% excluídos são features de valor real mas sem bloqueio para o objetivo central — e todas têm critério explícito de quando revisar a inclusão.