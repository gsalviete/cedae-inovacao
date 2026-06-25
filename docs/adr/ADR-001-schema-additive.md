## ADR-001 — Schema Additive: Construção Paralela do Modelo TO-BE

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** E1, E2, E3, E4, E5

### Decisão

Criar o novo schema Oracle em paralelo ao schema existente. A aplicação migra gradualmente de um schema para o outro, controlada por feature flag em PARAMETROS_SISTEMA. As tabelas legadas só são removidas após 30 dias de produção estável no novo schema, seguidos de 90 dias de quarentena com rename.

### Contexto

O sistema está em produção com dados reais. O schema atual (2 tabelas planas) é estruturalmente diferente do schema TO-BE (13 tabelas com relacionamentos). A migração precisa acontecer sem downtime e com rollback disponível em qualquer etapa.

### Alternativas rejeitadas

- **Big bang migration**: risco de downtime e perda de dados; rollback complexo. REJEITADO.
- **Shadow writes**: complexidade operacional alta; risco de inconsistência entre schemas. REJEITADO.

### Regras de implementação

1. Nunca remover ou renomear colunas das tabelas legadas até a Fase 5
2. Colunas adicionadas a tabelas existentes são sempre nullable (não quebram INSERTs legados)
3. ETL deve ser idempotente — re-execução não duplica dados
4. O feature flag `FORMULARIO_DESTINO_TABELA` controla o destino das submissões
5. O código do caminho legado deve ter comentário: `// TODO: remover após Fase 5 — [data-limite]`

### Rollback por fase

| Fase | Mecanismo | Tempo | Perda de dados |
|---|---|---|---|
| Fase 1 | DROP tabelas novas | < 5 min | Nenhuma |
| Fase 2 | Flag → LEGADO | < 1 min | Submissões no período (reconciliar) |
| Fase 5 (rename) | Rename de volta | < 5 min | Nenhuma |
| Fase 5 (DROP) | **Sem rollback** — dump obrigatório | N/A | N/A |

---