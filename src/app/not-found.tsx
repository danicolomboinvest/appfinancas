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
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
      <p className="text-label text-ink-faint">{t.uiNaoEncontradoRotulo}</p>
      <h1 className="text-h1 font-semibold tracking-tight text-ink">{t.uiNaoEncontradoTitulo}</h1>
      <p className="max-w-sm text-body text-ink-muted">{t.uiNaoEncontradoTexto}</p>
      {/* Letra na cor feita pra ficar em cima do destaque (on-accent), não a tinta: tinta
          sobre o destaque só funciona por acaso, e em tema de destaque escuro vira preto sobre
          preto. O hover clareia em vez de trocar pro strong, que é cor de TEXTO e pode ser
          escuro demais pra letra escura por cima. */}
      <Link
        href="/mensal"
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent shadow-premium-sm transition-all duration-150 ease-out hover:opacity-90"
      >
        {t.uiNaoEncontradoVoltar}
      </Link>
    </div>
  );
}
