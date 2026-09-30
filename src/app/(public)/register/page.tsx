import { lerTokenDeConvite } from "@/lib/auth/convite-cadastro";
import { RegisterForm } from "./RegisterForm";

/**
 * Cadastro. Página de servidor só pra ler o `?convite=` do e-mail "Seu acesso está liberado":
 * o código é conferido aqui (a assinatura usa o AUTH_SECRET) e o formulário recebe só o e-mail
 * da compra, já preenchido. Sem convite, ou com um vencido/mexido, o cadastro abre em branco.
 */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { convite } = await searchParams;
  return <RegisterForm emailDaCompra={lerTokenDeConvite(convite)} />;
}
