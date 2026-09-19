import Link from "next/link";
import { IMPORT_FILE_RETENTION_DAYS } from "@/lib/repositories/import-file.repo";
import { isPluggyConfigured } from "@/lib/pluggy/client";

export const metadata = { title: "Política de Privacidade · SPI Finance" };

/** Política de Privacidade (LGPD), conteúdo base para o lançamento; revisar com apoio jurídico. */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-ink-muted">Última atualização: 23 de julho de 2026</p>
      </div>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-ink-muted">
        <p>
          Esta política explica, em linguagem simples, como o <strong className="text-ink">SPI Finance</strong>{" "}
          trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">1. Quais dados coletamos</h2>
        <p>
          <strong className="text-ink">Dados de cadastro:</strong> nome, e-mail e senha (guardada de forma
          criptografada, nem nós conseguimos vê-la).
          <br />
          <strong className="text-ink">Dados financeiros que você registra:</strong> lançamentos, orçamentos, metas,
          ativos e arquivos de extrato que você importa. Esses dados existem, antes de tudo, para o app funcionar pra
          você (veja também a seção 3).
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">2. Para que usamos</h2>
        <p>
          Principalmente para operar o serviço: exibir seus painéis, calcular indicadores, gerar resumos e melhorar a
          experiência. <strong className="text-ink">Não vendemos nem compartilhamos seus dados</strong> com terceiros
          para publicidade.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">3. Quem, além de você, pode ver seus dados</h2>
        <p>
          Para operar e evoluir o SPI Finance e oferecer um acompanhamento financeiro relevante, a{" "}
          <strong className="text-ink">administração do app</strong> pode acessar informações da sua conta em painéis
          internos, inclusive de forma identificada — como seu <strong className="text-ink">patrimônio registrado</strong>{" "}
          e sua <strong className="text-ink">capacidade de poupança</strong>. Usamos isso para entender o perfil de quem
          usa o app e, quando fizer sentido, apresentar a você produtos e serviços financeiros próprios (como conteúdos,
          cursos ou consultoria/assessoria). Isso não muda o essencial: seus dados{" "}
          <strong className="text-ink">continuam não sendo vendidos nem compartilhados com terceiros</strong> para
          publicidade, e você pode excluir tudo quando quiser (seção 5).
        </p>
        {isPluggyConfigured() && (
        <p>
          Se você optar por <strong className="text-ink">conectar seu banco</strong> (Open Finance), a leitura das suas
          contas e cartões é feita pela <strong className="text-ink">Pluggy</strong>, empresa autorizada a operar no
          Open Finance Brasil, mediante a sua autorização expressa. O SPI Finance recebe apenas os lançamentos (data,
          descrição e valor) e nunca suas senhas bancárias. Você pode desconectar a qualquer momento em Configurações ›
          Conexões; os lançamentos já importados permanecem até que você os apague.
        </p>
        )}

        <h2 className="mt-2 text-base font-semibold text-ink">4. Onde ficam armazenados</h2>
        <p>
          Em provedores de nuvem contratados para hospedar o serviço (banco de dados e servidores), com acesso restrito
          e tráfego criptografado (HTTPS). Arquivos de extrato, fatura ou posição que o app consegue ler são processados
          na hora e <strong className="text-ink">não ficam salvos</strong> — guardamos só as transações e ativos que
          você confirmar.
        </p>
        <p>
          <strong className="text-ink">Quando a leitura falha</strong> (o app não entende o formato do seu banco, ou lê
          só parte do arquivo), o arquivo enviado fica guardado por{" "}
          <strong className="text-ink">até {IMPORT_FILE_RETENTION_DAYS} dias</strong>, com uma única finalidade: corrigir
          o leitor para aquele formato e conseguir te dar suporte. Depois desse prazo ele é apagado automaticamente.
          Nesse período, o acesso é restrito à administração do SPI Finance, o arquivo não é compartilhado com ninguém
          de fora e não é usado para nenhuma outra finalidade. Se você excluir sua conta antes disso, ele é apagado
          junto. Para pedir a exclusão imediata de um arquivo específico, fale com a gente no contato abaixo.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">5. Seus direitos (LGPD)</h2>
        <p>
          Você pode, a qualquer momento: <strong className="text-ink">acessar</strong> e{" "}
          <strong className="text-ink">corrigir</strong> seus dados (dentro do próprio app),{" "}
          <strong className="text-ink">exportar</strong> (Configurações → Dados) e{" "}
          <strong className="text-ink">excluir sua conta com todos os dados</strong> (Configurações → Dados → Excluir
          conta). A exclusão é definitiva e imediata, e leva junto qualquer arquivo de importação que estivesse
          guardado para suporte. Você também pode{" "}
          <strong className="text-ink">se opor</strong> a essa retenção ou pedir a exclusão de um arquivo específico
          pelo contato abaixo.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">6. Cookies e sessão</h2>
        <p>
          Usamos apenas cookies essenciais para manter você conectado(a) com segurança. Não usamos cookies de
          rastreamento ou publicidade.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">7. Contato do responsável</h2>
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
