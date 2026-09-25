/**
 * Link de abertura de conta na EQI (a assessoria de investimentos da Dani/Fatos Capital), com o
 * código do assessor pra a indicação cair pra ela. Mesmo `assessor`/`campaignId` do link usado
 * no site da Fatos (fatoscapital.com.br/bio); o `utm_*` muda pra identificar que veio do app,
 * não da bio do Instagram — senão os dois cliques aparecem juntos nos relatórios da EQI.
 */
export const EQI_SIGNUP_URL =
  "https://cadastro.eqi.com.br/?utm_campaign=spi-finance&utm_source=app&utm_medium=carteira-vazia&utm_content=abrir-conta&campaignId=7014V000002J1oiQAC&assessor=6135074&manual_referral=true";
