# Arquitetura Backend — Análise e Proposta
**Versão:** 1.0  
**Data:** 2026-06-25  
**Escopo:** NestJS backend (`backend/src/`)

---

## 1. Estrutura Atual do Projeto

```
backend/src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── admin.guard.ts          ← guard de admin (verifica JWT manualmente)
│   ├── auth.controller.ts      ← POST /api/auth/login
│   ├── auth.module.ts          ← configura JwtModule, PassportModule
│   ├── auth.service.ts         ← validateCredentials, generateToken, registrarLog
│   ├── jwt-auth.guard.ts       ← AuthGuard('jwt') — declarado, nunca aplicado
│   ├── jwt.strategy.ts         ← PassportStrategy — declarada, nunca ativada
│   └── dto/
│       └── login.dto.ts
├── iniciativas/
│   ├── iniciativas.controller.ts   ← POST/GET /api/iniciativas
│   ├── iniciativas.module.ts
│   ├── iniciativas.service.ts      ← SQL embutido no service
│   └── dto/
│       └── create-iniciativa.dto.ts
├── admin/
│   ├── admin.controller.ts     ← GET /api/admin/{kpis,acessos,logs}
│   ├── admin.module.ts
│   └── admin.service.ts        ← SQL embutido + duplicata de listarIniciativas()
└── database/
    ├── database.module.ts      ← @Global()
    └── database.service.ts     ← fábrica de conexões Oracle
```

**Módulos:** 4 (Database, Auth, Iniciativas, Admin)  
**Arquivos TypeScript em src/:** 18  
**Linhas de código em src/ (excl. node_modules, dist):** ~350

---

## 2. Problemas Encontrados

### 2.1 Acoplamento entre módulos

**`IniciativasController` importa `AuthService`** para registrar o log de submissão:

```typescript
// iniciativas.controller.ts
constructor(
  private readonly iniciativasService: IniciativasService,
  private readonly authService: AuthService,   ← cross-module import
) {}
```

Um controller de iniciativas não deveria conhecer o serviço de autenticação. O `registrarLog()` é uma preocupação transversal (auditoria), não de autenticação. Isso cria um acoplamento direto entre `IniciativasModule` e `AuthModule`.

**Impacto futuro:** quando `AuthService` for refatorado em E3 (autenticação via USUARIOS), qualquer mudança na sua interface obriga `IniciativasController` a atualizar junto.

---

### 2.2 Lógica de dados duplicada

`AdminService.listarIniciativas()` e `IniciativasService.listar()` são **idênticos** — mesma query SQL, mesma normalização de chaves Oracle:

```typescript
// admin.service.ts — linhas 31-48
async listarIniciativas(): Promise<any[]> {
  const sql = 'SELECT * FROM INOVACAO_INICIATIVAS ORDER BY CRIADO_EM DESC';
  // ... exatamente igual a IniciativasService.listar()
}
```

Além disso, `AdminService.getKpis()` chama internamente `listarIniciativas()`, carregando **todos** os registros em memória para agregar em JavaScript, em vez de usar `GROUP BY` no Oracle.

---

### 2.3 SQL embutido nos services

Queries SQL são strings literais dentro dos métodos de service:

```typescript
// iniciativas.service.ts
async criar(data: CreateIniciativaDto): Promise<number> {
  const sql = `INSERT INTO INOVACAO_INICIATIVAS (...)`;  ← SQL no service
```

Não há camada de repositório. Consequências:
- Impossível testar a lógica de negócio sem banco real
- Mudança de coluna Oracle exige busca manual em todos os services
- Normalização de keys Oracle (`key.toLowerCase()`) repetida 3 vezes

---

### 2.4 Dois mecanismos de autenticação paralelos e inconsistentes

