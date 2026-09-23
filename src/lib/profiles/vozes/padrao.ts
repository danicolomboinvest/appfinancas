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
    "Nenhum lançamento neste mês ainda. Toque em Registrar (o + no meio da barra de baixo) para lançar o primeiro — digitando, por áudio ou importando o extrato.",
  metaBatida: () => "Meta alcançada.",
  rodape: () => null,
  nav: { metas: "Metas", flowTabs: ["Visão mensal", "Só gastos", "Orçamento"] },
  titulos: TITULOS_PADRAO,
};
