# ADR-014 — Refinamentos de Interface, Permissões, Exportação, E-mail Automático e Termos de Uso

**Status:** IMPLEMENTADO (2026-07-23) — todos os itens do escopo entregues; ver nota de implementação abaixo
**Data:** 2026-07-23
**Épico previsto:** E7 — Refinamentos Operacionais e Comunicação
**Substitui/estende:** complementa ADR-003 (Identidade/Autenticação), ADR-004 (Workflow como dado), ADR-005 (Histórico imutável), ADR-007 (Mecanismo duplo de autenticação), ADR-008 (Auditoria em duas camadas), ADR-012 (Ciclo de vida), ADR-013 (Captação multicanal)
**Fontes verificadas:** código atual de `backend/src`, `frontend/`, migrations `V01`–`V29`, `docs/adr/ADR-001`…`ADR-013`

> Este documento é uma **especificação técnica no formato de ADR estendido**. Descreve **como** cada alteração foi implementada, o impacto em cada camada e os critérios de aceite.

> **Nota de implementação (2026-07-23):** todo o escopo foi implementado. Decisões efetivadas: (a) **permissões** — homologar/desclassificar restritos a ADM no `WorkflowService` (validação primária) e ocultos no `detalhe.js`; colaborador mantém acesso pleno às iniciativas; alteração de perfil (promover/rebaixar) e ativar/desativar permanecem ADM-only, com **proteção de auto-edição** e **trava do último ADM**; (b) **gestão de usuários** — modal de visualização + promover/rebaixar na UI (backend `PATCH role`/`status` já existente, reforçado); (c) **logos** — arquivos copiados para nomes kebab-case (`logo-colorido-horizontal.png`/`logo-colorido-vertical.png`), referências corrigidas em `index.html`, `login.html`, `_layout.html` (também sanando a imagem quebrada preexistente); (d) **estágio Paralisada** (`paralisada`) sem migração (coluna livre); (e) **exportação** via `exceljs`/`pdfkit`, endpoint `GET /api/iniciativas/export` (ambos os perfis, respeitando filtros); (f) **e-mail** via `nodemailer` (`MailModule` global, template como módulo `.ts`, logo por CID, best-effort na Via 2, controlado por `MAIL_ENABLED`); (g) **Termos** — migration `V30`, `TermosModule` (`/api/termos/status`, `/api/termos`), modal no `index.html` para usuário autenticado sem perfil admin, recusa → logout + `/login?termos=recusados`, auditoria dupla (`TERMOS_ACEITES` + `INOVACAO_LOGS`). Build (`nest build`) e boot validados; geração de XLSX/PDF e render do e-mail testados; rotas e grafo de DI conferidos no boot.

---

## 1. Contexto

O sistema **CEDAE Inovação** é uma esteira de captação de iniciativas com dois grandes ambientes:

- **Formulário público (Via 2)** — `frontend/templates/index.html`, servido em `/` (rota pública, sem autenticação), consumido pelo `IniciativasController.submeter` (`POST /api/iniciativas`).
- **Painel administrativo** — shell único (`frontend/templates/admin/_layout.html`) + uma página por módulo (dashboard, iniciativas, detalhe, usuários, canais, logs, registrar), montadas no boot em `backend/src/main.ts` via substituição de placeholders (`{{CONTENT}}`, `{{BASE_PATH}}` etc.). Toda a área administrativa é protegida pelo `AdminGuard`.

A identidade vem de **login direto no Active Directory (LDAPS)** (`AuthController` + `LdapService`), com sessão em cookie `httpOnly` JWT (`SessionService`). A **autorização** é uma whitelist na tabela `ADMIN_USERS`, com dois papéis: `ADM` e `CONTRIBUTOR`. O `AdminGuard` só verifica se o usuário existe e está ativo em `ADMIN_USERS` (`user.admin`); as operações sensíveis exigem `role === 'ADM'` (método `requireAdm` / checagens pontuais).

O ciclo de vida das iniciativas é um **workflow orientado a dados** (`TRANSICOES_STATUS` + `WorkflowService`), com histórico imutável em `HISTORICO_STATUS` (ADR-005) e observações em `INICIATIVA_OBSERVACOES`. O estado real é `SUBMETIDA → EM_ANALISE → HOMOLOGADA | DESCLASSIFICADA`.

Surgiu um conjunto de ajustes de identidade visual, usabilidade, permissões, exportação, notificação por e-mail e conformidade (Termos de Uso) que este ADR consolida.

### 1.1 Achados relevantes da análise (fatos, não suposições)

1. **As logos referenciadas no código não existem no repositório.** `index.html:24`, `login.html:87` e `admin/_layout.html:27` apontam para `/static/img/logo-cedae-horizontal.png`, **arquivo inexistente** em `frontend/static/img/`. Os arquivos realmente presentes são: `logo-placeholder.png`, `COLORIDO - HORIZONTAL.png` e `COLORIDO - VERTICAL.png`. Ou seja, **hoje as três telas exibem imagem quebrada** — a troca de logo corrige simultaneamente esse defeito latente.
2. **Nomes de arquivo com espaços e maiúsculas** (`COLORIDO - HORIZONTAL.png`) são frágeis em URLs (exigem encoding `%20`) e destoam da convenção kebab-case do resto de `static/`. Isso influencia a recomendação (§7.1).
3. **O `estagio_desenvolvimento` é uma coluna `VARCHAR2` livre**, sem `CHECK` constraint nem enum no backend (o DTO usa `@IsOptional @IsString`). O KPI `por_estagio` do dashboard é montado por `GROUP BY` dinâmico — um novo valor **aparece automaticamente** na agregação, mas o frontend só lê chaves fixas (`ideacao`/`piloto`/`escala`).
4. **O `WorkflowService.transicionar` hoje autoriza QUALQUER transição para ADM **e** CONTRIBUTOR** (`isAdmin = role === 'ADM' || role === 'CONTRIBUTOR'`). Ou seja, um colaborador **já pode** homologar e desclassificar — exatamente o oposto do requisito.
5. **A modal de criação de usuário não fecha após sucesso.** `submitCreateUser` (`page-usuarios.js`) exibe a mensagem e chama `loadUsers()`, mas **nunca** chama `closeCreateUser()`.
6. **Existe backend para gestão de papéis, mas não há UI.** `PATCH /api/admin/users/:id/role` (`atualizarRole`) e `PATCH /api/admin/users/:id/status` (`toggleAdmin`) já existem; a tela `usuarios.html` só expõe ativar/desativar — **não há botão de promover/rebaixar**.
7. **Não há exportação, geração de PDF nem de planilha.** As dependências do backend (`backend/package.json`) **não** incluem `exceljs`, `xlsx`, `pdfkit`, `puppeteer` ou similar.
8. **Não há envio de e-mail.** Sem `nodemailer`, sem `@nestjs-modules/mailer`, e **sem variáveis SMTP** no `.env`/`.env.example`.
9. **A auditoria já é dupla (ADR-008):** ações administrativas em `INOVACAO_LOGS` (via `AuthService.registrarLog`) + histórico imutável de workflow em `HISTORICO_STATUS`.

