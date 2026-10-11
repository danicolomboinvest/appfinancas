import type { ProfileThemeKey } from "./themes";

/**
 * As cores das esferas de vidro do Decidir (rodada 57, direção 2 "orbe de material"), copiadas
 * de `perguntas-orbe-proposta.html` e dos temas aprovados. Cada tema tem o vidro (g0 a g3, do
 * reflexo à borda) e o material do objeto dentro dele (m0 a m4, do claro ao escuro), mais o
 * ponto da pílula (comum e "pede atenção") e a cor da sombra de contato (r,g,b).
 *
 * Entram como variáveis do tema (`--ob-*`), uma vez no <html>, junto com a paleta.
 */
type Esfera = { g: [string, string, string, string]; m: [string, string, string, string, string]; ponto: string; atencao: string; sombra: string; pilula: string; borda: string; brilho: string; aro: string; halo: string };

const CLARO = { pilula: "rgba(255, 255, 255, 0.80)", borda: "rgba(255, 255, 255, 0.9)", brilho: "rgba(255, 255, 255, 0.80)", aro: "rgba(255, 255, 255, 0.55)", halo: "0.42" };
const ESCURO = { pilula: "rgba(24, 22, 28, 0.74)", borda: "rgba(255, 255, 255, 0.14)", brilho: "rgba(255, 255, 255, 0.26)", aro: "rgba(255, 255, 255, 0.22)", halo: "0.30" };

const ESFERAS: Record<ProfileThemeKey, { claro: Esfera; escuro: Esfera }> = {
  padrao: {
    claro: { ...CLARO, g: ["#FFFFFF", "#FCF6EA", "#F3E2C2", "#DDB97C"], m: ["#FFF7E6", "#F7D99A", "#E5B05A", "#A86E1A", "#6E3F08"], ponto: "#8A500C", atencao: "#B06A10", sombra: "138, 80, 12" },
    escuro: { ...ESCURO, g: ["#8A7246", "#4E3E23", "#2F2617", "#1E1910"], m: ["#FFF2D2", "#F8D78E", "#F2B544", "#C48A2A", "#7A5216"], ponto: "#F2B544", atencao: "#F2C26B", sombra: "0, 0, 0" },
  },
  girly: {
    claro: { ...CLARO, g: ["#FFFFFF", "#FDF1F4", "#F4D5DF", "#E2A9BC"], m: ["#FFF4F7", "#F4C0D0", "#DC8AA4", "#A8476A", "#6E2240"], ponto: "#B5687F", atencao: "#B07A2A", sombra: "122, 43, 71" },
    escuro: { ...ESCURO, g: ["#9A6276", "#62394A", "#3E2530", "#2A1A21"], m: ["#FFEAF1", "#F8C6D6", "#F0A8BE", "#C47690", "#7E3F55"], ponto: "#F0A8BE", atencao: "#E8C08A", sombra: "0, 0, 0" },
  },
  manifestacao: {
    claro: { ...CLARO, g: ["#FFFFFF", "#F6F4FE", "#E1DBF8", "#BDB3EE"], m: ["#F6F3FF", "#D2CAFB", "#A194E8", "#5E50B8", "#34297A"], ponto: "#6E5FC7", atencao: "#A87418", sombra: "70, 58, 148" },
    escuro: { ...ESCURO, g: ["#7068B0", "#3E3874", "#26244C", "#181733"], m: ["#F3F0FF", "#DAD3FF", "#B9AEFA", "#8277D8", "#4B3FA0"], ponto: "#C4BBFF", atencao: "#EDCF94", sombra: "0, 0, 0" },
  },
  // Titânio: metal escovado; o champanhe do tema fica só no ponto da pílula (era laranja até 11/10/2026).
  titanio: {
    claro: { ...CLARO, g: ["#FFFFFF", "#F2F3F4", "#C9CCD0", "#8E9298"], m: ["#FFFFFF", "#E6E8EB", "#AEB2B8", "#6B7078", "#33363B"], ponto: "#7A5A2B", atencao: "#B0761A", sombra: "40, 42, 48" },
    escuro: {
      ...ESCURO,
      pilula: "rgba(20, 21, 24, 0.78)",
      brilho: "rgba(255, 255, 255, 0.42)",
      aro: "rgba(255, 255, 255, 0.18)",
      g: ["#9DA2AA", "#4A4E56", "#24262B", "#121316"],
      m: ["#F4F5F6", "#C9CCD1", "#8E9298", "#4E5258", "#2A2D31"],
      ponto: "#D8BC88",
      atencao: "#E9C27A",
      sombra: "0, 0, 0",
    },
  },
};

/** As variáveis `--ob-*` do tema e do modo (vão no mesmo bloco da paleta). */
export function variaveisDaEsfera(tema: ProfileThemeKey, escuro: boolean): Record<string, string> {
  const e = ESFERAS[tema][escuro ? "escuro" : "claro"];
  return {
    ...Object.fromEntries(e.g.map((c, i) => [`--ob-g${i}`, c])),
    ...Object.fromEntries(e.m.map((c, i) => [`--ob-m${i}`, c])),
    "--ob-ponto": e.ponto,
    "--ob-atencao": e.atencao,
    "--ob-sombra": e.sombra,
    "--ob-pilula": e.pilula,
    "--ob-pilula-borda": e.borda,
    "--ob-brilho": e.brilho,
    "--ob-aro": e.aro,
    "--ob-halo": e.halo,
  };
}
