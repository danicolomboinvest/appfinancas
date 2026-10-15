import Link from "next/link";
import { Check, User, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth/rbac";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Explica } from "@/components/ui/Explica";
import { MOTIVOS } from "@/lib/cancelar/regras";
import { ONDE_PAROU, montarLinhaDoTempo, rotuloDeOndeParou, type ItemDaLinha, type OndeParou } from "@/lib/jornada/jornada";
import { lerJornada, lerPessoaDaJornada, type Saida } from "@/lib/repositories/jornada.repo";

export const metadata = { title: "Jornada · SPI Finance" };

const DIAS = 30;

const TOM: Record<"ambar" | "terracota" | "ardosia", { selo: string; barra: string }> = {
  ambar: { selo: "bg-[var(--color-atencao-fundo)] text-[var(--color-atencao)]", barra: "bg-[var(--color-atencao)]" },
  terracota: { selo: "bg-danger-soft text-danger", barra: "bg-danger" },
  ardosia: { selo: "bg-info-soft text-info", barra: "bg-info" },
};

function tomDe(chave: OndeParou) {
  return TOM[ONDE_PAROU.find((o) => o.chave === chave)?.tom ?? "ardosia"];
}

const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function quando(item: ItemDaLinha) {
  return item.soDia ? dia.format(item.quando) : `${dia.format(item.quando)}, ${hora.format(item.quando).replace(":", "h")}`;
}

function primeiroValor(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * A Jornada (16/10/2026, versão A escolhida pela Dani no mockup): quem pediu reembolso nos
 * últimos 30 dias, onde cada uma parou e, ao tocar no nome, a história dela do começo ao fim.
 * A aba "Cancelaram" mostra quem saiu da assinatura (fica até o vencimento).
 */
export default async function AdminJornadaPage(props: PageProps<"/admin/jornada">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const tipo = primeiroValor(sp.ver) === "cancelaram" ? "cancelou" : "reembolso";
  const aberta = primeiroValor(sp.p);

  const desde = new Date(nowInBrazil().getTime() - DIAS * 86_400_000);
  const { saidas, compras } = await lerJornada(desde, tipo);
  const escolhida = saidas.find((s) => s.chave === aberta) ?? null;
  const pessoa = escolhida ? await lerPessoaDaJornada(escolhida.email, escolhida.saiuEm, tipo) : null;

  const contagem = new Map<OndeParou, number>();
  for (const s of saidas) contagem.set(s.ondeParou, (contagem.get(s.ondeParou) ?? 0) + 1);
  const maior = Math.max(1, ...contagem.values());
  const porcentagem = compras > 0 ? Math.round((saidas.length / compras) * 1000) / 10 : null;
  const base = tipo === "cancelou" ? "/admin/jornada?ver=cancelaram" : "/admin/jornada";
  const linkDa = (s: Saida) => `/admin/jornada?${tipo === "cancelou" ? "ver=cancelaram&" : ""}p=${encodeURIComponent(s.chave)}#pessoa`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Jornada" />

      <div className="flex gap-2">
        {[
          { href: "/admin/jornada", rotulo: "Reembolsos", ativo: tipo === "reembolso" },
          { href: "/admin/jornada?ver=cancelaram", rotulo: "Cancelaram", ativo: tipo === "cancelou" },
        ].map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`rounded-full border px-4 py-1.5 text-sm ${p.ativo ? "border-transparent bg-tab-active-soft font-semibold text-accent-strong" : "border-border bg-surface text-ink-muted"}`}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-muted">{tipo === "cancelou" ? `Cancelaram em ${DIAS} dias` : `Reembolsos em ${DIAS} dias`}</p>
          <Explica>
            {tipo === "cancelou"
              ? "Quem saiu da assinatura nos últimos 30 dias. O acesso continua até o vencimento."
              : "Quem pediu reembolso nos últimos 30 dias, pela Hubla ou pela Apple. Antes de 16/10/2026 a Hubla não guardava a data do reembolso: nesses casos a data é a do dia em que o acesso foi desligado. A porcentagem é sobre as liberações novas do mesmo período."}
          </Explica>
        </div>
        <p className="text-[40px] font-light leading-tight text-ink">
          {saidas.length}
          {porcentagem !== null && <span className="ml-2 text-base font-medium text-ink-muted">{`de ${compras} compras, ${porcentagem.toLocaleString("pt-BR")}%`}</span>}
        </p>
      </Card>

      {saidas.length > 0 && (
        <Card className="flex flex-col gap-2.5 p-4">
          <p className="text-sm font-medium text-ink-muted">Onde pararam</p>
          {ONDE_PAROU.filter((o) => contagem.has(o.chave)).map((o) => (
            <div key={o.chave} className="grid grid-cols-[minmax(0,8.5rem)_1fr_1.75rem] items-center gap-2.5 text-sm">
              <span className="text-ink">{o.rotulo}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <span className={`block h-full rounded-full ${TOM[o.tom].barra}`} style={{ width: `${((contagem.get(o.chave) ?? 0) / maior) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums text-ink">{contagem.get(o.chave)}</span>
            </div>
          ))}
        </Card>
      )}

      {saidas.length === 0 && (
        <Card className="p-5">
          <p className="text-sm text-ink">{tipo === "cancelou" ? "Ninguém cancelou nos últimos 30 dias." : "Ninguém pediu reembolso nos últimos 30 dias."}</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {saidas.map((s) => {
          const aberto = escolhida?.chave === s.chave;
          return (
            <div key={s.chave} className="flex flex-col gap-2" id={aberto ? "pessoa" : undefined}>
              <Link href={aberto ? base : linkDa(s)} scroll={false}>
                <Card className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 ${aberto ? "border-accent" : ""}`}>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-ink-muted">
                    <User className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-[15px] font-semibold text-ink">{s.nome ?? s.email}</span>
                    <span className="block text-[13px] text-ink-muted">
                      {s.ondeParou === "sem_conta"
                        ? `Saiu em ${dia.format(s.saiuEm)}`
                        : `Usou ${s.diasDeUso} ${s.diasDeUso === 1 ? "dia" : "dias"}, ${s.via === "apple" || s.instalado ? "iPhone" : "navegador"}`}
                    </span>
                  </span>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tomDe(s.ondeParou).selo}`}>{rotuloDeOndeParou(s.ondeParou)}</span>
                </Card>
              </Link>
              {aberto && pessoa && <LinhaDoTempo itens={montarLinhaDoTempo(pessoa.dados)} motivo={pessoa.motivo} email={pessoa.email} dataExata={s.dataExata} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinhaDoTempo({
  itens,
  motivo,
  email,
  dataExata,
}: {
  itens: ItemDaLinha[];
  motivo: { motivo: string; texto: string | null } | null;
  email: string;
  dataExata: boolean;
}) {
  const rotuloDoMotivo = motivo ? (motivo.motivo === "reembolso" ? "Pediu nos 7 dias" : (MOTIVOS.find((m) => m.chave === motivo.motivo)?.rotulo ?? "Sem motivo")) : null;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="break-all text-xs text-ink-muted">{email}</p>
      <ol className="flex flex-col">
        {itens.map((item, i) => (
          <li key={i} className="relative pb-4 pl-8 last:pb-0">
            {i < itens.length - 1 && <span className="absolute bottom-0 left-[9px] top-[22px] w-0.5 bg-border-strong" aria-hidden />}
            <span
              className={`absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-full border-2 ${
                item.marca === "ok" ? "border-success text-success" : item.marca === "parou" ? "border-danger bg-danger text-white" : "border-border-strong bg-surface text-ink-muted"
              }`}
              aria-hidden
            >
              {item.marca === "ok" && <Check className="h-3 w-3" strokeWidth={2.6} />}
              {item.marca === "parou" && <X className="h-3 w-3" strokeWidth={2.6} />}
            </span>
            <p className="text-xs tabular-nums text-ink-muted">
              {quando(item)}
              {!dataExata && item.texto === "Pediu reembolso" ? ", data aproximada" : ""}
            </p>
            <p className="text-sm font-medium text-ink">{item.texto}</p>
            {item.chips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.chips.map((c, j) => (
                  <span key={j} className={`rounded-lg px-2 py-0.5 text-xs ${c.erro ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-muted"}`}>
                    {c.texto}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {rotuloDoMotivo && (
        <div className="rounded-2xl bg-surface-2 px-3.5 py-3 text-sm text-ink">
          {motivo?.texto && <p className="break-words">&ldquo;{motivo.texto}&rdquo;</p>}
          <p className="text-[13px] text-ink-muted">{`Motivo marcado: ${rotuloDoMotivo}`}</p>
        </div>
      )}
    </Card>
  );
}