---

## 2. Objetivos

1. Atualizar a identidade visual (logo principal, badge da home, logo da sidebar).
2. Acrescentar um novo estágio de desenvolvimento para iniciativas interrompidas.
3. Reequilibrar permissões: tornar `CONTRIBUTOR` quase equivalente a `ADM`, restringindo **apenas** homologar e desclassificar.
4. Corrigir o bug da modal de criação de usuário.
5. Habilitar gestão de usuários (editar próprio usuário, editar colaboradores, promover colaborador a administrador).
6. Habilitar exportação de iniciativas em Excel e PDF para ambos os perfis.
7. Enviar e-mail automático de confirmação ao proponente da Via 2.
8. Exibir Termos e Condições de Uso a usuários sem perfil administrativo, com registro auditável de aceite/recusa.

---

## 3. Escopo

- Substituição das três logos e ajustes de CSS associados.
- Novo estágio `paralisada` (front + agregações).
- Ajuste do controle de autorização (backend + frontend) para homologar/desclassificar.
- Correção da modal + feedback + refresh.
- UI e reforços de API para gestão de usuários.
- Módulo de exportação (Excel + PDF) com endpoints e bibliotecas.
- Módulo de e-mail (SMTP + template HTML + gatilho na Via 2).
- Módulo de Termos de Uso (modal + persistência de aceite + auditoria).

---

## 4. Itens fora do escopo

- Redesenho amplo de telas (mantém-se o design system atual — ADR-013/`project_frontend_redesign`).
- Alteração do mecanismo de autenticação LDAP/JWT.
- Migração para o schema totalmente normalizado (segue estratégia aditiva do ADR-001).
- Notificações por e-mail para outras vias (1/3/Externa) ou para transições de status — apenas a confirmação da Via 2 está no escopo.
- Fila/serviço assíncrono de mensageria (o envio será best-effort, não bloqueante — §12.4).
- Versionamento jurídico/redação final dos Termos (o texto será um placeholder aprovável; o mecanismo é o que este ADR entrega).

---

## 5. Arquitetura atual (resumo por camada)

| Camada | Elemento | Papel |
|---|---|---|
| Boot/roteamento | `backend/src/main.ts` | Renderiza templates no boot, injeta `{{BASE_PATH}}`, registra páginas admin e static assets (`/static`). |
| Autenticação | `AuthController`, `LdapService`, `SessionService` | Login AD → cookie JWT; `readLogin()` resolve identidade. |
| Autorização | `AdminGuard`, `AuthService.resolveUser` | `user.admin` (existe em `ADMIN_USERS`) + `role` (`ADM`/`CONTRIBUTOR`). |
| Iniciativas | `IniciativasController`, `CaptacaoController`, `IniciativasService` | Submissão pública (Via 2) e cadastro manual (Vias 1/3/Externa). |
| Workflow | `WorkflowService` | Transições, histórico, observações. |
| Admin | `AdminController`, `AdminService` | KPIs, logs, gestão de `ADMIN_USERS`, busca AD. |
| Canais | `CanaisAdminController`, `CanaisService` | Configuração de canais (edição só ADM). |
| Frontend | `frontend/templates/*`, `frontend/static/js/*` | MPA vanilla; `admin-core.js` = guard + formatadores; uma página JS por módulo. |
| Auditoria | `INOVACAO_LOGS` + `HISTORICO_STATUS` | Duas camadas (ADR-008). |

---

## 6. Arquitetura proposta (visão geral)

Todas as mudanças são **aditivas e incrementais** — nenhuma reescrita estrutural. Introduzem-se **dois módulos NestJS novos** e um conjunto de alterações pontuais:

- **`MailModule`** (`backend/src/mail/`): `MailService` (transporte SMTP via `nodemailer`) + templates HTML. Consumido pelo `IniciativasService.criar` (Via 2).
- **`ExportModule`** ou extensão do `IniciativasController`: endpoints `GET /api/iniciativas/export` (xlsx/pdf), reutilizando `IniciativasService.listar`/`getById`.
- **`TermosModule`** (`backend/src/termos/`): `TermosController` + `TermosService` + tabela `TERMOS_ACEITES`.
- Ajustes cirúrgicos em `WorkflowService`, `page-usuarios.js`, `detalhe.js`, `index.html`, `registrar.html`, `_layout.html`, `admin-core.js`, CSS.

---

## 7. Alterações de Frontend

### 7.1 Logos (itens 1, 2, 3)

**Recomendação transversal — normalizar os nomes dos arquivos.** Antes de referenciar, **renomear/copiar** os PNGs para nomes web-safe em kebab-case, evitando `%20` e inconsistência:

| Arquivo atual | Nome recomendado |
|---|---|
| `COLORIDO - HORIZONTAL.png` | `logo-colorido-horizontal.png` |
| `COLORIDO - VERTICAL.png` | `logo-colorido-vertical.png` |
| `logo-placeholder.png` | *(mantém)* |

> **Alternativa** (se os nomes precisarem ser preservados): referenciar com encoding — `/static/img/COLORIDO%20-%20HORIZONTAL.png`. **Não recomendada**: frágil, propensa a erro em edições futuras e destoa da convenção. A recomendação é renomear.

**Item 1 — Logo principal da home → `logo-placeholder`:**
- Componente: `frontend/templates/index.html:24` (`<img class="brand-logo" src=".../logo-cedae-horizontal.png">`).
- Ação: trocar `src` para `logo-placeholder.png`. Corrige de imediato a imagem quebrada (§1.1-1).
- CSS: `.brand-logo` (`style.css:194`, `.980`, `.1019`, `.1104`) usa altura fixa por breakpoint — validar proporção do placeholder; se necessário limitar por `max-height` sem quebrar o layout do header.