| Mecanismo | Arquivo | Estado |
|---|---|---|
| `JwtAuthGuard` (Passport) | `auth/jwt-auth.guard.ts` | Declarado, **nunca aplicado** |
| `JwtStrategy` (Passport) | `auth/jwt.strategy.ts` | Declarada, **nunca ativada** |
| `AdminGuard` (manual) | `auth/admin.guard.ts` | Aplicado em `AdminController` via `@UseGuards` |

O `AdminGuard` reimplementa a verificação JWT manualmente com `jwtService.verify()`, duplicando o que `JwtStrategy` + `JwtAuthGuard` já fariam. O `JWT_SECRET` aparece em **três locais independentes** com fallback hardcoded em cada um.

---

### 2.5 Guards como preocupação transversal dentro de módulo de feature

`admin.guard.ts` e `jwt-auth.guard.ts` vivem dentro de `auth/` — um módulo de feature. Guards são preocupações transversais (cross-cutting concerns) e deveriam estar em um local neutro. Quando E3 introduzir `RolesGuard`, `@Public()` e `@RequireRole()`, haverá mais guards/decorators que não pertencem semanticamente ao módulo de auth.

---

### 2.6 Ausência de tipagem para resultados Oracle

Todos os retornos de queries Oracle são `any[]`:

```typescript
return (result.rows as any[]).map((row) => {  // any em três services
  const normalized: Record<string, any> = {};
```

Com `strictNullChecks: false` e `noImplicitAny: false` atuais, isso não gera erros. Após E0-S03 (strict mode), todos esses `any` precisarão de tipagem adequada — e não há interfaces definidas para os shapes Oracle.

---

### 2.7 Ausência de interface compartilhada para o payload JWT

O shape do payload JWT (`{ sub, is_admin }`) é implicitamente assumido em três arquivos sem um tipo compartilhado:

```typescript
// auth.service.ts
const payload = { sub: username, is_admin };   ← criado aqui

// jwt.strategy.ts
async validate(payload: any) {                  ← any

// admin.guard.ts
if (!payload?.is_admin) {                       ← acesso direto sem tipo
```

---

### 2.8 `require()` síncrono dentro de métodos assíncronos

```typescript
// iniciativas.service.ts, admin.service.ts (3 ocorrências)
const idVar = { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER };
outFormat: require('oracledb').OUT_FORMAT_OBJECT,
```

`require('oracledb')` dentro de métodos é carregado a cada chamada. Deveria ser um import estático no topo do arquivo.

---

## 3. Estrutura Alvo Recomendada

```
backend/src/
├── main.ts
├── app.module.ts
│
├── config/                              ← fábricas de configuração de módulos
│   ├── jwt.config.ts                    ← JwtModule.registerAsync factory
│   └── throttler.config.ts             ← ThrottlerModule factory
│
├── common/                              ← preocupações transversais
│   ├── decorators/
│   │   ├── public.decorator.ts          ← @Public() — E3-S02
│   │   └── require-role.decorator.ts    ← @RequireRole() — E3-S02
│   ├── guards/
│   │   ├── jwt-auth.guard.ts            ← mover de auth/ após E3-S02
│   │   └── roles.guard.ts              ← E3-S02
│   └── interfaces/
│       └── jwt-payload.interface.ts     ← NOW — necessário para E0-S03
│
├── database/                            ← infraestrutura Oracle
│   ├── database.module.ts
│   └── database.service.ts
│
├── auth/                                ← autenticação e identidade
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── admin.guard.ts                   ← remover em E3-S02
│   ├── auth.repository.ts              ← E3-S01: findUserByLogin()
│   └── dto/
│       └── login.dto.ts
│
├── iniciativas/                         ← domínio de captação
│   ├── iniciativas.module.ts
│   ├── iniciativas.controller.ts
│   ├── iniciativas.service.ts
│   ├── iniciativas.repository.ts       ← E2-S02: SQL extraído do service
│   └── dto/
│       ├── create-iniciativa.dto.ts
│       ├── list-iniciativas.dto.ts     ← E2-S05: paginação + filtros
│       └── patch-status.dto.ts         ← E2-S03
│
├── admin/                               ← painel administrativo
│   ├── admin.module.ts
│   ├── admin.controller.ts
│   └── admin.service.ts                ← eliminar listarIniciativas() em E2-S05
│
├── workflow/                            ← E2-S01: motor de transição de status
│   ├── workflow.module.ts
│   ├── workflow.service.ts
│   └── workflow.exception.ts
│
├── parametros/                          ← E2-S02: feature flags e configurações
│   ├── parametros.module.ts
│   └── parametros.service.ts
│
├── reference-data/                      ← E2-S10: dados de domínio (enums do banco)
│   ├── reference-data.module.ts
│   ├── reference-data.controller.ts
│   └── reference-data.service.ts
│
├── users/                               ← E3-S03: gestão de usuários
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.repository.ts
│
├── investimentos/                       ← E4-S01
│   ├── investimentos.module.ts
│   ├── investimentos.controller.ts
│   ├── investimentos.service.ts
│   └── investimentos.repository.ts
│
└── anotacoes/                           ← E4-S02
    ├── anotacoes.module.ts
    ├── anotacoes.controller.ts
    ├── anotacoes.service.ts
    └── anotacoes.repository.ts
```

