import { CalendarX2, Link2Off, Lock, RefreshCw, UserRoundCheck, Users } from "lucide-react";
import type { TelaDoConvite as Tela } from "./regras";

/**
 * Os textos de cada motivo de o link do convite não abrir. Sem gênero: o app não sabe quem é cada
 * pessoa do casal, então o nome entra sem artigo ("Ana cancelou", "Nós dois de Ana").
 */
export type Motivo = { icone: typeof Lock; titulo: string; texto: string; botao?: { href: string; rotulo: string }; trocarConta?: boolean };

export function motivo(tela: Tela | "limite", titular: string, par: string, valeAte: string | null): Motivo {
  const entrar = { href: "/login", rotulo: "Entrar no SPI" };
  switch (tela) {
    case "vencido":
      return { icone: CalendarX2, titulo: "Este convite venceu", texto: `Convites valem 7 dias. Peça um convite novo para ${titular}.` };
    case "usado":
      return { icone: UserRoundCheck, titulo: "Este convite já foi usado", texto: "Cada convite abre uma vez só. Se foi você que entrou, é só entrar com o seu login.", botao: entrar };
    case "cancelado":
      return { icone: Link2Off, titulo: `${titular} cancelou este convite`, texto: `Se foi engano, peça um convite novo para ${titular}.` };
    case "substituido":
      return { icone: RefreshCw, titulo: "Este link foi trocado", texto: `${titular} mandou um convite mais novo. Abra o último link que chegou.` };
    case "casal-inativo":
      return { icone: Lock, titulo: "Este convite está pausado", texto: `O Nós dois de ${titular} não está ativo agora. Com a renovação, o link volta a valer${valeAte ? ` até ${valeAte}` : ""}.` };
    case "ja-tem-par":
      return { icone: Users, titulo: `O Nós dois de ${titular} já tem um par`, texto: "É um par por vez. Se é você, entre com o login que você criou.", botao: entrar, trocarConta: true };
    case "e-a-titular":
      return {
        icone: Users,
        titulo: "Este convite é para o seu par",
        texto: par ? `Mande o link para ${par}. Quando ${par} entrar, aparece no seu Nós dois.` : "Mande o link para o seu par. Quando entrar, aparece no seu Nós dois.",
        botao: { href: "/divisao", rotulo: "Voltar para o Nós dois" },
        trocarConta: true,
      };
    case "em-outro-casal":
      return {
        icone: Users,
        titulo: "Você já está em outro Nós dois",
        texto: "Cada pessoa fica em um Nós dois por vez. Saia do outro em Configurações e abra este link de novo.",
        botao: { href: "/configuracoes/nos-dois", rotulo: "Abrir Configurações" },
        trocarConta: true,
      };
    case "limite":
      return { icone: Lock, titulo: "Muitas tentativas seguidas", texto: "Por segurança, espere alguns minutos e abra o link de novo." };
    case "ja-esta-aqui":
      return { icone: UserRoundCheck, titulo: "Você já está no Nós dois", texto: `É só abrir o Nós dois de ${titular}.`, botao: { href: "/divisao", rotulo: "Abrir o Nós dois" } };
    case "invalido":
    default:
      return { icone: Link2Off, titulo: "Este link não abriu", texto: "O link pode ter sido cortado ao copiar. Peça para quem te convidou mandar de novo.", botao: entrar };
  }
}