**Item 2 — Badge "Formulário Via 2" → logo `COLORIDO - HORIZONTAL`:**
- Componente: `frontend/templates/index.html:46` (`<p class="hero-label">Formulário Via 2</p>`).
- Ação: substituir o `<p>` de texto por um `<img>` (ex.: `<img class="hero-logo" src=".../logo-colorido-horizontal.png" alt="CEDAE — Conexões que Transformam">`).
- CSS: a classe `.hero-label` (`style.css:341`, `:358` com pseudo-elemento `::before` verde e `animation-delay` em `:808`) é estilizada como *chip* de texto. Ao virar imagem, **remover/ajustar** `.hero-label::before` e o padding/typografia; criar `.hero-logo` com `max-width`/`height:auto` e preservar a animação de entrada (`animation-delay: 40ms`).
- Acessibilidade: definir `alt` significativo (a informação textual "Formulário Via 2" some; avaliar manter um `aria-label`/`sr-only` se o contexto for necessário para leitores de tela).

**Item 3 — Logo da sidebar → `COLORIDO - VERTICAL`:**
- Componente: `frontend/templates/admin/_layout.html:27` (`<img>` dentro de `.sidebar-brand-plate`).
- Ação: trocar `src` para `logo-colorido-vertical.png`.
- CSS: `.sidebar-brand-plate img` (`shell.css:61`) usa `max-width:172px`; a versão **vertical** é mais alta que larga — ajustar para limitar por **altura** (ex.: `max-height`) e revalidar o estado **colapsado** da sidebar (`shell.css:174-181`, `:306-308`), onde a placa some e entra o `.sidebar-brand-mark` (SVG gota). O SVG de colapso pode permanecer.

**Reutilização/impacto cruzado das logos:** a mesma referência quebrada existe em **`login.html:87`** (tela de login). O item 1 não a menciona, mas para consistência visual **recomenda-se** trocá-la também (para `logo-placeholder.png` ou `logo-colorido-horizontal.png`). Fica como **recomendação** (§17), fora do escopo obrigatório.

### 7.2 Novo estágio (item 4) — decisão de nomenclatura

**Decisão: `Paralisada`** (valor persistido `paralisada`).

Justificativa (UX): entre `Pausada` (sugere interrupção temporária e voluntária, com retomada implícita), `Suspensa` (conota decisão formal/administrativa de suspensão) e `Paralisada`, esta última comunica com mais precisão o cenário de **iniciativa interrompida por impedimento** — travada, sem progresso, exigindo atenção da Assessoria — sem prometer retomada nem implicar ato formal. É o rótulo que melhor sinaliza "precisa de intervenção" num funil de inovação. Observa-se ainda que `estagio_desenvolvimento` é um **estágio de maturidade**, distinto do **status de workflow** (`HOMOLOGADA`/`DESCLASSIFICADA`); "Paralisada" não colide semanticamente com nenhum status terminal.

Pontos de alteração no frontend:
- `frontend/templates/index.html` — novo `<label class="radio-option">` no grupo `estagio_desenvolvimento` (após "Escala"), com `value="paralisada"` e microcopy (ex.: *"A iniciativa foi iniciada mas está interrompida/travada no momento."*).
- `frontend/templates/admin/registrar.html:187-191` — nova `<option value="paralisada">Paralisada</option>` no `<select>`.
- `frontend/static/js/admin-core.js` — `ESTAGIO_MAP.paralisada = ['Paralisada', 'badge-paralisada']`.
- `frontend/static/css/admin.css` (após `:232`) — nova classe `.badge-paralisada` (paleta neutra/cinza ou âmbar suave, distinta de ideação/piloto/escala).
- Dashboard: `frontend/static/js/page-dashboard.js` (`kpi-*` e `renderFunnel`) e o template `dashboard.html` — decidir se "Paralisada" entra como KPI/coluna do funil. **Recomendação:** exibir como contador separado (não como etapa do funil linear, já que representa saída/interrupção do fluxo).

### 7.3 Permissões no frontend (item 5)

- `frontend/static/js/detalhe.js:157-164` (`loadAcoes`) — os botões **Homologar** e **Desclassificar** (transições a partir de `EM_ANALISE`) devem ser ocultados/desabilitados quando `Admin.me.role !== 'ADM'`. `Admin.me` já está disponível (`admin-core.js`). Recomenda-se filtrar o array `TRANSICOES.EM_ANALISE` por papel.
- `frontend/static/js/admin-core.js` (`applyRoleNav`) e `usuarios.html`/`page-usuarios.js` — ver §10 (a decisão de permissões redefine o que fica visível para `CONTRIBUTOR`).

### 7.4 Correção da modal (item 6)

- `frontend/static/js/page-usuarios.js` (`submitCreateUser`) — no ramo `if (res.ok)`: (a) chamar `closeCreateUser()`, (b) manter `loadUsers()` para atualizar a lista, (c) exibir **feedback de sucesso** fora da modal.
- **Feedback:** não existe util de *toast* global (`ui.js` não expõe nenhum). **Recomendação:** adicionar um pequeno helper `CedaeUI.toast(msg, tipo)` em `ui.js` (reutilizável por todas as páginas) e usá-lo aqui. Alternativa mínima: manter a mensagem inline e fechar a modal após um `setTimeout` curto — menos elegante. Recomenda-se o toast.

### 7.5 Gestão de usuários — UI (item 7)

- `frontend/templates/admin/usuarios.html` + `page-usuarios.js` — acrescentar, na coluna "Ação", controles para **promover/rebaixar** (`PATCH /users/:id/role`) além de ativar/desativar (já existe). Respeitar as travas de §10 (evitar auto-rebaixamento e remoção do último ADM).
- "Editar próprio usuário": como `nome`/`email` são resolvidos do AD, a edição é limitada; a ação prática é **gestão de papel/status**. Documentar que edição de dados cadastrais permanece derivada do AD.

### 7.6 Termos de Uso — UI (item 8)

- Ver §12-bis. Modal em `index.html` (ou página dedicada `/termos`) exibida no primeiro acesso de usuário autenticado sem perfil admin/colaborador.

---

## 8. Alterações de Backend

