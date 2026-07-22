import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";

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

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

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
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // authorize() always returns a persisted user with a real id, so this is safe.
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
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
