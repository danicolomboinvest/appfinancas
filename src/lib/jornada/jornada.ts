/**
 * A Jornada (16/10/2026, pedido da Dani): quem saiu do SPI (reembolso) e o que cada pessoa fez
 * antes de sair, para entender onde ela travou. Aqui só as regras, sem banco: o que conta como
 * "onde parou", o nome de cada tela e de cada erro de importação, e a linha do tempo montada a
 * partir do que o app já registra (compra, conta, telas, importações, lançamentos, reembolso).
 */

/** Onde a pessoa parou, do começo ao fim do caminho. A ordem é a da jornada. */
export type OndeParou = "sem_conta" | "nao_subiu" | "nao_leu" | "revisao" | "usou";

export const ONDE_PAROU: { chave: OndeParou; rotulo: string; tom: "ambar" | "terracota" | "ardosia" }[] = [
  { chave: "sem_conta", rotulo: "Não criou a conta", tom: "ambar" },
  { chave: "nao_subiu", rotulo: "Não subiu arquivo", tom: "ambar" },
  { chave: "nao_leu", rotulo: "Arquivo não lido", tom: "terracota" },
  { chave: "revisao", rotulo: "Travou na revisão", tom: "terracota" },
  { chave: "usou", rotulo: "Usou e parou", tom: "ardosia" },
];

export function rotuloDeOndeParou(chave: OndeParou): string {
  return ONDE_PAROU.find((o) => o.chave === chave)?.rotulo ?? chave;
}

/** O resumo de importação de uma pessoa: quantas tentativas, quantas lidas, quantas gravadas. */
export type ResumoDeImportacao = {
  temConta: boolean;
  tentativas: number;
  lidas: number;
  gravadas: number;
};

/**
 * Onde ela parou: sem conta; conta sem nenhum arquivo; arquivo que nunca foi lido; lido e nunca
 * gravado (parou na revisão); ou gravou e ainda assim saiu.
 */
export function ondeParou(r: ResumoDeImportacao): OndeParou {
  if (!r.temConta) return "sem_conta";
  if (r.tentativas === 0 && r.gravadas === 0) return "nao_subiu";
  if (r.gravadas > 0) return "usou";
  if (r.lidas === 0) return "nao_leu";
  return "revisao";
}

/** O que se sabe de uma tentativa de importação (ImportDiagnostic), sem o conteúdo do arquivo. */
export type TentativaDeImportacao = {
  stage: string;
  ok: boolean;
  target: string;
  kind: string | null;
  encoding: string | null;
  message: string | null;
  parsed: number;
  created: number;
};

/**
 * O erro em palavras curtas, a mesma separação da investigação de 15/10/2026 (senha, print,
 * formato desconhecido...). Nunca a mensagem inteira: ela é longa e às vezes cita o arquivo.
 */
export function rotuloDoErro(t: TentativaDeImportacao): string {
  const m = (t.message ?? "").toLowerCase();
  if (m.includes("senha")) return "Senha";
  if (m.startsWith("não consegui ler pdf neste servidor") || m.startsWith("exceção") || m.includes("nosso lado") || m.includes("[exce")) return "Erro do app";
  if (["pdf-vazio", "print", "pdf-so-numeros"].includes(t.kind ?? "") || t.encoding === "imagem" || m.includes("é uma imagem")) return "Foto ou print";
  if (t.target === "carteira" && (t.kind === "statement" || t.kind === "invoice")) return "Subiu na Carteira";
  if (["conta-de-consumo", "position", "irpf"].includes(t.kind ?? "")) return "Não é extrato";
  if (m.includes("linhas com valor, mas não consegui")) return "Formato desconhecido";
  if (m.includes("não encontrei transações") || m.includes("nenhum lançamento") || m.includes("chegou vazio") || m.includes("não identif")) return "Arquivo vazio";
  return "Não leu";
}

/** Tentativa que leu alguma coisa (o arquivo abriu e virou lançamentos para revisar). */
export function leu(t: TentativaDeImportacao): boolean {
  return t.stage === "parse" && t.ok && t.parsed > 0;
}

/** Tentativa que gravou lançamentos (a pessoa confirmou a importação). */
export function gravou(t: TentativaDeImportacao): boolean {
  return t.stage === "confirm" && t.ok && t.created > 0;
}

/** Tentativa de leitura que falhou ou não achou nada. */
export function falhou(t: TentativaDeImportacao): boolean {
  return t.stage === "parse" && (!t.ok || t.parsed === 0);
}