| Área | Arquivo | Mudança |
|---|---|---|
| Workflow (permissões) | `workflow/workflow.service.ts` | Restringir `HOMOLOGADA`/`DESCLASSIFICADA` a `role === 'ADM'` (§10). |
| Gestão de usuários | `admin/admin.controller.ts`, `admin/admin.service.ts` | Reforços em `atualizarRole`/`toggleAdmin` (anti-escalonamento, último ADM). Reavaliar `requireAdm` conforme §10. |
| E-mail | `mail/` (novo módulo) | `MailModule` + `MailService` + templates; consumido por `IniciativasService.criar`. |
| Exportação | `iniciativas/*` (ou `export/` novo) | Endpoints `GET /api/iniciativas/export`. |
| Termos | `termos/` (novo módulo) | `TermosController` + `TermosService`; consulta/gravação de aceite. |
| Auth | `auth/auth.service.ts` | (Opcional) sobrecarga de `registrarLog` para IP; ou passar IP no `detalhe`. |

Detalhes de cada item nas seções específicas (§10, §11, §12, §12-bis).

---

## 9. Alterações de Banco de Dados

Seguindo a estratégia **aditiva** (ADR-001) e o padrão idempotente das migrations existentes (`V19`, `V28`, `V29`).

### 9.1 Novo estágio `paralisada`
- **Sem migração obrigatória.** `ESTAGIO_DESENVOLVIMENTO` é `VARCHAR2` livre, sem `CHECK`. O novo valor é aceito imediatamente.
- **Recomendação:** **não** introduzir `CHECK` constraint agora (manteria o domínio implícito atual e evitaria acoplamento). Se, no futuro, houver tabela de domínio (`DOMINIO_VALORES` existe — `V01`), pode-se semear "paralisada" ali para alimentar filtros; documentar como melhoria.

### 9.2 Termos de Uso — nova tabela
Nova migration (próximo número livre — **`V30__create_termos_aceites.sql`**), idempotente:

```
TERMOS_ACEITES (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  login         VARCHAR2(100) NOT NULL,   -- identidade normalizada (mesma chave de ADMIN_USERS)
  versao_termos VARCHAR2(20)  NOT NULL,   -- ex.: '1.0' (permite re-aceite quando a versão muda)
  acao          VARCHAR2(10)  NOT NULL,   -- 'ACEITE' | 'RECUSA'  (CHECK)
  ip            VARCHAR2(45),             -- IPv4/IPv6, quando disponível
  user_agent    VARCHAR2(400),           -- opcional (rastreabilidade)
  registrado_em TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP) NOT NULL,
  CONSTRAINT CK_TA_ACAO CHECK (acao IN ('ACEITE','RECUSA'))
)
-- índice por (login, versao_termos) para consulta de status.
```

Justificativa do design: a tabela guarda o **estado autoritativo** de aceite (com versão, para re-consentimento quando os termos mudarem) e serve de trilha própria; o registro em `INOVACAO_LOGS` (§12-bis) mantém a integração com a auditoria geral (ADR-008, duas camadas).

### 9.3 Auditoria/IP
- `INOVACAO_LOGS` (colunas atuais: `USERNAME`, `ACAO`, `DETALHE`, `CRIADO_EM`) **não tem coluna de IP**. Para não alterar o schema legado, **recomenda-se** carregar IP + versão dentro de `DETALHE` (string estruturada). Alternativa: `ALTER TABLE INOVACAO_LOGS ADD IP VARCHAR2(45)` — mudança aditiva simples, porém obriga tocar `AuthService.registrarLog`. **Recomendação:** manter IP em `TERMOS_ACEITES.ip` (dado estruturado) e replicar no `DETALHE` do log (legibilidade), sem alterar `INOVACAO_LOGS`.

---

## 10. Alterações de Permissões

### 10.1 Regra de negócio
`CONTRIBUTOR` deve ser **praticamente equivalente** a `ADM`, com **apenas duas** restrições: **não homologar** e **não desclassificar**.

### 10.2 Onde as permissões são controladas hoje
- **Backend (guard):** `AdminGuard` — só valida `user.admin` (pertencer a `ADMIN_USERS`).
- **Backend (papel):** checagens `role === 'ADM'` em:
  - `AdminController.requireAdm` → `ad-users` (busca/resolve), `POST users` (criar), `PATCH users/:id/status`, `PATCH users/:id/role`.
  - `CanaisAdminController.atualizar` (`PATCH /api/admin/canais/:codigo`).
  - `WorkflowService.transicionar` → **hoje libera TODAS as transições para ambos os papéis** (bug de permissão frente ao novo requisito).
- **Frontend:** `applyRoleNav` esconde `.nav-item[data-role="ADM"]` (Canais) de não-ADM; `usuarios.html` esconde "Novo Admin" de não-ADM; `detalhe.js` mostra Homologar/Desclassificar a todos.

### 10.3 Mudança recomendada
1. **Bloquear homologar/desclassificar para não-ADM** — no `WorkflowService.transicionar`, negar quando `statusDestino ∈ {HOMOLOGADA, DESCLASSIFICADA}` e `role !== 'ADM'` (`ForbiddenException`). Esta é a **validação primária** (não confiar no frontend).
   - **Alternativa data-driven (recomendada a médio prazo):** usar a coluna `TRANSICOES_STATUS.perfil_requerido` (já existe, hoje ignorada) para expressar "esta transição exige ADM", alinhado ao ADR-004 (workflow como dado). No curto prazo, a checagem explícita em código é suficiente e mais simples; registrar o *débito técnico* de migrar para `perfil_requerido`.
2. **Liberar as demais operações a `CONTRIBUTOR`** — remover as travas `requireAdm` das operações que o requisito quer disponíveis a ambos (ex.: busca AD, configuração de canais). **Exceção crítica de segurança abaixo.**
3. **Frontend** — filtrar os botões Homologar/Desclassificar por `role === 'ADM'` (§7.3) e reexibir a navegação/ações antes exclusivas de ADM para `CONTRIBUTOR`.

### 10.4 Risco de escalonamento de privilégio (decisão importante)
O requisito diz "apenas duas restrições". Porém, gestão de usuários inclui **promover para ADM** e **criar usuário ADM**. Se `CONTRIBUTOR` puder alterar papéis para ADM, ele **contorna** a restrição (promove a si mesmo → homologa). Isso transforma "duas restrições" em "nenhuma".

**Decisão recomendada:** manter como **ADM-only** exatamente as operações que **concedem privilégio de ADM**:
- `PATCH /users/:id/role` para o alvo `ADM` (promoção) e alteração do próprio papel;
- criação de usuário com `role = 'ADM'`.

