import Link from "next/link";
import { auth } from "@/lib/auth/auth.config";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { vozDoTema } from "@/lib/profiles/voice";

/**
 * O tema do perfil ativo, se houver alguém logado. Esta tela mora na raiz, fora do shell que
 * já sabe o tema — e um 404 não pode virar 500 porque o banco não respondeu: qualquer
 * tropeço aqui cai no Padrão.
 */
async function temaDeQuemEstaLogado(): Promise<string> {
  try {
    const session = await auth();
    if (!session?.user) return "padrao";
    return (await getOrCreateActiveProfile(session.user.id)).theme;
  } catch {
    return "padrao";
  }
}

export default async function NotFound() {
  const t = vozDoTema(await temaDeQuemEstaLogado()).titulos;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
      <p className="text-label text-ink-faint">{t.uiNaoEncontradoRotulo}</p>
      <h1 className="text-h1 font-semibold tracking-tight text-ink">{t.uiNaoEncontradoTitulo}</h1>
      <p className="max-w-sm text-body text-ink-muted">{t.uiNaoEncontradoTexto}</p>
      {/* Botão neutro (tinta sobre fundo), como o "Próximo" das telas novas: fora do app não há
          tema carregado, e o destaque de antes saía no dourado antigo. */}
      <Link
        href="/mensal"
        className="mt-2 inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas shadow-premium-sm transition-all duration-150 ease-out hover:opacity-90"
      >
        {t.uiNaoEncontradoVoltar}
      </Link>
    </div>
  );
}
