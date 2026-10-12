"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LifeBuoy, PiggyBank, Plane, Receipt, ShoppingCart, Sparkles, Tag, IceCreamCone, type LucideIcon } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { CenaDaLu } from "@/components/money-reset/Lu";
import { SEMANAS } from "@/lib/money-reset/missoes";
import { vibrar } from "@/lib/celebrar";
import { salvarRespostaAction } from "../../actions";

/** Os valores da Lu (personagem da história, não da pessoa), inteiros, na moeda do app. */
function useBrl() {
  const money = useMoney();
  return (v: number) => money(v, { round: true });
}

function Botao({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm disabled:opacity-45">
      {children}
    </button>
  );
}

function Quadro({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <small className="block text-[12px] text-ink-muted">{rotulo}</small>
      <b key={valor} className={`mr-pula block text-[20px] tabular-nums ${destaque ? "text-accent-strong" : "text-ink"}`}>
        {valor}
      </b>
    </div>
  );
}

// ===== Semana 1 · O mês que sumiu: cada toque abre um gasto pequeno e o Saiu passa do Entrou =====
const GASTOS_DA_LU: { nome: string; marca: string | null; valor: number; fala: string }[] = [
  { nome: "iFood de sexta", marca: "iFood", valor: 62, fala: "Isso foi bobeira." },
  { nome: "Uber na chuva", marca: "Uber", valor: 38, fala: "Tava chovendo, né?" },
  { nome: "Promoção do app", marca: "Shopee", valor: 89, fala: "Tava barato!" },
  { nome: "Mais um streaming", marca: "Netflix", valor: 30, fala: "Esse eu nem lembrava." },
  { nome: "Lanche do trabalho", marca: null, valor: 47, fala: "Todo mundo ia." },
  { nome: "Presente do amigo secreto", marca: null, valor: 60, fala: "Não dava pra não ir." },
];

function Semana1({ fim }: { fim: React.ReactNode }) {
  const brl = useBrl();
  const [i, setI] = useState(0);
  const saiu = 3070 + GASTOS_DA_LU.slice(0, i).reduce((s, g) => s + g.valor, 0);
  const acabou = i >= GASTOS_DA_LU.length;
  return (
    <>
      <CenaDaLu fala={i === 0 ? "Recebi dia 5. Dia 20 já era. Não comprei nada grande!" : acabou ? "Saiu mais do que entrou. E nenhum gasto era grande." : GASTOS_DA_LU[i - 1].fala} />
      <div className="grid grid-cols-2 gap-2">
        <Quadro rotulo="Entrou" valor={brl(3200)} />
        <Quadro rotulo="Saiu" valor={brl(saiu)} destaque={saiu > 3200} />
      </div>
      {i > 0 && (
        <ul className="flex flex-col gap-1.5">
          {GASTOS_DA_LU.slice(0, i).map((g) => (
            <li key={g.nome} className="mr-entra glass flex items-center gap-2.5 rounded-xl px-2.5 py-2">
              <LogoDoLancamento descricao={g.marca} icon={Tag} size={36} />
              <span className="min-w-0 flex-1 break-words leading-snug text-[14px] text-ink">{g.nome}</span>
              <b className="text-[14px] tabular-nums text-ink">{brl(g.valor)}</b>
            </li>
          ))}
        </ul>
      )}
      {acabou ? (
        fim
      ) : (
        <Botao
          onClick={() => {
            vibrar("leve");
            setI(i + 1);
          }}
        >
          {i === 0 ? "Abrir o extrato da Lu" : "Próximo gasto"}
        </Botao>
      )}
    </>
  );
}

// ===== Semana 2 · Um destino pra cada real: cada toque enche um pote até o Sem destino zerar =====
const POTES: { nome: string; valor: number; icone: LucideIcon; fala: string }[] = [
  { nome: "Guardar primeiro", valor: 320, icone: PiggyBank, fala: "Primeiro eu me pago: 10% pra mim, antes de qualquer conta." },
  { nome: "Contas fixas", valor: 1900, icone: Receipt, fala: "Depois o que já tem dono: aluguel, luz, internet." },
  { nome: "Mercado e casa", valor: 600, icone: ShoppingCart, fala: "Mercado e casa, com lista." },
  { nome: "Livre da semana", valor: 380, icone: Sparkles, fala: "O que sobra é livre. Sem culpa." },
];

