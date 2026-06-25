## ADR-006 — Feature Flag em PARAMETROS_SISTEMA

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E1, E2

### Decisão

A migração do destino de escrita do formulário (tabela legada → tabela nova) é controlada pelo parâmetro `FORMULARIO_DESTINO_TABELA` em `PARAMETROS_SISTEMA`. Cache TTL 1 minuto no backend. Rollback sem deploy.

### Regras de implementação

1. Valores aceitos: `LEGADO` (padrão) ou `NOVO`
2. Valor inválido → fallback para `LEGADO` + log de erro
3. `IniciativasService.criar()` consulta o parâmetro via `ParametrosService.get()`
4. Comentário obrigatório no código: `// TODO: remover após Fase 5`
5. Parâmetro removido da tabela e do código na Fase 5 (junto com o código legado)

---