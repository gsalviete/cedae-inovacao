## ADR-009 — Manter Stack NestJS + OracleDB Thin Mode

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** Todos

### Decisão

A stack tecnológica atual é mantida integralmente: NestJS v10, OracleDB thin mode, HTML/CSS/JS puro no frontend. Modernizações de stack (TypeORM, React, etc.) são adiadas para após a estabilização funcional.

### Exceções documentadas

- Connection pool via `oracledb.createPool()` na Fase 5 (API do mesmo driver, não troca de stack)
- TypeScript strict mode habilitado na Fase 0 (melhoria dentro da stack)

### Melhorias de organização aprovadas (sem troca de stack)

- Queries SQL centralizadas em arquivos `*.repository.ts` por entidade
- Frontend: funções JS componentizadas sem framework

---