# Execução — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24

---

## Leitura obrigatória antes de implementar qualquer story

Leia os seguintes documentos **nesta ordem** antes de escrever qualquer linha de código:

1. `docs/execution/claude-rules.md` — regras invioláveis de implementação
2. `docs/planning/mvp-scope.md` — o que está e o que não está no escopo
3. `docs/planning/implementation-order.md` — ordem das fases, gates e alertas de deploy
4. `docs/planning/technical-task-breakdown.md` — tarefas técnicas detalhadas por story
5. `docs/architecture/database-migration-plan.md` — DDL, ETL e validações do banco
6. `docs/adr/*` — todas as decisões arquiteturais aprovadas

---

## Regras de execução

- Executar **apenas uma story por vez**.
- Nunca avançar automaticamente para a próxima story.
- Nunca implementar duas stories simultaneamente.
- Respeitar todos os ADRs e o escopo do MVP.
- Qualquer desvio de um ADR aprovado deve ser sinalizado imediatamente antes de prosseguir.

---

## Fluxo por story

```
1. Ler a descrição completa da story em implementation-backlog.md
2. Ler as tarefas técnicas correspondentes em technical-task-breakdown.md
3. Verificar se há dependências de banco em database-migration-plan.md
4. Implementar todas as tarefas da story
5. Executar os comandos de validação descritos nos critérios de aceite
6. Apresentar:
   - Lista de arquivos alterados (com descrição de cada mudança)
   - Decisões tomadas não previstas na story
   - Resultado dos comandos de validação
7. Aguardar aprovação explícita
```

---

## Story inicial

```
E0-S01 — Remover credenciais do repositório git
```

Referência: `docs/planning/implementation-backlog.md` → seção E0-S01  
Tarefas técnicas: `docs/planning/technical-task-breakdown.md` → seção E0-S01

---

## Referência rápida: IDs de todas as stories

```
FASE 0:  E0-S01  E0-S02  E0-S03  E0-S04
FASE 1:  E1-S01  E1-S02  E1-S03  E1-S04  E1-S05  E1-S06
FASE 2:  E2-S01  E2-S02  E2-S03  E2-S04  E2-S05
         E2-S06  E2-S07  E2-S08  E2-S09  E2-S10
FASE 3:  E3-S01  E3-S02  E3-S03  E3-S04  E3-S05
FASE 4:  E4-S01  E4-S02  E4-S03
FASE 5:  E5-S01  E5-S02  E5-S03
```

Total: 31 stories em 6 fases.