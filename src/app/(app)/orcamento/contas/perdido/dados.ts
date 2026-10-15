import type { AuthContext } from "@/lib/auth/session";
import { cacarDinheiroPerdido, estornoCaiu, type Achado, type ResultadoDaCaca } from "@/lib/dinheiro-perdido/detectar";
import { ateAgora, type EstadoDoAchado } from "@/lib/dinheiro-perdido/placar";
import { chavesDasAssinaturasDela, lancamentosParaCacar, listarAchadosGuardados, type AchadoGuardado } from "@/lib/repositories/dinheiro-perdido.repo";
import { carregarRespostasDeAssinatura, estadoPara } from "@/lib/assinaturas/respostas";
import { cartaComARegraUnica } from "@/lib/assinaturas/regra";

/** Uma carta pronta para a tela: o achado (sem a lista de lançamentos), o estado e se é novo. */
export type CartaDaTela = Omit<Achado, "lancamentos"> & { estado: EstadoDoAchado; novo: boolean };

function semLancamentos(a: Achado): Omit<Achado, "lancamentos"> {
  const { lancamentos, ...resto } = a;
  void lancamentos;
  return resto;
}

/** Achado que não aparece mais no extrato (já cancelou, o mês passou): volta da fotografia guardada. */
function daFotografia(g: AchadoGuardado): Omit<Achado, "lancamentos"> {
  const d = g.dados ?? {};
  return {
    chave: g.chave,
    tipo: (d.tipo ?? g.tipo) as Achado["tipo"],
    nome: g.nome,
    quem: d.quem ?? g.nome,
    descricaoDoLogo: d.descricaoDoLogo ?? g.nome,
    mensal: g.mensal,
    unico: g.unico,
    anual: g.mensal ? g.mensal * 12 : (g.unico ?? 0),
    dia: d.dia ?? null,
    meses: d.meses ?? 1,
    antes: d.antes,
    agora: d.agora,
    datas: d.datas,
    valorDaCobranca: d.valorDaCobranca,
    tarifa: d.tarifa,
    comerciante: d.comerciante ?? "",
    ultimaData: d.ultimaData ?? null,
  };
}

export type DinheiroPerdido = {
  /** As cartas para conferir, uma por vez (a ordem do motor: o maior por ano primeiro). */
  abertas: CartaDaTela[];
  /** Tudo, aberto e decidido: é o "ver tudo". */
  todas: CartaDaTela[];
  ateAgora: ReturnType<typeof ateAgora>;
  /** Achados que chegaram com um extrato novo e ela ainda não abriu. */
  novos: number;
  conferidos: ResultadoDaCaca["conferidos"];
  /** Os achados de agora, inteiros: é o que o "visto" guarda. */
  vivos: Achado[];
};

/**
 * Monta a tela: caça nos lançamentos de agora, junta com as decisões guardadas e soma o "Até
 * agora". Só lê; quem grava é a importação (o "novo") e as escolhas dela.
 */
export async function carregarDinheiroPerdido(ctx: AuthContext): Promise<DinheiroPerdido> {
  const [lancamentos, guardados, assinaturasDela, respostas] = await Promise.all([lancamentosParaCacar(ctx), listarAchadosGuardados(ctx), chavesDasAssinaturasDela(ctx), carregarRespostasDeAssinatura(ctx)]);
  const resultado = cacarDinheiroPerdido(lancamentos, { assinaturasDela });
  const porChave = new Map(guardados.map((g) => [g.chave, g]));
  const vivas = new Set(resultado.achados.map((a) => a.chave));

  // O estorno pedido que já caiu no extrato conta mesmo antes da próxima importação gravar.
  const estadoDe = (g: AchadoGuardado | undefined): EstadoDoAchado => {
    if (!g) return "aberto";
    if (g.estado === "pedi_estorno" && g.dados) {
      const d = g.dados;
      const caiu = estornoCaiu({ comerciante: d.comerciante ?? "", ultimaData: d.ultimaData ?? null, unico: g.unico, valorDaCobranca: d.valorDaCobranca, descricaoDoLogo: d.descricaoDoLogo ?? g.nome }, lancamentos);
      if (caiu) return "estornado";
    }
    return g.estado;
  };

  // A carta de assinatura segue a regra única (lib/assinaturas): a última resposta sobre ela, em
  // qualquer tela, decide "Uso", "Não uso" ou aberta; a que ela disse que não é assinatura sai.
  const comARegraUnica = (c: CartaDaTela) => cartaComARegraUnica(c, (marcas) => estadoPara(respostas, marcas));
  const doExtrato: CartaDaTela[] = resultado.achados
    .map((a) => {
      const g = porChave.get(a.chave);
      return comARegraUnica({ ...semLancamentos(a), estado: estadoDe(g), novo: Boolean(g && g.vistoEm === null && g.estado === "aberto") });
    })
    .filter((c): c is CartaDaTela => c !== null);
  const soGuardadas: CartaDaTela[] = guardados
    .filter((g) => !vivas.has(g.chave))
    .map((g) => comARegraUnica({ ...daFotografia(g), estado: estadoDe(g), novo: false }))
    .filter((c): c is CartaDaTela => c !== null && c.estado !== "aberto");
  const todas = [...doExtrato, ...soGuardadas];
  const decididas = todas.filter((c) => c.estado !== "aberto");
  return {
    abertas: doExtrato.filter((c) => c.estado === "aberto"),
    todas,
    ateAgora: ateAgora(decididas.map((c) => ({ mensal: c.mensal, unico: c.unico ?? c.valorDaCobranca ?? null, estado: c.estado }))),
    novos: doExtrato.filter((c) => c.novo).length,
    conferidos: resultado.conferidos,
    vivos: resultado.achados,
  };
}