---

## 4. Plano de Migração Incremental

A migração é feita **junto com as stories existentes**, nunca em commits isolados de refatoração pura. Cada story que toca um módulo o deixa mais próximo da estrutura alvo.

### Fase 0 (agora — E0-S03)

| Ação | Motivo |
|---|---|
| Criar `common/interfaces/jwt-payload.interface.ts` | Necessário para tipar `any` em `jwt.strategy.ts` e `admin.guard.ts` com strict mode |
| Converter `require('oracledb')` para import estático | Parte do strict mode cleanup em E0-S03 |
| Criar esqueleto de `common/` (pastas vazias com `.gitkeep`) | Sinalizar a estrutura ao time sem risco |

### Fase 2 (E2-S01 a E2-S10)

| Story | Ação estrutural |
|---|---|
| E2-S01 | Criar `workflow/` como módulo independente |
| E2-S02 | Criar `iniciativas/iniciativas.repository.ts`; extrair SQL do service |
| E2-S02 | Criar `parametros/` |
| E2-S05 | Remover `AdminService.listarIniciativas()` — AdminModule passa a importar IniciativasModule |
| E2-S10 | Criar `reference-data/` |

### Fase 3 (E3-S01 a E3-S05)

| Story | Ação estrutural |
|---|---|
| E3-S01 | Criar `auth/auth.repository.ts` |
| E3-S02 | Criar `common/guards/roles.guard.ts` |
| E3-S02 | Criar `common/decorators/public.decorator.ts` e `require-role.decorator.ts` |
| E3-S02 | Mover `jwt-auth.guard.ts` de `auth/` para `common/guards/` |
| E3-S02 | Remover `auth/admin.guard.ts` |
| E3-S03 | Criar `users/` |

### Fase 4 (E4-S01 a E4-S02)

| Story | Ação estrutural |
|---|---|
| E4-S01 | Criar `investimentos/` com repository |
| E4-S02 | Criar `anotacoes/` com repository |

---

## 5. O que deve ficar em cada diretório

### `common/`

Preocupações **transversais** — código que múltiplos módulos de feature precisam mas que não pertence semanticamente a nenhum deles.

```
common/
├── decorators/
│   ├── public.decorator.ts          ← SetMetadata('isPublic', true)
│   └── require-role.decorator.ts    ← SetMetadata('roles', [...roles])
├── guards/
│   ├── jwt-auth.guard.ts            ← guard global de autenticação (após E3)
│   └── roles.guard.ts              ← verifica payload.perfis contra @RequireRole
└── interfaces/
    └── jwt-payload.interface.ts     ← interface JwtPayload { sub, login, perfis, area_id }
```

**Não entra em `common/`:** lógica de negócio, acesso a banco, DTOs específicos de domínio.

