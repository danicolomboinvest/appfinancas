import { TITULOS_PADRAO, CUMPRIMENTO, fraseOrcamentoPadrao, type Voz } from "../voice-base";

export const padrao: Voz = {
  saudacao: (p, nome) => `${CUMPRIMENTO[p]}${nome ? `, ${nome}` : ""}.`,
  subSaudacao: () => null,
  tituloPainel: null,
  rotuloResultado: "Resultado",
  // O Padrão não ganha frase embaixo do painel: o bloco "O que mudou" já faz essa leitura, e
  // repetir o número em duas frases na mesma tela foi o que se tirou de lá de propósito.
  fraseResultado: () => null,
  ritmo: { rapido: "Gastando rápido demais", limite: "No limite do ritmo", dentro: "Dentro do ritmo" },
  tituloOrcamento: (mes) => `Seu orçamento de ${mes}`,
  fraseOrcamento: fraseOrcamentoPadrao,
  mesVazio:
    "Ainda não tem nada neste mês. Lance o primeiro gasto para começar a entender para onde seu dinheiro está indo, ou suba o extrato de uma vez.",
  metaBatida: () => "Meta alcançada.",
  rodape: () => null,
  nav: { metas: "Metas", flowTabs: ["Mensal", "Gastos", "Orçamento"] },
  titulos: TITULOS_PADRAO,
};
