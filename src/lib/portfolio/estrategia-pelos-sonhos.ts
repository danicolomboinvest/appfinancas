import type { StrategyAssetClass } from "@prisma/client";
import type { RiskProfileKey, RiskProfileResult } from "./risk-profile";

/**
 * A estratégia a partir dos sonhos (06/10/2026). A Dani: "posso precisar do dinheiro em dois anos,
 * em dois a cinco, em mais de cinco; vou ter uma carteira diversificada. Então a pergunta 'quando
 * você vai precisar desse dinheiro?' é estranha." Ninguém tem um prazo só. Então:
 *
 * 1. cada sonho (meta, reserva, liberdade financeira) cai numa faixa de prazo;
 * 2. o perfil sai só do comportamento (queda e experiência), não do prazo;
 * 3. cada faixa tem a sua mistura: o curto prazo fica seguro e à mão, o longo segue o perfil;
 * 4. a estratégia é a média das misturas, pesada pelo que ainda falta juntar em cada faixa.
 *
 * As misturas do médio prazo são a proposta inicial, para a Dani validar com o que ensina no curso.
 */

export type Faixa = "curto" | "medio" | "longo";
export const FAIXAS: Faixa[] = ["curto", "medio", "longo"];

export type Sonho = {
  id: string;
  nome: string;
  /** Quanto ainda falta juntar. */
  falta: number;
  /** Meses até a data do sonho; null quando não tem data. */
  meses: number | null;
  tipo: "meta" | "reserva" | "liberdade";
};

type Mistura = Record<StrategyAssetClass, number>;

const ZERO: Mistura = { RENDA_FIXA_POS_FIXADA: 0, RENDA_FIXA_IPCA: 0, PREFIXADO: 0, ACOES_BRASIL: 0, FIIS: 0, EXTERIOR: 0, OUTROS: 0 };
const m = (parcial: Partial<Mistura>): Mistura => ({ ...ZERO, ...parcial });

/** Os perfis prontos de sempre: são a mistura do longo prazo. */
export const PERFIS_PRONTOS: Record<RiskProfileKey, Mistura> = {
  conservador: m({ RENDA_FIXA_POS_FIXADA: 50, RENDA_FIXA_IPCA: 30, PREFIXADO: 10, ACOES_BRASIL: 5, FIIS: 5 }),
  moderado: m({ RENDA_FIXA_POS_FIXADA: 25, RENDA_FIXA_IPCA: 20, PREFIXADO: 10, ACOES_BRASIL: 20, FIIS: 15, EXTERIOR: 10 }),
  arrojado: m({ RENDA_FIXA_POS_FIXADA: 10, RENDA_FIXA_IPCA: 5, ACOES_BRASIL: 40, FIIS: 20, EXTERIOR: 20, OUTROS: 5 }),
};

/** Até 2 anos: dinheiro seguro e à mão, em qualquer perfil. De 2 a 5: mais renda fixa, um pouco de variável. */
const MEDIO: Record<RiskProfileKey, Mistura> = {
  conservador: m({ RENDA_FIXA_POS_FIXADA: 50, RENDA_FIXA_IPCA: 35, PREFIXADO: 15 }),
  moderado: m({ RENDA_FIXA_POS_FIXADA: 35, RENDA_FIXA_IPCA: 30, PREFIXADO: 15, FIIS: 10, ACOES_BRASIL: 10 }),
  arrojado: m({ RENDA_FIXA_POS_FIXADA: 25, RENDA_FIXA_IPCA: 25, PREFIXADO: 10, FIIS: 15, ACOES_BRASIL: 15, EXTERIOR: 10 }),
};

export function misturaDaFaixa(faixa: Faixa, perfil: RiskProfileKey): Mistura {
  if (faixa === "curto") return m({ RENDA_FIXA_POS_FIXADA: 100 });
  if (faixa === "medio") return MEDIO[perfil];
  return PERFIS_PRONTOS[perfil];
}

