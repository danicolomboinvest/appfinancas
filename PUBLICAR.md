# Publicar a versão nova (versao-nova-junto → main)

Preparado em 11/10/2026. Nada aqui foi executado em produção. Siga na ordem; cada passo diz o que
conferir antes do próximo.

O que vai junto: e-mails, metas, decidir, viagem, calculadoras, Nós dois com login do par,
análises, carteira, configurações (com o "antes de cancelar"), tutorial e empresa.
**Fica de fora:** o Onboarding novo (o começo continua o atual).

Conferido antes de escrever:
- suíte (312 arquivos, 2979 testes), typecheck, lint e `next build` passando;
- `origin/main` (b19daa8) é ancestral do `versao-nova-junto`: o push é fast-forward, sem merge;
- as 15 migrations aplicam do zero e também em cima de um banco igual ao de produção (só as do
  main + as novas), sem diferença para o schema.

---

## 0. Antes de começar (5 min)

- Faça num horário calmo, fora das 12h (o cron de avisos roda às 12h de Brasília).
- Tenha à mão: o painel da Vercel (projeto do SPI), o console do Neon (conta suporte, projeto
  `planejamento-financeiro`) e o terminal em `~/Projects/spi-vn-junto`.
- Anote o deployment de produção atual na Vercel (é o que volta no passo 7).

## 1. Backup do Neon

Dois backups, porque um é rápido de voltar e o outro sobrevive a tudo:

1. **Branch no Neon (volta em minutos):** console do Neon → projeto `planejamento-financeiro` →
   Branches → *Create branch* a partir de `main`, nome `antes-versao-nova-2026-10-11`. É uma
   cópia instantânea do banco como está agora.
2. **Backup cifrado no Mac (o de sempre):** no repositório principal,
   ```sh
   cd ~/Projects/"SPI Finance"
   npm run backup
   ```
   Confira que apareceu o arquivo de hoje (`.tar.gz.enc`) em `~/Documents/spi-finance-backups`.

Não siga sem os dois.

## 2. Migrations (`prisma migrate deploy`)

Todas são aditivas (tabelas e colunas novas, nulas ou com padrão). A única que reescreve dado é a
primeira: perfis com os temas antigos `minimalista`/`semfiltro` passam a `padrao`, e
`disciplina`/`game` passam a `titanio`. O app antigo continua funcionando com o banco novo, então
dá para migrar antes do deploy.

```sh
cd ~/Projects/spi-vn-junto
vercel env pull .env.production.local --environment=production   # traz o DATABASE_URL de produção
node --env-file=.env.production.local node_modules/.bin/prisma migrate status
```

O `status` tem que listar exatamente estas 15 como pendentes, nesta ordem:

1. 20261011120000_quatro_temas
2. 20261011150000_token_do_widget
3. 20261011170000_dividas
4. 20261011180000_viagem_da_meta
5. 20261011190000_login_do_par
6. 20261011190500_preco_diario
7. 20261011191000_configuracoes_recorrentes_fechamento
8. 20261011192000_empresa
9. 20261011200000_metas_foto_e_tipos
10. 20261011200500_carteira_versao_nova
11. 20261011201000_taxa_de_compra
12. 20261011202000_antes_de_cancelar
13. 20261011210000_antes_de_cancelar_automatico
14. 20261011220000_estender_na_hubla
15. 20261011230000_novidades_versao_nova

Se aparecer qualquer outra, ou se faltar alguma, pare.

```sh
node --env-file=.env.production.local node_modules/.bin/prisma migrate deploy
node --env-file=.env.production.local node_modules/.bin/prisma migrate status   # "Database schema is up to date!"
rm .env.production.local                                                         # não deixar a URL de produção no disco
```

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables, Production)

| Variável | Valor | Observação |
|---|---|---|
| `EMAIL_ASSETS_URL` | `https://financas.danicolombo.com.br` (ou deixar sem) | Logos e ícones dos e-mails e links do "antes de cancelar". Sem ela, vale esse mesmo endereço. |
| `ADICIONAIS_COBRAR_DESDE` | **vazia** | Só ligar depois que o branch de cobrança entrar (ver "Depois" abaixo). Vazia: todo mundo tem Nós dois e Empresa, e nenhum botão "Liberar" aparece. |

As de sempre (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, e-mail, Hubla) não mudam.

## 4. Crons novos (já estão no `vercel.json`, a Vercel lê no deploy)

| Rota | Quando (UTC) | Brasília | O que faz |
|---|---|---|---|
| `/api/cron/casal` | `30 7 * * *` | 4h30 | Prazos do login do par (90 dias sem renovar, limpa o "só meu" de quem saiu). |
| `/api/cron/indicadores` | `0 22 * * 1-5` | 19h, dias úteis | CDI, IPCA, Selic (Banco Central) e Tesouro, com fonte e hora. |

Mudaram por dentro (sem mudar horário): `alerts` (agora também "Você chegou lá" e os avisos do
"antes de cancelar"), `monthly-recap` (resumo novo), `contas` e `quotes` (guarda o preço do dia).
O "Você chegou lá" só sai para meta com aporte no mês: ninguém recebe um e-mail atrasado no dia
da publicação.

