import Link from "next/link";
import { CircleAlert, UserRound, Wallet } from "lucide-react";
import { DocumentoLegal, LINK_LEGAL, Secao } from "@/components/entrada/DocumentoLegal";
import { EMAIL_DO_SUPORTE } from "@/lib/support/contato";

export const metadata = { title: "Termos de Uso · SPI Finance" };

/** Termos de Uso, conteúdo base para o lançamento; revisar com apoio jurídico antes de escalar. */
export default function TermosPage() {
  return (
    <DocumentoLegal
      titulo="Termos de uso"
      atualizacao="Atualizados em 13 de julho de 2026"
      essencial={[
        { icone: Wallet, texto: "Uma ferramenta para organizar o seu dinheiro." },
        { icone: CircleAlert, texto: "Não é recomendação de investimento. Tudo é educativo." },
        { icone: UserRound, texto: "As decisões são suas." },
      ]}
      indice={[
        { id: "t1", rotulo: "O que é o serviço" },
        { id: "t2", rotulo: "Não é recomendação" },
        { id: "t3", rotulo: "Sua conta" },
        { id: "t4", rotulo: "Seus dados" },
        { id: "t5", rotulo: "Disponibilidade" },
        { id: "t6", rotulo: "Mudanças nos termos" },
        { id: "t7", rotulo: "Contato" },
      ]}
    >
      <p>
        Boas-vindas ao <strong className="text-ink">SPI Finance</strong>. Ao criar uma conta ou usar o
        aplicativo, você concorda com estes termos. Se não concordar, basta não utilizar o serviço.
      </p>

      <Secao id="t1">1. O que é o serviço</Secao>
      <p>
        O SPI Finance é uma ferramenta de organização financeira pessoal: registro de receitas e
        despesas, orçamento, metas, acompanhamento de carteira de investimentos e simuladores educativos.
      </p>

      <Secao id="t2">2. Não é recomendação de investimento</Secao>
      <p>
        Todo conteúdo do aplicativo, incluindo simuladores, comparativos, projeções, rebalanceamento e análises,
        tem caráter <strong className="text-ink">educativo e informativo</strong>. Nada aqui constitui recomendação,
        oferta ou aconselhamento de investimento, jurídico ou tributário. Decisões financeiras são de sua exclusiva
        responsabilidade; considere consultar um profissional certificado.
      </p>

      <Secao id="t3">3. Sua conta</Secao>
      <p>
        Você é responsável por manter sua senha em sigilo e pelas atividades realizadas na sua conta. As informações
        cadastradas devem ser verdadeiras. Podemos suspender contas que violem estes termos ou usem o serviço de
        forma abusiva.
      </p>

      <Secao id="t4">4. Seus dados</Secao>
      <p>
        O tratamento dos seus dados pessoais está descrito na{" "}
        <Link href="/privacidade" className={LINK_LEGAL}>
          Política de Privacidade
        </Link>
        . Em resumo: seus dados são seus, usamos apenas para operar o serviço e você pode exportá-los ou excluir a
        conta a qualquer momento.
      </p>

      <Secao id="t5">5. Disponibilidade e limitação de responsabilidade</Secao>
      <p>
        Trabalhamos para manter o serviço disponível e correto, mas ele é fornecido &quot;como está&quot;, sem
        garantias de disponibilidade ininterrupta ou exatidão de cotações e cálculos. Na máxima extensão permitida
        pela lei, não nos responsabilizamos por perdas decorrentes de decisões tomadas com base no aplicativo.
      </p>

      <Secao id="t6">6. Mudanças nestes termos</Secao>
      <p>
        Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas no aplicativo; o uso continuado
        após a atualização significa concordância.
      </p>

      <Secao id="t7">7. Contato</Secao>
      <p>
        Dúvidas? Escreva para{" "}
        <a href={`mailto:${EMAIL_DO_SUPORTE}`} className={LINK_LEGAL}>
          {EMAIL_DO_SUPORTE}
        </a>
        .
      </p>
    </DocumentoLegal>
  );
}