function Semana2({ fim }: { fim: React.ReactNode }) {
  const brl = useBrl();
  const [i, setI] = useState(0);
  const sem = 3200 - POTES.slice(0, i).reduce((s, p) => s + p.valor, 0);
  const acabou = i >= POTES.length;
  return (
    <>
      <CenaDaLu fala={i === 0 ? `Caiu o salário. ${brl(3200)}. Se eu não decidir agora, o mês decide por mim.` : POTES[i - 1].fala} />
      <div className="grid grid-cols-2 gap-2">
        {POTES.map((p, j) => {
          const cheio = j < i;
          const Icone = p.icone;
          return (
            <div key={p.nome} className={`flex flex-col gap-1.5 rounded-2xl border-[1.5px] bg-surface px-3 py-2.5 transition-colors ${cheio ? "mr-pula border-accent" : "border-dashed border-border-strong"}`}>
              <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <Icone size={14} aria-hidden className={cheio ? "text-accent-strong" : ""} />
                {p.nome}
              </span>
              <b className="text-[18px] tabular-nums text-ink">{brl(cheio ? p.valor : 0)}</b>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: cheio ? "100%" : "0%" }} />
              </span>
            </div>
          );
        })}
      </div>
      <div className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-semibold transition-colors ${sem === 0 ? "bg-success-soft text-success" : "bg-accent-soft text-accent-strong"}`}>
        <span>Sem destino</span>
        <b key={sem} className="mr-pula text-[19px] tabular-nums">
          {brl(sem)}
        </b>
      </div>
      {acabou ? (
        fim
      ) : (
        <Botao
          onClick={() => {
            vibrar("leve");
            setI(i + 1);
          }}
        >
          Dar destino
        </Botao>
      )}
    </>
  );
}

// ===== Semana 3 · O mês que fechou: cada toque fecha uma semana, e no fim ela decide a sobra =====
const LIVRE = 380;
const SEMANAS_DA_LU = [
  { gastou: 352, fala: "Semana 1: deu, e ainda sobrou um pouco." },
  { gastou: 371, fala: "Semana 2 apertou, mas coube." },
  { gastou: 318, fala: "Semana 3 sobrou mais. A marmita ajudou." },
  { gastou: 359, fala: "Semana 4 fechada. E agora, a sobra?" },
];
const DESTINOS_DA_SOBRA: { chave: string; nome: string; icone: LucideIcon; fala: string }[] = [
  { chave: "reserva", nome: "Reserva", icone: LifeBuoy, fala: "Foi pra reserva. Meu colchão cresceu." },
  { chave: "sonho", nome: "Sonho", icone: Plane, fala: "Foi pro sonho. A viagem chegou mais perto." },
  { chave: "mimo", nome: "Um mimo", icone: IceCreamCone, fala: "Um sorvete, sem culpa. O resto foi pra reserva." },
];

function Semana3({ fim }: { fim: React.ReactNode }) {
  const brl = useBrl();
  const [i, setI] = useState(0);
  const [sobraFoi, setSobraFoi] = useState<string | null>(null);
  const fechadas = SEMANAS_DA_LU.slice(0, i);
  const sobra = fechadas.reduce((s, w) => s + (LIVRE - w.gastou), 0);
  const acabou = i >= SEMANAS_DA_LU.length;
  const destino = DESTINOS_DA_SOBRA.find((d) => d.chave === sobraFoi);
  return (
    <>
      <CenaDaLu fala={destino ? destino.fala : i === 0 ? "Dia 30. Olhei o livre da semana toda segunda. Bora ver como fechou?" : SEMANAS_DA_LU[i - 1].fala} />
      <div className="glass flex flex-col gap-2.5 rounded-2xl p-3">
        <small className="text-[12px] text-ink-muted">Livre da semana da Lu: {brl(LIVRE)}</small>
        {SEMANAS_DA_LU.map((w, j) => (
          <div key={j} className="flex items-center gap-2.5">
            <span className="w-16 shrink-0 text-[13px] font-semibold text-ink">Semana {j + 1}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="block h-full rounded-full bg-success transition-[width] duration-700" style={{ width: j < i ? `${(w.gastou / LIVRE) * 100}%` : "0%" }} />
            </span>
            <b className="w-16 shrink-0 text-right text-[13px] tabular-nums text-ink">{j < i ? brl(w.gastou) : ""}</b>
          </div>
        ))}
      </div>
      <Quadro rotulo="Sobrou no mês" valor={brl(sobra)} destaque={acabou} />
      {!acabou ? (
        <Botao
          onClick={() => {
            vibrar("leve");
            setI(i + 1);
          }}
        >
          Fechar a semana {i + 1}
        </Botao>
      ) : !destino ? (
        <div className="grid grid-cols-3 gap-2">
          {DESTINOS_DA_SOBRA.map((d) => {
            const Icone = d.icone;
            return (
              <button key={d.chave} type="button" onClick={() => setSobraFoi(d.chave)} className="glass flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-[13px] font-semibold text-ink">
                <Icone size={20} className="text-accent-strong" aria-hidden />
                {d.nome}
              </button>
            );
          })}
        </div>
      ) : (
        fim
      )}
    </>
  );
}

export function Historinha({ semana, destino }: { semana: 1 | 2 | 3; destino: string }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const router = useRouter();
  const [indo, startTransition] = useTransition();
  const s = SEMANAS[semana - 1];
  const seguir = () =>
    startTransition(async () => {
      await salvarRespostaAction(`historia${semana}`, "vista");
      router.push(destino);
    });
  const fim = (
    <Botao onClick={seguir} disabled={indo}>
      {t.mrMinhaVez}
    </Botao>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/money-reset" aria-label={t.mrVerMapa} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.mrHistoriaDe(semana, s.nome)}</span>
      </div>
      <h1 className="text-h2 font-bold leading-tight tracking-tight text-ink">{s.historia}</h1>
      {semana === 1 ? <Semana1 fim={fim} /> : semana === 2 ? <Semana2 fim={fim} /> : <Semana3 fim={fim} />}
      <button type="button" onClick={seguir} disabled={indo} className="min-h-11 text-sm font-semibold text-ink-muted">
        {t.mrPularHistoria}
      </button>
      <p className="text-center text-[12px] text-ink-faint">A Lu é uma personagem. Os valores são da história dela.</p>
    </div>
  );
}
