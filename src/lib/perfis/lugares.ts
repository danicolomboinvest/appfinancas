/**
 * Os três lugares de perfil (decisão da dona, 11/10, rodada 74): Pessoal (incluso), Nós dois
 * (+ R$ 27 por ano) e Empresa (+ R$ 37 por ano). Sem "criar perfil" livre. Quem já tem mais
 * perfis (um segundo Pessoal, Casa, Projeto) mantém todos: eles aparecem à parte, "Você mantém os
 * perfis que já tinha". O par do casal entra por convite e não ocupa lugar.
 *
 * Puro: quem chama diz o que está liberado (ver extrasLiberados).
 */
export type TipoDoLugar = "PESSOAL" | "CASAL" | "EMPRESA";
/** A rota de compra de cada extra (/adicionais/<qual>, do branch de cobrança). */
export type Adicional = "conta_parceiro" | "perfil_empresa";

export type PerfilDoLugar = { id: string; name: string; kind: string; isDefault?: boolean; theme?: string };

export type Lugar<P extends PerfilDoLugar = PerfilDoLugar> = {
  tipo: TipoDoLugar;
  rotulo: string;
  perfil: P | null;
  /** Já pode usar: tem o perfil (cliente antiga mantém) ou o extra foi liberado. */
  liberado: boolean;
  /** Preço por ano do extra; null no Pessoal. */
  preco: number | null;
  adicional: Adicional | null;
};

export const PRECO_DOS_EXTRAS = { CASAL: 27, EMPRESA: 37 } as const;

export function lugaresDosPerfis<P extends PerfilDoLugar>(perfis: P[], liberados: { casal: boolean; empresa: boolean }): { lugares: Lugar<P>[]; mantidos: P[] } {
  const usados = new Set<string>();
  const pega = (kind: TipoDoLugar) => {
    const doTipo = perfis.filter((p) => p.kind === kind);
    const p = doTipo.find((x) => x.isDefault) ?? doTipo[0] ?? null;
    if (p) usados.add(p.id);
    return p;
  };
  const pessoal = pega("PESSOAL");
  const casal = pega("CASAL");
  const empresa = pega("EMPRESA");
  const lugares: Lugar<P>[] = [
    { tipo: "PESSOAL", rotulo: "Pessoal", perfil: pessoal, liberado: true, preco: null, adicional: null },
    { tipo: "CASAL", rotulo: "Nós dois", perfil: casal, liberado: !!casal || liberados.casal, preco: PRECO_DOS_EXTRAS.CASAL, adicional: "conta_parceiro" },
    { tipo: "EMPRESA", rotulo: "Empresa", perfil: empresa, liberado: !!empresa || liberados.empresa, preco: PRECO_DOS_EXTRAS.EMPRESA, adicional: "perfil_empresa" },
  ];
  return { lugares, mantidos: perfis.filter((p) => !usados.has(p.id)) };
}

/** Pode criar mais um perfil deste tipo? Só se o lugar dele está vazio e liberado. */
export function podeCriar(tipo: string, perfis: PerfilDoLugar[], liberados: { casal: boolean; empresa: boolean }): boolean {
  if (tipo !== "PESSOAL" && tipo !== "CASAL" && tipo !== "EMPRESA") return false;
  const lugar = lugaresDosPerfis(perfis, liberados).lugares.find((l) => l.tipo === tipo)!;
  return lugar.liberado && lugar.perfil === null;
}