const AREAS: [prefixo: string, rotulo: string][] = [
  ["/mensal/foco", "Visão geral"],
  ["/dashboard", "Visão geral"],
  ["/resumo-mensal", "Resumo do mês"],
  ["/mensal", "Mês"],
  ["/orcamento", "Orçamento"],
  ["/planejamento/metas", "Metas"],
  ["/planejamento/reserva", "Reserva"],
  ["/planejamento", "Planejamento"],
  ["/carteira", "Carteira"],
  ["/decidir", "Decidir"],
  ["/configuracoes", "Configurações"],
  ["/perfis", "Perfis"],
  ["/fichas", "Fichas"],
  ["/simuladores", "Calculadoras"],
  ["/viagem", "Viagem"],
  ["/dividas", "Dívidas"],
  ["/guia", "Como funciona"],
  ["/empresa", "Empresa"],
  ["/investir", "Empresa"],
  ["/divisao", "Nós dois"],
  ["/money-reset", "Money Reset"],
  ["/assinar", "Assinar"],
  ["/comecar", "Começo"],
];

const EVENTOS: Record<string, string> = {
  registro_importacao: "Abriu Importar",
  registro_digitado: "Abriu Digitar",
  registro_voz: "Falou um gasto",
  posso_comprar: "Posso comprar?",
  conta_a_pagar: "Conta a pagar",
  assinar_apple_viu: "Assinar (iPhone)",
  assinar_apple_tocou: "Tocou em assinar",
  tour_terminou: "Tutorial",
  tour_pulou: "Pulou o tutorial",
  novidades_terminou: "Tutorial",
  novidades_pulou: "Pulou o tutorial",
};

/** O nome da tela ou do toque, curto, para os chips da linha do tempo. */
export function rotuloDoUso(nome: string, caminho: string): string {
  if (nome !== "pageview") {
    if (nome.startsWith("comeco_")) return "Começo";
    return EVENTOS[nome] ?? nome.replace(/_/g, " ");
  }
  for (const [prefixo, rotulo] of AREAS) if (caminho === prefixo || caminho.startsWith(`${prefixo}/`)) return rotulo;
  const primeiro = caminho.split("/").filter(Boolean)[0];
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).replace(/-/g, " ") : "Início";
}

/* ---------------------------------------------------------------- Linha do tempo */

export type ItemDaLinha = {
  quando: Date;
  /** Só o dia (true) ou dia e hora (false). */
  soDia: boolean;
  texto: string;
  /** ok = passou; parou = onde travou; neutro = só aconteceu. */
  marca: "ok" | "parou" | "neutro";
  chips: { texto: string; erro?: boolean }[];
};

export type DadosDaJornada = {
  comprouEm: Date | null;
  via: "hubla" | "apple" | "manual";
  contaEm: Date | null;
  /** Uso do app (telas e toques), em ordem. */
  usos: { nome: string; caminho: string; em: Date }[];
  tentativas: (TentativaDeImportacao & { em: Date })[];
  /** Lançamentos feitos à mão (sem lote de importação), com a data em que foram criados. */
  manuais: Date[];
  saiuEm: Date | null;
  /** "reembolso" | "cancelou" */
  comoSaiu: "reembolso" | "cancelou" | null;
};

/** A chave do dia no fuso de Brasília (AAAA-MM-DD), para agrupar o que aconteceu no mesmo dia. */
export function diaEmBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const MAX_CHIPS = 6;

function semRepetir(textos: string[]): string[] {
  return [...new Set(textos)];
}

/**
 * A história em ordem: comprou, criou a conta, cada dia de importação (tentativas, o que leu, o
 * que gravou), os lançamentos à mão, os dias em que só abriu o app (com as telas) e a saída.
 * O ponto vermelho vai no lugar onde ela parou (a mesma regra de `ondeParou`).
 */
