"use client";

import { ehFalhaDeRede, MSG_FALHA_NOSSA, registrarErroNoCliente } from "@/lib/erros/erro-do-cliente";
import { LapisDaCategoria } from "@/components/categorias/LapisDaCategoria";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Delete, Plus, Shapes, Wallet } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { CurrencySwitch, ExchangeRateLine } from "@/components/forms/CurrencySwitch";
import { CasalFields } from "@/components/forms/CasalFields";
import { createMonthlyEntryAction, type MonthlyEntryState } from "@/app/(app)/mensal/[year]/[month]/actions";
import { NovaCategoria } from "./NovaCategoria";
import { CUSTOM_CATEGORY_ICON_MAP, PARENT_CATEGORIES, PARENT_CATEGORY_COLOR, PARENT_CATEGORY_ICON, categoriaOculta, categoryLabel, corEscolhida, incomeTypesFor, investmentTypesFor } from "@/lib/categories";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { dataDoChip, paraDecimal, teclar } from "@/lib/entries/digitar";
import { CHAVE_RASCUNHO_LANCAR, lerRascunho, montarRascunho, type RascunhoLancar } from "@/lib/entries/rascunho-lancar";
import { aoRecarregarParaVersaoNova, ehVersaoNovaERecarrega } from "@/lib/erros/versao-nova";
import type { CurrencyCode } from "@/lib/money";

const ULTIMO_NO_CARTAO = "spi-ultimo-no-cartao";
type Tipo = "EXPENSE" | "INCOME" | "INVESTMENT_CONTRIBUTION" | "RESGATE";
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

/**
 * "Digitar" como no protótipo aprovado (tema-padrao.html e tema-girly.html, 11/10/2026): Gasto ou
 * Entrada, o valor grande, o teclado na tela, a categoria em blocos com ícone e cor, o dia
 * (Hoje, Ontem, Outra data), "No cartão de crédito", "Repetir todo mês" e Salvar. O que o app já
 * fazia e o protótipo não mostra (o que foi, a moeda, o sonho, Guardei e Resgatei, o Casal, o
 * dinheiro do mês seguinte) mora em "Mais opções", recolhido. Grava pela mesma ação de sempre.
 */