---

### `auth/`

Tudo relacionado à **autenticação** (verificar identidade). Não inclui autorização (verificar permissão — isso vai para `common/guards/`).

```
auth/
├── auth.module.ts          ← configura JwtModule, PassportModule, exporta AuthService
├── auth.controller.ts      ← POST /api/auth/login
├── auth.service.ts         ← validateCredentials, generateToken, registrarLog
├── auth.repository.ts      ← E3: findUserByLogin() → consulta USUARIOS
├── jwt.strategy.ts         ← extrai e valida Bearer token
└── dto/
    └── login.dto.ts
```

**Não entra em `auth/`:** guards de autorização (após E3), lógica de perfis, CRUD de usuários.

---

### `database/`

Infraestrutura de **conexão com Oracle**. Não contém queries de negócio.

```
database/
├── database.module.ts      ← @Global() — exporta DatabaseService
└── database.service.ts     ← getConnection() — será pool em E5-S01
```

Em E5-S01: `onModuleInit()` cria pool com `oracledb.createPool()`.

---

### `modules/` (não adotado)

A estrutura proposta **não usa** um diretório `modules/` intermediário. Feature modules ficam diretamente em `src/` seguindo a convenção NestJS padrão — a nesting adicional (src/modules/iniciativas/) aumenta profundidade sem benefício claro num projeto de escala MVP.

---

### `repositories/` (não adotado como diretório central)

Repositories ficam **dentro do módulo que os usa** seguindo a convenção NestJS:

```
iniciativas/
├── iniciativas.service.ts
├── iniciativas.repository.ts   ← aqui, não em src/repositories/
└── ...
```

Um diretório `src/repositories/` central seria adequado apenas com ORM (TypeORM, Prisma) onde os repositories são entidades do framework. Com SQL puro, o repository é um detalhe do módulo.

---

### `guards/` (dentro de `common/`)

Todos os guards de **autorização** centralizados. Guards de autenticação de middleware específico podem ficar no módulo relevante durante a transição.

```
common/guards/
├── jwt-auth.guard.ts        ← global auth guard (APP_GUARD) após E3-S02
└── roles.guard.ts           ← verifica perfis no payload JWT
```

`admin.guard.ts` atual é temporário — removido em E3-S02.

---

### `decorators/` (dentro de `common/`)

Decorators de **metadados** que os guards leem via `Reflector`.

```
common/decorators/
├── public.decorator.ts          ← @Public() — bypassa JWT global guard
└── require-role.decorator.ts    ← @RequireRole('ANALISTA_ASSESSORIA')
```

---

### `dto/`

DTOs ficam **dentro do módulo** que os expõe, não em um diretório global. Exceção: DTOs de paginação ou response padrão usados por múltiplos módulos podem ir em `common/dto/`.

```
# Por módulo (padrão):
iniciativas/dto/create-iniciativa.dto.ts
iniciativas/dto/list-iniciativas.dto.ts
users/dto/create-user.dto.ts

# Compartilhado (se necessário):
common/dto/paginated-response.dto.ts   ← { data, total, page, totalPages }
```

---

### `entities/`

O projeto **não usa ORM** (TypeORM, Prisma) — não há entidades de framework. O equivalente funcional são interfaces TypeScript que descrevem o shape das linhas Oracle:

```
common/interfaces/
├── jwt-payload.interface.ts      ← JwtPayload
├── oracle-iniciativa.interface.ts ← OracleIniciativaRow (após E0-S03)
└── oracle-log.interface.ts       ← OracleLogRow (após E0-S03)
```

**Não criar um diretório `entities/` vazio** — misleading num projeto sem ORM.

---

### `interfaces/` (dentro de `common/`)

Tipos e contratos compartilhados entre módulos.

```
common/interfaces/
├── jwt-payload.interface.ts   ← { sub: string; login: string; perfis: string[]; area_id: number }
└── (oracle row types após E0-S03 se necessário para strict mode)
```

