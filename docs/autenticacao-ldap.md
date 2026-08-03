# Autenticação LDAP (Active Directory) — CEDAE Inovação

Este documento descreve a autenticação por **login direto no Active Directory
via LDAPS**, que substitui o mecanismo anterior baseado em Kerberos/IIS
(header `x-remote-user`).

> **Resumo da mudança:** a *única* coisa que muda é **como o usuário é
> identificado**. Toda a autorização existente — tabela `ADMIN_USERS`, papéis
> (`ADM`/`CONTRIBUTOR`), `AdminGuard`, `/api/me` — permanece **intacta**. Antes,
> a identidade vinha de um header injetado pelo IIS; agora vem de um cookie de
> sessão emitido após o bind no AD.

---

## 1. Dependências adicionadas

| Pacote                 | Uso                                                        |
| ---------------------- | ---------------------------------------------------------- |
| `ldapts`               | Cliente LDAP/LDAPS moderno e mantido (bind + search no AD) |
| `@nestjs/jwt`          | Assinatura/verificação do token de sessão (JWT)            |
| `cookie-parser`        | Leitura do cookie de sessão nas requisições                |
| `@types/cookie-parser` | Tipagem (devDependency)                                    |

Instalação (já refletida no `package.json`/lockfile):

```bash
cd backend
pnpm add ldapts @nestjs/jwt cookie-parser
pnpm add -D @types/cookie-parser
```

---

## 2. Novas variáveis de ambiente

Todas estão documentadas no `.env.example`. Resumo:

| Variável                | Obrigatória | Default | Descrição                                                                 |
| ----------------------- | ----------- | ------- | ------------------------------------------------------------------------- |
| `LDAP_HOST`             | sim         | —       | URL do servidor, ex.: `ldaps://dns3.cedae.corp`                           |
| `LDAP_PORT`             | não         | `636`   | Porta do LDAPS                                                             |
| `LDAP_BASE_DN`          | sim         | —       | Base de busca, ex.: `DC=cedae,DC=corp`                                    |
| `LDAP_DOMAIN`           | sim         | —       | Domínio NetBIOS do bind (`DOMINIO\usuario`), ex.: `CEDAE`                 |
| `LDAP_GROUP`            | não         | vazio   | Grupo do AD exigido para acessar. Vazio = qualquer usuário autenticado    |
| `LDAP_CA_FILE`          | não         | —       | Caminho do certificado da CA (para validar o cert do servidor)            |
| `LDAP_TLS_REQUIRE_CERT` | não         | `allow` | `allow` (não valida cert) ou `demand` (exige cert válido)                 |
| `LDAP_NETWORK_TIMEOUT`  | não         | `8000`  | Timeout de rede (ms) para conexão e operações                             |
| `SESSION_SECRET`        | prod        | efêmero | Segredo de assinatura do JWT de sessão. **Defina em produção**            |
| `SESSION_TTL`           | não         | `28800` | Validade da sessão em segundos (8h)                                       |
| `SESSION_COOKIE_SECURE` | não         | `false` | `true` marca o cookie como `Secure` (HTTPS). Use `true` em produção       |
| `DEV_REMOTE_USER`       | não         | —       | Fallback de identidade para dev sem AD (compat. com header legado)        |

---

## 3. Fluxo de autenticação

```
┌──────────┐   1. usuário+senha    ┌───────────────────┐   2. bind LDAPS    ┌────────────┐
│ Frontend │ ────────────────────► │  POST /api/auth/  │ ─────────────────► │   Active   │
│ (/login) │                       │      login        │   DOMINIO\usuario  │  Directory │
└──────────┘                       └───────────────────┘ ◄───────────────── └────────────┘
     ▲                                      │  3. search sAMAccountName
     │                                      │     (displayName, mail, memberOf)
     │  6. cookie de sessão (JWT)           │
     │     + redirect p/ aplicação          ▼
     │                              4. resolveUser(login)  ── consulta ADMIN_USERS (autorização inalterada)
     └──────────────────────────── 5. emite cookie httpOnly `inovacao_session`
```

Passo a passo:

1. O usuário informa **usuário** e **senha** na tela `/login`.
2. O backend faz **bind** no AD como `LDAP_DOMAIN\usuario` (ex.: `CEDAE\joao.silva`).
   - Bind rejeitado por credencial (código LDAP 49) → **401** "usuário ou senha inválidos".
   - Falha de conexão/TLS/timeout → **503** "serviço indisponível" (não é erro de senha).
3. Com o bind OK, faz **search** pelo `sAMAccountName` e lê
   `displayName`, `mail`, `sAMAccountName`, `memberOf`.
4. (Opcional) Se `LDAP_GROUP` estiver definido, exige que o usuário pertença ao
   grupo — senão retorna **403**.
5. O login é normalizado (`joao.silva` → `joao.silva@cedae.com.br`, mesma regra
   de sempre) e passado para `AuthService.resolveUser`, que consulta
   `ADMIN_USERS` **exatamente como antes**.
6. É emitido o cookie `inovacao_session` (JWT httpOnly, `SameSite=Lax`) e o
   frontend redireciona para a aplicação. As requisições seguintes enviam o
   cookie automaticamente; `AdminGuard` e `/api/me` extraem a identidade dele.

