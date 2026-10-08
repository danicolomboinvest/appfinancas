"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/actions";
import { registrarCompraAppleAction } from "@/lib/apple/actions";
import { trackEvent } from "@/lib/usage/track-event";

/**
 * A tela de assinatura do app iOS (out/2026), no lugar do cadeado. A Apple exige (3.1.1) que o
 * acesso possa ser comprado aqui dentro, e (3.1.2) que a tela diga o nome, a duração e o preço
 * da assinatura, que ela renova sozinha, e tenha os links de Termos e Privacidade e o
 * "Restaurar compras". Nada aqui fala de compra feita fora do app.
 *
 * Quem faz a compra é o StoreKit, pelo plugin nativo SpiCompras do app (ver
 * ~/Claude/spi-finance-ios/ios/App/App/SpiCompras.swift); o preço exibido é o que a Apple manda.
 */

type Produto = { id: string; titulo: string; preco: string; periodo: "mes" | "ano" };
type Nativo = { nativePromise?: (plugin: string, metodo: string, opcoes?: object) => Promise<Record<string, unknown>> };

function nativo(metodo: string, opcoes?: object): Promise<Record<string, unknown>> {
  const cap = (window as unknown as { Capacitor?: Nativo }).Capacitor;
  if (!cap?.nativePromise) return Promise.reject(new Error("sem-app"));
  return cap.nativePromise("SpiCompras", metodo, opcoes);
}

/**
 * O app de verdade antes do preço (07/10/2026). Das 77 pessoas que chegaram a esta tela sem ter
 * comprado antes, 64 pararam aqui: a tela tinha só três frases e os planos. Três telas reais,
 * com a frase da loja embaixo, mostram o que ela leva.
 */
const TELAS = [
  { src: "/icons/telas/foco.webp", legenda: "Quanto você pode gastar hoje" },
  { src: "/icons/telas/decidir.webp", legenda: "Pergunte antes de gastar" },
  { src: "/icons/telas/orcamento.webp", legenda: "Saiba como o mês vai fechar" },
];

export function AssinarPelaApple({ token, produtosIds }: { token: string; produtosIds: string[] }) {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"comprando" | "restaurando" | null>(null);
  const [saindo, startSair] = useTransition();

  // Esta tela vem antes do rastreio de telas do app (ver layout): sem isso ninguém sabia quantas
  // pessoas chegavam aqui.
  useEffect(() => {
    trackEvent("assinar_apple_viu", "/assinar-apple");
  }, []);

  useEffect(() => {
    nativo("produtos", { ids: produtosIds })
      .then((r) => {
        const lista = [...((r.produtos as Produto[]) ?? [])].sort((a, b) => Number(a.periodo !== "ano") - Number(b.periodo !== "ano"));
        setProdutos(lista);
        setEscolhido(lista[0]?.id ?? null);
      })
      .catch(() => setProdutos([]));
  }, [produtosIds]);

  async function registrar(transacoes: string[]) {
    const r = await registrarCompraAppleAction(transacoes);
    if (r.ok) router.refresh();
    else setErro(r.mensagem);
  }

  async function comprar() {
    if (!escolhido) return;
    setErro(null);
    setOcupado("comprando");
    trackEvent("assinar_apple_tocou", "/assinar-apple");
    try {
      const r = await nativo("comprar", { id: escolhido, token });
      if (typeof r.transacao === "string") await registrar([r.transacao]);
      else if (r.pendente) setErro("A compra está aguardando aprovação. Assim que a Apple confirmar, o acesso abre.");
    } catch {
      setErro("Não deu pra concluir a assinatura. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function restaurar() {
    setErro(null);
    setOcupado("restaurando");
    try {
      const r = await nativo("restaurar");
      const transacoes = (r.transacoes as string[]) ?? [];
      if (transacoes.length === 0) setErro("Não achamos uma assinatura ativa neste ID Apple.");
      else await registrar(transacoes);
    } catch {
      setErro("Não deu pra restaurar agora. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  const plano = produtos?.find((p) => p.id === escolhido);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
          <h1 className="text-xl font-semibold tracking-tight text-ink">Assine o SPI Finance</h1>
        </div>

        {/* As telas deslizam para o lado; a primeira já aparece inteira e a próxima espia. */}
        <div className="-mx-6 mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TELAS.map((t, i) => (
            <figure key={t.src} className="w-[64%] shrink-0 snap-center">
              <Image
                src={t.src}
                alt={t.legenda}
                width={480}
                height={600}
                priority={i === 0}
                className="h-auto w-full rounded-2xl border border-border shadow-premium-sm"
              />
              <figcaption className="mt-2 text-center text-sm font-semibold text-ink">{t.legenda}</figcaption>
            </figure>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-premium-sm">

          {produtos === null ? (
            <p className="py-4 text-center text-sm text-ink-muted">Carregando os planos...</p>
          ) : produtos.length === 0 ? (
            <p className="rounded-lg bg-surface-2 px-3 py-3 text-sm text-ink-muted">
              Os planos não carregaram. Confira a internet e abra o app de novo.
            </p>
          ) : (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Planos">
              {produtos.map((p) => {
                const ativo = p.id === escolhido;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setEscolhido(p.id)}
                    className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      ativo ? "border-accent bg-accent-soft" : "border-border bg-surface-2"
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-ink">{p.periodo === "ano" ? "Anual" : "Mensal"}</span>
                      <span className="text-xs text-ink-muted">{p.titulo}</span>
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums text-ink">
                      {p.preco}
                      <span className="block text-xs font-normal text-ink-muted">{p.periodo === "ano" ? "por ano" : "por mês"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {erro && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}

          <Button type="button" onClick={comprar} disabled={!plano || ocupado !== null} className="w-full">
            {ocupado === "comprando" ? "Abrindo a App Store..." : plano ? `Assinar por ${plano.preco}` : "Assinar"}
          </Button>

          <p className="text-xs leading-relaxed text-ink-faint">
            {plano
              ? `Assinatura ${plano.periodo === "ano" ? "anual" : "mensal"} de ${plano.preco}, cobrada na sua conta Apple. `
              : "Cobrada na sua conta Apple. "}
            Ela renova sozinha pelo mesmo período e preço, a não ser que você cancele até 24 horas antes do fim. Dá pra
            cancelar quando quiser em Ajustes, no seu nome, em Assinaturas.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
            <button type="button" onClick={restaurar} disabled={ocupado !== null} className="font-medium text-accent-strong">
              {ocupado === "restaurando" ? "Restaurando..." : "Restaurar compras"}
            </button>
            <Link href="/termos" className="text-ink-muted underline-offset-2 hover:underline">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="text-ink-muted underline-offset-2 hover:underline">
              Privacidade
            </Link>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <Button type="button" variant="ghost" size="sm" disabled={saindo} onClick={() => startSair(() => logoutAction())}>
            {saindo ? "Saindo..." : "Sair desta conta"}
          </Button>
        </div>
      </div>
    </main>
  );
}
