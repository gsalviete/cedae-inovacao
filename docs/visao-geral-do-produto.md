# CEDAE Inovação — Visão Geral do Produto

**Versão:** 1.0
**Data:** 2026-07-29
**Público-alvo:** Assessoria de Inovação, liderança, áreas usuárias, auditoria e novos integrantes do time
**Natureza:** documento de negócio — descreve *o que* o sistema faz e *qual problema resolve*. Não descreve implementação.

> Para o modelo de dados campo a campo, ver [`dicionario-de-dados.md`](dicionario-de-dados.md).
> Para as decisões arquiteturais que sustentam o que está descrito aqui, ver [`adr/`](adr/).

---

## 1. O que é o CEDAE Inovação

O **CEDAE Inovação** é o **Banco de Dados de Inovação da CEDAE** — o repositório
institucional único onde toda iniciativa de inovação da companhia é registrada,
analisada, decidida e acompanhada.

Ele cumpre três papéis, nesta ordem:

1. **Capta** iniciativas de inovação, venham de onde vierem.
2. **Tramita** cada iniciativa por um ciclo de vida único e auditável, até uma decisão formal.
3. **Mede** o portfólio resultante, produzindo indicadores confiáveis por origem, estágio, dimensão e desfecho.

O sistema atende dois públicos muito distintos:

| Público | O que faz no sistema | Como acessa |
|---|---|---|
| **Colaborador da CEDAE** (proponente) | Submete a própria ideia por um formulário guiado e recebe um número de protocolo | Formulário público, sem login |
| **Assessoria de Inovação** (analista/administrador) | Cadastra iniciativas captadas fora do formulário, analisa, decide, comenta, exporta e acompanha indicadores | Painel administrativo, com login corporativo (Active Directory) |

---

## 2. A dor que o sistema mitiga

Antes do sistema, a gestão do portfólio de inovação da CEDAE era feita
essencialmente **em planilha**, alimentada manualmente a partir de fontes
dispersas: e-mails, atas de reunião, consultas aos sistemas corporativos SGE/SGP
e conversas com parceiros externos.

Esse arranjo produz um conjunto de problemas conhecidos e mutuamente
reforçados. O sistema foi desenhado para atacar cada um deles.

### 2.1 Inconsistência de dados por uso de planilha

**O problema.** A planilha não impõe domínio de valores. A mesma área é digitada
como "GESUP", "Ge. Suprimentos" e "gerência de suprimentos"; o mesmo estágio
aparece como "ideação", "Ideia" e "conceito"; valores monetários convivem como
`10.000`, `R$ 10 mil` e `dez mil reais`. Qualquer tentativa de somar, agrupar ou
contar produz números diferentes conforme quem faz a conta.