### Resposta do `POST /api/auth/login` (sucesso)

```json
{
  "login": "joao.silva@cedae.com.br",
  "nome": "João da Silva",
  "email": "joao.silva@cedae.com.br",
  "grupos": ["sistemas.dev", "Domain Users"],
  "role": "ADM",
  "admin": true
}
```

### Precedência de identidade (`SessionService.readLogin`)

1. Cookie de sessão JWT (fluxo LDAP novo).
2. Header `x-remote-user` (compatibilidade com IIS/Kerberos, se ainda existir).
3. `DEV_REMOTE_USER` (desenvolvimento local).

Isso permite migrar sem quebrar dev nem um eventual período de transição.

---

## 4. Estrutura de código

```
backend/src/auth/
├── ldap/
│   ├── ldap.module.ts     # módulo Nest que expõe o LdapService
│   ├── ldap.service.ts    # authenticate() e isMemberOf() — bind + search LDAPS
│   └── ldap.types.ts      # LdapConfig, LdapUser (sem any)
├── dto/
│   └── login.dto.ts       # validação de { username, password }
├── auth.controller.ts     # POST /api/auth/login e /logout
├── session.service.ts     # emite/limpa cookie JWT e resolve a identidade
├── auth.service.ts        # (inalterado) resolveUser / registrarLog
├── admin.guard.ts         # agora lê identidade da sessão (fallback header)
└── me.controller.ts       # idem
```

Segurança implementada:

- A **senha nunca é registrada** em log (nem em erro).
- Detalhes do erro do LDAP **não vazam** ao cliente — só entram no log interno;
  o cliente recebe mensagens genéricas (401/403/503).
- O filtro de busca escapa metacaracteres LDAP (RFC 4515), evitando injeção.
- Cookie de sessão é `httpOnly` (inacessível a JS) e `SameSite=Lax`.

---

## 5. Como testar em ambiente corporativo

1. Preencha o `.env` (backend) com os dados reais do AD:

   ```env
   LDAP_HOST=ldaps://dns3.cedae.corp
   LDAP_PORT=636
   LDAP_BASE_DN=DC=cedae,DC=corp
   LDAP_DOMAIN=CEDAE
   LDAP_TLS_REQUIRE_CERT=allow        # use demand + LDAP_CA_FILE em produção
   LDAP_NETWORK_TIMEOUT=8000
   SESSION_SECRET=<string-longa-aleatoria>
   SESSION_COOKIE_SECURE=true         # se servir por HTTPS
   # LDAP_GROUP=sistemas.dev          # opcional: restringe o acesso
   ```

   Remova/esvazie `DEV_REMOTE_USER` para exigir login real.

2. `pnpm build && pnpm start` (backend).

3. Acesse a aplicação → você será redirecionado para `/login`.

4. Entre com seu usuário de rede (ex.: `joao.silva`) e senha do domínio.
   - Credenciais corretas → redireciona para a aplicação; o nome aparece no header.
   - Credenciais erradas → mensagem "Usuário ou senha inválidos".

5. Teste rápido por linha de comando (sem frontend):

   ```bash
   curl -i -X POST http://localhost:8095/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"joao.silva","password":"SUA_SENHA"}'
   # sucesso → 200 + header Set-Cookie: inovacao_session=...
   ```

   Reaproveite o cookie para `/api/me`:

   ```bash
   curl --cookie "inovacao_session=<TOKEN>" http://localhost:8095/api/me
   ```

---

## 6. Pontos que podem variar conforme a configuração do AD

Estes itens dependem de como o AD da empresa está montado e podem precisar de
ajuste:

- **Formato do bind.** Usamos `DOMINIO\sAMAccountName`. Alguns ambientes exigem
  UPN (`usuario@cedae.corp`) ou o DN completo. Se o bind falhar mesmo com senha
  correta, este é o primeiro suspeito (ajuste em `LdapService`/`LDAP_DOMAIN`).
- **`sAMAccountName` vs. e-mail no `ADMIN_USERS`.** `normalizeLogin` monta o
  login como `sAMAccountName@cedae.com.br`. Se os registros em `ADMIN_USERS`
  usarem outro sufixo de domínio, ajuste `normalize-login.ts`.
- **Base de busca (`LDAP_BASE_DN`).** Se os usuários estiverem em uma OU
  específica, pode ser necessário apontar para ela (ou manter a raiz do domínio,
  que costuma funcionar).
- **Certificado LDAPS.** Em produção, prefira `LDAP_TLS_REQUIRE_CERT=demand` e
  forneça `LDAP_CA_FILE` com a CA interna. Com `allow`, o certificado não é
  validado (aceitável apenas em rede confiável/homologação).
- **Nomes de grupo (`memberOf`).** Extraímos o `CN` de cada DN de grupo. Se a
  política de grupos usar nomes com vírgulas escapadas ou aninhamento profundo,
  confira o `LDAP_GROUP` esperado. A verificação é *case-insensitive*.
- **Porta/host.** Confirme com a equipe de infraestrutura o host de AD correto e
  se 636 (LDAPS) está liberado no firewall a partir do servidor da aplicação.
- **Contas desabilitadas/expiradas.** O AD retorna o mesmo código 49 do bind;
  o sistema as trata como "credenciais inválidas".
```
