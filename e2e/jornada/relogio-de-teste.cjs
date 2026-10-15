// Relógio de teste da jornada (e2e/jornada). SÓ é carregado pelo `npm run test:jornada`, via
// NODE_OPTIONS="--require .../relogio-de-teste.cjs", e só age com SPI_RELOGIO_DE_TESTE apontando
// para um arquivo. O código do app não sabe que ele existe: em produção nada muda.
//
// O arquivo guarda {"base": <ms do dia simulado>, "real": <ms reais em que foi escrito>}. O relógio
// anda normal a partir dali: agora = base + (agora real - real). O teste troca o dia reescrevendo
// o arquivo; o servidor lê de novo no máximo a cada 50 ms.
const fs = require("fs");
const ARQUIVO = process.env.SPI_RELOGIO_DE_TESTE;
// Só com banco local: se alguém carregar isto apontando para outro banco, o relógio fica o real.
const bancoLocal = /@(localhost|127\.0\.0\.1|\[::1\]):/.test(process.env.DATABASE_URL || "");
if (ARQUIVO && bancoLocal && !process.env.VERCEL) {
  const Real = Date;
  const realNow = Real.now.bind(Real);
  let desvio = 0;
  let lidoEm = 0;
  let mtime = 0;
  const atualiza = () => {
    const r = realNow();
    if (r - lidoEm < 50) return;
    lidoEm = r;
    try {
      const st = fs.statSync(ARQUIVO);
      if (st.mtimeMs === mtime) return;
      mtime = st.mtimeMs;
      const { base, real } = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
      desvio = Number(base) - Number(real);
    } catch {
      /* arquivo ainda não existe: relógio de verdade */
    }
  };
  const agora = () => {
    atualiza();
    return realNow() + desvio;
  };
  function Falso(...a) {
    if (!new.target) return new Real(agora()).toString();
    return a.length === 0 ? new Real(agora()) : new Real(...a);
  }
  Falso.prototype = Real.prototype;
  for (const k of Object.getOwnPropertyNames(Real)) {
    if (!["prototype", "length", "name"].includes(k)) Object.defineProperty(Falso, k, Object.getOwnPropertyDescriptor(Real, k));
  }
  Falso.now = agora;
  Object.defineProperty(Falso, Symbol.hasInstance, { value: (x) => x instanceof Real });
  globalThis.Date = Falso;
}
