# Referência de Design — Essência do App

> Documento para orientar a implementação visual. Não é sobre copiar telas — é sobre replicar a linguagem visual: um app de finanças dark mode com estética premium, calma e extremamente legível. A sensação é de "private banking digital": sofisticado, silencioso, sem nada gritando por atenção.

---

## 1. Personalidade do design (o mais importante)

- **Escuro, calmo e confiante.** O fundo é quase preto. Nada de branco puro, nada de cores saturadas berrantes. O app transmite controle e seriedade, não "gamificação".
- **Os NÚMEROS são os protagonistas.** Todo o design existe para destacar valores financeiros. Números grandes, tipografia limpa, resto da interface recuado.
- **Hierarquia por opacidade, não por cor.** Texto principal em branco suave; texto secundário em cinza médio; rótulos em cinza apagado e menores. Quase nenhuma borda visível — a separação vem de espaçamento e de leves diferenças de tom de fundo.
- **Densidade com respiro.** Muita informação por tela, mas nunca parece apertado, porque o espaçamento vertical é generoso e cada linha de lista tem altura confortável.
- **Cor só quando significa algo.** Verde = positivo/entrada, vermelho/coral = negativo/saída, e pequenos toques de cor nos ícones de categoria. O resto é monocromático.

---

## 2. Paleta de cores (tokens aproximados)

```
--bg-base:        #0B0D12   (fundo geral, quase preto com leve tom azulado)
--bg-card:        #171A21   (cards e superfícies elevadas, um degrau acima do fundo)
--bg-card-2:      #1F2330   (superfície de 2º nível: chips, inputs, hover)
--border-sutil:   #262B36   (usar raramente; separadores quase invisíveis)

--text-primary:   #F2F3F5   (branco suave, nunca #FFF puro)
--text-secondary: #9AA0AC   (cinza médio para descrições e datas)
--text-terciario: #5C6270   (rótulos pequenos, section headers)

--positivo:       #34D399 → #4ADE80  (verde menta, usado em variações e entradas)
--negativo:       #F87171 → #FB7185  (vermelho/coral suave, nunca vermelho puro)
--acento:         #818CF8 / #60A5FA  (azul-lavanda para elementos interativos e gráficos neutros)
```

Regras de uso:
- Fundo base em 90% da tela; cards apenas um tom acima (contraste baixo entre superfícies — a elevação é sutil).
- **Brilho ambiente (detalhe que muda tudo):** o fundo nunca é preto chapado. Atrás do elemento hero de cada tela há uma **luz radial difusa** na cor do contexto (verde no fluxo positivo, âmbar em alertas, azul na carteira), tipo: `radial-gradient(closest-side, rgba(52,211,153,0.15), transparent 75%)` posicionada no topo, vazando pra fora da tela. É o que dá profundidade e clima "premium" sem poluir.
- Verde e vermelho aparecem SÓ em valores e variações (+R$ / −R$ / %). Nunca como decoração.
- Cada categoria de gasto tem uma cor própria em versão **pastel dessaturada** (ver seção de ícones).
- **Gradientes são permitidos e desejados em 3 lugares:** (1) contorno de pílulas de indicador, (2) preenchimento de barras de progresso e arcos, (3) preenchimento sob a linha do gráfico. Sempre gradientes de tons próximos (verde→verde-claro, laranja→amarelo), nunca arco-íris.

---

## 3. Tipografia

- Uma única família sans-serif geométrica/neutra (Inter, SF Pro ou similar). Nada de serifa, nada de fonte "divertida".
- **Números grandes usam tabular figures** (algarismos de largura fixa) — isso dá o aspecto "financeiro profissional".

Escala típica observada:
```
Hero (patrimônio/saldo do mês):  34–40px, peso 600–700, tracking levemente negativo
Título de seção/tela:            20–22px, peso 600
Valor em linha de lista:         16–17px, peso 500–600
Texto de item de lista:          15–16px, peso 400–500
Descrição/data secundária:       13px,    peso 400, cor secundária
Section header (rótulo de grupo):11–12px, peso 500, cor terciária,
                                 às vezes em caixa alta com letter-spacing +0.5px
```

Padrão recorrente: **número hero + variação logo abaixo** em texto menor colorido, ex.:
```
R$ 128.450,32
▲ +R$ 2.340 (1,9%) este mês     ← 13–14px, verde
```

---

## 4. Forma, espaçamento e layout

