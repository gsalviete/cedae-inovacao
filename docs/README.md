# CEDAE Inovação — Documentação do Projeto
**Versão:** 1.0  
**Data:** 2026-06-24  
**Fase atual:** Pré-implementação — todos os artefatos de planejamento concluídos

> **Nota (2026-07-29):** este índice reflete a fase de planejamento. O sistema já
> está implementado (ADR-001 a ADR-015). Para entender **o produto hoje**, comece
> pelos dois documentos abaixo.

---

## Comece por aqui

| Documento | Para quê |
|---|---|
| [`visao-geral-do-produto.md`](visao-geral-do-produto.md) | O que o sistema faz, qual dor mitiga, as quatro vias de captação, ciclo de vida, papéis e indicadores. **Documento de negócio — não exige conhecimento técnico** |
| [`dicionario-de-dados.md`](dicionario-de-dados.md) | Modelo de dados campo a campo: tabelas, colunas, domínios de valor, regras e pontos de atenção para relatórios |

---

## Fontes de Verdade

Em caso de conflito entre documentos, a hierarquia abaixo define qual prevalece:

```
1. docs/adr/          ← Decisões arquiteturais aprovadas (imutáveis)
2. docs/planning/mvp-scope.md         ← O que entra e o que não entra no MVP
3. docs/planning/technical-task-breakdown.md  ← O que fazer em cada story
4. docs/architecture/database-migration-plan.md  ← Como o banco deve evoluir
```

Documentos de planejamento (roadmap, backlog, épicos) derivam das fontes acima.
Quando houver ambiguidade, consultar a fonte de verdade de maior precedência.

---

## Estrutura de Diretórios

```
docs/
├── adr/                        ← ADRs individuais aprovados (ADR-001 a ADR-015)
│   ├── ADR-001-schema-additive.md
│   ├── ADR-002-dominio-valores.md
│   ├── ADR-002B-status-workflow.md
│   ├── ADR-003-identidade-autenticacao.md
│   ├── ADR-004-workflow-como-dado.md
│   ├── ADR-005-historico-status-imutavel.md
│   ├── ADR-006-feature-flag-parametros.md
│   ├── ADR-007-mecanismo-duplo-autenticacao.md
│   ├── ADR-008-auditoria-duas-camadas.md
│   ├── ADR-009-manter-stack-nestjs.md
│   ├── ADR-010-parametros-sistema.md
│   ├── ADR-011-proponentes-internos-mvp.md
│   ├── ADR-012-ciclo-vida-mvp.md
│   ├── ADR-013-captacao-multicanal.md
│   ├── ADR-014-interface-permissoes-exportacao-email-termos.md
│   └── ADR-015-relevancia-classificacao-reversao-captacao-externa.md
│
├── architecture/               ← Documentos técnicos de arquitetura
│   ├── final-adrs.md           ← Consolidação de todos os ADRs (índice + conteúdo completo)
│   ├── adr-review.md           ← Revisão crítica dos ADRs com impactos e rollback
│   └── database-migration-plan.md  ← DDL, ETL, validações e rollback por fase
│
├── planning/                   ← Planejamento de execução
│   ├── mvp-scope.md            ← IN/OUT do MVP com justificativas
│   ├── implementation-order.md ← Ordem das fases, stories e gates de saída
│   ├── technical-task-breakdown.md  ← Tarefas técnicas por story ([BE][FE][DB][OPS][TEST])
│   └── epic-breakdown.md       ← Objetivos, motivações e critérios de aceite por épico
│
├── execution/                  ← Guias operacionais para implementação
│   ├── claude-rules.md         ← Regras invioláveis de implementação
│   └── claude-task.md          ← Ponto de entrada para o desenvolvedor
│
└── README.md                   ← Este arquivo
```

---

## Ordem de Leitura Recomendada

### Para entender o domínio (contexto histórico)

Estes documentos foram produzidos durante a fase de discovery e não são fontes de verdade, mas fornecem contexto:

1. `current-domain-analysis.md` — análise do domínio atual
2. `business-entities.md` — entidades de negócio identificadas
3. `business-rules.md` — regras explícitas e implícitas
4. `domain-gaps.md` — lacunas identificadas
5. `discovery-questions.md` — perguntas e respostas da fase de discovery

### Para entender as decisões (arquitetura)

1. `docs/architecture/adr-review.md` — revisão crítica com contexto de cada decisão
2. `docs/adr/ADR-001-*.md` a `ADR-015-*.md` — cada decisão individualmente
3. `docs/architecture/final-adrs.md` — visão consolidada de todos os ADRs

### Para iniciar a implementação

1. `docs/execution/claude-task.md` ← **comece aqui**
2. `docs/execution/claude-rules.md`
3. `docs/planning/implementation-order.md`
4. `docs/planning/technical-task-breakdown.md`
5. `docs/architecture/database-migration-plan.md`

---

## Ordem de Implementação (resumo)

| Fase | Épico | Stories | Duração | Gate principal |
|---|---|---|---|---|
| 0 | E0 — Segurança | E0-S01 a S04 | 1 semana | Credenciais removidas; build TypeScript limpo |
| 1 | E1 — Fundação de Dados | E1-S01 a S06 | 4 semanas | ETL validado; queries retornam zero |
| 2 | E2 — Workflow | E2-S01 a S10 | 4 semanas | Assessoria gerencia ciclo de vida no sistema |
| 3 | E3 — Autenticação | E3-S01 a S05 | 3 semanas | Login via USUARIOS; legado removido |
| 4 | E4 — Portfólio | E4-S01 a S03 | 4 semanas | Assessoria gerencia dados sem TI |
| 5 | E5 — Maturidade | E5-S01 a S03 | 2 semanas | Schema legado arquivado; CI/CD ativo |

**Total:** ~18 semanas | 31 stories | 252 tarefas técnicas

---

## Inconsistências Conhecidas (não corrigidas — apenas registradas)

Ver `docs/architecture/inconsistency-report.md` para a lista completa de inconsistências
identificadas na validação dos artefatos.

As inconsistências são menores e não bloqueiam a implementação, mas devem ser
endereçadas durante o desenvolvimento de cada story afetada.