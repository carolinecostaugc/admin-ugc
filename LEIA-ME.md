# Painel de automação de DM do Instagram

Um painel web com login e um motor de respostas automáticas no direct (estilo ManyChat):
alguém comenta uma palavra no seu post, recebe uma DM com botão, toca no botão, a conversa
segue (mais mensagens, um link ou um arquivo) e o contato fica salvo.

## O que tem nesta pasta

| Caminho | O que é |
|---|---|
| `index.html`, `styles.css`, `app.js` | O painel (login, Início, Calendário, Instagram) |
| `config.js` | As 2 chaves PÚBLICAS do Supabase (URL e anon key) |
| `abrir-local.bat` / `abrir-local.ps1` | Abre o painel em `http://localhost:5173` no Windows |
| `supabase/sql/01..04` | Scripts do banco (rodar em ordem) |
| `supabase/functions/` | As Edge Functions (o motor) |

---

## Passo 0: testar agora, sem configurar nada

1. **Windows:** dê duplo clique em `abrir-local.bat`.
   **Mac/Linux:** abra o Terminal nesta pasta e rode `python3 -m http.server 5173`, depois abra `http://localhost:5173`.
2. Entre com **qualquer e-mail** e **uma senha de 5 dígitos** (ex: `12345`).
3. Navegue à vontade: Início, Calendário, Instagram, crie automações e veja a prévia ao vivo.

No modo de teste local, as automações ficam salvas só no seu navegador. Nada vai pro
Instagram. Os passos abaixo são pra colocar no ar de verdade.

---

## Passo 1: criar o projeto no Supabase e rodar o SQL

1. Crie uma conta e um projeto em supabase.com.
2. Vá em **SQL Editor** e rode, **nesta ordem**, o conteúdo de:
   1. `supabase/sql/01_tabelas.sql` (tabelas + a linha inicial do freio)
   2. `supabase/sql/02_freio.sql` (as funções do freio)
   3. `supabase/sql/03_rls.sql` (regras de acesso)
   4. `supabase/sql/03b_storage.sql` (opcional: pasta de arquivos pra biblioteca de anexos)
   5. `supabase/sql/05_leads.sql` (aba Leads: contagem de interações e limpeza diária;
      rode depois do `04_agendamento.sql`, do passo 5)

   Confira se aparece "Success". Se der erro, o Supabase desfaz o script inteiro e as tabelas
   não são criadas (o painel continua abrindo, mas com tudo zerado e sem salvar).

> **ATENÇÃO:** sem o `02_freio.sql`, o freio falha fechado e **nenhuma DM por comentário sai**
> (tudo vai pra fila e a fila nunca anda). É o passo que não pode faltar.

## Passo 2: criar o usuário admin

Supabase > **Authentication** > **Users** > **Add user** > crie com e-mail e senha.
É esse login que vale quando o site estiver no ar. Não existe tela pública de cadastro (de propósito).

Recomendado: em **Authentication > Providers > Email**, desligue "Allow new users to sign up".

## Passo 3: configurar os segredos das Edge Functions

Supabase > **Edge Functions** > **Secrets** (ou pela CLI, abaixo). Crie:

| Segredo | Valor |
|---|---|
| `IG_ACCESS_TOKEN` | token long-lived do Instagram (passo 6) |
| `IG_ACCOUNT_ID` | id numérico da conta do Instagram (passo 6) |
| `APP_SECRET` | segredo do app no Meta (App settings > Basic) |
| `APP_SECRET_ENFORCE` | `false` no começo; `true` depois de testar |
| `VERIFY_TOKEN` | uma senha que você inventa (aperto de mão do webhook) |
| `GRAPH_API_VERSION` | `v21.0` |
| `SCHED_SECRET` | outra senha que você inventa (protege os robôs agendados) |
| `TEST_IG_ACCOUNTS` | ids numéricos das contas de teste, separados por vírgula |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm prontas dentro das Edge Functions.
A service_role **nunca** vai pro `config.js` nem pra lugar público.

Pela CLI:

