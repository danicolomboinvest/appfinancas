/**
 * Textos da área "importacao", na voz do Padrão — as frases EXATAS que o app tem hoje. Os temas
 * sobrescrevem o que quiserem em `vozes/<tema>.ts`; o que não sobrescrevem, cai aqui.
 *
 * Regras pra quem cataloga: a chave começa com o prefixo da área; o valor do Padrão é a
 * frase atual do componente, sem mudar uma vírgula; frase com número ou nome vira função.
 *
 * A área cobre o drawer "Registrar" (os quatro cartões e o fluxo de voz), os três importadores
 * (extrato/fatura, posição da corretora, declaração de IR), o histórico de importações, as
 * sugestões "Parece que se repete" e o Resumo Mensal (convite, stories e imagem de compartilhar).
 *
 * Erros que explicam um problema REAL da pessoa (arquivo grande, senha, microfone) entram aqui
 * porque são texto que ela lê e o tema pode suavizar; erros técnicos ficam nos componentes.
 */
export type TextosImportacao = {
  // Drawer "Registrar": os cartões de escolha e o botão de voltar
  impVoltar: string;
  impDigitar: string;
  impGravarAudio: string;
  impImportarArquivo: string;
  impConectarBanco: string;
  impConectarBancoSub: string;
  // Fluxo de voz (segurar pra falar)
  impVozSegure: string;
  impVozSolte: string;
  impVozNaoSuportado: string;
  impVozNaoEntendi: string;
  impVozErroPermissao: string;
  impVozErroSemFala: string;
  impVozErroRede: string;
  impVozErroSemMicrofone: string;
  impVozErroGenerico: string;
  /** Só a pergunta que abre a dica do Safari no iPhone; o passo a passo (aA › Configurações…) é fixo. */
  impVozSafariDica: string;
  // Compartilhado pelos importadores (mesma frase em mais de um lugar = uma chave só)
  impLendoArquivo: string;
  impErroEnvio: string;
  impErroSalvar: string;
  impProtegido: string;
  impSenhaPlaceholder: string;
  impAbrindo: string;
  impDesbloquear: string;
  impOutroArquivo: string;
  impAplicando: string;
  impPular: string;
  impRemover: string;
  impConcluir: string;
  // Extrato/fatura: subir o arquivo
  impArquivoGrande: string;
  impOQueSubindo: string;
  impTipoExtrato: string;
  impTipoFatura: string;
  impExtratoDica: string;
  impFaturaDica: string;
  impFaturaMes: string;
  impFaturaMesDica(mes: string): string;
  impEscolherExtrato: string;
  impFormatosBanco: string;
  impSenhaDicaBanco: string;
  /** "Esse arquivo parece uma fatura de cartão (motivo), não um extrato." */
  impPareceOutroTipo(sugerido: "extrato" | "fatura", atual: "extrato" | "fatura", motivo: string): string;
  impPareceFaturaAviso: string;
  impPareceExtratoAviso: string;
  impImportarComo(tipo: "extrato" | "fatura"): string;
  impEMesmo(tipo: "extrato" | "fatura"): string;
  // Extrato/fatura: revisão de categoria, uma por vez
  impRevisar(atual: number, total: number): string;
  impParcela(atual: number, total: number, restantes: number): string;
  impQualCategoria: string;
  impOutra: string;
  impNovaCategoriaPlaceholder: string;
  impCriando: string;
  impCriarEUsar: string;
  impNovaCategoriaDica: string;
  // Extrato/fatura: conferência antes de importar
  impSemCategoriaTitulo(n: number): string;
  impSemCategoriaSub(n: number, soma: string): string;
  impCategorizar(n: number): string;
  impNumerosErrados: string;
  impNumerosErradosDica: string;
  impFalarComAGente: string;
  impResumoLancamentos(n: number, valor: string): string;
  impNoSaldo(positivo: boolean): string;
  impEntendiComo(resumo: string): string;
  impLinhasLidas(lidas: number, total: number): string;
  impTotalImpresso(valor: string): string;
  impCoberturaBaixa: string;
  impFaltouCoisa: string;
  impSomaDiferente(abaixo: boolean, diferenca: string): string;
  impRepetidos: string;
  impRepetidosDica: string;
  impDeixarSo1: string;
  impRotuloRenda: string;
  impImportando: string;
  impImportarN(n: number): string;
  // Extrato/fatura: pronto
  impImportadosSucesso(n: number): string;
  impToastImportados(n: number): string;
  impToastJaExistiam(n: number): string;
  impPagamentoFatura(n: number): string;
  impSemData: string;
  impRemovidoExtrato: string;
  impManter: string;
  // Posição da corretora (carteira)
  impCarteiraArquivoGrande: string;
  impCarteiraEscolher: string;
  impCarteiraFormato: string;
  impSenhaDicaCorretora: string;
  impCarteiraLiTudo(resumo: string): string;
  impCarteiraEmDia(n: number): string;
  impCarteiraNovos: string;
  impCarteiraSemValor: string;
  impCarteiraMudancas: string;
  impCarteiraSemMudanca(n: number): string;
  /** O botão que promete o que vai fazer: "Adicionar 3 e atualizar 2", "Atualizar 2"… */
  impCarteiraBotao(novos: number, mudancas: number): string;
  /** A frase final: "3 novos na carteira · 2 atualizados", ou que não havia nada a mudar. */
  impCarteiraFeito(criados: number, atualizados: number): string;
  // Declaração de IR (preço médio)
  impIrpfArquivoGrande: string;
  impIrpfSelecioneUm: string;
  /** [antes, destaque, depois]: o miolo vai em destaque na tela, por isso vem em três pedaços. */
  impIrpfIntro: [string, string, string];
  impIrpfLendo: string;
  impIrpfEscolher: string;
  impIrpfFormato: string;
  impIrpfEncontrei(n: number): string;
  impIrpfConfira: string;
  impIrpfPrecoMedio: string;
  impIrpfNaDeclaracao(quantidade: string): string;
  impIrpfInvestido: string;
  impIrpfNaoAplicar: string;
  impIrpfComoFunciona: string;
  impIrpfAplicarEm(n: number): string;
  impIrpfConcluido(n: number): string;
  // Histórico de importações
  impHistoricoTitulo: string;
  impHistoricoExtrato: string;
  impHistoricoFatura: string;
  impHistoricoBanco: string;
  impHistoricoLancamentos(n: number): string;
  impHistoricoDesfazer: string;
  impHistoricoConfirmar: string;
  impHistoricoDesfeita(n: number): string;
  impHistoricoNota: string;
  // "Parece que se repete"
  impRepeteTitulo: string;
  impRepeteSub: string;
  impRepeteLancamento: string;
  impRepeteCostumaCair(dia: number): string;
  impRepeteVistoEm(n: number): string;
  impRepeteLancar: string;
  impRepeteTodoMes: string;
  impRepeteLancado: string;
  impRepeteLancadoAteDezembro: string;
  impRepeteErro: string;
  // Resumo mensal: o convite no topo do Fluxo
  impResumoPronto: string;
  impResumoProntoSub: string;
  // Resumo mensal: os stories
  impStoryTitulo: string;
  impStorySub: string;
  impStoryGastou: string;
  impStoryMaiorParte: string;
  impStoryComparado: string;
  impStoryDelta(pct: number, menos: boolean): string;
  impStoryEsteMes: string;
  impStoryMesPassado: string;
  impStoryDiaEconomico: string;
  impStoryDiaGastador: string;
  impStoryDiaGastadorCom(valor: string): string;
  impStoryDesdeQueChegou(meses: number, positivo: boolean): string;
  impStoryAcumuladoRuim: string;
  impStoryProjecaoUnica: string;
  impStoryProjecaoUnicaNota(valor: string): string;
  impStoryProjecaoMensal: string;
  impStoryProjecaoMensalNota(valor: string): string;
  impStoryDestaques: string;
  impStoryGastosDoMes: string;
  impStoryNoBolso: string;
  impStoryPotencial: string;
  impStoryGerando: string;
  impStoryCompartilhar: string;
  // Resumo mensal: a imagem e o texto de compartilhar
  impShareTitulo: string;
  /** As duas linhas do título desenhado na imagem. */
  impShareImagemTitulo: [string, string];
  impShareGastei: string;
  impShareFicouNoBolso: string;
  impShareSaldo: string;
  impSharePotencial: string;
  /** O texto que vai no lugar da imagem quando o aparelho não compartilha arquivo. */
  impShareTexto(periodo: string, gastei: string, positivo: boolean, saldo: string, potencial: string): string;
};