`CONTRIBUTOR` pode fazer todo o restante (criar/gerir colaboradores `CONTRIBUTOR`, exportar, configurar canais, tramitar até `EM_ANALISE`, registrar iniciativas). Justificativa: preserva a **intenção** do requisito (colaborador ≈ admin) sem abrir um caminho de auto-escalonamento que anularia a única restrição pedida; alinha-se à seção "Gestão de usuários", que enquadra a **promoção** como capacidade do Administrador.

> **Ponto de aprovação explícito:** se a Assessoria preferir a leitura literal (colaborador também promove a ADM), registrar a aceitação consciente do risco. A recomendação técnica é a trava anti-escalonamento acima.

### 10.5 Inconsistências a corrigir
- `WorkflowService` comenta "isAdmin" mas aceita `CONTRIBUTOR` — alinhar código e semântica.
- Garantir **defesa em profundidade**: mesmo ocultando botões no frontend, o backend deve rejeitar (o `detalhe.js` faz `fetch` direto; sem a checagem no `WorkflowService` a restrição seria burlável).

---

## 11. Estratégia de Exportação

### 11.1 Situação atual
Não há exportação, PDF ou planilha; nenhuma biblioteca correspondente instalada (§1.1-7).

### 11.2 Bibliotecas — recomendação
- **Excel:** **`exceljs`** — API rica (estilos, larguras, cabeçalhos), sem dependências nativas, licença permissiva. Preferível a `xlsx`/SheetJS (limitações de estilo na versão community).
- **PDF:** **`pdfkit`** (+ util de tabela, ex. layout manual ou `pdfkit-table`) — geração server-side sem navegador headless. Preferível a **Puppeteer** (Chromium ~300MB, pesado para container Oracle) quando o conteúdo é tabular. Se, futuramente, exigir-se PDF pixel-fiel a um layout HTML rico, reconsiderar um renderizador HTML→PDF; para a lista/ficha atual, `pdfkit` basta.

### 11.3 Endpoints
`GET /api/iniciativas/export?format=xlsx|pdf&canal=&status=&q=` — protegido por `AdminGuard` (disponível a **ambos** os perfis). Responde com `Content-Type` e `Content-Disposition: attachment` adequados.

- **Escopo/filtros:** a listagem (`page-iniciativas.js`) filtra **no cliente** por `canal` e por termo de busca. Para o export ser consistente com o que o usuário vê, o endpoint deve **aceitar os mesmos filtros** (`canal`, `q` e, se aplicável, `status`) e reproduzi-los no `IniciativasService`. Alternativa mais simples (e recomendada para a 1ª entrega): frontend envia os filtros correntes na query; o backend refaz a seleção server-side sobre `INOVACAO_INICIATIVAS`.

### 11.4 Campos exportados
- **Export de lista (recomendado):** `codigo_publico`, `titulo_iniciativa`, `nome_colaborador`, `area_proponente`, `estagio_desenvolvimento`, `status`, `canal_codigo`, `proponente_tipo`, `organizacao_externa`, `criado_em` (campos de `IniciativasService.listar`).
- **Export de ficha individual (opcional/futuro):** todos os campos de `getById` (blocos 0–IV + procedência), útil para PDF de uma iniciativa.
- **Recomendação:** entregar primeiro o export de **lista** (xlsx e pdf) respeitando filtros; ficha individual como incremento.

### 11.5 Frontend
- Botões "Exportar Excel" / "Exportar PDF" na toolbar de `iniciativas.html`, disparando download com os filtros vigentes. Sem nova dependência no cliente (o backend gera o arquivo).

---

## 12. Estratégia de Envio de E-mails

### 12.1 Situação atual
Inexistente. Sem `nodemailer`, sem SMTP configurado.

### 12.2 Serviço e configuração
- **Biblioteca:** `nodemailer` (padrão de mercado, transporte SMTP simples). Encapsular num `MailModule`/`MailService` (`backend/src/mail/`).
- **Variáveis de ambiente** (adicionar a `.env` e `.env.example`):
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (true/false), `SMTP_USER`, `SMTP_PASS`;
  - `MAIL_FROM=bi.7@cedae.com.br` (remetente de teste), `MAIL_FROM_NAME` (ex.: "Assessoria de Inovação CEDAE");
  - `MAIL_ENABLED` (flag para desligar em ambientes sem SMTP — dev).
- O `main.ts` já usa `dotenv/config`; nenhuma mudança de bootstrap além de importar o `MailModule` no `AppModule`.

### 12.3 Gatilho
Na **Via 2** (`IniciativasController.submeter` → `IniciativasService.criar`), **após** a persistência bem-sucedida, disparar o e-mail para `email_proponente` (campo obrigatório no `CreateIniciativaDto`).

### 12.4 Robustez (não bloquear a submissão)
Seguir o padrão já usado com `registrarLog`: envio **best-effort**, `.catch()` silencioso/logado, **nunca** propagar erro de e-mail para a resposta HTTP da submissão. O proponente recebe o protocolo na tela independentemente do e-mail.

### 12.5 Template HTML
- **Local recomendado:** `backend/src/mail/templates/` (empacotar no build; validar que o `nest build` copie assets não-`.ts` — configurar `nest-cli.json` `compilerOptions.assets`, hoje ausente).
- **Estratégia de geração:** manter simplicidade e coerência com o projeto — **substituição de placeholders** (`{{PROTOCOLO}}`, `{{NOME}}`, `{{BASE_PATH}}`) num HTML estático, exatamente como `main.ts.renderTemplate` já faz. Evita nova dependência de template engine. **Alternativa:** `handlebars` se as personalizações crescerem — registrar como caminho de evolução.
- **Logo no e-mail:** clientes de e-mail bloqueiam recursos externos e a `/static` pode não ser publicamente acessível. **Recomendação:** anexar `logo-colorido-horizontal.png` como **inline/CID** (`cid:logo`) referenciado no `<img>`. Alternativa: base64 embutido (alguns clientes, ex. Outlook, degradam). CID é o mais robusto.
- **Conteúdo obrigatório:** logo COLORIDO - HORIZONTAL; mensagem de confirmação; **número do protocolo** (`codigo_publico`, ex. `INOV-2026-001`); confirmação de registro com sucesso; orientação de contato em caso de dúvidas via **bi.7@cedae.com.br**.

