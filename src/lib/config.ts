/**
 * Link de checkout do curso (Hubla) — pra onde manda quem esbarra numa tela premium sem
 * acesso. Configurável por variável de ambiente pra trocar sem precisar de deploy de código
 * (ex.: mudar o produto/promoção). Sem a env definida, cai no site principal — nunca fica um
 * link quebrado, mas a Dani precisa configurar COURSE_CHECKOUT_URL na Vercel com o link de
 * verdade da Hubla antes de contar com essa conversão de verdade.
 */
export const COURSE_CHECKOUT_URL = process.env.COURSE_CHECKOUT_URL || "https://fatoscapital.com.br";