**O que o sistema faz.** Todo campo classificatório tem **domínio fechado**,
apresentado como opção selecionável e validado no servidor — nunca digitado
livremente. Estágio de desenvolvimento, macrodimensão, perfil de impacto, tipo
de suporte, relevância estratégica, classificação Ação/Projeto, canal de origem e
tipo de instituição externa são todos conjuntos finitos e conhecidos
(ver [dicionário de dados, §4](dicionario-de-dados.md#4-domínios-de-valor)).
Onde o domínio fechado não cobre o caso real, existe um campo de observação
próprio e explícito (por exemplo, "Outros / Multidimensionais" abre um campo de
texto dedicado) — em vez de o usuário improvisar dentro do campo classificatório
e corromper a agregação.

### 2.2 Portfólio fragmentado — não existe "o número"

**O problema.** As iniciativas vivem em lugares diferentes conforme a origem: as
que o colaborador propõe espontaneamente ficam em um lugar, as levantadas em
reunião ficam na ata, as identificadas no SGE/SGP ficam numa planilha de
acompanhamento, e as de parceiros externos ficam no e-mail de quem conversou com
o parceiro. Perguntar "quantas iniciativas de inovação a CEDAE tem?" não tem
resposta única.

**O que o sistema faz.** **Base única, origem preservada.** As quatro vias de
captação (§4) gravam na *mesma* base, com o *mesmo* ciclo de vida, e cada
registro carrega o carimbo de por onde entrou. O total é um só; o recorte por
origem continua disponível como dimensão de análise, não como base separada.

### 2.3 Perda de rastreabilidade da decisão

**O problema.** Na planilha, mudar o status é sobrescrever uma célula. O estado
anterior desaparece, e com ele *quem* decidiu, *quando* e *por quê*. Meses depois
não há como reconstruir por que uma iniciativa foi desqualificada — nem
demonstrá-lo a uma auditoria.

**O que o sistema faz.** Cada mudança de estado gera um **evento imutável** no
histórico, com autor, data/hora e justificativa. Nada é sobrescrito: reverter uma
decisão **acrescenta** um evento de reversão, não apaga o anterior. A linha do
tempo completa de qualquer iniciativa é reconstituível a partir do registro
inicial de submissão até o desfecho atual.

### 2.4 O proponente submete e não sabe o que aconteceu

**O problema.** Quem manda uma ideia por e-mail ou formulário avulso não recebe
comprovante, não tem número para citar e não sabe se a proposta chegou.

**O que o sistema faz.** Toda iniciativa — de qualquer via — recebe um
**protocolo único** no padrão `INOV-AAAA-NNN`, exibido ao proponente na tela de
sucesso e enviado por e-mail de confirmação na submissão pelo formulário público.

### 2.5 Ausência de controle de acesso e de trilha de auditoria

**O problema.** Uma planilha compartilhada é editável por qualquer pessoa com o
link, sem distinção entre quem pode consultar, quem pode analisar e quem pode
decidir — e sem registro de quem fez o quê.

**O que o sistema faz.** O acesso ao painel exige **autenticação corporativa
(Active Directory)** e cadastro prévio em uma lista de autorização, com dois
perfis de permissão distintos (§6). Além do histórico de negócio, existe uma
**trilha técnica de auditoria** que registra logins, submissões, cadastros
manuais, edições administrativas, reclassificações, reversões de decisão e
aceites de termos.

### 2.6 Indicadores produzidos manualmente

**O problema.** Contar linhas de planilha por filtro é trabalhoso, precisa ser
refeito a cada apresentação e diverge conforme o momento em que foi extraído.

**O que o sistema faz.** O painel calcula os indicadores **diretamente sobre a
base, no momento da consulta** — sempre atuais e sempre coerentes com o
detalhamento. Ver §7.

### 2.7 Retrabalho de digitação e cópia entre sistemas

**O problema.** O analista consulta o SGE/SGP, identifica uma iniciativa
relevante e copia manualmente as informações para uma planilha de
acompanhamento. Esse arquivo passa a ser uma segunda cópia dos dados, que
envelhece e diverge da origem.

**O que o sistema faz.** Substitui essa planilha por um **cadastro centralizado e
guiado** (Via 1), que registra explicitamente a procedência — sistema de origem e
identificador do projeto na origem — permitindo voltar à fonte quando
necessário. A digitação continua sendo humana e deliberada; o que desaparece é a
planilha paralela.

### 2.8 Dados de terceiros sem consentimento registrado

**O problema.** Coletar nome, e-mail e área de um colaborador em formulário sem
registro de ciência do tratamento é uma exposição desnecessária sob a LGPD.

**O que o sistema faz.** A submissão pública exige **confirmação explícita de
ciência do aviso de privacidade** — validada no servidor, não apenas no
navegador — e registra o aceite na auditoria junto do protocolo. Usuários
autenticados do painel registram **aceite ou recusa dos Termos e Condições de
Uso**, versionados: uma nova versão dos termos volta a exigir manifestação.

### 2.9 Resumo

| Dor | Como o sistema mitiga |
|---|---|
| Inconsistência de dados (texto livre) | Domínios fechados, validados no servidor, com campo de observação dedicado onde o domínio não basta |
| Portfólio fragmentado por origem | Base única com carimbo de origem obrigatório |
| Decisão sem rastro | Histórico imutável com autor, data/hora e justificativa; reversão é evento novo |
| Proponente sem retorno | Protocolo `INOV-AAAA-NNN` + e-mail de confirmação |
| Sem controle de acesso | Login corporativo (AD) + lista de autorização + dois perfis |
| Indicadores manuais | Agregação calculada sobre a base, no momento da consulta |
| Cópia manual entre sistemas | Cadastro centralizado com procedência registrada |
| Consentimento não registrado | Ciência LGPD na submissão + Termos de Uso versionados no painel |

---

## 3. Conceito central: a Iniciativa

A **iniciativa** é a unidade de trabalho do sistema. Ela reúne, em um único
registro:

| Bloco | O que descreve |
|---|---|
| **Identificação do proponente** | Quem propôs, como falar com essa pessoa, de que área |
| **Escopo** | Qual o problema prático, qual a solução proposta, que risco isso mitiga, em que estágio está |
| **Metadados e orçamento** | Macrodimensão da inovação, perfil de impacto, necessidade de aporte, valor e retorno econômico estimado |
| **Suporte esperado** | Que tipo de apoio da Assessoria é considerado crítico para destravar a iniciativa |
| **Origem** | Por qual via entrou, se o proponente é interno ou externo, e a procedência específica da via |
| **Qualificação da Assessoria** | Relevância estratégica e classificação Ação/Projeto — avaliações internas, não do proponente |
| **Estado** | Situação atual no ciclo de vida, mais toda a linha do tempo de como chegou até ela |

Uma iniciativa **nasce com protocolo, com origem carimbada e com um evento
inicial de submissão** — sempre, independentemente da via. Esse é o contrato
invariante do sistema.

---

## 4. As quatro vias de captação

O princípio é **base única, origem preservada**: as quatro vias alimentam a mesma
base, com o mesmo ciclo de vida e a mesma governança. O que muda entre elas é
**quem digita** e **qual procedência é anotada** — nunca o fluxo posterior.

| Via | Nome | Quem digita | Autenticação | Procedência registrada |
|---|---|---|---|---|
| **Via 1** | Registro de Sistemas Corporativos (SGE/SGP) | Analista | Sim | Sistema de origem (SGE ou SGP) + identificador do projeto na origem (opcional) |
| **Via 2** | Formulário Interno de Submissão | O próprio colaborador | Não (público) | — |
| **Via 3** | Registro de Reuniões com Áreas | Analista | Sim | Data e área da reunião (preservadas como observação inicial) |
| **Captação Externa** | Iniciativas de ICTs, universidades, empresas e parceiros | Analista | Sim | Instituição de origem + tipo de instituição |

**Ponto importante:** nenhuma via faz importação, sincronização ou leitura
automática de sistema externo. A Via 1 **não integra** com SGE/SGP — o analista
consulta esses sistemas manualmente, por fora, e cadastra a iniciativa à mão. O
sistema apenas registra que aquela iniciativa foi identificada lá, e onde
encontrá-la de volta. Isso é uma decisão deliberada: a integração resolveria um
problema que não existe e acrescentaria um ponto de falha.

**Regras de procedência:**

- A Via 1 exige o sistema de origem (SGE ou SGP); o identificador do projeto é opcional e livre.
- A Captação Externa exige instituição e tipo de instituição, e é a única via em que o proponente pode ficar em branco — na prática a iniciativa costuma ser identificada antes de existir um contato formal.
- A Via 1 é automaticamente carimbada como **relevância estratégica: Planejamento Estratégico** — pela própria natureza da fonte.
- Depois de criada, a origem de uma iniciativa não é alterada pela operação normal.

---

## 5. Ciclo de vida da iniciativa

Todas as vias convergem para o mesmo fluxo. A origem qualifica a iniciativa; não
cria um processo paralelo.

```
   [Entrada por qualquer via]
             │
             ▼
      ┌────────────┐   iniciar análise    ┌────────────┐
      │ SUBMETIDA  │ ───────────────────► │ EM_ANALISE │
      └────────────┘                      └─────┬──────┘
                                                │
                        homologar (ADM)         │        desclassificar (ADM,
                     ┌──────────────────────────┼──────── justificativa obrigatória)
                     ▼                          ▼
             ┌──────────────┐         ┌────────────────────┐
             │  HOMOLOGADA  │         │  DESCLASSIFICADA   │
             └──────┬───────┘         └─────────┬──────────┘
                    │                           │
                    └──── reversão (ADM, justificativa obrigatória) ────┐
                                                                        ▼
                                                                  EM_ANALISE
```

| Estado | Significado |
|---|---|
| **Submetida** | Entrada. Estado inicial de toda iniciativa, de qualquer via |
| **Em Análise** | Sob avaliação da Assessoria |
| **Homologada** | Desfecho positivo — a iniciativa é aceita no portfólio |
| **Desclassificada** | Desfecho negativo — exige justificativa registrada |

**Reversão de decisão.** Homologar ou desclassificar por engano deixou de ser um
problema irreversível: um administrador pode devolver a iniciativa a *Em Análise*,
com justificativa obrigatória. A reversão devolve a iniciativa ao ponto em que a
decisão foi tomada — não ao início, o que fingiria que a triagem nunca ocorreu — e
é registrada como um **evento próprio** na linha do tempo, distinguível de uma
triagem comum.

**Janela de correção.** O autor de uma observação ou de um evento de tramitação
pode corrigi-lo em até **2 horas** após o registro. Depois disso, o registro é
definitivo. A correção também fica marcada.

**Observações.** Ao longo da tramitação, qualquer usuário do painel pode
acrescentar observações livres à iniciativa — o espaço para o contexto que não
cabe nos campos estruturados, sem poluir os campos que alimentam indicadores.

---

## 6. Papéis e permissões

O acesso ao painel é concedido por **cadastro prévio**: quem não estiver na lista
de usuários autorizados é tratado como colaborador comum — pode usar o formulário
público, mas não vê o painel.

| Ação | Público (anônimo) | CONTRIBUTOR | ADM |
|---|:---:|:---:|:---:|
| Submeter pelo formulário (Via 2) | ✅ | ✅ | ✅ |
| Registrar Vias 1, 3 e Captação Externa | ❌ | ✅ | ✅ |
| Consultar listagem, detalhe e histórico | ❌ | ✅ | ✅ |
| Iniciar análise (Submetida → Em Análise) | ❌ | ✅ | ✅ |
| Registrar observações | ❌ | ✅ | ✅ |
| Ver indicadores | ❌ | ✅ | ✅ |
| Exportar a base (Excel/PDF) | ❌ | ✅ | ✅ |
| **Homologar / Desclassificar** | ❌ | ❌ | ✅ |
| **Reverter decisão terminal** | ❌ | ❌ | ✅ |
| **Editar dados da iniciativa** | ❌ | ❌ | ✅ |
| **Definir relevância estratégica e classificação Ação/Projeto** | ❌ | ❌ | ✅ |
| Ativar/desativar canais de captação | ❌ | ❌ | ✅ |
| Gerir usuários do painel | ❌ | ❌ | ✅ |

**Princípio de separação.** O CONTRIBUTOR opera toda a esteira — cadastra,
analisa, comenta, exporta — mas **não decide**. Homologação, desclassificação,
reversão e edição de conteúdo são atos exclusivos do administrador.

**Regras de proteção da gestão de usuários:**

- Ninguém altera o próprio usuário (nem status, nem perfil).
- O último administrador ativo não pode ser desativado.
- O perfil só é alterado por **promoção** (CONTRIBUTOR → ADM); não há rebaixamento pelo sistema.

**Identidade.** A autenticação é feita contra o **Active Directory da CEDAE**; o
sistema não guarda senhas. Após o login, a sessão dura 8 horas.

---

## 7. Indicadores

O painel apresenta o portfólio sob as dimensões abaixo, todas calculadas sobre a
base viva:

| Indicador | Pergunta que responde |
|---|---|
| Total de iniciativas | Qual o tamanho do portfólio? |
| Por estágio de desenvolvimento | O portfólio é de ideias ou de coisas já rodando? |
| Por macrodimensão | A inovação da companhia é tecnológica, operacional, gerencial ou socioambiental? |
| Por status | Quanto está parado na entrada, quanto está em análise, quanto já foi decidido? |
| **Por canal de origem** | Qual via de captação está efetivamente trazendo iniciativas? |
| **Interno vs. externo** | Qual a participação da inovação aberta no portfólio? |
| **Taxa de homologação por canal** | Qual via traz as iniciativas que efetivamente passam? |
| Via 1 por sistema de origem | SGE ou SGP? |
| Captação externa por tipo de instituição | ICT, universidade, empresa pública, empresa privada, startup? |

A dimensão **canal/origem** é a que só existe porque a base é única e carimbada —
é o retorno direto sobre a decisão descrita em §2.2.

---

## 8. Exportação e comunicação

**Exportação.** A base pode ser exportada em **Excel (.xlsx)** ou **PDF**,
respeitando os filtros aplicados na listagem (canal, status, busca textual). A
exportação inclui protocolo, título, canal, proponente, área, organização
externa, estágio, relevância estratégica, classificação, status e data de
registro. Disponível a CONTRIBUTOR e ADM.

> Observação: a exportação existe para relatórios, apresentações e análises
> pontuais. Ela **não** é um mecanismo de gestão paralela — o dado autoritativo é
> o do sistema.

**E-mail.** A submissão pelo formulário público dispara um **e-mail de
confirmação ao proponente**, com o protocolo. O envio é *best-effort*: uma falha
no servidor de e-mail nunca invalida nem bloqueia a submissão.

**Notificações de mudança de status** ao proponente estão previstas na modelagem
mas ainda não são enviadas — ver §10.

---

## 9. Como o sistema evita voltar a ser uma planilha

Três decisões estruturais sustentam isso:

1. **Configuração é dado, não código.** Os canais de captação e as transições
   permitidas do workflow são registros em tabela, editáveis pela Assessoria.
   Acrescentar um canal novo (um hackathon, um edital, uma caixa de ideias) não
   exige alteração de estrutura nem de software.
2. **Preservação total.** Nenhum dado é descartado. Informação de contexto que não
   tem campo próprio vira observação registrada, não é perdida nem espremida em um
   campo classificatório.
3. **Evolução aditiva.** O sistema cresce acrescentando campos e tabelas, nunca
   removendo ou renomeando o que já existe — o acervo histórico continua legível a
   cada nova entrega.

---

## 10. Limites conhecidos do escopo atual

Registrados aqui para evitar expectativa incorreta. Nenhum deles é bloqueante
para o uso do sistema hoje.

| Item | Situação |
|---|---|
| **Notificação por e-mail em mudança de status** | A intenção de notificar está registrada por transição, mas o envio automático ao proponente ainda não é feito. Apenas o e-mail de confirmação de submissão é enviado |
| **Acompanhamento pelo proponente** | O proponente recebe o protocolo, mas não tem área logada para consultar o andamento |
| **Integração com SGE/SGP** | Não existe, por decisão. A Via 1 é cadastro manual |
| **Anexos** | Não é possível anexar documentos à iniciativa |
| **Estados adicionais** (rascunho, devolvida, suspensa, concluída, cancelada) | Previstos na modelagem, inativos — o fluxo confirmado tem quatro estados |
| **Alinhamento com Plano Estratégico / ODS por iniciativa** | Fora de escopo enquanto o PE não estiver formalizado. A relevância estratégica cobre parcialmente a necessidade |
| **Normalização de proponente e instituição** | Proponente e instituição são atributos da iniciativa, não entidades próprias. Consequência: não há visão consolidada "por parceiro recorrente" |
| **Listagem pública de iniciativas** | O endpoint de listagem responde sem autenticação. O detalhe, o histórico, a edição, a tramitação e a exportação exigem sessão autenticada. Restringir a listagem é um ajuste conhecido e pendente |

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **Iniciativa** | Unidade de registro do sistema: uma proposta de inovação, de qualquer origem |
| **Protocolo / Código público** | Identificador legível da iniciativa, no padrão `INOV-AAAA-NNN`. É o número que o proponente cita |
| **Via / Canal de captação** | Por onde a iniciativa entrou no sistema (Via 1, Via 2, Via 3, Captação Externa) |
| **Procedência** | Os metadados específicos da via: sistema de origem, instituição, contexto de reunião |
| **Proponente** | Quem propõe a iniciativa. Interno (colaborador/área) ou externo (parceiro/instituição) |
| **Tramitação** | Movimentação da iniciativa entre estados do ciclo de vida |
| **Transição** | Movimento permitido entre dois estados, com perfil exigido e regra de justificativa |
| **Evento de histórico** | Registro imutável de uma tramitação: quem, quando, de qual estado para qual, por quê |
| **Reversão** | Desfazer uma homologação ou desclassificação, devolvendo a iniciativa a *Em Análise* |
| **Observação** | Anotação livre registrada na iniciativa durante a tramitação |
| **Relevância estratégica** | Avaliação da Assessoria sobre por que (ou se) a iniciativa importa estrategicamente |
| **Classificação Ação/Projeto** | Distinção entre esforço pontual e projeto estruturado. Definida apenas pelo administrador |
| **Macrodimensão** | Natureza da inovação: tecnológica, operacional, gerencial, socioambiental ou multidimensional |
| **ADM / CONTRIBUTOR** | Perfis de acesso ao painel. ADM decide; CONTRIBUTOR opera |
| **SGE / SGP** | Sistemas corporativos da CEDAE consultados manualmente pelo analista na captação Via 1 |
| **ICT** | Instituição Científica, Tecnológica e de Inovação |
