import Link from "next/link";

export const metadata = { title: "Termos de Uso · SPI Finance" };

/** Termos de Uso — conteúdo base para o lançamento; revisar com apoio jurídico antes de escalar. */
export default function TermosPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Termos de Uso</h1>
        <p className="mt-1 text-sm text-ink-muted">Última atualização: 13 de julho de 2026</p>
      </div>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-ink-muted">
        <p>
          Bem-vindo(a) ao <strong className="text-ink">SPI Finance</strong>. Ao criar uma conta ou usar o
          aplicativo, você concorda com estes termos. Se não concordar, basta não utilizar o serviço.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">1. O que é o serviço</h2>
        <p>
          O SPI Finance é uma ferramenta de organização financeira pessoal: registro de receitas e
          despesas, orçamento, metas, acompanhamento de carteira de investimentos e simuladores educativos.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">2. Não é recomendação de investimento</h2>
        <p>
          Todo conteúdo do aplicativo — incluindo simuladores, comparativos, projeções, rebalanceamento e análises —
          tem caráter <strong className="text-ink">educativo e informativo</strong>. Nada aqui constitui recomendação,
          oferta ou aconselhamento de investimento, jurídico ou tributário. Decisões financeiras são de sua exclusiva
          responsabilidade; considere consultar um profissional certificado.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">3. Sua conta</h2>
        <p>
          Você é responsável por manter sua senha em sigilo e pelas atividades realizadas na sua conta. As informações
          cadastradas devem ser verdadeiras. Podemos suspender contas que violem estes termos ou usem o serviço de
          forma abusiva.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">4. Seus dados</h2>
        <p>
          O tratamento dos seus dados pessoais está descrito na{" "}
          <Link href="/privacidade" className="text-accent-strong hover:underline">
            Política de Privacidade
          </Link>
          . Em resumo: seus dados são seus, usamos apenas para operar o serviço e você pode exportá-los ou excluir a
          conta a qualquer momento.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">5. Disponibilidade e limitação de responsabilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível e correto, mas ele é fornecido &quot;como está&quot;, sem
          garantias de disponibilidade ininterrupta ou exatidão de cotações e cálculos. Na máxima extensão permitida
          pela lei, não nos responsabilizamos por perdas decorrentes de decisões tomadas com base no aplicativo.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">6. Mudanças nestes termos</h2>
        <p>
          Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas no aplicativo; o uso continuado
          após a atualização significa concordância.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">7. Contato</h2>
        <p>
          Dúvidas? Escreva para{" "}
          <a href="mailto:suporte.danielacolombo@gmail.com" className="text-accent-strong hover:underline">
            suporte.danielacolombo@gmail.com
          </a>
          .
        </p>
      </section>

      <Link href="/register" className="text-sm font-medium text-accent-strong hover:underline">
        ← Voltar ao cadastro
      </Link>
    </main>
  );
}
