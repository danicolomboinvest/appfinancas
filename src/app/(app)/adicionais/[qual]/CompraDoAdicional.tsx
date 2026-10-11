"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { registrarAdicionalAppleAction } from "@/lib/adicionais/actions";
import type { Adicional } from "@/lib/adicionais/config";

export type ComoPagar =
  | { via: "apple"; produto: string; token: string }
  | { via: "hubla"; link: string | null }
  /** App Android: o Google não deixa ter link nem botão de compra fora. */
  | { via: "site" };

type Nativo = { nativePromise?: (plugin: string, metodo: string, opcoes?: object) => Promise<Record<string, unknown>> };

function nativo(metodo: string, opcoes?: object): Promise<Record<string, unknown>> {
  const cap = (window as unknown as { Capacitor?: Nativo }).Capacitor;
  if (!cap?.nativePromise) return Promise.reject(new Error("sem-app"));
  return cap.nativePromise("SpiCompras", metodo, opcoes);
}

const ICONE: Record<Adicional, LucideIcon> = { perfil_empresa: Briefcase, conta_parceiro: Users };

/**
 * A tela do adicional: o nome, uma linha do que ela ganha, o preço e um botão. Sem textão
 * (feedback da Dani: "não é uma aula").
 */
export function CompraDoAdicional({
  adicional,
  nome,
  frase,
  preco: precoDaHubla,
  comoPagar,
}: {
  adicional: Adicional;
  nome: string;
  frase: string;
  /** O preço anual já escrito (em real, o da Hubla). */
  preco: string;
  comoPagar: ComoPagar;
}) {
  const router = useRouter();
  const Icone = ICONE[adicional];
  const [precoDaLoja, setPrecoDaLoja] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [conferindo, startConferir] = useTransition();
  const [conferiu, setConferiu] = useState(false);

  // No iPhone, o preço que vale é o da Apple (ela arredonda para os preços da loja).
  useEffect(() => {
    if (comoPagar.via !== "apple") return;
    nativo("produtos", { ids: [comoPagar.produto] })
      .then((r) => {
        const p = (r.produtos as { preco?: string }[] | undefined)?.[0]?.preco;
        if (p) setPrecoDaLoja(p);
      })
      .catch(() => {});
  }, [comoPagar]);

  const preco = precoDaLoja ?? precoDaHubla;

  async function registrar(transacoes: string[]) {
    const r = await registrarAdicionalAppleAction(adicional, transacoes);
    if (r.ok) router.push("/perfis");
    else setAviso(r.mensagem);
  }

  async function comprarNaApple() {
    if (comoPagar.via !== "apple") return;
    setAviso(null);
    setOcupado(true);
    try {
      const r = await nativo("comprar", { id: comoPagar.produto, token: comoPagar.token });
      if (typeof r.transacao === "string") await registrar([r.transacao]);
      else if (r.pendente) setAviso("A compra está esperando aprovação. Assim que a Apple confirmar, abre sozinho.");
    } catch {
      setAviso("Não deu pra concluir a compra. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function restaurar() {
    setAviso(null);
    setOcupado(true);
    try {
      const r = await nativo("restaurar");
      const transacoes = (r.transacoes as string[]) ?? [];
      if (transacoes.length === 0) setAviso("Não achamos essa compra neste ID Apple.");
      else await registrar(transacoes);
    } catch {
      setAviso("Não deu pra restaurar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  // Pagou na Hubla: a confirmação chega por aviso da Hubla em alguns segundos. A página confere de
  // novo no servidor e, se já tem, vai sozinha para os perfis.
  function jaPaguei() {
    startConferir(() => {
      router.refresh();
      setConferiu(true);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6">
      <Card className="flex flex-col items-start gap-4 p-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong" aria-hidden>
          <Icone size={24} strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-ink">{nome}</h1>
          <p className="text-sm text-ink-muted">{frase}</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-ink">
          {preco} <span className="text-sm font-normal text-ink-muted">por ano</span>
        </p>

        {comoPagar.via === "apple" && (
          <Button type="button" onClick={comprarNaApple} disabled={ocupado} className="w-full">
            {ocupado ? "Abrindo a Apple…" : `Liberar por ${preco}`}
          </Button>
        )}
        {comoPagar.via === "hubla" &&
          (comoPagar.link ? (
            <a
              href={comoPagar.link}
              className="inline-flex w-full items-center justify-center rounded-full bg-accent-gradient px-5 py-3 text-sm font-semibold text-on-accent shadow-premium-sm hover:opacity-95"
            >
              Liberar por {preco} no ano
            </a>
          ) : (
            <p className="text-sm text-ink-muted">A venda abre em breve.</p>
          ))}
        {comoPagar.via === "site" && <p className="text-sm text-ink-muted">Este adicional se compra pelo site do SPI Finance.</p>}

        {aviso && <p className="text-sm text-danger">{aviso}</p>}
        {conferiu && !conferindo && comoPagar.via === "hubla" && (
          <p className="text-sm text-ink-muted">A confirmação ainda não chegou. Em alguns minutos abre sozinho.</p>
        )}
      </Card>

      <div className="flex items-center justify-center gap-2">
        <Link href="/perfis" className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink">
          Agora não
        </Link>
        {comoPagar.via === "hubla" && comoPagar.link && (
          <Button type="button" variant="ghost" size="sm" onClick={jaPaguei} disabled={conferindo}>
            Já paguei
          </Button>
        )}
        {comoPagar.via === "apple" && (
          <Button type="button" variant="ghost" size="sm" onClick={restaurar} disabled={ocupado}>
            Restaurar compra
          </Button>
        )}
      </div>
    </div>
  );
}