### 12.6 Personalizações futuras
Isolar o "assunto + template + dados" no `MailService` (ex.: `sendConfirmacaoVia2({ nome, protocolo, email })`), de modo que novos e-mails (outras vias, transições) reutilizem o transporte e o layout base. Registrar como extensão natural.

---

## 12-bis. Termos e Condições + Auditoria (requisito adicional)

### 12-bis.1 Público-alvo e momento de exibição
**Alvo:** todo usuário **autenticado no AD** que **não** possui perfil administrativo — isto é, `resolveUser` retorna `admin === false` / `role === null` (login que **não** está em `ADMIN_USERS`). Esses usuários hoje conseguem autenticar (o `AuthController.login` emite sessão a qualquer usuário AD válido), mas são redirecionados pelo guard por não serem admins.

**Momento:** no **primeiro acesso autenticado** desse tipo de usuário (e sempre que a **versão** dos termos mudar). Fluxo:
1. Usuário autentica via `/login`.
2. O cliente consulta o status de aceite (`GET /api/termos/status`).
3. Se **não** houver aceite da versão corrente → exibir a **modal de Termos** (recomendado sobre a landing pública `index.html`) antes de liberar qualquer uso identificado; a alternativa de **página dedicada `/termos`** é aceitável se a modal ficar visualmente apertada.

> **Ambiguidade registrada:** o formulário Via 2 é **anônimo** (sem identidade), portanto os Termos **não** se aplicam a submissões públicas não autenticadas — não há chave para registrar aceite. A interpretação adotada (usuário **autenticado** sem perfil admin) é a única compatível com "não possuir perfil de Administrador ou Colaborador". Caso a Assessoria queira Termos também para o público anônimo, a única via seria consentimento por **cookie/localStorage** sem vínculo de identidade (auditoria limitada) — registrar como decisão separada.

### 12-bis.2 Controle de aceite/recusa
- Estado autoritativo em **`TERMOS_ACEITES`** (§9.2), chaveado por `login` + `versao_termos`.
- `GET /api/termos/status` → `{ aceito: boolean, versaoAtual: string }` (consulta a última ação do login para a versão corrente).
- `POST /api/termos` → body `{ acao: 'ACEITE' | 'RECUSA' }`; grava linha em `TERMOS_ACEITES` (com IP do request e user-agent) **e** registra no log (§12-bis.4).
- **Versão dos termos:** constante de configuração (ex.: `TERMOS_VERSAO=1.0` em env ou `parametros_sistema` — `V05`). Ao subir a versão, o status volta a "não aceito" e a modal reaparece — **re-consentimento** controlado.

### 12-bis.3 Fluxo em caso de recusa
**Decisão:** ao recusar, **encerrar a sessão** (`logout` → `SessionService.clear`) e **redirecionar para `/login`** com mensagem explicativa ("É necessário aceitar os Termos para utilizar o sistema.").

Justificativa: sem aceite, o usuário **não** tem função disponível no ambiente identificado (não é admin); permitir sessão ativa sem consentimento não agrega e complica a governança. Logout + bloqueio é o comportamento mais simples, seguro e auditável, e permite nova tentativa a qualquer momento. Alternativas descartadas: (a) manter logado porém bloqueado — estado ambíguo; (b) apenas fechar a modal — permitiria uso sem consentimento.

### 12-bis.4 Auditoria (integração com ADR-008)
Registrar **toda** ação (ACEITE **e** RECUSA) em **duas camadas**, coerente com ADR-008:
1. **`TERMOS_ACEITES`** — estado estruturado e autoritativo: `login`, `versao_termos`, `acao`, `ip`, `user_agent`, `registrado_em`.
2. **`INOVACAO_LOGS`** — trilha geral, via `AuthService.registrarLog(login, acao, detalhe)`:
   - `ACAO`: `'termos_aceite'` ou `'termos_recusa'`;
   - `DETALHE`: string estruturada com `versao` e `ip` (ex.: `"versao=1.0; ip=10.1.2.3"`), já que `INOVACAO_LOGS` não tem coluna de IP (§9.3).
- **IP:** obter de `req.ip`/`x-forwarded-for` (atrás do IIS; validar cabeçalho de proxy). Registrar "não disponível" quando ausente — nunca falhar por causa disso.
- **Não bloqueante:** o log segue o padrão best-effort do projeto (o aceite grava em `TERMOS_ACEITES` de forma transacional; o `INOVACAO_LOGS` é complementar e tolerante a falha).

### 12-bis.5 Componentes, rotas e serviços impactados
- **Novo:** `TermosModule`, `TermosController` (`GET /api/termos/status`, `POST /api/termos`), `TermosService`, migration `V30`.
- **Frontend:** modal em `index.html` (+ `frontend/static/js/` — novo `termos.js` ou hook em `app.js`), consumindo `api.js`.
- **Reuso:** `SessionService` (logout), `AuthService.registrarLog` (auditoria), `AppModule` (registrar módulo).

---

## 13. Impactos Técnicos (checagem obrigatória)

| Dimensão | Impacto |
|---|---|
| Autenticação | Sem mudança no mecanismo. Termos consomem sessão/logout existentes. |
| Autorização | Ajuste central: homologar/desclassificar ADM-only; trava anti-escalonamento em papéis (§10). |
| Rotas | Novas: `GET /api/iniciativas/export`, `GET/POST /api/termos`. Páginas admin inalteradas em roteamento. |
| Componentes compartilhados | `admin-core.js` (ESTAGIO_MAP, role), `ui.js` (toast), `_layout.html` (logo). |
| Layout/CSS | `.hero-label`→`.hero-logo`, `.brand-logo`, `.sidebar-brand-plate img`, `.badge-paralisada`. |
| Entidades | `INOVACAO_INICIATIVAS` (sem alteração de schema p/ estágio). Nova `TERMOS_ACEITES`. |
| DTOs | Nenhum novo campo obrigatório (estágio é string livre). Possível `TermosAcaoDto`, `ExportQueryDto`. |
| Enums | Não há enum de estágio no backend; `ESTAGIO_MAP` (front) recebe `paralisada`. |
| Validações | Reforço de papel no workflow; validação `acao ∈ {ACEITE,RECUSA}`. |
| APIs | Export + Termos + reforços de gestão de usuários. |
| Serviços | Novos `MailService`, `TermosService`; ajuste `WorkflowService`, `IniciativasService`. |
| Banco/migrações | `V30__create_termos_aceites.sql` (idempotente). |
| Exportações | Nova capacidade (xlsx/pdf). |
| Notificações | Novo e-mail de confirmação Via 2. |
| Testes | §15. |
| Build | `nest-cli.json` precisa copiar assets de e-mail (templates/imagem) — hoje sem `assets`. |

