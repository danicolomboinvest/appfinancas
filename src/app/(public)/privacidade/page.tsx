import Link from "next/link";
import { EMAIL_DO_SUPORTE } from "@/lib/support/contato";
import { IMPORT_FILE_RETENTION_DAYS } from "@/lib/repositories/import-file.repo";
import { isPluggyConfigured } from "@/lib/pluggy/client";

export const metadata = { title: "Política de Privacidade · SPI Finance" };

/** Política de Privacidade (LGPD), conteúdo base para o lançamento; revisar com apoio jurídico. */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-ink-muted">Última atualização: 12 de outubro de 2026</p>
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
          ativos e arquivos de extrato que você importa. Esses dados existem, antes de tudo, para o app funcionar para
          você (veja também a seção 3).
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">2. Para que usamos</h2>
        <p>
          Principalmente para operar o serviço: exibir seus painéis, calcular indicadores, gerar resumos e melhorar a
          experiência. <strong className="text-ink">Não vendemos nem compartilhamos seus dados</strong> com terceiros
          para publicidade.
        </p>
        <p>
          Usamos nomes de lojas, sem identificar ninguém, para o app separar seus gastos sozinho. Quando várias
          pessoas colocam a mesma loja na mesma categoria, guardamos só o nome da loja, a categoria e quantas pessoas
          concordaram. Uma loja só entra depois que pelo menos 3 pessoas diferentes a usaram, e nunca entram valor,
          data, e-mail, quem você é, nem Pix ou transferência para pessoas.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">3. Quem, além de você, pode ver seus dados</h2>
        <p>
          Para operar e evoluir o SPI Finance e oferecer um acompanhamento financeiro relevante, a{" "}
          <strong className="text-ink">administração do app</strong> pode acessar informações da sua conta em painéis
          internos, inclusive de forma identificada, como seu <strong className="text-ink">patrimônio registrado</strong>{" "}
          e sua <strong className="text-ink">capacidade de poupança</strong>. Usamos isso para entender o perfil de quem
          usa o app e, quando fizer sentido, apresentar a você produtos e serviços financeiros próprios (como conteúdos,
          cursos ou consultoria/assessoria). Isso não muda o essencial: seus dados{" "}
          <strong className="text-ink">continuam não sendo vendidos nem compartilhados com terceiros</strong> para
          publicidade, e você pode excluir tudo quando quiser (seção 6).
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

        {/* Login do par (11/10/2026), texto aprovado pela Dani: a gente, sem travessão, sem gênero. */}
        <h3 id="nos-dois" className="mt-1 scroll-mt-20 text-sm font-semibold text-ink">No Nós dois, com o seu par</h3>
        <p>
          Quando você convida o seu par para o Nós dois, cada pessoa entra com o próprio login, e a gente mostra para as
          duas só o que é do casal: os lançamentos marcados como <strong className="text-ink">nosso</strong> e{" "}
          <strong className="text-ink">de cada um</strong>, as metas a dois e a proporção da renda de cada pessoa (por
          exemplo, 55% e 45%). O valor da renda de quem paga o Casal só aparece se essa pessoa escolher mostrar.
        </p>
        <p>
          O que a gente nunca compartilha com o par: os perfis <strong className="text-ink">Pessoal</strong> e{" "}
          <strong className="text-ink">Empresa</strong>, e os lançamentos marcados como{" "}
          <strong className="text-ink">só meu</strong>, que só quem lançou vê, nem o total aparece para a outra pessoa.
        </p>
        <p>
          Qualquer uma das duas pessoas pode encerrar esse compartilhamento quando quiser, em Configurações › Nós dois:
          quem paga o Casal pode remover o par, e o par pode sair. O acesso termina na hora. O histórico do casal fica com
          quem paga, e quem saiu pode baixar uma cópia do que lançou por 90 dias.
        </p>
        <p>
          Se a assinatura do Casal não for renovada, a gente corta o acesso do par na hora e guarda tudo por 90 dias:
          nesse tempo, o par ainda baixa a cópia do que lançou, e com a renovação tudo volta como estava. Depois dos 90
          dias, o que era só do par é apagado.
        </p>
        <p>
          Para pedir a exclusão dos seus dados do Nós dois antes disso, saia do Nós dois e exclua a sua conta em
          Configurações › Dados (o par também tem esse caminho), ou escreva para a gente no contato da seção 9 que a
          gente apaga.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">4. Onde ficam armazenados</h2>
        <p>
          O app roda na <strong className="text-ink">Vercel</strong> e o banco de dados fica na{" "}
          <strong className="text-ink">Neon</strong>, os dois em servidores em{" "}
          <strong className="text-ink">São Paulo</strong>. O tráfego é criptografado (HTTPS), o banco é criptografado
          em repouso pelo provedor, e cada conta só enxerga os próprios dados. Os e-mails do app (confirmação, aviso,
          resumo) saem pelo servidor de e-mail da <strong className="text-ink">Hostinger</strong>.
        </p>
        <p>
          Arquivos de extrato, fatura ou posição que o app consegue ler são processados na hora e{" "}
          <strong className="text-ink">não ficam salvos</strong>: guardamos só as transações e ativos que você
          confirmar.
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

        <p>
          <strong className="text-ink">Cópia de segurança:</strong> uma vez por dia o banco de dados inteiro é copiado,
          para que nenhum dado seja perdido se algo der errado. Cada cópia é{" "}
          <strong className="text-ink">criptografada</strong> antes de ser guardada, só a administração tem a chave, e
          ela é apagada automaticamente depois de 30 dias.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">5. Inteligência artificial</h2>
        <p>
          O SPI Finance <strong className="text-ink">não envia seus dados para serviços de inteligência artificial</strong>.
          A leitura dos extratos e a sugestão de categorias são feitas por regras dentro do próprio app. Se você usar o
          microfone para lançar um gasto, quem transforma a sua fala em texto é o reconhecimento de voz do seu próprio
          celular ou navegador (Apple ou Google, conforme o aparelho); o app recebe só o texto.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">6. Seus direitos (LGPD)</h2>
        <p>
          Você pode, a qualquer momento: <strong className="text-ink">acessar</strong> e{" "}
          <strong className="text-ink">corrigir</strong> seus dados (dentro do próprio app),{" "}
          <strong className="text-ink">exportar</strong> (Configurações → Dados) e{" "}
          <strong className="text-ink">excluir sua conta com todos os dados</strong> (Configurações → Dados → Excluir
          conta). A exclusão é definitiva e imediata no app, e leva junto qualquer arquivo de importação que estivesse
          guardado para suporte. As cópias de segurança criptografadas que ainda tiverem seus dados são apagadas
          sozinhas em até 30 dias. Fica guardado só o registro da compra (e-mail e produto comprado), que é o que
          libera o acesso ao app e serve de comprovante. Você também pode{" "}
          <strong className="text-ink">se opor</strong> a essa retenção ou pedir a exclusão de um arquivo específico
          pelo contato abaixo.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">7. Incidentes de segurança</h2>
        <p>
          Se acontecer um incidente de segurança que possa trazer risco ou dano para você, avisamos por e-mail quem
          foi afetado, dizendo o que aconteceu, quais dados foram envolvidos e o que estamos fazendo, e comunicamos a
          Autoridade Nacional de Proteção de Dados (ANPD), como manda a LGPD.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">8. Cookies e sessão</h2>
        <p>
          Usamos apenas cookies essenciais para manter você conectado(a) com segurança. Não usamos cookies de
          rastreamento ou publicidade.
        </p>

        <h2 className="mt-2 text-base font-semibold text-ink">9. Contato do responsável</h2>
        <p>
          Para exercer seus direitos ou tirar dúvidas sobre privacidade:{" "}
          <a href={`mailto:${EMAIL_DO_SUPORTE}`} className="text-accent-strong hover:underline">
            {EMAIL_DO_SUPORTE}
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
