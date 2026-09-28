import Link from "next/link";

export const metadata = { title: "Suporte · SPI Finance" };

export default function SuportePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Suporte</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Precisa de ajuda com o SPI Finance? Fale com a gente.
        </p>
      </div>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-ink-muted">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-ink">
            <strong>E-mail de suporte:</strong>{" "}
            <a href="mailto:suporte.danielacolombo@gmail.com" className="text-accent-strong hover:underline">
              suporte.danielacolombo@gmail.com
            </a>
          </p>
          <p className="mt-1">Respondemos em até 2 dias úteis.</p>
        </div>

        <h2 className="mt-2 text-base font-semibold text-ink">Perguntas frequentes</h2>

        <div>
          <h3 className="font-medium text-ink">Como faço para ter acesso ao SPI Finance?</h3>
          <p>
            O acesso é liberado automaticamente para quem compra o curso Seu Primeiro Investimento. Use o mesmo
            e-mail da compra para se cadastrar em{" "}
            <Link href="/register" className="text-accent-strong hover:underline">
              /register
            </Link>
            .
          </p>
        </div>

        <div>
          <h3 className="font-medium text-ink">Esqueci minha senha, e agora?</h3>
          <p>
            Use{" "}
            <Link href="/esqueci-senha" className="text-accent-strong hover:underline">
              Esqueci minha senha
            </Link>{" "}
            na tela de login para redefinir.
          </p>
        </div>

        <div>
          <h3 className="font-medium text-ink">Comprei o curso mas ainda não recebi acesso</h3>
          <p>
            Pode levar alguns minutos para o pagamento ser confirmado. Se depois disso ainda não conseguir se
            cadastrar, escreva para o e-mail de suporte acima com o e-mail usado na compra.
          </p>
        </div>

        <div>
          <h3 className="font-medium text-ink">Como excluo minha conta e meus dados?</h3>
          <p>
            Dentro do app, vá em Configurações → Dados → Excluir conta. A exclusão é imediata e definitiva. Mais
            detalhes na{" "}
            <Link href="/privacidade" className="text-accent-strong hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        <div>
          <h3 className="font-medium text-ink">Encontrei um erro ou tenho uma sugestão</h3>
          <p>Conta pra gente pelo e-mail de suporte acima — leitura de extratos, cotações e cálculos são revisados manualmente quando reportados.</p>
        </div>
      </section>

      <Link href="/login" className="text-sm font-medium text-accent-strong hover:underline">
        ← Voltar ao login
      </Link>
    </main>
  );
}
