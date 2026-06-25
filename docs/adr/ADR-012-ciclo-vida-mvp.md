## ADR-012 — Ciclo de Vida MVP: 4 Estados, 3 Transições

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E2  
**Decisão originada em:** Resposta DQ-005/006

### Decisão

O MVP implementa o ciclo de vida mínimo confirmado com a Assessoria:

```
SUBMETIDA ──► EM_ANALISE ──► APROVADA
                        └──► REPROVADA
```

Estados `RASCUNHO`, `DEVOLVIDA`, `SUSPENSA`, `CONCLUIDA`, `CANCELADA` são válidos no schema (STATUS_WORKFLOW os conhece) mas não têm transições ativas no MVP. São adicionados via INSERT em TRANSICOES_STATUS quando o processo da Assessoria amadurecer.

### Nomenclatura obrigatória

| Antigo (documentos anteriores) | Correto (este documento em diante) |
|---|---|
| HOMOLOGADA | **APROVADA** |
| DESQUALIFICADA | **REPROVADA** |

### Impacto no ETL (Fase 1)

Registros históricos da planilha que estavam como `[Homologada]` são migrados com `status = 'APROVADA'`. Registros `[Desqualificada]` → `status = 'REPROVADA'`. Registros `[Em Análise]` → `status = 'EM_ANALISE'`.