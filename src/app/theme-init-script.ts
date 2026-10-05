/**
 * Roda antes da primeira pintura pra evitar o flash de tema errado. Agora precisa tratar o
 * CLARO explicitamente: o padrão do CSS (`:root`) é escuro, então quem escolheu claro veria a
 * tela nascer preta e clarear depois — que é exatamente o flash que este script existe pra
 * evitar, só que ao contrário.
 */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "dark") document.documentElement.classList.add("dark");
  if (t === "light") document.documentElement.classList.add("light");
} catch (e) {}
try {
  // App de iPhone da primeira versão: ele mesmo já tira as margens do relógio e da barrinha de
  // baixo. A versão nova vai até as bordas e se anuncia como "SPIFinanceApp-iOS/2".
  // Sem expressão regular: dentro deste texto o "\\/" de uma regex vira "/" e o script inteiro
  // deixava de rodar (05/10/2026), levando junto o tema salvo.
  var ua = navigator.userAgent;
  if (ua.indexOf("SPIFinanceApp-iOS") >= 0) {
    document.documentElement.classList.add("app-ios");
    if (ua.indexOf("SPIFinanceApp-iOS/") < 0) document.documentElement.classList.add("app-margem-nativa");
  }
} catch (e) {}
`;