- **Border-radius generoso:** cards ~16–20px; chips/pills ~999px (totalmente arredondados); barras de progresso arredondadas nas pontas.
- **Sem sombras chamativas.** Elevação por cor de fundo, não por drop-shadow. Se usar sombra, quase imperceptível.
- **Padding interno de card:** ~16–20px. **Espaço entre cards:** ~12–16px. **Margem lateral da tela:** ~16–20px.
- Layout de tela típico: título no topo → número hero → gráfico → seletor de período → listas agrupadas em cards.
- Listas: cada item com ~56–64px de altura, ícone à esquerda, título+subtítulo no centro, valor alinhado à direita. Divisores internos quase invisíveis ou inexistentes (só espaçamento).
- Grupos de lista com **section header pequeno em cinza** acima de cada card ("CONTAS", "INVESTIMENTOS", "HOJE", "ONTEM"...).

---

## 5. Componentes-chave

### Ícones de categoria (assinatura visual do app)
- Círculo de ~36–40px com **fundo colorido translúcido** (a cor da categoria com ~15–20% de opacidade) e, dentro, um **emoji ou ícone simples** na cor cheia.
- Ex.: alimentação = círculo laranja translúcido com 🍔; transporte = azul com 🚗; casa = roxo com 🏠.
- Isso dá cor e personalidade ao app sem poluir — é O elemento que quebra o monocromático.

### Gráfico de linha (patrimônio / fluxo)
- Linha fina (2–2,5px) e **suave (curva, não pontas retas)**.
- **Gradiente de preenchimento abaixo da linha**, da cor da linha (~25% opacidade) até transparente.
- Sem grid, sem eixos pesados — no máximo labels mínimos em cinza apagado.
- Cor da linha acompanha o contexto: verde se subindo, vermelho se caindo, ou azul-lavanda neutro.
- Ao tocar/arrastar: ponto destacado + valor daquela data aparece no topo (scrubbing).

### Seletor de período (pills)
- Linha horizontal de pills: `1M  3M  6M  1A  Tudo`.
- Pill ativa: fundo `--bg-card-2` (ou levemente mais claro), texto branco.
- Pills inativas: sem fundo, texto cinza.

### Barras de progresso (orçamento/metas)
- Barra fina (6–8px), totalmente arredondada, trilha em `rgba(255,255,255,0.08)`.
- Preenchimento em **gradiente da cor da categoria** (ex.: laranja→amarelo); muda para vermelho/coral quando estoura o limite.
- **Anima ao entrar:** cresce de 0 até o valor (~0,8s ease-out).
- Sempre acompanhada de "gasto / limite" em texto: `R$ 820 de R$ 1.000`.

### Cards de resumo
- Grid 2 colunas de cards pequenos com: rótulo pequeno em cinza no topo, número grande embaixo, às vezes variação % colorida.
- Ex.: "Entradas | R$ 12.400" ao lado de "Saídas | R$ 8.230".

### Tab bar inferior
- Fundo escuro (mesmo tom do card ou levemente translúcido com blur).
- Ícones em linha fina/outline; aba ativa em branco (ou acento), inativas em cinza terciário.
- Labels pequenos (10–11px) abaixo dos ícones.

### Liquid Glass — vidro fosco (ASSINATURA Nº 1 do app, prioridade máxima)
Tudo que **flutua sobre o conteúdo** é feito de "vidro": tab bar, botões flutuantes, pills de ação, chips ativos. A sensação é de uma **lente/lupa** — o conteúdo rola POR BAIXO e aparece desfocado, saturado e levemente ampliado através do vidro.

Receita CSS (aplicar em tab bar, botão flutuante e pills):
```css
background: rgba(26, 29, 38, 0.5);            /* tinta escura translúcida */
backdrop-filter: blur(22px) saturate(180%) brightness(1.1);
-webkit-backdrop-filter: blur(22px) saturate(180%) brightness(1.1);
border: 0.5px solid rgba(255, 255, 255, 0.14); /* aro fino de luz */
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.14),        /* brilho especular no topo (efeito lente) */
  inset 0 -1px 0 rgba(0,0,0,0.3),              /* sombra interna embaixo */
  0 10px 30px rgba(0,0,0,0.5);                 /* flutuação sobre o conteúdo */
border-radius: 999px;                          /* formato de pílula/cápsula */
```

Regras do vidro:
- A tab bar é uma **cápsula flutuante** destacada das bordas da tela (margem lateral e inferior de ~14px), não uma barra colada no rodapé.
- O conteúdo NUNCA termina antes da tab bar — ele passa por baixo dela (padding-bottom generoso na área de scroll, tab bar com `position: fixed/absolute`).
- Aba ativa dentro do vidro: pill interna com `rgba(255,255,255,0.1)`.
- Cards comuns podem ganhar versão sutil do efeito: `rgba(255,255,255,0.05)` + borda `rgba(255,255,255,0.08)` — parecem lâminas de vidro escuro mesmo sem blur.
- Ao rolar/arrastar, o desfoque revela o movimento do conteúdo sob o vidro — esse é o momento "uau"; garantir que funcione no PWA (backdrop-filter tem bom suporte em iOS/Safari e Chrome).