const s = (n: number) => (n === 1 ? "" : "s");

export const PADRAO_IMPORTACAO: TextosImportacao = {
  // Drawer "Registrar"
  impVoltar: "Voltar",
  impDigitar: "Digitar",
  impGravarAudio: "Gravar áudio",
  impImportarArquivo: "Importar extrato ou fatura (PDF, Excel, CSV, OFX)",
  impConectarBanco: "Conectar meu banco",
  impConectarBancoSub: "Open Finance · os lançamentos chegam sozinhos, todo dia",
  // Fluxo de voz
  impVozSegure: "Segure para falar",
  impVozSolte: "Solte para transcrever",
  impVozNaoSuportado: "Seu navegador não suporta reconhecimento de voz. Use a opção de digitar.",
  impVozNaoEntendi: "Não entendemos o que foi dito. Tente falar de novo.",
  impVozErroPermissao: "Permita o acesso ao microfone nas configurações do navegador e tente de novo.",
  impVozErroSemFala: "Não conseguimos te ouvir. Aproxime o microfone e tente de novo.",
  impVozErroRede: "Falha de conexão durante a gravação. Tente de novo.",
  impVozErroSemMicrofone: "Nenhum microfone encontrado neste dispositivo.",
  impVozErroGenerico: "Não foi possível gravar agora. Tente de novo.",
  impVozSafariDica: "Cansada de autorizar o microfone toda vez? O Safari pergunta de novo a cada visita.",
  // Compartilhado
  impLendoArquivo: "Lendo arquivo...",
  impErroEnvio: "Não consegui enviar o arquivo. Confira a internet e tente de novo.",
  impErroSalvar: "Não consegui salvar. Confira a internet e tente de novo.",
  impProtegido: "Este arquivo está protegido por senha",
  impSenhaPlaceholder: "Senha do arquivo",
  impAbrindo: "Abrindo...",
  impDesbloquear: "Desbloquear e continuar",
  impOutroArquivo: "Escolher outro arquivo",
  impAplicando: "Aplicando...",
  impPular: "Pular",
  impRemover: "Remover",
  impConcluir: "Concluir",
  // Extrato/fatura: subir o arquivo
  impArquivoGrande: "Arquivo muito grande (máx. 4 MB). Exporte um período menor do extrato, ou salve em Excel (.xlsx) ou CSV, que pesam bem menos que PDF.",
  impOQueSubindo: "O que você está subindo?",
  impTipoExtrato: "Extrato bancário",
  impTipoFatura: "Fatura de cartão",
  impExtratoDica: "Entradas viram renda e saídas viram gasto, pelo sinal do valor.",
  impFaturaDica: "Todas as linhas entram como gasto (compras do cartão).",
  impFaturaMes: "De qual mês é esta fatura?",
  impFaturaMesDica: (mes) =>
    `Todas as compras desta fatura vão entrar em ${mes}, mesmo as que aconteceram no mês anterior (o fechamento da fatura costuma cruzar dois meses).`,
  impEscolherExtrato: "Escolher extrato",
  impFormatosBanco: "CSV, OFX, Excel ou PDF do seu banco",
  impSenhaDicaBanco:
    "Quase sempre é o seu CPF, só os números. Se não for, a senha vem escrita no e-mail em que o banco mandou o arquivo.",
  impPareceOutroTipo: (sugerido, atual, motivo) =>
    `Esse arquivo parece ${sugerido === "fatura" ? "uma fatura de cartão" : "um extrato bancário"}${motivo ? ` (${motivo})` : ""}, não ${atual === "fatura" ? "uma fatura" : "um extrato"}.`,
  impPareceFaturaAviso: "Se importar como extrato, cada compra do cartão vira renda no seu mês.",
  impPareceExtratoAviso: "Se importar como fatura, cada entrada da conta vira gasto.",
  impImportarComo: (tipo) => `Importar como ${tipo === "fatura" ? "fatura" : "extrato"}`,
  impEMesmo: (tipo) => `É ${tipo === "fatura" ? "fatura" : "extrato"} mesmo`,
  // Extrato/fatura: revisão
  impRevisar: (atual, total) => `Revisar ${atual} de ${total}`,
  impParcela: (atual, total, restantes) =>
    `Parcela ${atual} de ${total}: as ${restantes} seguintes entram sozinhas nos próximos meses.`,
  impQualCategoria: "Qual a categoria?",
  impOutra: "Outra",
  impNovaCategoriaPlaceholder: "Nome da categoria (ex.: Fatura, Pet, Farmácia)",
  impCriando: "Criando...",
  impCriarEUsar: "Criar e usar",
  impNovaCategoriaDica: "A categoria nova já aparece no Orçamento pra você planejar um valor pra ela.",
  // Extrato/fatura: conferência
  impSemCategoriaTitulo: (n) => `${n} gasto${s(n)} sem categoria ${n === 1 ? "ficou" : "ficaram"} de fora`,
  impSemCategoriaSub: (n, soma) => `${n === 1 ? "Ele não entra" : "Eles não entram"} na importação. Some ${soma}.`,
  impCategorizar: (n) => `Categorizar ${n === 1 ? "esse gasto" : "esses gastos"} →`,
  impNumerosErrados: "Esses números parecem errados",
  impNumerosErradosDica:
    "Confira a lista abaixo antes de confirmar. Se estiver errado mesmo, fala com a gente — já guardamos uma cópia do arquivo e ensinamos o app a ler esse banco.",
  impFalarComAGente: "Falar com a gente",
  impResumoLancamentos: (n, valor) => `${n} lançamento${s(n)} · ${valor}`,
  impNoSaldo: (positivo) => `${positivo ? "a mais" : "a menos"} no saldo`,
  impEntendiComo: (resumo) => `Entendi como: ${resumo}.`,
  impLinhasLidas: (lidas, total) => `Li ${lidas} de ${total} linhas com valor no arquivo.`,
  impTotalImpresso: (valor) => `Total impresso na fatura: ${valor}.`,
  impCoberturaBaixa: "Menos da metade das linhas com valor virou lançamento. Confira se falta alguma coisa.",
  impFaltouCoisa: "Faltou coisa, me ajuda",
  impSomaDiferente: (abaixo, diferenca) =>
    `A soma lida ${abaixo ? "está" : "passa"} ${diferenca} ${abaixo ? "abaixo" : "acima"} do total impresso na fatura. Pode faltar (ou sobrar) alguma linha.`,
  impRepetidos: "Repetidos no arquivo",
  impRepetidosDica:
    "Mesma data, valor e descrição mais de uma vez. Se foi compra de verdade, mantenha; se é o arquivo repetindo, deixe só uma.",
  impDeixarSo1: "Deixar só 1",
  impRotuloRenda: "Renda",
  impImportando: "Importando...",
  impImportarN: (n) => `Importar ${n} lançamento${s(n)}`,
  // Extrato/fatura: pronto
  impImportadosSucesso: (n) => `${n} lançamentos importados com sucesso.`,
  impToastImportados: (n) => `${n} lançamentos importados`,
  impToastJaExistiam: (n) => `${n} já existiam (ignorados)`,
  impPagamentoFatura: (n) =>
    `Encontrei ${n === 1 ? "este lançamento" : "estes lançamentos"} no seu extrato que ${n === 1 ? "pode ser" : "podem ser"} o pagamento desta fatura. Quer remover pra não contar o gasto duas vezes?`,
  impSemData: "sem data",
  impRemovidoExtrato: "Removido do extrato.",
  impManter: "Manter",
  // Posição da corretora
  impCarteiraArquivoGrande: "Arquivo muito grande (máx. ~7 MB). Exporte um relatório menor e tente de novo.",
  impCarteiraEscolher: "Escolher a posição da corretora",
  impCarteiraFormato: "Posição da corretora ou da B3 (CSV, Excel ou PDF)",
  impSenhaDicaCorretora:
    "Digite a senha do arquivo (a mesma que a corretora pede pra abrir). Ela é usada só pra abrir e não fica salva.",
  impCarteiraLiTudo: (resumo) => `Li o arquivo inteiro: ${resumo}.`,
  impCarteiraEmDia: (n) =>
    `Sua carteira já está em dia com esse extrato, ${n} ativo${s(n)} conferido${s(n)}, nenhuma mudança encontrada. 🎉`,
  impCarteiraNovos: "Novos na carteira",
  impCarteiraSemValor: "sem valor",
  impCarteiraMudancas: "Mudanças",
  impCarteiraSemMudanca: (n) =>
    `${n} ativo${s(n)} sem mudança, já ${n === 1 ? "está" : "estão"} na carteira e ${n === 1 ? "fica" : "ficam"} como ${n === 1 ? "está" : "estão"}.`,
  impCarteiraBotao: (novos, mudancas) =>
    [novos > 0 ? `Adicionar ${novos}` : null, mudancas > 0 ? `atualizar ${mudancas}` : null]
      .filter(Boolean)
      .join(" e ")
      .replace(/^atualizar/, "Atualizar"),
  impCarteiraFeito: (criados, atualizados) =>
    [criados > 0 ? `${criados} novo${s(criados)} na carteira` : null, atualizados > 0 ? `${atualizados} atualizado${s(atualizados)}` : null]
      .filter(Boolean)
      .join(" · ") || "Nada pra mudar, carteira já estava em dia.",
  // Declaração de IR
  impIrpfArquivoGrande: "Arquivo muito grande (máx. ~7 MB).",
  impIrpfSelecioneUm: "Selecione ao menos um ativo pra aplicar o preço médio.",
  impIrpfIntro: [
    "Sua declaração de IR tem o ",
    "preço médio",
    " de cada ação e FII (o custo de aquisição), o que os extratos de corretora não trazem. Suba o PDF do recibo da declaração e eu preencho o investido de cada ativo, pra o lucro/prejuízo calcular certo.",
  ],
  impIrpfLendo: "Lendo declaração...",
  impIrpfEscolher: "Escolher PDF da declaração",
  impIrpfFormato: "Recibo da Declaração de Ajuste Anual (PDF de texto)",
  impIrpfEncontrei: (n) => `Encontrei ${n} ativo${s(n)} com preço médio.`,
  impIrpfConfira:
    "Confira o ativo da sua carteira em cada linha (as que a declaração só traz o nome da empresa vêm sem casar — escolha à mão ou deixe de fora).",
  impIrpfPrecoMedio: "Preço médio",
  impIrpfNaDeclaracao: (quantidade) => `${quantidade} na declaração`,
  impIrpfInvestido: "investido",
  impIrpfNaoAplicar: "Não aplicar",
  impIrpfComoFunciona:
    "O preço médio vira o valor investido (preço médio × quantidade da carteira). A cotação atual não muda, só o investido, que é a base do lucro/prejuízo.",
  impIrpfAplicarEm: (n) => `Aplicar em ${n} ativo${s(n)}`,
  impIrpfConcluido: (n) => `Preço médio preenchido em ${n} ativo${s(n)}. Agora o lucro/prejuízo deles calcula certo.`,
  // Histórico de importações
  impHistoricoTitulo: "Histórico de importações",
  impHistoricoExtrato: "Extrato",
  impHistoricoFatura: "Fatura",
  impHistoricoBanco: "Banco conectado",
  impHistoricoLancamentos: (n) => `${n} lançamento${s(n)}`,
  impHistoricoDesfazer: "Desfazer",
  impHistoricoConfirmar: "Confirmar exclusão?",
  impHistoricoDesfeita: (n) => `Importação desfeita: ${n} lançamento${s(n)} removido${s(n)}.`,
  impHistoricoNota:
    "Desfazer uma importação apaga todos os lançamentos que aquele arquivo criou. Importações feitas antes deste histórico existir não aparecem aqui.",
  // "Parece que se repete"
  impRepeteTitulo: "Parece que se repete",
  impRepeteSub: "Estava nos meses anteriores e ainda não está neste. Um toque lança.",
  impRepeteLancamento: "Lançamento",
  impRepeteCostumaCair: (dia) => `costuma cair dia ${dia}`,
  impRepeteVistoEm: (n) => `${n} dos últimos 3 meses`,
  impRepeteLancar: "Lançar",
  impRepeteTodoMes: "Todo mês",
  impRepeteLancado: "Lançado.",
  impRepeteLancadoAteDezembro: "Lançado neste mês e nos seguintes até dezembro.",
  impRepeteErro: "Não consegui lançar. Tente de novo.",
  // Resumo mensal: convite
  impResumoPronto: "Seu resumo mensal está pronto",
  impResumoProntoSub: "Veja o que aconteceu com o seu dinheiro este mês",
  // Resumo mensal: stories
  impStoryTitulo: "Resumo Mensal",
  impStorySub: "O que aconteceu com o seu dinheiro este mês.",
  impStoryGastou: "Este mês você gastou",
  impStoryMaiorParte: "A maior parte foi com",
  impStoryComparado: "Comparado com o mês anterior, você gastou",
  impStoryDelta: (pct, menos) => `${pct}% ${menos ? "menos" : "a mais"}`,
  impStoryEsteMes: "Este mês",
  impStoryMesPassado: "Mês passado",
  impStoryDiaEconomico: "Seu dia da semana mais econômico foi",
  impStoryDiaGastador: "O dia da semana mais gastador foi",
  impStoryDiaGastadorCom: (valor) => `com ${valor}`,
  impStoryDesdeQueChegou: (meses, positivo) =>
    `Desde que você chegou aqui (${meses} ${meses === 1 ? "mês" : "meses"}),${positivo ? " ficou no seu bolso" : " o saldo ficou"}`,
  impStoryAcumuladoRuim: "Mês a mês dá pra virar esse jogo. O primeiro passo é ver o número.",
  impStoryProjecaoUnica: "Se você investisse hoje, de uma vez, tudo que já juntou, em 10 anos isso vira até…",
  impStoryProjecaoUnicaNota: (valor) => `*${valor} investidos de uma vez a 10% a.a., estimativa educativa, não garantia.`,
  impStoryProjecaoMensal: "Mantendo sua poupança média todo mês, reinvestindo, em 10 anos isso vira até…",
  impStoryProjecaoMensalNota: (valor) =>
    `*Poupança média de ${valor}/mês (poupado no ano ÷ meses preenchidos) a 10% a.a., estimativa educativa, não garantia.`,
  impStoryDestaques: "Destaques",
  impStoryGastosDoMes: "Gastos do mês",
  impStoryNoBolso: "No bolso desde o início",
  impStoryPotencial: "Potencial em 10 anos mantendo sua poupança média",
  impStoryGerando: "Gerando imagem…",
  impStoryCompartilhar: "Compartilhar resumo",
  // Resumo mensal: compartilhar
  impShareTitulo: "Meu resumo do mês",
  impShareImagemTitulo: ["Meu resumo", "do mês"],
  impShareGastei: "Gastei este mês",
  impShareFicouNoBolso: "Ficou no meu bolso desde o início",
  impShareSaldo: "Saldo desde o início",
  impSharePotencial: "Potencial em 10 anos mantendo minha poupança média",
  impShareTexto: (periodo, gastei, positivo, saldo, potencial) =>
    [
      `Meu resumo do mês (${periodo}):`,
      `• Gastei ${gastei}`,
      `• ${positivo ? "Ficou no bolso" : "Saldo"} desde o início: ${saldo}`,
      `• Potencial em 10 anos: ${potencial}`,
    ].join("\n"),
};