export function montarLinhaDoTempo(d: DadosDaJornada): ItemDaLinha[] {
  const itens: ItemDaLinha[] = [];
  const via = d.via === "apple" ? "pela Apple" : d.via === "hubla" ? "pela Hubla" : "liberado à mão";
  if (d.comprouEm) itens.push({ quando: d.comprouEm, soDia: false, texto: `Comprou ${via}`, marca: "ok", chips: [] });

  const resumo: ResumoDeImportacao = {
    temConta: d.contaEm !== null,
    tentativas: d.tentativas.filter((t) => t.stage === "parse").length,
    lidas: d.tentativas.filter(leu).length,
    gravadas: d.tentativas.filter(gravou).length,
  };
  const parou = ondeParou(resumo);

  if (!d.contaEm) {
    itens.push({ quando: d.comprouEm ?? d.saiuEm ?? new Date(0), soDia: true, texto: "Não criou a conta", marca: "parou", chips: [] });
  } else {
    itens.push({ quando: d.contaEm, soDia: false, texto: "Criou a conta", marca: "ok", chips: [] });
    if (parou === "nao_subiu") {
      const abriu = d.usos.find((u) => u.nome === "registro_importacao" || u.caminho.startsWith("/comecar/porta/extrato"));
      itens.push({
        quando: abriu?.em ?? d.contaEm,
        soDia: !abriu,
        texto: abriu ? "Abriu Importar e não subiu arquivo" : "Nunca subiu um arquivo",
        marca: "parou",
        chips: [],
      });
    }
  }

  // Importações, um item por dia.
  const porDia = new Map<string, (TentativaDeImportacao & { em: Date })[]>();
  for (const t of d.tentativas) {
    const k = diaEmBrasilia(t.em);
    porDia.set(k, [...(porDia.get(k) ?? []), t]);
  }
  for (const lista of porDia.values()) {
    const leituras = lista.filter((t) => t.stage === "parse");
    const gravados = lista.filter(gravou).reduce((s, t) => s + t.created, 0);
    const erros = leituras.filter(falhou).map(rotuloDoErro);
    const lidas = leituras.filter(leu).length;
    const primeiro = lista[0].em;
    let texto: string;
    let marca: ItemDaLinha["marca"];
    if (gravados > 0) {
      texto = `Importou ${gravados} ${gravados === 1 ? "lançamento" : "lançamentos"}`;
      marca = "ok";
    } else if (lidas > 0) {
      texto = leituras.length === 1 ? "O app leu o arquivo e ela não gravou" : `Tentou ${leituras.length} vezes, leu e não gravou`;
      marca = parou === "revisao" ? "parou" : "neutro";
    } else {
      texto = leituras.length === 1 ? "Tentou importar, não leu" : `Tentou importar ${leituras.length} vezes, não leu`;
      marca = parou === "nao_leu" ? "parou" : "neutro";
    }
    const chips = erros.slice(0, MAX_CHIPS).map((e) => ({ texto: e, erro: true }));
    if (erros.length > MAX_CHIPS) chips.push({ texto: `mais ${erros.length - MAX_CHIPS}`, erro: true });
    itens.push({ quando: primeiro, soDia: false, texto, marca, chips });
  }

  // Lançamentos à mão, um item por dia.
  const manuaisPorDia = new Map<string, Date[]>();
  for (const m of d.manuais) {
    const k = diaEmBrasilia(m);
    manuaisPorDia.set(k, [...(manuaisPorDia.get(k) ?? []), m]);
  }
  for (const lista of manuaisPorDia.values()) {
    itens.push({ quando: lista[0], soDia: true, texto: `Lançou ${lista.length} à mão`, marca: "ok", chips: [] });
  }

  // Os dias de uso: as telas que abriu em cada dia (sem repetir), menos o dia da conta, que já
  // aparece acima, e os dias que já têm importação ou lançamento à mão ficam com as telas também.
  const usosPorDia = new Map<string, { em: Date; nomes: string[] }>();
  for (const u of d.usos) {
    const k = diaEmBrasilia(u.em);
    const atual = usosPorDia.get(k) ?? { em: u.em, nomes: [] };
    atual.nomes.push(rotuloDoUso(u.nome, u.caminho));
    usosPorDia.set(k, atual);
  }
  const dias = [...usosPorDia.entries()].sort(([a], [b]) => a.localeCompare(b));
  dias.forEach(([, uso], i) => {
    const telas = semRepetir(uso.nomes);
    const ultimo = i === dias.length - 1;
    const chips = telas.slice(0, MAX_CHIPS).map((t) => ({ texto: t }));
    if (telas.length > MAX_CHIPS) chips.push({ texto: `mais ${telas.length - MAX_CHIPS}` });
    itens.push({ quando: uso.em, soDia: true, texto: ultimo ? "Último dia no app" : "Abriu o app", marca: ultimo && parou === "usou" ? "parou" : "neutro", chips });
  });

  if (d.saiuEm) {
    itens.push({ quando: d.saiuEm, soDia: true, texto: d.comoSaiu === "cancelou" ? "Cancelou a renovação" : "Pediu reembolso", marca: "neutro", chips: [] });
  }

  // Ordem do tempo; no mesmo instante, a ordem em que foram postos (compra antes da conta).
  return itens.map((item, i) => ({ item, i })).sort((a, b) => a.item.quando.getTime() - b.item.quando.getTime() || a.i - b.i).map(({ item }) => item);
}

/** Quantos dias diferentes ela abriu o app. */
export function diasDeUso(usos: { em: Date }[]): number {
  return new Set(usos.map((u) => diaEmBrasilia(u.em))).size;
}