### Arco de score (elemento hero alternativo)
- Semicírculo fino (6–8px de espessura, pontas arredondadas) com trilha em `rgba(255,255,255,0.07)` e preenchimento em **gradiente da cor do contexto**.
- Número grande no centro do arco (ex.: taxa de poupança "34%", score da carteira).
- **Anima ao entrar:** o arco se preenche do zero até o valor (1,2–1,5s, easing suave) enquanto o número faz count-up sincronizado.
- Usar para: taxa de poupança do mês, progresso de metas, "nota" da carteira.

### Pílulas de indicador com contorno em gradiente
- Trio de pílulas lado a lado resumindo a tela (ex.: Renda | Gastos | Aportes), cada uma com **borda de 1,5px em gradiente** da sua cor e fundo escuro:
```css
border: 1.5px solid transparent;
background: linear-gradient(#12141B,#12141B) padding-box,
            linear-gradient(135deg, corA, corB) border-box;
border-radius: 999px;
```
- Valor abreviado dentro (12,4k) e rótulo pequeno colorido embaixo. É a versão financeira dos "anéis de status" — dá identidade sem virar poluição.

### Tab bar de vidro com botão "+" central (padrão oficial de registro)
- A ação de registrar gasto NÃO é botão flutuante solto — é um **círculo "+" encaixado no centro da tab bar**, entre as abas (2 de cada lado).
- O círculo (~52px) sobe ~20px acima da linha da cápsula, com **gradiente da cor de acento, brilho suave ao redor** (`box-shadow: 0 0 22px rgba(52,211,153,0.45)`) e highlight especular interno no topo.
- Ícone `+` escuro (tom 900 da mesma cor) dentro do círculo, para contraste.
- As abas continuam com ícone outline + label 10–11px; ativa em branco, inativas em cinza.
- Ao tocar: abre o registro (aí sim aparecem opções como microfone), com transição de expansão a partir do botão.

### Botões e ações
- Ação primária: botão sólido arredondado (radius alto), cor de acento ou branco com texto escuro.
- Ações secundárias: texto colorido ou pill com fundo `--bg-card-2`.
- Chips de filtro roláveis horizontalmente no topo de listas.

---

## 6. Como os dados são apresentados

- Valores monetários sempre formatados: `R$ 1.234,56`. Negativos com `−` e cor, não com parênteses.
- Variações sempre com **seta + valor + percentual**: `▲ R$ 234 (2,1%)`.
- Datas relativas nas listas: "Hoje", "Ontem", depois "15 de jul".
- Transações: nome do estabelecimento em branco, categoria/conta em cinza 13px abaixo, valor à direita (saída em branco ou cinza; entrada em verde).
- Percentuais de alocação: número + barra ou anel fino, nunca só texto.

---

## 7. Micro-interações e sensação de uso

- Transições suaves e rápidas (200–300ms, ease-out) entre telas e ao expandir cards.
- **Coreografia de entrada de tela (obrigatória nas telas principais):** os elementos não aparecem prontos — em ~1,5s: (1) a linha do gráfico **se desenha** da esquerda pra direita (stroke-dashoffset), (2) o gradiente sob a linha faz fade-in depois da linha, (3) o ponto final da linha pulsa continuamente, (4) números hero fazem **count-up** com easing desacelerando, (5) arcos e barras crescem do zero. Tudo sincronizado, nada simultâneo demais.
- Botão "+" central com brilho que respira sutilmente (animação de opacity no glow, ~3s de ciclo).
- Pull-to-refresh e feedback tátil leve (quando possível no PWA).
- Skeleton loading escuro (blocos cinza `--bg-card-2` pulsando), nunca spinner branco.

---

## 8. O que EVITAR (tão importante quanto o resto)

- ❌ Branco puro, fundos claros, ou modo claro como padrão.
- ❌ Cores saturadas em áreas grandes (verde/vermelho só em texto de valor).
- ❌ Bordas visíveis em tudo — separação é por espaçamento e tom.
- ❌ Sombras fortes, gradientes chamativos em botões, glassmorphism exagerado.
- ❌ Muitos pesos/tamanhos de fonte diferentes — a escala da seção 3 basta.
- ❌ Texto longo. Tudo que puder virar número, ícone, barra ou chip, deve virar.
- ❌ Ícones detalhados/3D — sempre outline fino ou emoji dentro do círculo colorido.

---

## 9. Resumo em uma frase (norte para qualquer tela nova)

**"Fundo quase preto com uma luz ambiente difusa na cor do contexto, cards como lâminas de vidro escuro, números brancos grandes que fazem count-up, arco de score e gráficos que se desenham ao entrar, gradientes só em contornos/barras/preenchimentos de tons próximos, círculos coloridos translúcidos para categorias, tab bar de vidro fosco com o conteúdo rolando por baixo e um botão '+' central com brilho — cor apenas onde há significado."**
