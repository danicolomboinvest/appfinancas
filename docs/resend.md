# E-mail do SPI Finance pela Resend

Desde 30/10/2026 o app sabe mandar e-mail por dois caminhos:

- **Resend** (API), quando a variável `RESEND_API_KEY` existe na Vercel. Remetente `SPI Finance <spi@acesso.danicolombo.com.br>`, e quem responder cai no `app@danicolombo.com.br`.
- **SMTP da Hostinger** (`app@danicolombo.com.br`), igual a hoje, quando a chave não existe. Ele também é a reserva: se a Resend falhar, o app tenta o SMTP uma vez e anota a falha na lista de erros do app (rota "e-mail"), a mesma que chega no raio-X diário por e-mail.

Por que mudar: o SMTP aceita 100 envios por dia, o app já passou disso, e foram 73 e-mails devolvidos em 30 dias sem ninguém ver.

Regra de ouro: **a chave nunca vai no código, nem no Git, nem no chat.** Ela só existe na tela da Resend (uma vez, na hora de criar) e nas variáveis da Vercel.

## O que você precisa fazer (uma vez)

### a) Criar a chave na Resend

1. Entre em resend.com com a sua conta (a mesma do Rota, plano Pro).
2. Menu **API Keys**, botão **Create API Key**.
3. Nome: `spi-finance`. Permission: **Sending access**. Domain: **acesso.danicolombo.com.br** (é o único verificado; `danicolombo.com.br` não está).
4. Copie a chave que aparece (começa com `re_`). Ela só aparece uma vez.

### b) Colocar a chave na Vercel

1. vercel.com, projeto **appfinancas**, **Settings**, **Environment Variables**.
2. **Add**: nome `RESEND_API_KEY`, valor a chave copiada, ambiente **Production** (só ele; Preview e Development continuam no SMTP).
3. Opcional: `EMAIL_FROM` se quiser outro remetente (precisa ser do domínio `acesso.danicolombo.com.br`), e `EMAIL_REPLY_TO` se quiser que a resposta caia em outro endereço que não o app@.

### c) Avisar o app quando um e-mail volta (webhook)

1. Na Resend, menu **Webhooks**, botão **Add Webhook**.
2. Endpoint URL: `https://financas.danicolombo.com.br/api/webhooks/resend`
3. Eventos: marque **email.bounced** e **email.complained** (só esses dois).
4. Depois de criar, abra o webhook e copie o **Signing secret** (começa com `whsec_`).
5. Na Vercel, mesma tela de variáveis: **Add** `RESEND_WEBHOOK_SECRET` com esse valor, ambiente Production.

Sem esse segredo a rota responde 503 e não grava nada, de propósito.

### d) Redeploy

Variável nova só vale depois de um deploy. Na Vercel, **Deployments**, os três pontinhos do último deploy, **Redeploy**. Ou faça o push normal do código.

### e) Testar

- O jeito mais simples: em Admin › Acessos, libere (ou reenvie o convite para) o SEU e-mail. O e-mail tem de chegar de `spi@acesso.danicolombo.com.br`; se chegar de `app@danicolombo.com.br`, a chave não entrou (confira o nome da variável e se fez o redeploy).
- Sem mandar nada: a rota `/api/cron/boas-vindas?dryRun=1` conta o que seria enviado, mas só responde com o `CRON_SECRET` no cabeçalho `Authorization`; é mais fácil me pedir no chat para rodar.
- Para conferir o webhook: na Resend, Webhooks, abra o seu e clique em **Send test event** (ou espere a primeira devolução real). A Resend mostra a resposta: `recorded` gravou, `ignored` é outro tipo de evento, 401 é segredo errado, 503 é segredo faltando na Vercel.

## Onde cada coisa aparece

- Lista de erros do app (AppError), rota "e-mail": falhas da Resend (com o motivo) e cada devolução, com o e-mail mascarado. Entra no raio-X diário que chega por e-mail.
- Admin › Jornada, linha do tempo da pessoa: "E-mail devolvido" ou "Marcou o e-mail como spam", com o assunto e o motivo. Só para quem já criou a conta.

## Para voltar atrás

Apague a variável `RESEND_API_KEY` na Vercel e faça redeploy. O app volta ao SMTP sozinho; nada mais precisa mudar.
