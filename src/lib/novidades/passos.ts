/**
 * "Tivemos uma mudança" (versão nova, 11/10/2026): o tutorial que TODO mundo vê na primeira vez
 * que abre a versão nova, inclusive quem já usava. Texto puro, na voz da Dani (primeira pessoa,
 * frase curta, sem travessão e sem emoji), para dar para testar.
 *
 * `alvo` é o data-tour do elemento de verdade que o passo ilumina.
 */
export const EVENTO_NOVIDADES_VISTAS = "novidades_versao_nova_vistas";
export const CHAVE_LOCAL_NOVIDADES = "novidades-versao-nova-vistas";
/** Endereço que reabre o tutorial (Configurações › Ajuda › Ver de novo o que mudou). */
export const LINK_VER_DE_NOVO = "/mensal/foco?novidades=1";

export const ABERTURA_DAS_NOVIDADES = {
  titulo: "Tivemos uma mudança",
  texto: "O SPI ficou mais simples. Te mostro em 1 minuto.",
  ver: "Ver o que mudou",
  pular: "Pular",
} as const;

export type PassoDasNovidades = { alvo: string; redondo?: boolean; titulo: string; texto: string; acao?: { rotulo: string; href: string } };

export const PASSOS_DAS_NOVIDADES: PassoDasNovidades[] = [
  {
    alvo: "topo",
    titulo: "O menu e a sua foto",
    texto: "No menu, à esquerda, ficam Metas, Carteira, Decidir e o resto. Na sua foto, à direita, ficam a sua conta e os seus perfis.",
  },
  {
    alvo: "fluxo",
    titulo: "Tudo do mês em quatro abas",
    texto: "Resumo, Orçamento, Transações e Recorrentes. Toque numa aba ou deslize para o lado.",
  },
  {
    alvo: "registrar",
    redondo: true,
    titulo: "O + registra tudo",
    texto: "Gasto, entrada ou o extrato inteiro. Ele fica aqui na Visão geral e some quando você rola.",
  },
  {
    alvo: "livre",
    titulo: "Quanto dá para gastar",
    texto: "Este é o seu livre até domingo. Se ele couber, o mês fecha no plano.",
  },
  {
    alvo: "perfil",
    redondo: true,
    titulo: "Escolha o seu estilo",
    texto: "São quatro: Padrão, Girly, Manifestação e Titânio, no claro ou no escuro. Troca na sua foto, em Configurações.",
    acao: { rotulo: "Escolher meu estilo", href: "/configuracoes#aparencia" },
  },
];

/** "2 de 5". */
export function contadorDoPasso(indice: number, total = PASSOS_DAS_NOVIDADES.length): string {
  return `${indice + 1} de ${total}`;
}
