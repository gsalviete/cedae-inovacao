## ADR-008 — Auditoria em Duas Camadas

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épicos:** E1, E2

### Decisão

Duas tabelas com propósitos distintos e separados:

- **HISTORICO_STATUS**: auditoria de negócio — eventos semânticos do ciclo de vida. Permanente. Consultado por gestores e auditorias regulatórias.
- **AUDITORIA_LOGS**: auditoria técnica — INSERT/UPDATE/DELETE em tabelas críticas. Retenção 7 anos. Consultado por DBAs e investigações de segurança.

### Tabelas auditadas pelo AUDITORIA_LOGS no MVP

INICIATIVAS, USUARIOS, USUARIOS_PERFIS, HISTORICO_STATUS, TRANSICOES_STATUS, PARAMETROS_SISTEMA.

### Regras de implementação

1. INOVACAO_LOGS (legado) → dados migrados para AUDITORIA_LOGS no ETL como registros históricos
2. `AuditService.registrar()` é chamado de forma assíncrona e não-bloqueante
3. HISTORICO_STATUS: retenção permanente | AUDITORIA_LOGS: retenção 7 anos
4. `AuthService.registrarLog()` legado é substituído por chamadas ao `AuditModule`

---