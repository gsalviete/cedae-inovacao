## ADR-003 — Separação Identidade / Autenticação / Autorização

**Status:** APPROVED  
**Data:** 2026-06-24  
**Épico:** E3

### Decisão

A entidade `USUARIOS` usa `id` (BIGINT gerado pelo banco) como chave primária imutável em todos os relacionamentos. O campo `login` é apenas um atributo de autenticação e pode ser atualizado sem impacto em cascata. O campo `origem_identidade` registra o mecanismo de autenticação atual da conta.

### Regras de implementação

1. O JWT usa `sub: user_id` (número inteiro), não o login
2. O campo `login` nunca aparece como FK em nenhuma outra tabela
3. Perfis e permissões ficam em `USUARIOS_PERFIS` (N:M) — separados da identidade
4. Senhas armazenadas exclusivamente como hash bcrypt (nunca plain text)
5. `origem_identidade` aceita: `LOCAL` | `LDAP` | `AD` | `SSO` — registra de onde veio a identidade, não o mecanismo de senha
6. Migração futura para AD: apenas `UPDATE USUARIOS SET login = upn, origem_identidade = 'AD'` — sem impacto em outras tabelas

### JWT payload (formato obrigatório após E3)

```json
{
  "sub": 1,
  "login": "gsalviete",
  "perfis": ["ADMINISTRADOR"],
  "area_id": 3,
  "iat": 1750000000,
  "exp": 1750003600
}
```

### Perfis MVP

| codigo | Pode ver | Pode transitar status | Pode administrar |
|---|---|---|---|
| `ANALISTA_ASSESSORIA` | Todas as iniciativas | SUBMETIDA→EM_ANALISE, EM_ANALISE→APROVADA, EM_ANALISE→REPROVADA | Não |
| `GESTOR_AREA` | Iniciativas da sua área | Não | Não |
| `ADMINISTRADOR` | Tudo | Tudo | Sim |

---