Depois do deploy, confira em Settings → Cron Jobs que são 10 no total.

## 5. Push para main e deploy da Vercel

```sh
cd ~/Projects/spi-vn-junto
git fetch origin
git merge-base --is-ancestor origin/main versao-nova-junto && echo "ok, fast-forward"
git push origin versao-nova-junto:main
```

Se o `merge-base` não disser "ok", alguém mexeu no main: pare e junte de novo antes.

A Vercel começa o deploy sozinha com o push. Acompanhe em Deployments até ficar *Ready*.

No Mac, para o backup diário passar a levar as tabelas novas:

```sh
cd ~/Projects/"SPI Finance" && git pull && npx prisma generate
```

## 6. Primeiros 10 minutos em produção

Com a sua conta (você já usava o app):

1. Entrar. Tem que aparecer **"Tivemos uma mudança"** uma vez. Pular. Recarregar: não volta.
2. Configurações › Ajuda: tem "Ver de novo o que mudou" e ele abre o tutorial.
3. Visão geral (as 4 abas), Metas (abrir uma), Dívidas, Carteira (Meus ativos, Proventos,
   Estratégia), Viagem, Calculadoras ("Quitar ou investir" lista as dívidas), Análises,
   Decidir, Configurações: tudo abre sem tela de erro.
4. Trocar para o perfil Nós dois e para a Empresa: abrem.
5. Configurações › Perfis: nenhum botão "Liberar".
6. Tema Titânio no claro e no escuro: nada laranja.

No painel:

7. Vercel → Logs (filtro Error) nos primeiros minutos: nada novo e repetido.
8. Rodar o cron dos indicadores uma vez à mão e ver números com fonte:
   ```sh
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://financas.danicolombo.com.br/api/cron/indicadores
   ```
9. Rodar os avisos em ensaio (não manda nada) e ver se as contagens fazem sentido:
   ```sh
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://financas.danicolombo.com.br/api/cron/alerts?dryRun=1"
   ```
10. Hubla: uma compra de teste (ou o próximo webhook real) aparece no admin como sempre.
11. Neon → Monitoring: conexões e CPU no normal.

## 7. Como voltar atrás

**O app deu problema (o mais comum):**
- Vercel → Deployments → o deployment anotado no passo 0 → *Instant Rollback* (ou *Promote to
  Production*). Volta em segundos. O banco pode ficar como está: o app antigo funciona com as
  colunas novas. Quem tinha tema Titânio aparece no Padrão até a versão nova voltar.
- Para tirar o código do main sem reescrever o histórico:
  ```sh
  git checkout -b desfazer-versao-nova origin/main
  git revert --no-commit b19daa8..HEAD && git commit -m "Desfaz a versão nova"
  git push origin desfazer-versao-nova:main
  ```

**O banco deu problema (migration falhou no meio, dado estranho):**
- Não rode `migrate reset` nem nada que apague dado.
- Se a migration parou no meio: `prisma migrate status` mostra qual; corrija e rode
  `prisma migrate resolve --rolled-back <nome>` antes de tentar de novo.
- Para voltar o banco inteiro: Neon → branch `antes-versao-nova-2026-10-11` → *Restore* (ou trocar
  o `DATABASE_URL` da Vercel para ela). Atenção: o que as pessoas lançaram depois do backup se
  perde. Prefira voltar só o app.
- Só os temas antigos de volta (se alguém reclamar): ler da branch do Neon
  `SELECT id, theme FROM "FinancialProfile" WHERE theme IN ('minimalista','semfiltro','disciplina','game');`
  e regravar esses ids no main.

---

## Depois (não faz parte desta publicação)

- **Cobrança dos adicionais** (branch `cobranca-adicionais`, outra conversa):
  - a rota `/adicionais/[qual]` mora lá; precisa ganhar o adicional `perfil_casal` (o Nós dois é
    100% pago) e a trava de criar ou abrir o perfil Casal no servidor, como a Empresa;
  - trocar a ponte: `src/lib/casal-login/adicional.ts` vira
    `export { temAdicional, type Adicional } from "@/lib/adicionais/acesso";` e o corpo de
    `src/lib/perfis/extras-liberados.ts` passa a usar `temAdicional(userId, "perfil_casal")` e
    `temAdicional(userId, "perfil_empresa")`;
  - conflitos esperados: `src/app/api/webhooks/hubla/route.ts` (aqui 211–214: reembolso corta na
    hora e a saída sem reembolso fica até o vencimento; lá 216–225: revoga os adicionais) e
    `src/app/(app)/perfis/actions.ts` (aqui 35–40: até 3 perfis; lá 47: `exigirEmpresa`). As
    duas regras ficam;
  - só depois disso ligar `ADICIONAIS_COBRAR_DESDE`.
- **Onboarding novo:** a migration `20261011190000_comeco` vai precisar de horário próprio, e a
  tela "Qual é o seu banco?" troca as palavras minúsculas pelos logos de símbolo.