```bash
supabase secrets set IG_ACCESS_TOKEN=SEU_VALOR_AQUI IG_ACCOUNT_ID=SEU_VALOR_AQUI \
  APP_SECRET=SEU_VALOR_AQUI APP_SECRET_ENFORCE=false VERIFY_TOKEN=SEU_VALOR_AQUI \
  GRAPH_API_VERSION=v21.0 SCHED_SECRET=SEU_VALOR_AQUI TEST_IG_ACCOUNTS=SEU_VALOR_AQUI
```

## Passo 4: publicar as Edge Functions

Instale a CLI do Supabase (Mac: `brew install supabase/tap/supabase`; Windows: `scoop install supabase`,
ou use `npx supabase` se tiver Node). Nesta pasta:

```bash
supabase login
supabase link --project-ref SEU_PROJETO

# Públicas (quem chama não tem login do Supabase): SEMPRE com --no-verify-jwt
supabase functions deploy instagram-webhook --no-verify-jwt
supabase functions deploy ig-scheduler --no-verify-jwt
supabase functions deploy ig-token-refresh --no-verify-jwt

# Só pro painel logado
supabase functions deploy ig-insights
supabase functions deploy ig-media
```

A `instagram-webhook` **precisa** ser pública, senão o Meta não consegue chamar
(no painel do Supabase isso é o "Verify JWT" desligado). O `ig-scheduler` e o
`ig-token-refresh` também, mas eles só respondem a quem manda o `SCHED_SECRET`.

## Passo 5: agendar os robôs (pg_cron)

Abra `supabase/sql/04_agendamento.sql`, troque `SEU_PROJETO` e `SEU_SCHED_SECRET` e rode no SQL Editor.
Ele liga as extensões `pg_cron` e `pg_net` e agenda:

- `ig-scheduler` a cada 1 minuto (esvazia a fila e manda os passos com atraso)
- `ig-token-refresh` toda segunda-feira (renova o token)

## Passo 6: configurar o app no Meta for Developers

1. Em developers.facebook.com crie um app e adicione o produto **Instagram** (Instagram API with Instagram Login).
2. Conecte sua conta **profissional** do Instagram (Business ou Creator).
3. Libere as permissões: `instagram_business_basic`, `instagram_business_manage_comments`,
   `instagram_business_manage_messages` (e `instagram_business_manage_insights` pras métricas).
4. Gere o **token long-lived** e anote o **id numérico da conta**. Coloque nos segredos do passo 3.
5. No app do Instagram, em configurações de mensagens, deixe o acesso a mensagens permitido
   (Configurações > Mensagens > Ferramentas conectadas).

## Passo 7: cadastrar o webhook no Meta

- **URL de callback:** `https://SEU_PROJETO.supabase.co/functions/v1/instagram-webhook`
- **Token de verificação:** o mesmo `VERIFY_TOKEN`
- **Assine os TRÊS campos:** `comments`, `messages` e `messaging_postbacks`.
  O `messaging_postbacks` é o que faz os botões da conversa funcionarem.

## Passo 8: publicar o painel

1. Em `config.js`, troque `SUA_SUPABASE_URL_AQUI` e `SUA_SUPABASE_ANON_KEY_AQUI`
   (Supabase > Project Settings > API). A anon key pode ficar pública: quem tranca o banco é o RLS.
2. Suba `index.html`, `styles.css`, `app.js` e `config.js` em qualquer host estático
   (ex: GitHub Pages). Fora do localhost, o login passa a ser o do Supabase (passo 2).

## Passo 9: testar com uma SEGUNDA conta

Comentários da sua própria conta são ignorados de propósito. Com outra conta, comente a
palavra-chave num post. Ponha o id dessa conta em `TEST_IG_ACCOUNTS` pra ela ignorar a regra
do 1 por dia e você poder testar várias vezes.

Pra ver o que aconteceu: Supabase > Edge Functions > `instagram-webhook` > **Logs**, e a tabela
`ig_deliveries` (cada envio, com status e motivo).

## Passo 10: ligar a trava da assinatura

Quando tudo funcionar, mude `APP_SECRET_ENFORCE` para `true`. A partir daí, requisição sem a
assinatura certa do Meta é recusada.

---

## Regras e limites (pra não tomar bloqueio)

