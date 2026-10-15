import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

/**
 * O caderno de achados da jornada: cada inconsistência vira uma linha com a ação, a tela de origem,
 * a tela errada, o esperado, o visto e o print. O teste não para no primeiro achado (a ideia é
 * ver a semana inteira); no fim de cada jornada ele falha se houver achado novo.
 *
 * Tipos:
 *  - "numero": o mesmo número diferente entre telas, ou diferente do banco.
 *  - "texto": "R$ NaN", "undefined", "1 lançamentos", "-R$ 0".
 *  - "tela": rolagem lateral ou texto cortado a 375 px.
 *  - "aviso": aviso que devia sumir e não sumiu, ou que sumiu sem motivo (vai para o módulo de
 *    avisos, src/lib/avisos/, e fica como esperado-falhar).
 *  - "sumiu": algo que estava e não devia sumir.
 *  - "decisao": duas telas usam regras diferentes de propósito (ex.: dois "livres"); vai para a
 *    Dani decidir e não derruba o teste.
 */
export type TipoDeAchado = "numero" | "texto" | "tela" | "aviso" | "sumiu" | "decisao";

export type Achado = {
  perfil: string;
  dia: string;
  acao: string;
  telaDeOrigem: string;
  telaErrada: string;
  esperado: string;
  visto: string;
  tipo: TipoDeAchado;
  print?: string;
  /** Chave estável para comparar rodadas e marcar os conhecidos. */
  chave: string;
};

export const PASTA_DE_SAIDA = process.env.JORNADA_SAIDA ?? path.join(__dirname, "../../.jornada-resultados");
export const PASTA_DE_PRINTS = path.join(PASTA_DE_SAIDA, "prints");

export class Caderno {
  achados: Achado[] = [];
  dia = "";
  acao = "";
  constructor(readonly perfil: string) {
    fs.mkdirSync(PASTA_DE_PRINTS, { recursive: true });
  }

  async anotar(p: Page | null, a: Omit<Achado, "perfil" | "dia" | "acao" | "print" | "chave"> & { chave?: string }) {
    const chave = a.chave ?? `${this.perfil}|${a.tipo}|${a.telaErrada}|${a.esperado}`.slice(0, 200);
    if (this.achados.some((x) => x.chave === chave && x.acao === this.acao)) return;
    let print: string | undefined;
    if (p) {
      const nome = `${this.perfil}-${String(this.achados.length + 1).padStart(2, "0")}-${a.tipo}.png`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
      try {
        await p.screenshot({ path: path.join(PASTA_DE_PRINTS, nome), fullPage: true, timeout: 10_000 });
        print = nome;
      } catch {
        /* sem print: segue */
      }
    }
    this.achados.push({ ...a, perfil: this.perfil, dia: this.dia, acao: this.acao, print, chave });
  }

  salvar() {
    fs.mkdirSync(PASTA_DE_SAIDA, { recursive: true });
    fs.writeFileSync(path.join(PASTA_DE_SAIDA, `achados-${this.perfil}.json`), JSON.stringify(this.achados, null, 2));
  }

  dos(tipos: TipoDeAchado[]) {
    return this.achados.filter((a) => tipos.includes(a.tipo));
  }
}

export function lerAchados(perfil: string): Achado[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(PASTA_DE_SAIDA, `achados-${perfil}.json`), "utf8"));
  } catch {
    return [];
  }
}

export function resumoDosAchados(lista: Achado[]): string {
  return lista.map((a) => `- [${a.tipo}] ${a.dia} · ${a.acao} · ${a.telaErrada}: esperado ${a.esperado}; visto ${a.visto}`).join("\n");
}
