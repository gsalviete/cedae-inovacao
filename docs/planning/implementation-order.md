# Ordem de Implementação — CEDAE Inovação
**Versão:** 1.0  
**Data:** 2026-06-24  
**Fonte de verdade:** implementation-backlog.md + release-plan.md

---

## Fase 0 — Segurança Emergencial
**Duração estimada:** 1 semana  
**Pré-requisito:** Nenhum

```
E0-S01  Remover credenciais do repositório git
E0-S02  Remover logs de credenciais e adicionar rate limiting
E0-S03  Habilitar TypeScript strict mode e remover dependências mortas
E0-S04  Gerar JWT_SECRET forte e documentar gestão de segredos
```

**Gate — critérios obrigatórios para avançar para Fase 1:**
- [ ] Nenhuma credencial (senha, token, chave) existe no repositório git ou em qualquer arquivo commitado
- [ ] JWT_SECRET tem no mínimo 32 caracteres aleatórios e não está hardcoded
- [ ] `POST /api/auth/login` retorna 429 após 5 tentativas falhas consecutivas do mesmo IP em 60s
- [ ] Nenhum log em produção contém valores de credenciais
- [ ] `pnpm run build` completa sem erros TypeScript com strict mode
- [ ] `passport-local` removido de `package.json`
- [ ] Comportamento funcional do sistema idêntico ao pré-Fase 0

---

## Fase 1 — Fundação de Dados
**Duração estimada:** 4 semanas  
**Pré-requisito:** Gate da Fase 0 aprovado + lista de gerências fornecida pela Assessoria

```
E1-S01  Criar tabelas de referência sem dependências externas
E1-S02  Criar tabelas de identidade e usuário administrador seed
E1-S03  Criar tabelas transacionais e de workflow
E1-S04  Adicionar colunas de migração na tabela INOVACAO_INICIATIVAS
E1-S05  ETL: migração de dados históricos
E1-S06  Criar tabela INICIATIVAS com estrutura TO-BE completa
```

**Gate — critérios obrigatórios para avançar para Fase 2:**
- [ ] Todas as queries de validação pós-ETL retornam 0 (ver database-migration-plan.md §5)
- [ ] Relatório de curadoria do ETL aprovado pela Assessoria
- [ ] Sistema legado funcionando normalmente após todas as mudanças de banco
- [ ] Tabela INICIATIVAS vazia e pronta para receber dados
- [ ] Feature flag `FORMULARIO_DESTINO_TABELA = 'LEGADO'` confirmado em PARAMETROS_SISTEMA

---

## Fase 2 — Workflow e Ciclo de Vida
**Duração estimada:** 4 semanas  
**Pré-requisito:** Gate da Fase 1 aprovado + ciclo de vida validado com a equipe do painel admin

```
E2-S01  WorkflowModule: serviço de transição de status
E2-S02  IniciativasService: gravar em INICIATIVAS com feature flag
E2-S03  Endpoint PATCH /api/iniciativas/:id/status
E2-S04  Endpoint GET /api/iniciativas/:id/historico
E2-S05  Refatorar IniciativasService.listar() com paginação e filtros
E2-S06  Refatorar AdminService.getKpis() para GROUP BY SQL
E2-S07  Frontend: exibir CODIGO_PUBLICO e dropdown de área no formulário
E2-S08  Frontend: tela de detalhe e controles de workflow no painel admin
E2-S09  Proteger GET /api/iniciativas e atualizar frontend  ⚠️ DEPLOY COORDENADO COM E2-S08
E2-S10  Criar endpoint GET /api/reference/:domain
```

> ⚠️ **Atenção:** E2-S08 e E2-S09 devem ser deployadas no mesmo ciclo de release.
> A proteção do endpoint e a atualização do frontend são inseparáveis.

**Gate — critérios obrigatórios para avançar para Fase 3:**
- [ ] Feature flag `NOVO` ativo em produção por 48h sem incidentes
- [ ] Pelo menos 1 iniciativa real aprovada/reprovada pela Assessoria usando o novo sistema
- [ ] COUNT de INOVACAO_INICIATIVAS não cresceu após ativação do flag
- [ ] Planilha Excel confirmada como somente leitura pela Assessoria

---

## Fase 3 — Autenticação Robusta e RBAC
**Duração estimada:** 3 semanas  
**Pré-requisito:** Gate da Fase 2 aprovado + usuário admin seed em USUARIOS testado

```
E3-S01  AuthService: autenticação via USUARIOS com mecanismo duplo
E3-S02  RolesGuard e atualização de JwtStrategy
E3-S03  UsersModule: CRUD de usuários (backend)
E3-S04  Tela de gestão de usuários no painel admin (frontend)
E3-S05  Remover mecanismo legado de autenticação  ⚠️ PRAZO MÁXIMO 1 SEMANA APÓS E3-S01
```

> ⚠️ **Atenção:** E3-S05 tem prazo máximo de 1 semana após E3-S01 em produção.
> A data limite deve ser registrada como comentário no código no momento do deploy de E3-S01.

**Gate — critérios obrigatórios para avançar para Fase 4:**
- [ ] Zero ocorrências de `[WARN] Autenticação via credencial legada` nas últimas 24h
- [ ] `ADMIN_USERNAME` e `ADMIN_PASSWORD` não existem em nenhum arquivo do repositório
- [ ] Pelo menos 2 usuários com contas individuais e perfis distintos criados
- [ ] Todos os acessos ao painel rastreados por `usuario_id` em AUDITORIA_LOGS

---

## Fase 4 — Portfólio Avançado
**Duração estimada:** 4 semanas  
**Pré-requisito:** Gate da Fase 3 aprovado

```
E4-S01  Gestão de investimento na tela de detalhe
E4-S02  Anotações com tipo e visibilidade
E4-S03  Gestão de dados de referência no painel admin
```

**Gate — critérios obrigatórios para avançar para Fase 5:**
- [ ] Pelo menos 3 iniciativas com dados financeiros registrados no sistema
- [ ] Assessoria confirma que gerencia dados de referência sem chamar TI
- [ ] Nenhuma escrita em tabelas legadas há pelo menos 7 dias

---

## Fase 5 — Maturidade Operacional
**Duração estimada:** 2 semanas  
**Pré-requisito:** Gate da Fase 4 aprovado + 30 dias sem INSERT em INOVACAO_INICIATIVAS + aprovação formal da Assessoria

```
E5-S01  Connection pool Oracle
E5-S02  Pipeline CI/CD básico
E5-S03  Arquivamento das tabelas legadas  ⚠️ IRREVERSÍVEL — dump obrigatório antes
```

> ⚠️ **Atenção:** E5-S03 é a única operação sem rollback limpo.
> Requer dump de arquivamento verificado + aprovação formal + grep confirmando zero referências no código.

**Gate — MVP completo:**
- [ ] `grep -r "INOVACAO_INICIATIVAS\b\|INOVACAO_LOGS\b" backend/src/` retorna vazio
- [ ] Pipeline CI/CD verde há pelo menos 5 dias consecutivos
- [ ] Connection pool funcionando sem erros por 48h
- [ ] Dump das tabelas legadas arquivado e verificado
- [ ] Data de DROP programada: +90 dias a partir da data do rename
- [ ] Documento de encerramento de MVP assinado pela Assessoria