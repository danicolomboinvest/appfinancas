import { Card } from "@/components/ui/Card";
import { responderRendaDoCasalAction } from "@/app/(app)/mensal/foco/actions";

/**
 * No perfil Casal, "renda" pode ser duas coisas bem diferentes: tudo que os dois ganham, ou só o
 * que cada um transfere pra conta conjunta. Na segunda, gastar tudo que entrou é o combinado, e a
 * regra dos 90% diria "não" pra qualquer compra. Em vez de adivinhar, pergunta uma vez.
 */
export function PerguntaRendaDoCasal() {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-base font-semibold text-ink">A renda deste perfil é qual?</p>
        <p className="mt-1 text-sm text-ink-muted">Pra eu fazer a conta certa. Dá pra trocar depois, nesta mesma tela.</p>
      </div>
      <form action={responderRendaDoCasalAction.bind(null, "casal")}>
        <button type="submit" className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:bg-surface-hover">
          <span className="block text-sm font-semibold text-ink">A do casal inteira</span>
          <span className="block text-caption text-ink-muted">Os salários dos dois entram aqui.</span>
        </button>
      </form>
      <form action={responderRendaDoCasalAction.bind(null, "conjunta")}>
        <button type="submit" className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:bg-surface-hover">
          <span className="block text-sm font-semibold text-ink">Só o que cada um põe na conta conjunta</span>
          <span className="block text-caption text-ink-muted">Cada um fica com o resto na própria conta.</span>
        </button>
      </form>
    </Card>
  );
}
