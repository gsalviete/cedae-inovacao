## ADR-011 — Proponentes Apenas Internos no MVP

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1, E2  
**Decisão originada em:** Resposta DQ-009/010

### Decisão

No MVP, todos os proponentes são colaboradores internos da CEDAE. A entidade `PROPONENTES` tem `tipo = 'INTERNO'` por padrão. O campo `tipo EXTERNO` existe no schema mas não é utilizado no MVP. Nenhum módulo de "inserção pela Assessoria" para parceiros externos é construído no MVP.

### Regras de implementação

1. `PROPONENTES.tipo` = `INTERNO` para todos os registros criados no MVP
2. Campo `canal_id` em `INICIATIVAS` = ID do canal `VIA_2` em todas as submissões — preenchido automaticamente
3. `CANAIS_CAPTACAO` criada com um único registro ativo: `VIA_2`
4. A estrutura para `EXTERNO` existe no schema — apenas não é populada

---