---

## 14. Dependências envolvidas

**Reutilizáveis (já no projeto):**
- `SessionService`/`AuthService`/`AdminGuard` — identidade e guarda.
- `AuthService.registrarLog` + `INOVACAO_LOGS` — auditoria.
- Padrão `renderTemplate` de `main.ts` — base para templates de e-mail.
- `DatabaseService` (oracledb) — persistência dos Termos.
- Design system/CSS (`style.css`, `shell.css`, `admin.css`) e formatadores (`admin-core.js`).
- Endpoints `atualizarRole`/`toggleAdmin` já existentes — base da gestão de usuários.

**Novas dependências a adicionar (backend):**
- `nodemailer` (+ `@types/nodemailer`) — e-mail.
- `exceljs` — Excel.
- `pdfkit` (+ `@types/pdfkit`, e opcionalmente `pdfkit-table`) — PDF.

Nenhuma dependência nova no frontend (MPA vanilla).

---

## 15. Estratégia de Testes

- **Permissões (crítico):** testes de que `CONTRIBUTOR` recebe `403` ao tentar `PATCH /iniciativas/:id/status` para `HOMOLOGADA`/`DESCLASSIFICADA`, e `200` para `EM_ANALISE`; que `ADM` consegue ambos; que `CONTRIBUTOR` não promove a ADM (anti-escalonamento).
- **Workflow:** transições válidas/ inválidas continuam respeitando `TRANSICOES_STATUS`.
- **Modal:** teste manual/e2e — criar usuário fecha a modal, atualiza a lista e mostra feedback.
- **Export:** validar `Content-Type`/`Content-Disposition`, que os filtros são respeitados e que os campos batem com a lista; abrir os arquivos gerados (xlsx/pdf).
- **E-mail:** com `MAILDEV`/`smtp4dev` local — confirmar remetente `bi.7@cedae.com.br`, protocolo correto, logo via CID; garantir que falha de SMTP **não** quebra a submissão (best-effort).
- **Termos:** status antes/depois do aceite; recusa → logout+redirect; re-exibição ao mudar a versão; gravação em `TERMOS_ACEITES` **e** `INOVACAO_LOGS` (com IP).
- **Regressão visual:** header da home, hero, sidebar (normal e colapsada), login — sem imagem quebrada.
- **Migração:** rodar `V30` duas vezes (idempotência), como as demais.

> Observação: o repositório **não possui suíte de testes automatizada** hoje (sem `jest`/specs no backend). Recomenda-se, no mínimo, testes manuais roteirizados; e, como melhoria, introduzir `@nestjs/testing` para os pontos críticos de permissão.

---

## 16. Riscos

| Risco | Sev. | Mitigação |
|---|---|---|
| **Escalonamento de privilégio** via gestão de papéis anula a restrição de homologar/desclassificar. | Alta | Trava anti-escalonamento (§10.4); ponto de aprovação explícito. |
| Restrição só no frontend seria burlável por `fetch` direto. | Alta | Validação primária no `WorkflowService` (defesa em profundidade). |
| Nomes de arquivo de logo com espaço quebram em produção (encoding). | Média | Renomear para kebab-case (§7.1). |
| Falha de SMTP bloqueando submissões. | Média | Envio best-effort não bloqueante (§12.4). |
| Logo não aparece no e-mail (bloqueio de recurso externo). | Média | Anexo CID (§12.5). |
| `nest build` não copia templates/imagem do e-mail. | Média | Configurar `assets` no `nest-cli.json`. |
| Termos aplicados ao público anônimo por engano. | Baixa | Escopo definido em usuários autenticados (§12-bis.1). |
| IP indisponível atrás do IIS. | Baixa | Ler `x-forwarded-for`; registrar "não disponível". |
| Novo estágio quebra agregações do dashboard que assumem 3 chaves. | Baixa | Atualizar `page-dashboard.js`/`dashboard.html` (§7.2). |

---

## 17. Plano de Rollback

Todas as mudanças são reversíveis por serem majoritariamente aditivas:
- **Frontend (logos, badge, estágio, modal, botões):** revert de commit; assets antigos permanecem.
- **Permissões:** reverter a checagem no `WorkflowService` restaura o comportamento anterior.
- **Export/E-mail/Termos:** são módulos novos e isolados — desabilitar via flag (`MAIL_ENABLED`, feature-flag de Termos em `parametros_sistema`) ou remover o import no `AppModule` sem afetar o núcleo.
- **Banco:** `TERMOS_ACEITES` é tabela nova; rollback = `DROP TABLE TERMOS_ACEITES` (sem impacto em dados existentes). Nenhuma coluna legada é alterada. **Não** há migração destrutiva.
- **Dependências:** remover `nodemailer`/`exceljs`/`pdfkit` do `package.json` se necessário.

---

## 18. Plano de Implementação (por etapas)

**Etapa 1 — Identidade visual (baixo risco, entrega rápida):**
1. Renomear/copiar logos para kebab-case.
2. Trocar `src` em `index.html` (brand), substituir badge por `<img>` (hero), trocar sidebar em `_layout.html`; ajustar CSS (`.hero-logo`, `.brand-logo`, `.sidebar-brand-plate img`). (Opcional: `login.html`.)

**Etapa 2 — Novo estágio + correção da modal (usabilidade):**
3. Adicionar `paralisada` (index/registrar/`ESTAGIO_MAP`/CSS/dashboard).
4. Corrigir `submitCreateUser` (fechar + atualizar + toast).

**Etapa 3 — Permissões (segurança):**
5. `WorkflowService`: homologar/desclassificar ADM-only.
6. Trava anti-escalonamento em papéis; liberar demais operações a `CONTRIBUTOR`.
7. Frontend: ocultar botões/ações conforme papel; reexibir navegação a `CONTRIBUTOR`.

**Etapa 4 — Gestão de usuários (UI):**
8. Controles de promover/rebaixar em `usuarios.html`/`page-usuarios.js` (backend já pronto).

**Etapa 5 — Exportação:**
9. Adicionar `exceljs`/`pdfkit`; endpoint `GET /api/iniciativas/export`; botões na toolbar; respeitar filtros.

