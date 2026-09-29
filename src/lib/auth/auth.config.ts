import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { findUserByEmail } from "@/lib/repositories/user.repo";
import { sessaoValeParaSenha, versaoDaSenha } from "@/lib/auth/sessao";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Necessário em produção atrás de um domínio próprio (ex.: financas.danicolombo.com.br) —
  // sem isso o Auth.js só confia em localhost e no domínio padrão *.vercel.app.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        // Sem olhar maiúscula: contas antigas guardaram o e-mail do jeito que foi digitado.
        const user = await findUserByEmail(email);
        if (!user) return null;

        // Modelo freemium: qualquer conta loga (parte de finanças pessoais é grátis). Quem não
        // pagou só esbarra na trava depois, dentro das telas de investimento (ver
        // hasPremiumAccess em allowedEmail.repo.ts) — login em si não é mais fechado.

        // Conta travada por excesso de tentativas, nem compara a senha.
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          // 5 erros seguidos travam a conta por 15 minutos (anti força bruta).
          const failed = user.failedLoginCount + 1;
          await prisma.user.update({
            where: { id: user.id },
            data:
              failed >= 5
                ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
                : { failedLoginCount: failed },
          });
          return null;
        }

        // Login certo zera o contador/trava.
        if (user.failedLoginCount > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          senhaVersao: versaoDaSenha(user.passwordHash),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Login (authorize() já validou tudo): grava id, papel e a marca da senha no token.
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.senhaVersao = user.senhaVersao;
        return token;
      }
      // Toda chamada seguinte (sessão já existente, sem `user` de novo): confirma que a
      // conta ainda existe. Sem isso, uma conta apagada (limpeza de testes, exclusão de
      // conta) deixava quem já estava logado preso num erro 500 em qualquer aba com o
      // cookie antigo — só funcionava em aba anônima, sem cookie nenhum. Retornar null
      // aqui invalida a sessão e a pessoa cai pro login normalmente, como se tivesse saído.
      //
      // A mesma consulta (que já acontecia) também traz papel e senha atuais:
      // - senha trocada ("esqueci minha senha") derruba as sessões abertas em outros aparelhos,
      //   senão quem pegou o celular dela continuava vendo tudo por até 30 dias renováveis;
      // - papel é relido do banco: admin rebaixado perde o /admin na requisição seguinte, em vez
      //   de carregar o ADMIN congelado no token enquanto continuar usando o app.
      if (token.id) {
        const atual = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, passwordHash: true },
        });
        if (!atual) return null;
        const marca = versaoDaSenha(atual.passwordHash);
        if (!sessaoValeParaSenha(token.senhaVersao, marca)) return null;
        token.senhaVersao = marca;
        token.role = atual.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
