# Regras de Implementação — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24

---

## Arquitetura

- Não alterar ADRs sem autorização explícita do Tech Lead.
- Não alterar escopo MVP sem autorização explícita (ver `docs/planning/mvp-scope.md`).
- Não criar novas tabelas sem migration versionada.
- Não modificar schema manualmente — toda mudança passa por script em `database/migrations/`.
- Toda decisão que contrarie um ADR aprovado deve ser documentada como novo ADR antes de implementar.

---

## Backend

- Não usar `any` em TypeScript — strict mode está habilitado.
- Não usar `// @ts-ignore` — corrigir o erro de tipo.
- Sempre tipar retornos de funções públicas.
- Sempre usar DTOs com `class-validator` para validação de entrada.
- Sempre usar Repository Pattern — queries SQL ficam em `*.repository.ts`, nunca embutidas em services.
- Nunca fazer UPDATE direto em `INICIATIVAS.status_id` fora do `WorkflowService`.
- Nunca chamar `oracledb.getConnection()` diretamente nos services — usar sempre o pool via `DatabaseModule`.
- `AuditService.registrar()` deve ser chamado de forma assíncrona e não-bloqueante.

---

## Banco de Dados

- Toda mudança de schema deve possuir migration numerada (`V{N}__descricao.sql`).
- Toda migration deve ser idempotente onde aplicável (verificar existência antes de criar).
- Nunca editar migrations já executadas — criar uma nova migration para corrigir.
- Nunca fazer DROP de tabela sem aprovação formal e dump de arquivamento.
- Scripts ETL devem gerar relatório de curadoria para revisão da Assessoria antes da execução em produção.

---

## Frontend

- Não introduzir frameworks novos (sem React, Vue, Angular, etc.).
- Reutilizar a estrutura HTML/CSS/JS existente.
- Componentizar funções reutilizáveis (modal, badge, timeline) sem framework.
- Toda chamada autenticada deve enviar `Authorization: Bearer ${token}` no cabeçalho.
- Endpoints marcados como `@Public()` no backend não enviam token.

---

## Entrega

Ao concluir uma story, antes de encerrar:

1. Listar todos os arquivos alterados com uma linha descrevendo a mudança em cada um
2. Explicar decisões tomadas que não estavam explicitamente definidas na story
3. Mostrar comandos de validação e seus resultados esperados
4. Aguardar aprovação explícita antes de avançar

**Nunca iniciar a próxima story automaticamente.**  
**Nunca implementar duas stories simultaneamente.**

---

## Deploys de Alto Risco

Os seguintes deploys requerem atenção especial e validação extra antes de executar:

| Deploy | Risco | Verificação adicional |
|---|---|---|
| E1-S04 | ALTER TABLE em produção | DBA presente; executar fora do horário de pico |
| E1-S05 | ETL modifica dados históricos | Executar em dev primeiro; curadoria aprovada |
| E2-S09 | Proteger endpoint + atualizar frontend | Deploy único obrigatório com E2-S08 |
| E3-S01 | Mudança no fluxo de autenticação | Admin testa login via USUARIOS antes de confirmar |
| E3-S05 | Único caminho de autenticação restante | Confirmação documentada de login nas últimas 24h |
| E5-S03 | Rename de tabelas — sem rollback limpo | Grep obrigatório; dump obrigatório; aprovação formal |