- **Opt-in sempre:** o sistema só responde quem comentou ou mandou mensagem. Nada de disparo em massa.
- **Nada de spam nem lista comprada.** Isso quebra as regras do Meta e derruba a conta.
- **1 por dia:** 1 DM por pessoa a cada 24h em gatilho de comentário (contas de teste ignoram).
- **Freio de envio:** no máximo 6 por minuto, 60 por hora, 180 por dia (bem abaixo do teto de
  ~200 a 300 respostas privadas por dia do Instagram). O excesso espera na fila.
  Disjuntor: 3 bloqueios seguidos pausam 3 horas; 8 falhas seguidas pausam 30 minutos.
  Pra mudar os tetos: edite a linha `private_reply` da tabela `ig_send_budget`.
- **Janela de 24h:** fora de uma interação recente não dá pra mandar DM. O comentário e o
  toque no botão abrem a janela. Depois da resposta ao comentário, o Instagram só deixa
  mandar mais coisa (inclusive arquivo) quando a pessoa responde ou toca no botão.
- **Token:** vence em ~60 dias. A renovação semanal cuida disso (o token novo fica na tabela
  `ig_secrets`, que só o servidor lê). Confira em `ig_token_status`.
- **Limites do Instagram:** título de botão 20 caracteres; no máximo 3 botões anexados por
  mensagem (com mais, vira pílula de resposta rápida, até 13); resposta a comentário só vale
  por ~7 dias; o banco devolve no máximo 1000 linhas por requisição (pagine tabelas grandes).

---

## Como a conversa é guardada (campo `flow`)

```json
{
  "steps": [
    { "id": 1, "message": "Oi! Quer o guia?", "buttons": [{ "title": "Quero", "next": 2 }] },
    { "id": 2, "message": "Prefere PDF ou vídeo?", "buttons": [
        { "title": "PDF", "next": 3 },
        { "title": "Ver no site", "url": "https://seusite.com" }
    ]},
    { "id": 3, "message": "Aqui está!", "assets": ["ID_DO_ARQUIVO"] }
  ]
}
```

- A Mensagem 1 é sempre o **primeiro** item de `steps` (o id não importa).
- Um botão tem `next` (vai pra outro passo) **ou** `url` (abre link). Sem os dois = encerra (não é enviado).
- O toque no botão chega como `STEP:idDaAutomacao:proximoPasso`, então automações diferentes não se misturam.
- Envio: botões anexados (button template); se o Instagram recusar, pílula (quick reply); por último, texto com o link escrito.
- Avançado (editando o `flow` direto no banco):
  - `"collect": { "field": "email", "next": 3 }` pede um dado (`email` ou `telefone`, com validação) e segue pro passo 3.
  - `"delay": { "seconds": 3600, "next": 3 }` manda o passo 3 sozinho depois de 1 hora.

---

## Checklist do que preencher

- [ ] `config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [ ] Segredos: `IG_ACCESS_TOKEN`, `IG_ACCOUNT_ID`, `APP_SECRET`, `APP_SECRET_ENFORCE`, `VERIFY_TOKEN`, `GRAPH_API_VERSION`, `SCHED_SECRET`, `TEST_IG_ACCOUNTS`
- [ ] `04_agendamento.sql`: `SEU_PROJETO`, `SEU_SCHED_SECRET`
- [ ] Meta: URL do webhook + `VERIFY_TOKEN` + campos `comments`, `messages`, `messaging_postbacks`
- [ ] Usuário admin criado no Supabase Auth

## Se algo não funcionar

| Sintoma | Provável causa |
|---|---|
| Nenhuma DM sai, tudo fica "na_fila" | Faltou rodar o `02_freio.sql`, ou o disjuntor pausou (veja `paused_until` em `ig_send_budget`) |
| Fila nunca anda | O agendamento (passo 5) não rodou ou o `SCHED_SECRET` não bate |
| Meta não verifica o webhook | `VERIFY_TOKEN` diferente, ou a função não foi publicada com `--no-verify-jwt` |
| DM chega mas o botão não faz nada | Faltou assinar `messaging_postbacks` no webhook |
| Comentei e nada aconteceu | Comentou com a própria conta, ou a regra do 1 por dia (use `TEST_IG_ACCOUNTS`) |
| Painel no ar diz "não foi configurado" | `config.js` ainda com os placeholders |
