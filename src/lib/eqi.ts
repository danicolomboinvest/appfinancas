/**
 * Link de abertura de conta na EQI (a assessoria de investimentos da Dani/Fatos Capital), com o
 * código do assessor pra a indicação cair pra ela. Mesmo `assessor`/`campaignId` do link usado
 * no site da Fatos (fatoscapital.com.br/bio); o `utm_*` muda pra identificar que veio do app,
 * não da bio do Instagram — senão os dois cliques aparecem juntos nos relatórios da EQI.
 */
export const EQI_SIGNUP_URL =
  "https://cadastro.eqi.com.br/?utm_campaign=spi-finance&utm_source=app&utm_medium=carteira-vazia&utm_content=abrir-conta&campaignId=7014V000002J1oiQAC&assessor=6135074&manual_referral=true";

/**
 * O link de abertura de conta da EQI pela Fatos Capital que a dona mandou em 11/10/2026 (plano da
 * versão nova, seção 12). Vai EXATAMENTE assim no "Abrir minha conta": o `assessor=6135074` é o
 * que liga a conta ao escritório. Abre numa aba nova (rodada 73).
 */
export const EQI_ABRIR_CONTA_URL =
  "https://lps.eqi.com.br/abertura-de-conta-eqi_inst02_alwayson_x_a_x_x/?utm_campaign=AAAAMMDD-CPT-AON-BSE-X&utm_source=PRC-XXX-XXX&utm_medium=XXX-CT1-XXX&utm_content=OUT-QAS&campaignId=7014V000002J1onQAC&assessor=6135074&manual_referral=true#form";
