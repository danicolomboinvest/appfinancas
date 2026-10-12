import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, Plus } from "lucide-react";
import { EMAIL_DO_SUPORTE } from "@/lib/support/contato";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { BOTAO, Cartao, Pequeno, TelaDeEntrada, Titulo, Voltar } from "@/components/entrada/pecas";

export const metadata = { title: "Suporte · SPI Finance" };

/** Uma pergunta que abre ao toque (o + vira x). */
function Pergunta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group rounded-[18px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_20px] items-center gap-2.5 rounded-[18px] px-4 py-3.5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
        {titulo}
        <Plus size={20} strokeWidth={1.6} aria-hidden className="text-ink-muted transition-transform duration-200 group-open:rotate-45" />
      </summary>
      <p className="px-4 pb-3.5 text-[15px] text-ink-muted">{children}</p>
    </details>
  );
}

const LINK_NO_TEXTO = "font-semibold text-accent-strong underline-offset-4 hover:underline";

export default async function SuportePage() {
  // Dentro do app iOS esta página também abre, e lá não se fala de compra feita fora (3.1.1).
  const appDaApple = await naAppDaApple();
  return (
    <TelaDeEntrada>
      <Voltar href="/login" />
      <Titulo>Como podemos ajudar?</Titulo>

      <Cartao>
        <Pequeno>E-mail do suporte</Pequeno>
        <p className="[overflow-wrap:anywhere] text-[17px] font-semibold">{EMAIL_DO_SUPORTE}</p>
        <Pequeno>Respondemos em até 2 dias úteis.</Pequeno>
        <a href={`mailto:${EMAIL_DO_SUPORTE}`} className={`${BOTAO} mt-1.5`}>
          <Mail size={20} strokeWidth={1.6} aria-hidden />
          Escrever
        </a>
      </Cartao>

      <h2 className="sr-only">Perguntas frequentes</h2>
      <div className="flex flex-col gap-2.5">
        <Pergunta titulo="Como tenho acesso ao app?">
          {appDaApple ? (
            <>
              Crie a sua conta no app e assine pela App Store, no plano mensal ou anual. Já assinou? Toque em Restaurar
              compras na tela de assinatura.
            </>
          ) : (
            <>
              O acesso é liberado para quem compra.{" "}
              <Link href="/register" className={LINK_NO_TEXTO}>
                Crie a conta
              </Link>{" "}
              com o mesmo e-mail da compra. No app para iPhone, também dá para assinar pela App Store.
            </>
          )}
        </Pergunta>
        <Pergunta titulo="Esqueci minha senha">
          Na tela de entrar, toque em{" "}
          <Link href="/esqueci-senha" className={LINK_NO_TEXTO}>
            Esqueci a senha
          </Link>{" "}
          e siga o link do e-mail.
        </Pergunta>
        {!appDaApple && (
          <Pergunta titulo="Comprei e ainda não tenho acesso">
            O pagamento pode levar alguns minutos. Se continuar, escreva para o suporte com o e-mail da compra.
          </Pergunta>
        )}
        <Pergunta titulo="Como excluo minha conta?">
          No app: Configurações, Apagar dados ou conta. É imediato e definitivo. Mais detalhes na{" "}
          <Link href="/privacidade" className={LINK_NO_TEXTO}>
            Privacidade
          </Link>
          .
        </Pergunta>
        <Pergunta titulo="Achei um erro ou tenho uma ideia">
          Conte pelo e-mail do suporte. Cada aviso sobre extrato, cotação ou cálculo é revisado por uma pessoa.
        </Pergunta>
      </div>
    </TelaDeEntrada>
  );
}
