/**
 * Os guias do Money Reset nas telas de verdade (05/10/2026): cada passo diz qual botão acender
 * (um seletor CSS) e o que o balão fala. O guia avança quando ela toca no botão aceso, mesmo que
 * o toque troque de tela (a gaveta do +, o Raio-X, as Metas).
 *
 * `rota`: em que tela o passo mora; se ela não está lá, o guia leva (`ir`). Sem `rota`, vale em
 * qualquer tela (o "+" está em todas). O último passo acende o botão e, no toque, o guia sai e
 * deixa ela terminar sozinha (o resto da tela já se explica).
 */

export type PassoDoGuia = {
  alvo: string;
  txt: string;
  dica?: string;
  /** No computador o botão é outro (o "+" do celular vira "Registrar" no menu ao lado). */
  txtComputador?: string;
  rota?: string;
  ir?: string;
  redondo?: boolean;
  /** Se ela não achar o botão, o balão oferece "Abrir para mim". */
  abrir?: "registrar";
};

/** Celular: o "+" redondo no meio da barra de baixo. Computador: o botão Registrar do menu. */
const MAIS: PassoDoGuia = {
  alvo: '[data-tour="registrar"]',
  txt: "Toque no + aqui embaixo, no meio",
  txtComputador: "Clique em {Registrar}, no menu ao lado",
  dica: "É por ele que tudo entra no app.",
  redondo: true,
  abrir: "registrar",
};
const IMPORTAR: PassoDoGuia = { alvo: '[data-guia="importar"]', txt: "Toque em {Importar}" };

export const GUIAS: Record<number, PassoDoGuia[]> = {
  1: [
    MAIS,
    IMPORTAR,
    { alvo: '[data-guia="tipo-extrato"]', txt: "Escolha {Extrato}", dica: "A fatura do cartão entra amanhã." },
    { alvo: '[data-guia="escolher-arquivo"]', txt: "Agora toque aqui e escolha o extrato", dica: "Pode ser um arquivo com os 3 meses. Depois revise o que o app pedir e toque em Importar." },
  ],
  2: [
    MAIS,
    IMPORTAR,
    { alvo: '[data-guia="tipo-fatura"]', txt: "Hoje é a fatura: toque em {Fatura}" },
    { alvo: '[data-guia="escolher-arquivo"]', txt: "Toque aqui e escolha a fatura", dica: "É o PDF que o banco manda no e-mail. Confira o mês em que ela vence." },
  ],
  4: [
    { alvo: 'a[href="/decidir/raio-x"]', rota: "/mensal/foco", ir: "/mensal/foco", txt: "Toque em {RaioX}", dica: "Fica no {Foco}, em Antes de decidir, pergunte." },
    { alvo: '[data-guia="raiox-item"]', rota: "/decidir/raio-x", txt: "Para cada item: manter, cancelar ou pela metade", dica: "O que marcar para cancelar, cancele hoje de verdade." },
  ],
  8: [
    { alvo: '[data-tour="metas"]', txt: "Toque em {Metas}, na barra de baixo", txtComputador: "Clique em {Metas}, no menu ao lado", ir: "/planejamento/metas" },
    { alvo: '[data-guia="nova-meta"]', rota: "/planejamento/metas", ir: "/planejamento/metas", txt: "Toque em {NovaMeta}", dica: "O que é, quanto custa e para quando. Pesou? Mude a data." },
  ],
  9: [
    { alvo: '[data-guia="reserva-salvar"]', rota: "/planejamento/reserva-emergencia", ir: "/planejamento/reserva-emergencia", txt: "Confira o alvo e diga quanto já tem. Depois toque em Salvar", dica: "6 meses do seu custo de vida. Não tem nada? Ponha zero." },
  ],
  10: [
    { alvo: '[data-guia="orc-editar"]', rota: "/orcamento", ir: "/orcamento", txt: "Toque para montar o {orcamento}" },
    // O texto vem do botão aceso (data-guia-txt): sem plano é "Dividir", com plano é "Ajustar as categorias".
    { alvo: '[data-guia="orc-ir-divisao"]', rota: "/orcamento", txt: "Toque para ir à divisão", dica: "É ali que vem a divisão da aula." },
    { alvo: '[data-guia="orc-sugerir"]', rota: "/orcamento", txt: "Toque em {Sugerir}", dica: "Vem a divisão da aula, em reais. Ajuste o que não combina com a sua vida, siga e toque em Salvar." },
  ],
  15: [MAIS, { alvo: '[data-guia="posso-comprar"]', txt: "Toque em {PossoComprar}", dica: "Seja sincera. Se for impulso, {DecidirAmanha}." }],
  16: [MAIS, { alvo: '[data-guia="gravar-audio"]', txt: "Toque em {GravarAudio}", dica: "Fale: \"pão, 12 reais, dinheiro\". Confira e salve." }],
  18: [
    { alvo: '[data-guia="ritual"]', rota: "/mensal/foco/ritual", ir: "/mensal/foco/ritual", txt: "Passe pelos cartões e tome a decisão da semana", dica: "Segunda, os gastos. Sábado, os limites." },
  ],
};
