## ADR-007 — Mecanismo Duplo de Autenticação Durante a Transição

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E3  
**Prazo máximo:** 1 semana após deploy de E3-001

### Decisão

Durante a transição para autenticação via `USUARIOS`, o sistema mantém dois caminhos ativos: (1) USUARIOS + bcrypt; (2) fallback para env vars com log de warning. O fallback é removido após 1 semana sem incidentes (story E3-005).

### Regras de implementação

1. O fallback para env vars é explicitamente temporário — comentário `// TEMPORÁRIO: remover em E3-005`
2. Ambos os caminhos geram JWT com o mesmo payload (formato do ADR-003)
3. O fallback gera log `[WARN] Autenticação via credencial legada — migrar para E3-005`
4. E3-005 só pode ser deployada após confirmação documentada de login bem-sucedido via USUARIOS
5. `ADMIN_USERNAME` e `ADMIN_PASSWORD` são deletadas do `.env` em E3-005

---