/** A reserva é sempre curto prazo (é o dinheiro do imprevisto); sonho sem data fica no meio. */
export function faixaDoSonho(s: Pick<Sonho, "meses" | "tipo">): Faixa {
  if (s.tipo === "reserva") return "curto";
  if (s.meses === null) return "medio";
  if (s.meses <= 24) return "curto";
  if (s.meses <= 60) return "medio";
  return "longo";
}

export type EstrategiaPelosSonhos = {
  /** Percentuais inteiros por classe, somando 100. */
  valores: Mistura;
  /** O que pesou em cada faixa, para a tela explicar. Só as faixas com sonho. */
  faixas: { faixa: Faixa; total: number; sonhos: Sonho[] }[];
};

export function estrategiaPelosSonhos(perfil: RiskProfileKey, sonhos: Sonho[]): EstrategiaPelosSonhos {
  const comFalta = sonhos.filter((s) => s.falta > 0);
  const faixas = FAIXAS.map((faixa) => {
    const daFaixa = comFalta.filter((s) => faixaDoSonho(s) === faixa);
    return { faixa, total: daFaixa.reduce((a, s) => a + s.falta, 0), sonhos: daFaixa };
  }).filter((f) => f.total > 0);
  const total = faixas.reduce((a, f) => a + f.total, 0);
  // Sem nenhum sonho com valor faltando: a estratégia é a do perfil, como sempre foi.
  if (total <= 0) return { valores: { ...PERFIS_PRONTOS[perfil] }, faixas: [] };

  const bruto = { ...ZERO };
  for (const f of faixas) {
    const mistura = misturaDaFaixa(f.faixa, perfil);
    for (const k of Object.keys(bruto) as StrategyAssetClass[]) bruto[k] += (mistura[k] * f.total) / total;
  }
  return { valores: arredondarPara100(bruto), faixas };
}

/** Inteiros que somam 100, pelo maior resto (sem isso, 33,3 + 33,3 + 33,3 viraria 99). */
function arredondarPara100(v: Mistura): Mistura {
  const chaves = Object.keys(v) as StrategyAssetClass[];
  const base = Object.fromEntries(chaves.map((k) => [k, Math.floor(v[k])])) as Mistura;
  let falta = 100 - chaves.reduce((a, k) => a + base[k], 0);
  const porResto = [...chaves].sort((a, b) => v[b] - Math.floor(v[b]) - (v[a] - Math.floor(v[a])));
  for (const k of porResto) {
    if (falta <= 0) break;
    base[k] += 1;
    falta -= 1;
  }
  return base;
}

export type Comportamento = {
  /** Se a carteira caísse 15%: 0 = venderia tudo, 1 = seguraria tenso, 2 = compraria mais. */
  queda: 0 | 1 | 2;
  /** Já investiu em ações ou fundos imobiliários: 0 = nunca, 1 = um pouco, 2 = sempre. */
  experiencia: 0 | 1 | 2;
};

const ORDEM: RiskProfileKey[] = ["conservador", "moderado", "arrojado"];

/**
 * O perfil só pelo jeito da pessoa: o prazo agora mora nos sonhos. Cada resposta é um TETO (a
 * dimensão mais fraca manda, como num questionário de suitability): quem venderia tudo numa queda
 * é conservadora, mesmo com experiência; quem nunca investiu em renda variável começa no máximo
 * moderada e sobe depois.
 */
export function perfilPeloComportamento({ queda, experiencia }: Comportamento): RiskProfileResult {
  const tetoQueda: RiskProfileKey = queda === 0 ? "conservador" : queda === 1 ? "moderado" : "arrojado";
  const tetoExperiencia: RiskProfileKey = experiencia === 0 ? "moderado" : "arrojado";
  const profile = ORDEM[Math.min(ORDEM.indexOf(tetoQueda), ORDEM.indexOf(tetoExperiencia))];
  const reason =
    queda === 0
      ? "Numa queda você venderia tudo, então a carteira precisa balançar pouco."
      : experiencia === 0 && queda === 2
        ? "Você ainda não investiu em renda variável: dá para começar moderado e subir depois."
        : queda === 1
          ? "Você segura uma queda, mas com aperto. O perfil respeita isso."
          : "Calma nas quedas e experiência: dá para buscar crescimento.";
  return { profile, reason };
}
