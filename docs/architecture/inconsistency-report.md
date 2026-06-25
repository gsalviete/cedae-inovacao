# Relatório de Inconsistências — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24  
**Produzido em:** Passo 2 — Validação de Consistência  
**Política:** Inconsistências são registradas aqui e não corrigidas automaticamente.
Devem ser resolvidas pelo desenvolvedor durante a implementação da story afetada.

---

## INC-001 — ADR-012: Divergência de título no índice vs. corpo

**Severidade:** Baixa  
**Localização:** `docs/architecture/final-adrs.md` — linha do índice vs. título do ADR-012

**Descrição:**  
O índice de status lista ADR-012 como "Ciclo de vida MVP: **3 estados**", enquanto o título do ADR no corpo do documento é "Ciclo de Vida MVP: **4 Estados, 3 Transições**". O conteúdo do ADR está correto: 4 estados (SUBMETIDA, EM_ANALISE, APROVADA, REPROVADA) com 3 transições ativas.

**Resolução sugerida:** Atualizar a linha do índice para "Ciclo de Vida MVP: 4 Estados, 3 Transições" ao revisar o documento. Não altera nenhuma decisão arquitetural.

**Story afetada:** Nenhuma — é inconsistência de documentação.

---

## INC-002 — `database-migration-plan.md`: DDL ausente para 9 dos 31 scripts listados

**Severidade:** Média  
**Localização:** `docs/architecture/database-migration-plan.md` — seção 3

**Descrição:**  
O plano lista 31 scripts (V01 a V31), mas fornece DDL completo apenas para:
V01 (DOMINIO_VALORES + seed), V02 (STATUS_WORKFLOW), V13 (seed TRANSICOES_STATUS), V14 (HISTORICO_STATUS + trigger + view) e V19 (ALTER TABLE).

Os seguintes scripts têm **apenas menção no índice, sem DDL detalhado**:
- V03 — `create_canais_captacao.sql`
- V04 — `create_perfis_acesso.sql`
- V05 — `create_parametros_sistema.sql`
- V07 — `seed_unidades_organizacionais.sql`
- V08 — `create_usuarios.sql`
- V09 — `create_usuarios_perfis.sql`
- V10 — `seed_usuario_admin.sql`
- V11 — `create_proponentes.sql`
- V15 — `create_investimentos.sql`
- V16 — `create_anotacoes.sql`
- V17 — `create_iniciativas_suportes.sql`
- V18 — `create_auditoria_logs.sql`
- V27 — `etl_auditoria_logs_legado.sql`
- V28 — `create_iniciativas.sql`
- V29 — `add_fks_to_support_tables.sql`
- V30 — `create_views_dominio.sql`
- V31 — `create_view_historico_ativo.sql`

**Resolução sugerida:** O DDL dessas tabelas está especificado em `docs/architecture/final-adrs.md` (schemas nos ADRs relevantes) e em `future-data-model.md` (arquivo de referência). O desenvolvedor deve usar esses documentos como fonte para gerar os scripts faltantes durante E1-S01, E1-S02 e E1-S03.

**Story afetada:** E1-S01, E1-S02, E1-S03, E1-S06.

---

## INC-003 — ETL usa `iniciativa_legado_id` em vez de `iniciativa_id`

**Severidade:** Média  
**Localização:** `docs/architecture/database-migration-plan.md` — seção 4 (ETL, explosão de SUPORTE_NECESSARIO)

**Descrição:**  
O script ETL de explosão de SUPORTE_NECESSARIO faz INSERT em `INICIATIVAS_SUPORTES` usando a coluna `iniciativa_legado_id`. Porém, o modelo de dados definido em `future-data-model.md` e em `final-adrs.md` define a tabela `INICIATIVAS_SUPORTES` com a coluna `iniciativa_id` (FK → INICIATIVAS).

O ETL na Fase 1 ocorre antes da tabela `INICIATIVAS` ser criada (E1-S06). A lógica de explosão de suportes vincula os dados ao ID da tabela legada `INOVACAO_INICIATIVAS`, não ao ID da nova tabela `INICIATIVAS`.

**Resolução sugerida:** Durante E1-S05 (ETL), a coluna de ligação deve ser tratada de uma de duas formas:
1. Usar um campo auxiliar temporário `iniciativa_legado_id NUMBER` na tabela `INICIATIVAS_SUPORTES` que será substituído pelo `iniciativa_id` real quando a tabela `INICIATIVAS` for criada e populada em E1-S06; ou
2. Executar a explosão de SUPORTE_NECESSARIO apenas após a criação e migração de dados para `INICIATIVAS` (reordenar para dentro de E1-S06).