**Etapa 6 — E-mail Via 2:**
10. `MailModule`/`MailService` (`nodemailer`), env SMTP, template HTML+CID, gatilho best-effort em `criar`; `nest-cli.json` assets.

**Etapa 7 — Termos + Auditoria:**
11. Migration `V30`; `TermosModule` (status/registro); modal + fluxo de recusa (logout); auditoria dupla.

---

## 19. Critérios de Aceitação

1. Home exibe a logo `logo-placeholder` no lugar da logo principal (sem imagem quebrada).
2. O badge "Formulário Via 2" foi substituído pela logo `COLORIDO - HORIZONTAL`.
3. A sidebar do painel exibe a logo `COLORIDO - VERTICAL`, inclusive no estado colapsado.
4. O formulário (público e de registro) oferece a opção **Paralisada**; iniciativas paralisadas aparecem corretamente em listas/badges/dashboard.
5. `CONTRIBUTOR` consegue usar todas as funções, **exceto** homologar e desclassificar (bloqueio no backend e ocultação no frontend); `ADM` mantém tudo.
6. `CONTRIBUTOR` **não** consegue conceder perfil ADM (anti-escalonamento) — ou, se a decisão literal for aprovada, o risco está formalmente aceito.
7. Ao criar usuário, a modal fecha, a lista atualiza e há feedback de sucesso.
8. `ADM` promove/rebaixa colaboradores pela interface; travas (último ADM, auto-rebaixamento) respeitadas.
9. `ADM` e `CONTRIBUTOR` exportam iniciativas em **Excel** e **PDF**, respeitando os filtros vigentes, com os campos definidos.
10. Ao submeter pela **Via 2**, o proponente recebe e-mail HTML (remetente `bi.7@cedae.com.br`) com logo COLORIDO - HORIZONTAL, mensagem de confirmação, **protocolo** e orientação de contato; falha de e-mail não impede a submissão.
11. Usuário autenticado **sem** perfil admin/colaborador vê os Termos no primeiro acesso; aceite libera o uso; recusa faz logout e redireciona; re-consentimento ao mudar a versão.
12. Aceite **e** recusa ficam registrados em `TERMOS_ACEITES` e em `INOVACAO_LOGS` (com versão e IP quando disponível).

---

## 20. Checklist Final

- [ ] Logos renomeadas para kebab-case e referências atualizadas (index, layout, login opcional).
- [ ] `.hero-label`→`.hero-logo`, `.brand-logo` e `.sidebar-brand-plate img` ajustados (inclui sidebar colapsada).
- [ ] Estágio `paralisada` em index, registrar, `ESTAGIO_MAP`, CSS e dashboard.
- [ ] `WorkflowService` bloqueia homologar/desclassificar para não-ADM (validação primária).
- [ ] Trava anti-escalonamento de papel (decisão §10.4 aprovada/registrada).
- [ ] Frontend oculta botões/ações por papel; navegação liberada a `CONTRIBUTOR`.
- [ ] `submitCreateUser` fecha modal + atualiza lista + feedback (toast em `ui.js`).
- [ ] UI de promover/rebaixar usuários (backend já existente) + travas.
- [ ] `exceljs`/`pdfkit` adicionados; endpoint de export com filtros; botões na toolbar.
- [ ] `MailModule`/`MailService` + env SMTP + template HTML/CID + gatilho best-effort na Via 2.
- [ ] `nest-cli.json` copia assets de e-mail no build.
- [ ] Migration `V30__create_termos_aceites.sql` (idempotente) aplicada.
- [ ] `TermosModule` (status/registro), modal, fluxo de recusa (logout) e auditoria dupla.
- [ ] `.env.example` atualizado (SMTP, `MAIL_FROM`, `TERMOS_VERSAO`, `MAIL_ENABLED`).
- [ ] Testes manuais roteirizados executados (permissões, export, e-mail, termos, visual).
- [ ] Rollback validado (flags/`DROP TABLE`/revert) sem impacto em dados legados.

---

### Anexo A — Inventário de arquivos impactados (referência de implementação)

**Frontend**
- `frontend/templates/index.html` (logo linha 24; badge linha 46; radios de estágio ~192-218)
- `frontend/templates/login.html` (logo linha 87 — opcional)
- `frontend/templates/admin/_layout.html` (logo sidebar linha 27)
- `frontend/templates/admin/registrar.html` (select estágio 187-191)
- `frontend/templates/admin/usuarios.html` (ações de usuário; modal)
- `frontend/templates/admin/dashboard.html` (KPI de estágio)
- `frontend/static/js/admin-core.js` (`ESTAGIO_MAP`, papel)
- `frontend/static/js/page-usuarios.js` (`submitCreateUser`, promover/rebaixar)
- `frontend/static/js/detalhe.js` (`loadAcoes` 153-181 — botões por papel)
- `frontend/static/js/page-dashboard.js` (`renderFunnel`, KPIs)
- `frontend/static/js/page-iniciativas.js` (botões de export; filtros)
- `frontend/static/js/ui.js` (novo `toast`)
- `frontend/static/js/` (novo `termos.js`) + `app.js` (hook de termos)
- `frontend/static/css/style.css` (`.hero-label`/`.hero-logo`, `.brand-logo`), `shell.css` (`.sidebar-brand-plate`), `admin.css` (`.badge-paralisada`)
- `frontend/static/img/` (renomear logos)

**Backend**
- `backend/src/workflow/workflow.service.ts` (permissão homolog/desclass)
- `backend/src/admin/admin.controller.ts` + `admin.service.ts` (gestão de usuários; anti-escalonamento)
- `backend/src/iniciativas/iniciativas.controller.ts` + `iniciativas.service.ts` (gatilho e-mail; export)
- `backend/src/mail/` (novo módulo + templates)
- `backend/src/termos/` (novo módulo)
- `backend/src/app.module.ts` (registrar módulos novos)
- `backend/src/auth/auth.service.ts` (auditoria/IP — opcional)
- `backend/nest-cli.json` (assets de e-mail)
- `backend/package.json` (`nodemailer`, `exceljs`, `pdfkit`)

**Banco / Config**
- `database/migrations/V30__create_termos_aceites.sql` (novo)
- `.env` / `.env.example` (SMTP, `MAIL_FROM`, `TERMOS_VERSAO`, `MAIL_ENABLED`)