export function Digitar({
  year,
  month,
  customCategories = [],
  goals = [],
  onSuccess,
  criandoCategoria,
  onCriandoCategoria,
  inicial,
}: {
  year: number;
  month: number;
  customCategories?: { id: string; name: string; icon?: string }[];
  goals?: { id: string; name: string }[];
  onSuccess?: () => void;
  /** Quem abre o Digitar numa folha controla a tela "Nova categoria" (título e Voltar da folha). */
  criandoCategoria?: boolean;
  onCriandoCategoria?: (v: boolean) => void;
  /** Vindo da voz: o que ela disse já preenchido. */
  inicial?: { valor?: number; tipo?: string; categoria?: ParentCategory; subcategoria?: string; descricao?: string; moeda?: CurrencyCode };
}) {
  const { voz, profileId, cartaoComLimite, kind, categorias } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const moedaDoApp = useCurrency();
  // A ação de sempre, chamada direto: deu certo, avisa e fecha a folha; deu erro, mostra aqui.
  const [isPending, iniciarEnvio] = useTransition();
  const [state, setState] = useState<MonthlyEntryState>({});
  const { showToast, showError } = useToast();

  const [perfilDaTela] = useState(profileId);
  // O que estava digitado quando o app recarregou para a versão nova (13/10/2026). Só sem `inicial`
  // (a voz já traz o que ela disse, e isso vale mais que um rascunho antigo).
  const [rascunho] = useState<RascunhoLancar | null>(() => {
    if (inicial) return null;
    try {
      return lerRascunho(window.sessionStorage.getItem(CHAVE_RASCUNHO_LANCAR), Date.now());
    } catch {
      return null;
    }
  });
  const [tipo, setTipo] = useState<Tipo>(
    rascunho?.tipo ?? (inicial?.tipo === "INCOME" ? "INCOME" : inicial?.tipo === "INVESTMENT_CONTRIBUTION" ? "INVESTMENT_CONTRIBUTION" : "EXPENSE"),
  );
  const [centavos, setCentavos] = useState(rascunho?.centavos ?? Math.round((inicial?.valor ?? 0) * 100));
  const [categoria, setCategoria] = useState<string | null>(rascunho ? rascunho.categoria : (inicial?.categoria ?? null));
  const [tipoLivre, setTipoLivre] = useState<string>(
    rascunho?.tipoLivre ?? (inicial?.tipo === "INCOME" || inicial?.tipo === "INVESTMENT_CONTRIBUTION" ? (inicial?.subcategoria ?? "") : ""),
  );
  const [chip, setChip] = useState<string>(rascunho?.chip ?? "hoje");
  const [outraData, setOutraData] = useState(false);
  const [noCartao, setNoCartao] = useState(() => {
    try {
      return window.localStorage.getItem(ULTIMO_NO_CARTAO) === "1";
    } catch {
      return false;
    }
  });
  const [repetir, setRepetir] = useState(false);
  const [mais, setMais] = useState(false);
  const [descricao, setDescricao] = useState(rascunho?.descricao ?? inicial?.descricao ?? "");
  const [moeda, setMoeda] = useState<CurrencyCode>(inicial?.moeda ?? moedaDoApp);
  const [meta, setMeta] = useState("");
  const [mesSeguinte, setMesSeguinte] = useState(false);
  const [extras, setExtras] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [criandoLocal, setCriandoLocal] = useState(false);
  const criando = criandoCategoria ?? criandoLocal;
  const setCriando = (v: boolean) => (onCriandoCategoria ? onCriandoCategoria(v) : setCriandoLocal(v));

  // Se o app recarregar para a versão nova com esta folha aberta, guarda o que está digitado.
  const atual = useRef<RascunhoLancar>({ tipo, centavos, categoria, tipoLivre, descricao, chip });
  useEffect(() => {
    atual.current = { tipo, centavos, categoria, tipoLivre, descricao, chip };
  });
  useEffect(
    () =>
      aoRecarregarParaVersaoNova(() => {
        if (!atual.current.centavos) return;
        window.sessionStorage.setItem(CHAVE_RASCUNHO_LANCAR, montarRascunho(atual.current, Date.now()));
      }),
    [],
  );
  // Rascunho usado uma vez: sai do aparelho e avisa que voltou.
  useEffect(() => {
    if (!rascunho) return;
    try {
      window.sessionStorage.removeItem(CHAVE_RASCUNHO_LANCAR);
    } catch {}
    showToast("Voltei com o que estava digitado antes da atualização.");
  }, [rascunho, showToast]);

  const ehGasto = tipo === "EXPENSE";
  const hoje = nowInBrazil();
  const entrada = tipo === "INCOME";
  const tiposLivres = entrada ? incomeTypesFor(kind) : investmentTypesFor(kind);
  const pais = PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categorias, pc));
  const personalizadas = [...customCategories, ...extras];
  const estrangeira = moeda !== moedaDoApp;
  const valorTexto = money(centavos / 100);

  const salvar = () => {
    // Sem valor, o toque não pode morrer calado (o botão some de cinza no sol e parece ativo).
    if (!centavos) {
      showError("Digite o valor no teclado antes de salvar.");
      return;
    }
    try {
      salvarDeVerdade();
    } catch (err) {
      // Qualquer falha ANTES de chegar ao servidor (aparelho antigo, campo que não existe) vira
      // aviso e registro, em vez de um toque que não faz nada.
      registrarErroNoCliente("lancar", err);
      const msg = "Não consegui salvar neste aparelho. Toque em Salvar de novo; se continuar, fale com a gente.";
      setState({ error: msg });
      showError(msg);
    }
  };

  const salvarDeVerdade = () => {
    const fd = new FormData();
    fd.set("year", String(year));
    fd.set("month", String(month));
    if (perfilDaTela) fd.set("profileId", perfilDaTela);
    fd.set("amount", paraDecimal(centavos));
    fd.set("currency", moeda);
    fd.set("description", descricao);
    fd.set("category", tipo === "RESGATE" ? "INVESTMENT_CONTRIBUTION" : tipo);
    if (tipo === "RESGATE") fd.set("resgate", "on");
    const pai = ehGasto && categoria && (PARENT_CATEGORIES as readonly string[]).includes(categoria) ? categoria : "";
    const custom = ehGasto && categoria && !pai ? categoria : "";
    fd.set("parentCategory", pai);
    fd.set("customCategoryId", custom);
    fd.set("subcategory", ehGasto ? (inicial?.categoria && categoria === inicial.categoria ? (inicial.subcategoria ?? "") : "") : tipoLivre);
    fd.set("entryDate", dataDoChip(chip, hoje));
    if (meta) fd.set("goalId", meta);
    if (repetir) fd.set("repeatMonthly", "on");
    if (entrada && mesSeguinte) fd.set("paraMesSeguinte", "on");
    if (cartaoComLimite && ehGasto) {
      fd.set("noCartao", noCartao ? "sim" : "nao");
      try {
        window.localStorage.setItem(ULTIMO_NO_CARTAO, noCartao ? "1" : "0");
      } catch {}
    }
    // Campos do Casal e a cotação (quando vierem): os inputs reais dentro de "Mais opções".
    const form = document.getElementById("digitar-mais") as HTMLFormElement | null;
    if (form) for (const [k, v] of new FormData(form).entries()) fd.set(k, v);
    iniciarEnvio(async () => {
      // Nada falha em silêncio (12/10/2026, caso da Hadas no iPhone): a ação que nem chega ao
      // servidor (rede caiu, módulo que não carregou) vira aviso na tela e registro no AppError, e o
      // erro de validação também aparece em aviso, porque a mensagem do topo fica fora da vista
      // de quem está com o dedo no Salvar, lá embaixo.
      let res: Awaited<ReturnType<typeof createMonthlyEntryAction>>;
      try {
        res = await createMonthlyEntryAction({}, fd);
      } catch (err) {
        registrarErroNoCliente("lancar", err);
        // App atualizado com a folha aberta: o aviso e a recarga já vêm, o rascunho fica guardado.
        if (ehVersaoNovaERecarrega(err)) return;
        const msg = ehFalhaDeRede(err) ? "Não consegui salvar: parece que a internet caiu. Toque em Salvar de novo." : MSG_FALHA_NOSSA;
        setState({ error: msg });
        showError(msg);
        return;
      }
      setState(res);
      if (res.error) {
        showError(res.error);
        return;
      }
      showToast(res.aviso ?? t.lancamentoSalvo);
      onSuccess?.();
    });
  };


  const segmento = (valor: Tipo, rotulo: string) => (
    <button
      type="button"
      aria-pressed={tipo === valor}
      onClick={() => {
        setTipo(valor);
        setCategoria(null);
        setTipoLivre("");
      }}
      className={`min-h-11 rounded-full text-[15px] transition-colors ${tipo === valor ? "bg-surface font-medium text-ink shadow-premium-sm" : "text-ink-muted"}`}
    >
      {rotulo}
    </button>
  );
  const linhaSw = (rotulo: string, ligado: boolean, mudar: () => void, nota?: string) => (
    <button type="button" role="switch" aria-checked={ligado} onClick={mudar} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left">
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] text-ink">{rotulo}</span>
        {nota && <small className="text-caption text-ink-muted">{nota}</small>}
      </span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? "bg-ink" : "bg-border-strong"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-surface shadow-sm transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
  const bloco = (chave: string, rotulo: string, Icone: typeof Shapes, cor: string) => (
    <button key={chave} type="button" aria-pressed={categoria === chave || tipoLivre === chave} onClick={() => (ehGasto ? setCategoria(chave) : setTipoLivre(chave))} className="flex min-w-0 flex-col items-center gap-1.5 py-1 text-[13px] leading-tight text-ink-muted aria-pressed:font-medium aria-pressed:text-ink">
      <span
        className={`flex size-12 items-center justify-center rounded-full transition-shadow ${categoria === chave || tipoLivre === chave ? "shadow-[0_0_0_2px_var(--color-surface),0_0_0_3.5px_var(--color-ink)]" : ""}`}
        style={{ background: `color-mix(in srgb, ${cor} 18%, var(--color-surface))`, color: cor }}
      >
        <Icone size={21} strokeWidth={1.7} aria-hidden />
      </span>
      <span className="w-full break-words text-center">{rotulo}</span>
    </button>
  );

  if (criando)
    return (
      <NovaCategoria
        existentes={[...personalizadas.map((c) => c.name), ...pais.map((pc) => categoryLabel(categorias, pc))]}
        onVoltar={onCriandoCategoria ? undefined : () => setCriando(false)}
        onCriada={(c) => {
          setExtras((e) => (e.some((x) => x.id === c.id) ? e : [...e, c]));
          setCategoria(c.id);
          setCriando(false);
        }}
      />
    );

  return (
    <div className="flex flex-col gap-3.5">
      {state.error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Gasto ou entrada">
        {segmento("EXPENSE", "Gasto")}
        {segmento("INCOME", "Entrada")}
      </div>
      {(tipo === "INVESTMENT_CONTRIBUTION" || tipo === "RESGATE") && (
        <p className="text-center text-sm text-ink-muted">{tipo === "RESGATE" ? "Resgatei" : "Guardei"} (em Mais opções)</p>
      )}

      <p className={`py-1 text-center text-[2.5rem] font-light leading-none tracking-[-0.035em] tabular-nums ${entrada && centavos ? "text-success" : "text-ink"}`} aria-live="polite">
        {valorTexto}
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado do valor">
        {TECLAS.map((k) => (
          <button key={k} type="button" aria-label={k === "del" ? "Apagar" : k} onClick={() => setCentavos((c) => teclar(c, k))} className="flex h-[50px] items-center justify-center rounded-2xl bg-surface text-[1.375rem] text-ink shadow-premium-sm active:scale-95">
            {k === "del" ? <Delete size={20} aria-hidden /> : k}
          </button>
        ))}
      </div>

      <h3 className="pt-1 text-[15px] font-medium text-ink">{ehGasto ? "Categoria" : tipo === "RESGATE" ? "De onde saiu" : "Tipo"}</h3>
      <div className="grid grid-cols-4 gap-x-1 gap-y-2.5">
        {ehGasto
          ? [
              ...pais.map((pc) => bloco(pc, categoryLabel(categorias, pc), PARENT_CATEGORY_ICON[pc], PARENT_CATEGORY_COLOR[pc])),
              // As que ela criou: lápis no canto ou toque longo para editar e apagar (12/10/2026).
              ...personalizadas.map((c) => (
                <LapisDaCategoria key={c.id} categoria={{ id: c.id, name: c.name, icon: c.icon ?? "tag" }} outras={personalizadas.map((o) => ({ id: o.id, name: o.name, icon: o.icon ?? "tag" }))} className="min-w-0">
                  {bloco(c.id, c.name, CUSTOM_CATEGORY_ICON_MAP[c.icon ?? ""] ?? Shapes, corEscolhida(categorias, c.id) ?? "var(--color-accent)")}
                </LapisDaCategoria>
              )),
            ]
          : tiposLivres.map((tp) => bloco(tp, tp, Wallet, "var(--color-dinheiro-entrou)"))}
        {ehGasto && (
          <button type="button" onClick={() => setCriando(true)} className="flex min-w-0 flex-col items-center gap-1.5 py-1 text-[13px] text-ink-muted">
            <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-border-strong">
              <Plus size={20} aria-hidden />
            </span>
            Nova
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Quando">
        {[["hoje", "Hoje"], ["ontem", "Ontem"]].map(([k, r]) => (
          <button key={k} type="button" aria-pressed={!outraData && chip === k} onClick={() => (setChip(k), setOutraData(false))} className={`min-h-10 rounded-full px-4 text-sm ${!outraData && chip === k ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-border"}`}>
            {r}
          </button>
        ))}
        <button type="button" aria-pressed={outraData} onClick={() => (setOutraData(true), setChip(dataDoChip("ontem", hoje)))} className={`min-h-10 rounded-full px-4 text-sm ${outraData ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-border"}`}>
          {outraData && chip !== "hoje" && chip !== "ontem" ? new Date(`${chip}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "Outra data"}
        </button>
      </div>
      {outraData && (
        <input type="date" aria-label="Outra data" max={dataDoChip("hoje", hoje)} defaultValue={dataDoChip("ontem", hoje)} onChange={(e) => e.target.value && setChip(e.target.value)} className="box-border min-h-12 w-full min-w-0 max-w-full rounded-2xl border border-border bg-surface-2 px-3 text-[15px] text-ink" />
      )}

      <div className="flex flex-col divide-y divide-border">
        {cartaoComLimite && ehGasto && linhaSw("No cartão de crédito", noCartao, () => setNoCartao((v) => !v))}
        {linhaSw("Repetir todo mês", repetir, () => setRepetir((v) => !v))}
      </div>
      {repetir && <p className="-mt-1 text-sm text-ink-muted">Vai aparecer em Recorrentes</p>}

      <details open={mais} onToggle={(e) => setMais((e.target as HTMLDetailsElement).open)} className="group rounded-2xl border border-border bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[15px] text-ink [&::-webkit-details-marker]:hidden">
          Mais opções
          <ChevronDown size={18} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <form id="digitar-mais" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3">
          <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
            {t.formLancDescricao}
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t.formLancDescricaoPlaceholder} className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-2 px-3 text-[15px] text-ink outline-none focus:border-ink" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-muted">Também</span>
            <div className="flex flex-wrap gap-2">
              {([["INVESTMENT_CONTRIBUTION", "Guardei"], ["RESGATE", "Resgatei"]] as const).map(([k, r]) => (
                <button key={k} type="button" aria-pressed={tipo === k} onClick={() => (setTipo(k), setCategoria(null), setTipoLivre(""))} className={`min-h-10 rounded-full px-4 text-sm ${tipo === k ? "bg-ink text-canvas" : "bg-surface-2 text-ink"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
            Moeda
            <CurrencySwitch value={moeda} onChange={setMoeda} />
          </div>
          {estrangeira && <ExchangeRateLine key={moeda} from={moeda} to={moedaDoApp} amount={centavos / 100} />}
          {goals.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
              {t.formLancMetaVinculada}
              <select value={meta} onChange={(e) => setMeta(e.target.value)} className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-2 px-3 text-[15px] text-ink">
                <option value="">{t.formLancNenhuma}</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {entrada && (
            <label className="flex min-h-11 items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" checked={mesSeguinte} onChange={(e) => setMesSeguinte(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
              {t.formLancMesSeguinte(new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long" }))}
            </label>
          )}
          <CasalFields tipo={tipo === "RESGATE" ? "INVESTMENT_CONTRIBUTION" : tipo} />
        </form>
      </details>

      {/* O erro também aqui, colado no botão: o do topo fica fora da vista de quem tocou em Salvar. */}
      {state.error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{state.error}</p>}
      <button type="button" onClick={salvar} disabled={isPending} aria-disabled={!centavos} className="min-h-12 w-full rounded-full bg-ink text-[16px] font-medium text-canvas disabled:opacity-40 aria-disabled:opacity-40">
        {isPending ? t.formSalvando : "Salvar"}
      </button>
    </div>
  );
}