Interfaces locais a um único módulo ficam no próprio módulo (sem subdir obrigatório).

---

### `config/`

Fábricas de configuração de módulos quando o `forRootAsync()` cresce complexo o suficiente para ser extraído:

```
config/
├── jwt.config.ts          ← () => ({ secret: process.env.JWT_SECRET, ... })
└── throttler.config.ts    ← () => [{ ttl: ..., limit: ... }]
```

Hoje `app.module.ts` configura inline — faz sentido extrair para `config/` quando os módulos tiverem múltiplas opções ou dependerem de `ConfigService`.

---

## 6. Mudanças que podem ser feitas agora sem risco

### 6.1 Criar `common/interfaces/jwt-payload.interface.ts` — **necessário para E0-S03**

```typescript
export interface JwtPayload {
  sub: string;
  is_admin: boolean;   // shape atual — será expandido em E3
}
```

Permite tipar corretamente `jwt.strategy.ts`, `admin.guard.ts` e `auth.service.ts` quando strict mode for habilitado.

### 6.2 Converter `require('oracledb')` para import estático

Em `iniciativas.service.ts` e `admin.service.ts`, substituir:
```typescript
// antes (dentro do método):
const idVar = { dir: require('oracledb').BIND_OUT };

// depois (import no topo do arquivo):
import * as oracledb from 'oracledb';
const idVar = { dir: oracledb.BIND_OUT };
```

Mudança puramente técnica, sem alteração de comportamento.

### 6.3 Criar estrutura de diretórios para `common/`

Criar os arquivos iniciais de `common/` (interface JWT, pelo menos) como parte de E0-S03, já que o strict mode exigirá esses tipos.

---

## 7. Mudanças que devem esperar até após E3

### 7.1 Mover/remover guards de `auth/`

`admin.guard.ts` e `jwt-auth.guard.ts` só devem ser movidos **em E3-S02**, quando:
- `AdminGuard` é **removido** (substituído por `RolesGuard` + `@RequireRole`)
- `JwtAuthGuard` é ativado como **guard global** via `APP_GUARD`
- `common/guards/` passa a ser o único lugar de guards de autorização

Mover antes criaria mais diffs sem benefício e complicaria o rollback de E3 se necessário.

### 7.2 Ativar `JwtAuthGuard` como guard global

Aplicar `APP_GUARD` globalmente no `AppModule` só é seguro depois que:
- Todos os endpoints públicos tiverem `@Public()`
- A `JwtStrategy` estiver validando contra `USUARIOS` (E3-S01)
- Todos os módulos existentes forem auditados para endpoints que não precisam de token

Ativar antes sem `@Public()` nos endpoints quebraria o formulário público (`POST /api/iniciativas`).

### 7.3 Extrair SQL para repositories

A extração completa de SQL dos services para repositories deve ocorrer **durante a story que refatora cada módulo**:
- `iniciativas.repository.ts` — em E2-S02 (quando `criar()` bifurca entre LEGADO e NOVO)
- `auth.repository.ts` — em E3-S01 (quando `findUserByLogin()` é adicionado)
- `users.repository.ts` — em E3-S03 (módulo novo, já nasce com repository)

Extrair antes seria refatoração sem mudança de comportamento que adiciona risco ao E0-E1 sem ganho imediato.

### 7.4 Eliminar `AdminService.listarIniciativas()` duplicado

Remover em E2-S05, conforme já especificado na story: AdminModule passa a importar IniciativasModule. Remover antes quebraria `AdminService.getKpis()`.

### 7.5 Separar `AuthService.registrarLog()` em `AuditService`

O log de auditoria está em `AuthService` por conveniência histórica, mas pertence a um serviço transversal. A separação é planejada implicitamente em E3 (a `claude-rules.md` referencia `AuditService.registrar()`). Extrair antes de E3 cria dependência circular potencial com `IniciativasController` → `AuditService` → `DatabaseService`.