**Story afetada:** E1-S05, E1-S06.

---

## INC-004 — `ETL_CURADORIA_LOG` referenciada sem script de criação

**Severidade:** Baixa  
**Localização:** `docs/architecture/database-migration-plan.md` — seção 4, bloco PL/SQL

**Descrição:**  
O script PL/SQL do ETL faz INSERT em `ETL_CURADORIA_LOG`, mas não existe nenhum script `CREATE TABLE ETL_CURADORIA_LOG` no plano de migração. A execução do ETL falharia caso essa tabela não exista previamente.

**Resolução sugerida:** Adicionar criação de `ETL_CURADORIA_LOG` como script auxiliar antes do ETL (ex: V20B ou antes de V21). A tabela é temporária — pode ser criada, usada para curadoria e depois removida após a conclusão da Fase 1.

**Story afetada:** E1-S05.

---

## INC-005 — `AuditModule` / `AuditService` sem story dedicada

**Severidade:** Baixa  
**Localização:** `docs/architecture/final-adrs.md` (ADR-008), `docs/planning/implementation-backlog.md`

**Descrição:**  
O ADR-008 define que um `AuditModule` com `AuditService.registrar()` substitui o `AuthService.registrarLog()` disperso. O `implementation-backlog.md` não tem story específica para criar o `AuditModule`. A referência mais próxima está em E1-S03 (criar `AUDITORIA_LOGS` no banco) e E3-S03 (os endpoints de usuários devem registrar em `AUDITORIA_LOGS`).

**Resolução sugerida:** Criar o `AuditModule` como tarefa adicional dentro de E2-S01 (WorkflowModule — onde o primeiro uso de auditoria ocorre na camada de aplicação) ou como tarefa inaugural de E1-S03 ao criar a tabela. O desenvolvedor deve adicionar essa tarefa ao iniciar E2-S01.

**Story afetada:** E2-S01 (onde o AuditModule deve existir antes de ser usado).

---

## INC-006 — `ParametrosService` sem story dedicada

**Severidade:** Baixa  
**Localização:** `docs/planning/technical-task-breakdown.md` — E2-S02

**Descrição:**  
O `ParametrosService` (backend/src/parametros/parametros.service.ts) é criado dentro das tarefas de E2-S02, mas E2-S02 tem como objetivo principal refatorar `IniciativasService.criar()`. Criar um novo módulo (`ParametrosModule`) é um escopo adicional que pode fazer E2-S02 crescer além do estimado (M = 3-4 dias).

**Resolução sugerida:** O desenvolvedor pode optar por criar `ParametrosService` como primeira tarefa de E2-S02 antes de refatorar o `IniciativasService`, ou extrair como uma tarefa dentro de E1-S01 (quando PARAMETROS_SISTEMA é criada no banco). Não altera arquitetura — apenas organização de tarefas.

**Story afetada:** E2-S02.

---

## INC-007 — `RELACIONAMENTOS_INICIATIVAS` listada no OUT do MVP mas sem DDL no migration plan

**Severidade:** Informativa  
**Localização:** `docs/planning/mvp-scope.md` (seção OUT), `docs/architecture/database-migration-plan.md`

**Descrição:**  
`RELACIONAMENTOS_INICIATIVAS` está corretamente no escopo OUT do MVP. No entanto, o `future-data-model.md` inclui seu DDL completo. O `database-migration-plan.md` não inclui script para essa tabela (correto, pois está fora do MVP).

**Resolução sugerida:** Nenhuma ação necessária — o comportamento está correto. Esta entrada serve como confirmação de que a ausência do script é intencional, não um gap.

**Story afetada:** Nenhuma no MVP.

---

## Resumo das Inconsistências

| ID | Severidade | Story Afetada | Ação Requerida |
|---|---|---|---|
| INC-001 | Baixa | Nenhuma | Corrigir título no índice do ADR-012 |
| INC-002 | Média | E1-S01, E1-S02, E1-S03, E1-S06 | Gerar DDLs faltantes usando future-data-model.md como referência |
| INC-003 | Média | E1-S05, E1-S06 | Definir estratégia de coluna de ligação para ETL de suportes |
| INC-004 | Baixa | E1-S05 | Adicionar CREATE TABLE ETL_CURADORIA_LOG antes do ETL |
| INC-005 | Baixa | E2-S01 | Criar AuditModule como tarefa adicional em E2-S01 |
| INC-006 | Baixa | E2-S02 | Criar ParametrosService antes de refatorar IniciativasService |
| INC-007 | Informativa | Nenhuma | Confirmação de ausência intencional |