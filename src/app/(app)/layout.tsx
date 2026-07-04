import Link from "next/link";
import { auth, signOut } from "@/lib/auth/auth.config";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/parametros", label: "Premissas" },
  { href: "/mensal", label: "Controle mensal" },
  { href: "/planejamento/acumulo", label: "Planejamento — Acúmulo" },
  { href: "/planejamento/usufruto", label: "Planejamento — Usufruto" },
  { href: "/planejamento/projecao", label: "Projeção patrimonial" },
  { href: "/planejamento/reserva-emergencia", label: "Reserva de emergência" },
  { href: "/planejamento/metas", label: "Metas" },
  { href: "/carteira", label: "Carteira" },
  { href: "/simuladores/financiar-vs-alugar", label: "Simuladores" },
  { href: "/fichas/acoes", label: "Fichas de análise" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-black/10 p-4">
        <p className="mb-6 text-sm font-semibold">Planejamento Financeiro</p>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-2 py-1.5 text-sm hover:bg-black/5">
              {item.label}
            </Link>
          ))}
          {session?.user.role === "ADMIN" && (
            <Link href="/admin" className="rounded px-2 py-1.5 text-sm hover:bg-black/5">
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t border-black/10 pt-4">
          <p className="mb-2 truncate text-xs text-black/60">{session?.user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm underline">
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
