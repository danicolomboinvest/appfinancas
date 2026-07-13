import Link from "next/link";

export const metadata = { title: "Política de Privacidade · Planejamento Financeiro" };

/** Política de Privacidade (LGPD) — conteúdo base para o lançamento; revisar com apoio jurídico. */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-ink-muted">Última atualização: 13 de julho de 2026</p>
      </div>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-ink-muted">
        <p>
          Esta política explica, em linguagem simples, como o <strong className="text-ink">Planejamento Financeiro</strong>{" "}
          trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">1. Quais dados coletamos</h2>
        <p>
          <strong className="text-ink">Dados de cadastro:</strong> nome, e-mail e senha (guardada de forma
          criptografada — nem nós conseguimos vê-la).
          <br />
          <strong className="text-ink">Dados financeiros que você registra:</strong> lançamentos, orçamentos, metas,
          ativos e arquivos de extrato que você importa. Esses dados existem para o app funcionar pra você — e para
          mais nada.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">2. Para que usamos</h2>
        <p>
          Exclusivamente para operar o serviço: exibir seus painéis, calcular indicadores, gerar resumos e melhorar a
          experiência. <strong className="text-ink">Não vendemos nem compartilhamos seus dados</strong> com terceiros
          para publicidade.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">3. Onde ficam armazenados</h2>
        <p>
          Em provedores de nuvem contratados para hospedar o serviço (banco de dados e servidores), com acesso restrito
          e tráfego criptografado (HTTPS). Arquivos de extrato importados são processados na hora e não ficam salvos —
          só as transações/ativos que você confirmar.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">4. Seus direitos (LGPD)</h2>
        <p>
          Você pode, a qualquer momento: <strong className="text-ink">acessar</strong> e{" "}
          <strong className="text-ink">corrigir</strong> seus dados (dentro do próprio app),{" "}
          <strong className="text-ink">exportar</strong> (Configurações → Dados) e{" "}
          <strong className="text-ink">excluir sua conta com todos os dados</strong> (Configurações → Dados → Excluir
          conta). A exclusão é definitiva e imediata.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">5. Cookies e sessão</h2>
        <p>
          Usamos apenas cookies essenciais para manter você conectado(a) com segurança. Não usamos cookies de
          rastreamento ou publicidade.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">6. Contato do responsável</h2>
        <p>
          Para exercer seus direitos ou tirar dúvidas sobre privacidade:{" "}
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
