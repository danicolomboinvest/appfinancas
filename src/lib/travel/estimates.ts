/**
 * Planejador de viagem: estimativas de custo CURADAS, mantidas aqui no código — de propósito,
 * sem raspar site externo (sites de custo de viagem proíbem raspagem nos termos ou mudam sem
 * aviso; base própria nunca "quebra" e é fácil de ajustar). Valores em R$ de 2026, referência
 * de planejamento e não orçamento fechado — quem planeja ajusta tudo antes de virar meta.
 *
 * O custo de cada destino NÃO é digitado um a um: cada lugar recebe duas etiquetas —
 *   `tier`  = quão caro é o dia a dia lá (hospedagem, comida, passeios);
 *   `band`  = quanto custa CHEGAR lá saindo do Brasil (ida e volta por pessoa).
 * Assim, ajustar a inflação de um ano inteiro é mexer em ~20 números (as tabelas abaixo), não
 * em 900. Uma viagem pode ter VÁRIOS destinos ("3 dias em Paris, 4 em Roma"): cada trecho usa
 * as diárias do seu próprio destino, e a passagem soma o voo principal + as conexões.
 */

export type TravelStyle = "economico" | "medio" | "confortavel";

export type TravelRegion =
  | "Brasil"
  | "América do Sul"
  | "América do Norte"
  | "Caribe e América Central"
  | "Europa"
  | "África e Oriente Médio"
  | "Ásia"
  | "Oceania";

/** Quão caro é o dia a dia no destino. */
type CostTier = "economico" | "barato" | "medio" | "caro" | "premium";

/** Quanto custa chegar lá (ida e volta por pessoa, saindo do Brasil). */
type FlightBand =
  | "nacional_curto"
  | "nacional_perto"
  | "nacional"
  | "nacional_longe"
  | "nacional_remoto"
  | "sul_perto"
  | "sul"
  | "sul_norte"
  | "central"
  | "norte"
  | "europa"
  | "europa_longe"
  | "africa"
  | "oriente_medio"
  | "asia"
  | "oceania";

export type TravelDestination = {
  key: string;
  label: string;
  country: string;
  region: TravelRegion;
  tier: CostTier;
  band: FlightBand;
  /** Outros nomes pelos quais a pessoa pode procurar (ex.: "NY" para Nova York). */
  aliases?: string[];
};

export const TRAVEL_STYLE_LABEL: Record<TravelStyle, string> = {
  economico: "Econômico",
  medio: "Médio",
  confortavel: "Confortável",
};

/** Diárias no estilo "médio": hospedagem por QUARTO/noite; comida e passeios por pessoa/dia. */
const TIER_DAILY: Record<CostTier, { lodging: number; food: number; activities: number }> = {
  economico: { lodging: 200, food: 90, activities: 70 },
  barato: { lodging: 300, food: 120, activities: 90 },
  medio: { lodging: 420, food: 160, activities: 120 },
  caro: { lodging: 620, food: 220, activities: 160 },
  premium: { lodging: 900, food: 300, activities: 220 },
};

/** Passagem ida e volta por pessoa, saindo do Brasil, no estilo "médio". */
const FLIGHT_BAND: Record<FlightBand, number> = {
  nacional_curto: 400, // bate-volta de carro/ônibus ou voo curtíssimo
  nacional_perto: 650,
  nacional: 950,
  nacional_longe: 1400,
  nacional_remoto: 2200, // Noronha, Lençóis, Alter do Chão
  sul_perto: 1600, // Argentina, Uruguai, Paraguai
  sul: 2200, // Chile, Bolívia
  sul_norte: 2800, // Peru, Colômbia, Equador
  central: 3200, // México, Caribe, América Central
  norte: 3900, // EUA, Canadá
  europa: 4600,
  europa_longe: 5400, // nórdicos, leste europeu, Islândia
  africa: 5200,
  oriente_medio: 5600,
  asia: 6800,
  oceania: 8500,
};

/** Conexão entre dois destinos da MESMA região (por pessoa). */
const HOP_SAME_REGION: Record<TravelRegion, number> = {
  Brasil: 450,
  "América do Sul": 700,
  "América do Norte": 900,
  "Caribe e América Central": 900,
  Europa: 600,
  "África e Oriente Médio": 1100,
  Ásia: 800,
  Oceania: 1100,
};

/** Passagem varia menos entre estilos (tarifa é tarifa); diárias variam bem mais. */
const STYLE_MULTIPLIER: Record<TravelStyle, { flight: number; daily: number }> = {
  economico: { flight: 0.85, daily: 0.65 },
  medio: { flight: 1, daily: 1 },
  confortavel: { flight: 1.5, daily: 1.7 },
};

function d(
  key: string,
  label: string,
  country: string,
  region: TravelRegion,
  tier: CostTier,
  band: FlightBand,
  aliases?: string[],
): TravelDestination {
  return { key, label, country, region, tier, band, aliases };
}

export const TRAVEL_DESTINATIONS: TravelDestination[] = [
  // ---------- Brasil: Sudeste ----------
  d("sao-paulo", "São Paulo", "Brasil", "Brasil", "medio", "nacional", ["sampa", "sp"]),
  d("rio-de-janeiro", "Rio de Janeiro", "Brasil", "Brasil", "medio", "nacional", ["rj"]),
  d("belo-horizonte", "Belo Horizonte", "Brasil", "Brasil", "barato", "nacional", ["bh"]),
  d("vitoria", "Vitória", "Brasil", "Brasil", "barato", "nacional"),
  d("campos-do-jordao", "Campos do Jordão", "Brasil", "Brasil", "caro", "nacional_curto"),
  d("paraty", "Paraty", "Brasil", "Brasil", "medio", "nacional_curto"),
  d("buzios", "Búzios", "Brasil", "Brasil", "caro", "nacional_curto"),
  d("arraial-do-cabo", "Arraial do Cabo", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("cabo-frio", "Cabo Frio", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("angra-dos-reis", "Angra dos Reis e Ilha Grande", "Brasil", "Brasil", "medio", "nacional_curto"),
  d("ilhabela", "Ilhabela", "Brasil", "Brasil", "medio", "nacional_curto"),
  d("ubatuba", "Ubatuba", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("guaruja", "Guarujá", "Brasil", "Brasil", "medio", "nacional_curto"),
  d("santos", "Santos", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("petropolis", "Petrópolis", "Brasil", "Brasil", "medio", "nacional_curto"),
  d("ouro-preto", "Ouro Preto", "Brasil", "Brasil", "barato", "nacional_perto"),
  d("tiradentes", "Tiradentes", "Brasil", "Brasil", "medio", "nacional_perto"),
  d("capitolio", "Capitólio e Serra da Canastra", "Brasil", "Brasil", "barato", "nacional_perto"),
  d("serra-do-cipo", "Serra do Cipó", "Brasil", "Brasil", "barato", "nacional_perto"),
  d("monte-verde", "Monte Verde", "Brasil", "Brasil", "medio", "nacional_curto"),
  d("pocos-de-caldas", "Poços de Caldas", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("holambra", "Holambra", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("brotas", "Brotas", "Brasil", "Brasil", "barato", "nacional_curto"),
  d("olimpia", "Olímpia", "Brasil", "Brasil", "medio", "nacional_perto"),

  // ---------- Brasil: Sul ----------
  d("florianopolis", "Florianópolis", "Brasil", "Brasil", "medio", "nacional", ["floripa"]),
  d("balneario-camboriu", "Balneário Camboriú", "Brasil", "Brasil", "medio", "nacional"),
  d("bombinhas", "Bombinhas", "Brasil", "Brasil", "medio", "nacional"),
  d("garopaba", "Garopaba e Praia do Rosa", "Brasil", "Brasil", "medio", "nacional"),
  d("curitiba", "Curitiba", "Brasil", "Brasil", "barato", "nacional"),
  d("ilha-do-mel", "Ilha do Mel", "Brasil", "Brasil", "barato", "nacional_perto"),
  d("porto-alegre", "Porto Alegre", "Brasil", "Brasil", "barato", "nacional"),
  d("gramado", "Gramado e Canela", "Brasil", "Brasil", "caro", "nacional", ["serra gaucha"]),
  d("bento-goncalves", "Bento Gonçalves e Vale dos Vinhedos", "Brasil", "Brasil", "medio", "nacional"),
  d("cambara-do-sul", "Cambará do Sul", "Brasil", "Brasil", "medio", "nacional"),
  d("urubici", "Urubici e Serra Catarinense", "Brasil", "Brasil", "barato", "nacional"),
  d("sao-joaquim", "São Joaquim", "Brasil", "Brasil", "barato", "nacional"),
  d("torres", "Torres", "Brasil", "Brasil", "barato", "nacional"),
  d("blumenau", "Blumenau", "Brasil", "Brasil", "barato", "nacional"),
  d("foz-do-iguacu", "Foz do Iguaçu", "Brasil", "Brasil", "barato", "nacional", ["cataratas"]),

  // ---------- Brasil: Nordeste ----------
  d("salvador", "Salvador", "Brasil", "Brasil", "barato", "nacional"),
  d("morro-de-sao-paulo", "Morro de São Paulo", "Brasil", "Brasil", "medio", "nacional"),
  d("praia-do-forte", "Praia do Forte", "Brasil", "Brasil", "medio", "nacional"),
  d("itacare", "Itacaré", "Brasil", "Brasil", "medio", "nacional"),
  d("porto-seguro", "Porto Seguro", "Brasil", "Brasil", "barato", "nacional"),
  d("trancoso", "Trancoso", "Brasil", "Brasil", "caro", "nacional"),
  d("arraial-dajuda", "Arraial d'Ajuda", "Brasil", "Brasil", "medio", "nacional"),
  d("caraiva", "Caraíva", "Brasil", "Brasil", "medio", "nacional"),
  d("chapada-diamantina", "Chapada Diamantina", "Brasil", "Brasil", "barato", "nacional", ["lencois bahia"]),
  d("recife", "Recife e Olinda", "Brasil", "Brasil", "barato", "nacional"),
  d("porto-de-galinhas", "Porto de Galinhas", "Brasil", "Brasil", "medio", "nacional"),
  d("fernando-de-noronha", "Fernando de Noronha", "Brasil", "Brasil", "premium", "nacional_remoto", ["noronha"]),
  d("maceio", "Maceió", "Brasil", "Brasil", "barato", "nacional"),
  d("maragogi", "Maragogi", "Brasil", "Brasil", "medio", "nacional"),
  d("sao-miguel-dos-milagres", "São Miguel dos Milagres", "Brasil", "Brasil", "caro", "nacional"),
  d("japaratinga", "Japaratinga", "Brasil", "Brasil", "medio", "nacional"),
  d("aracaju", "Aracaju", "Brasil", "Brasil", "barato", "nacional"),
  d("joao-pessoa", "João Pessoa", "Brasil", "Brasil", "barato", "nacional"),
  d("natal", "Natal", "Brasil", "Brasil", "barato", "nacional"),
  d("pipa", "Praia da Pipa", "Brasil", "Brasil", "medio", "nacional"),
  d("fortaleza", "Fortaleza", "Brasil", "Brasil", "barato", "nacional"),
  d("jericoacoara", "Jericoacoara", "Brasil", "Brasil", "medio", "nacional_longe", ["jeri"]),
  d("canoa-quebrada", "Canoa Quebrada", "Brasil", "Brasil", "barato", "nacional_longe"),
  d("cumbuco", "Cumbuco", "Brasil", "Brasil", "barato", "nacional"),
  d("icarai-de-amontada", "Icaraí de Amontada", "Brasil", "Brasil", "medio", "nacional_longe"),
  d("barra-grande", "Barra Grande (PI)", "Brasil", "Brasil", "barato", "nacional_longe"),
  d("sao-luis", "São Luís", "Brasil", "Brasil", "barato", "nacional_longe"),
  d("lencois-maranhenses", "Lençóis Maranhenses", "Brasil", "Brasil", "medio", "nacional_remoto", ["barreirinhas"]),
  d("teresina", "Teresina", "Brasil", "Brasil", "economico", "nacional_longe"),

  // ---------- Brasil: Centro-Oeste ----------
  d("brasilia", "Brasília", "Brasil", "Brasil", "medio", "nacional"),
  d("chapada-dos-veadeiros", "Chapada dos Veadeiros", "Brasil", "Brasil", "barato", "nacional", ["alto paraiso"]),
  d("pirenopolis", "Pirenópolis", "Brasil", "Brasil", "barato", "nacional_perto"),
  d("caldas-novas", "Caldas Novas", "Brasil", "Brasil", "barato", "nacional_perto"),
  d("goiania", "Goiânia", "Brasil", "Brasil", "economico", "nacional"),
  d("bonito", "Bonito", "Brasil", "Brasil", "medio", "nacional_longe"),
  d("pantanal", "Pantanal", "Brasil", "Brasil", "caro", "nacional_longe"),
  d("campo-grande", "Campo Grande", "Brasil", "Brasil", "economico", "nacional"),
  d("cuiaba", "Cuiabá", "Brasil", "Brasil", "economico", "nacional_longe"),
  d("chapada-dos-guimaraes", "Chapada dos Guimarães", "Brasil", "Brasil", "barato", "nacional_longe"),

  // ---------- Brasil: Norte ----------
  d("manaus", "Manaus e Amazônia", "Brasil", "Brasil", "medio", "nacional_longe"),
  d("presidente-figueiredo", "Presidente Figueiredo", "Brasil", "Brasil", "barato", "nacional_longe"),
  d("belem", "Belém", "Brasil", "Brasil", "barato", "nacional_longe"),
  d("alter-do-chao", "Alter do Chão", "Brasil", "Brasil", "barato", "nacional_remoto"),
  d("jalapao", "Jalapão", "Brasil", "Brasil", "medio", "nacional_remoto"),
  d("palmas", "Palmas", "Brasil", "Brasil", "economico", "nacional_longe"),
  d("porto-velho", "Porto Velho", "Brasil", "Brasil", "economico", "nacional_remoto"),
  d("rio-branco", "Rio Branco", "Brasil", "Brasil", "economico", "nacional_remoto"),
  d("boa-vista", "Boa Vista", "Brasil", "Brasil", "economico", "nacional_remoto"),
  d("macapa", "Macapá", "Brasil", "Brasil", "economico", "nacional_remoto"),

  // ---------- América do Sul ----------
  d("buenos-aires", "Buenos Aires", "Argentina", "América do Sul", "barato", "sul_perto"),
  d("bariloche", "Bariloche", "Argentina", "América do Sul", "medio", "sul_perto"),
  d("mendoza", "Mendoza", "Argentina", "América do Sul", "barato", "sul_perto"),
  d("el-calafate", "El Calafate e Patagônia", "Argentina", "América do Sul", "medio", "sul"),
  d("ushuaia", "Ushuaia", "Argentina", "América do Sul", "medio", "sul"),
  d("cordoba-ar", "Córdoba", "Argentina", "América do Sul", "barato", "sul_perto"),
  d("santiago", "Santiago", "Chile", "América do Sul", "medio", "sul"),
  d("valparaiso", "Valparaíso", "Chile", "América do Sul", "barato", "sul"),
  d("atacama", "Deserto do Atacama", "Chile", "América do Sul", "medio", "sul"),
  d("puerto-varas", "Puerto Varas e Patagônia chilena", "Chile", "América do Sul", "medio", "sul"),
  d("torres-del-paine", "Torres del Paine", "Chile", "América do Sul", "caro", "sul"),
  d("montevideu", "Montevidéu", "Uruguai", "América do Sul", "medio", "sul_perto"),
  d("punta-del-este", "Punta del Este", "Uruguai", "América do Sul", "caro", "sul_perto"),
  d("colonia-do-sacramento", "Colônia do Sacramento", "Uruguai", "América do Sul", "medio", "sul_perto"),
  d("assuncao", "Assunção", "Paraguai", "América do Sul", "economico", "sul_perto"),
  d("la-paz", "La Paz", "Bolívia", "América do Sul", "economico", "sul"),
  d("uyuni", "Salar de Uyuni", "Bolívia", "América do Sul", "barato", "sul"),
  d("lima", "Lima", "Peru", "América do Sul", "barato", "sul_norte"),
  d("cusco", "Cusco e Machu Picchu", "Peru", "América do Sul", "barato", "sul_norte", ["machu picchu"]),
  d("arequipa", "Arequipa", "Peru", "América do Sul", "economico", "sul_norte"),
  d("bogota", "Bogotá", "Colômbia", "América do Sul", "barato", "sul_norte"),
  d("cartagena", "Cartagena", "Colômbia", "América do Sul", "medio", "sul_norte"),
  d("medellin", "Medellín", "Colômbia", "América do Sul", "barato", "sul_norte"),
  d("san-andres", "San Andrés", "Colômbia", "América do Sul", "medio", "sul_norte"),
  d("quito", "Quito", "Equador", "América do Sul", "barato", "sul_norte"),
  d("galapagos", "Ilhas Galápagos", "Equador", "América do Sul", "premium", "sul_norte"),

  // ---------- América do Norte ----------
  d("nova-york", "Nova York", "Estados Unidos", "América do Norte", "premium", "norte", ["new york", "ny", "nova iorque"]),
  d("miami", "Miami", "Estados Unidos", "América do Norte", "caro", "norte"),
  d("orlando", "Orlando (parques)", "Estados Unidos", "América do Norte", "caro", "norte", ["disney"]),
  d("los-angeles", "Los Angeles", "Estados Unidos", "América do Norte", "caro", "norte", ["la"]),
  d("las-vegas", "Las Vegas", "Estados Unidos", "América do Norte", "medio", "norte"),
  d("sao-francisco", "São Francisco", "Estados Unidos", "América do Norte", "premium", "norte", ["san francisco"]),
  d("chicago", "Chicago", "Estados Unidos", "América do Norte", "caro", "norte"),
  d("washington", "Washington DC", "Estados Unidos", "América do Norte", "caro", "norte"),
  d("boston", "Boston", "Estados Unidos", "América do Norte", "caro", "norte"),
  d("seattle", "Seattle", "Estados Unidos", "América do Norte", "caro", "norte"),
  d("nova-orleans", "Nova Orleans", "Estados Unidos", "América do Norte", "medio", "norte"),
  d("havai", "Havaí", "Estados Unidos", "América do Norte", "premium", "norte", ["honolulu", "hawaii"]),
  d("toronto", "Toronto", "Canadá", "América do Norte", "caro", "norte"),
  d("vancouver", "Vancouver", "Canadá", "América do Norte", "caro", "norte"),
  d("montreal", "Montreal", "Canadá", "América do Norte", "medio", "norte"),
  d("banff", "Banff e Rocky Mountains", "Canadá", "América do Norte", "caro", "norte"),

  // ---------- Caribe e América Central ----------
  d("cancun", "Cancún", "México", "Caribe e América Central", "caro", "central"),
  d("playa-del-carmen", "Playa del Carmen", "México", "Caribe e América Central", "medio", "central"),
  d("tulum", "Tulum", "México", "Caribe e América Central", "caro", "central"),
  d("cidade-do-mexico", "Cidade do México", "México", "Caribe e América Central", "barato", "central", ["mexico city", "cdmx"]),
  d("los-cabos", "Los Cabos", "México", "Caribe e América Central", "caro", "central"),
  d("puerto-vallarta", "Puerto Vallarta", "México", "Caribe e América Central", "medio", "central"),
  d("punta-cana", "Punta Cana", "República Dominicana", "Caribe e América Central", "medio", "central"),
  d("havana", "Havana e Varadero", "Cuba", "Caribe e América Central", "barato", "central"),
  d("aruba", "Aruba", "Aruba", "Caribe e América Central", "caro", "central"),
  d("curacao", "Curaçao", "Curaçao", "Caribe e América Central", "medio", "central"),
  d("bahamas", "Bahamas", "Bahamas", "Caribe e América Central", "caro", "central", ["nassau"]),
  d("jamaica", "Jamaica", "Jamaica", "Caribe e América Central", "medio", "central", ["montego bay"]),
  d("porto-rico", "San Juan", "Porto Rico", "Caribe e América Central", "medio", "central"),
  d("barbados", "Barbados", "Barbados", "Caribe e América Central", "caro", "central"),
  d("costa-rica", "Costa Rica", "Costa Rica", "Caribe e América Central", "medio", "central", ["san jose"]),
  d("cidade-do-panama", "Cidade do Panamá", "Panamá", "Caribe e América Central", "barato", "central"),
  d("belize", "Belize", "Belize", "Caribe e América Central", "medio", "central"),
  d("guatemala", "Antígua e Guatemala", "Guatemala", "Caribe e América Central", "economico", "central"),

  // ---------- Europa ----------
  d("lisboa", "Lisboa", "Portugal", "Europa", "medio", "europa"),
  d("porto-pt", "Porto", "Portugal", "Europa", "medio", "europa"),
  d("algarve", "Algarve", "Portugal", "Europa", "medio", "europa"),
  d("madeira", "Ilha da Madeira", "Portugal", "Europa", "medio", "europa"),
  d("acores", "Açores", "Portugal", "Europa", "medio", "europa"),
  d("madri", "Madri", "Espanha", "Europa", "medio", "europa", ["madrid"]),
  d("barcelona", "Barcelona", "Espanha", "Europa", "caro", "europa"),
  d("sevilha", "Sevilha", "Espanha", "Europa", "medio", "europa"),
  d("valencia", "Valência", "Espanha", "Europa", "medio", "europa"),
  d("granada", "Granada", "Espanha", "Europa", "medio", "europa"),
  d("ibiza", "Ibiza", "Espanha", "Europa", "premium", "europa"),
  d("maiorca", "Maiorca", "Espanha", "Europa", "caro", "europa", ["mallorca"]),
  d("tenerife", "Tenerife e Canárias", "Espanha", "Europa", "medio", "europa"),
  d("paris", "Paris", "França", "Europa", "premium", "europa"),
  d("nice", "Nice e Costa Azul", "França", "Europa", "caro", "europa"),
  d("provenca", "Provença", "França", "Europa", "caro", "europa"),
  d("lyon", "Lyon", "França", "Europa", "medio", "europa"),
  d("bordeaux", "Bordeaux", "França", "Europa", "caro", "europa"),
  d("roma", "Roma", "Itália", "Europa", "caro", "europa"),
  d("veneza", "Veneza", "Itália", "Europa", "caro", "europa"),
  d("florenca", "Florença e Toscana", "Itália", "Europa", "caro", "europa"),
  d("milao", "Milão", "Itália", "Europa", "caro", "europa"),
  d("costa-amalfitana", "Costa Amalfitana", "Itália", "Europa", "premium", "europa", ["napoles", "positano"]),
  d("sicilia", "Sicília", "Itália", "Europa", "medio", "europa"),
  d("sardenha", "Sardenha", "Itália", "Europa", "caro", "europa"),
  d("cinque-terre", "Cinque Terre", "Itália", "Europa", "caro", "europa"),
  d("londres", "Londres", "Reino Unido", "Europa", "premium", "europa", ["london"]),
  d("edimburgo", "Edimburgo", "Reino Unido", "Europa", "caro", "europa"),
  d("dublin", "Dublin", "Irlanda", "Europa", "caro", "europa"),
  d("amsterda", "Amsterdã", "Holanda", "Europa", "caro", "europa", ["amsterdam"]),
  d("bruxelas", "Bruxelas e Bruges", "Bélgica", "Europa", "caro", "europa"),
  d("berlim", "Berlim", "Alemanha", "Europa", "medio", "europa"),
  d("munique", "Munique", "Alemanha", "Europa", "caro", "europa"),
  d("frankfurt", "Frankfurt", "Alemanha", "Europa", "caro", "europa"),
  d("rota-romantica", "Rota Romântica e Baviera", "Alemanha", "Europa", "medio", "europa"),
  d("zurique", "Zurique", "Suíça", "Europa", "premium", "europa"),
  d("interlaken", "Interlaken e Alpes suíços", "Suíça", "Europa", "premium", "europa"),
  d("genebra", "Genebra", "Suíça", "Europa", "premium", "europa"),
  d("viena", "Viena", "Áustria", "Europa", "caro", "europa"),
  d("salzburgo", "Salzburgo", "Áustria", "Europa", "caro", "europa"),
  d("praga", "Praga", "Tchéquia", "Europa", "medio", "europa_longe"),
  d("budapeste", "Budapeste", "Hungria", "Europa", "barato", "europa_longe"),
  d("cracovia", "Cracóvia", "Polônia", "Europa", "barato", "europa_longe"),
  d("varsovia", "Varsóvia", "Polônia", "Europa", "barato", "europa_longe"),
  d("copenhague", "Copenhague", "Dinamarca", "Europa", "premium", "europa_longe"),
  d("estocolmo", "Estocolmo", "Suécia", "Europa", "caro", "europa_longe"),
  d("oslo", "Oslo e fiordes", "Noruega", "Europa", "premium", "europa_longe"),
  d("helsinque", "Helsinque", "Finlândia", "Europa", "caro", "europa_longe"),
  d("laponia", "Lapônia", "Finlândia", "Europa", "premium", "europa_longe", ["aurora boreal"]),
  d("reykjavik", "Reykjavík e Islândia", "Islândia", "Europa", "premium", "europa_longe"),
  d("atenas", "Atenas", "Grécia", "Europa", "medio", "europa_longe"),
  d("santorini", "Santorini", "Grécia", "Europa", "caro", "europa_longe"),
  d("mykonos", "Mykonos", "Grécia", "Europa", "premium", "europa_longe"),
  d("creta", "Creta", "Grécia", "Europa", "medio", "europa_longe"),
  d("istambul", "Istambul", "Turquia", "Europa", "barato", "europa_longe"),
  d("capadocia", "Capadócia", "Turquia", "Europa", "barato", "europa_longe"),
  d("dubrovnik", "Dubrovnik", "Croácia", "Europa", "medio", "europa_longe"),
  d("split", "Split e Hvar", "Croácia", "Europa", "medio", "europa_longe"),
  d("liubliana", "Liubliana e Lago Bled", "Eslovênia", "Europa", "medio", "europa_longe"),
  d("bucareste", "Bucareste", "Romênia", "Europa", "barato", "europa_longe"),
  d("malta", "Malta", "Malta", "Europa", "medio", "europa_longe"),

  // ---------- África e Oriente Médio ----------
  d("marrakech", "Marrakech", "Marrocos", "África e Oriente Médio", "barato", "africa"),
  d("fez", "Fez e Chefchaouen", "Marrocos", "África e Oriente Médio", "barato", "africa"),
  d("cairo", "Cairo e Luxor", "Egito", "África e Oriente Médio", "barato", "africa", ["piramides"]),
  d("cidade-do-cabo", "Cidade do Cabo", "África do Sul", "África e Oriente Médio", "medio", "africa", ["cape town"]),
  d("joanesburgo", "Joanesburgo", "África do Sul", "África e Oriente Médio", "barato", "africa"),
  d("kruger", "Kruger e safári", "África do Sul", "África e Oriente Médio", "caro", "africa", ["safari"]),
  d("zanzibar", "Zanzibar", "Tanzânia", "África e Oriente Médio", "medio", "africa"),
  d("serengeti", "Serengeti e Kilimanjaro", "Tanzânia", "África e Oriente Médio", "caro", "africa"),
  d("masai-mara", "Nairóbi e Masai Mara", "Quênia", "África e Oriente Médio", "caro", "africa"),
  d("namibia", "Namíbia", "Namíbia", "África e Oriente Médio", "medio", "africa"),
  d("seychelles", "Seychelles", "Seychelles", "África e Oriente Médio", "premium", "africa"),
  d("mauricio", "Ilhas Maurício", "Maurício", "África e Oriente Médio", "caro", "africa"),
  d("cabo-verde", "Cabo Verde", "Cabo Verde", "África e Oriente Médio", "medio", "africa"),
  d("dubai", "Dubai", "Emirados Árabes", "África e Oriente Médio", "caro", "oriente_medio"),
  d("abu-dhabi", "Abu Dhabi", "Emirados Árabes", "África e Oriente Médio", "caro", "oriente_medio"),
  d("doha", "Doha", "Catar", "África e Oriente Médio", "caro", "oriente_medio"),
  d("tel-aviv", "Tel Aviv", "Israel", "África e Oriente Médio", "caro", "oriente_medio"),
  d("jerusalem", "Jerusalém", "Israel", "África e Oriente Médio", "medio", "oriente_medio"),
  d("petra", "Petra e Jordânia", "Jordânia", "África e Oriente Médio", "medio", "oriente_medio"),

  // ---------- Ásia ----------
  d("toquio", "Tóquio", "Japão", "Ásia", "caro", "asia", ["tokyo"]),
  d("kyoto", "Kyoto", "Japão", "Ásia", "caro", "asia", ["quioto"]),
  d("osaka", "Osaka", "Japão", "Ásia", "medio", "asia"),
  d("seul", "Seul", "Coreia do Sul", "Ásia", "medio", "asia"),
  d("pequim", "Pequim", "China", "Ásia", "barato", "asia", ["beijing"]),
  d("xangai", "Xangai", "China", "Ásia", "medio", "asia", ["shanghai"]),
  d("hong-kong", "Hong Kong", "China", "Ásia", "caro", "asia"),
  d("taipe", "Taipé", "Taiwan", "Ásia", "barato", "asia"),
  d("bangkok", "Bangkok", "Tailândia", "Ásia", "economico", "asia"),
  d("phuket", "Phuket", "Tailândia", "Ásia", "barato", "asia"),
  d("krabi", "Krabi e Phi Phi", "Tailândia", "Ásia", "barato", "asia"),
  d("chiang-mai", "Chiang Mai", "Tailândia", "Ásia", "economico", "asia"),
  d("bali", "Bali", "Indonésia", "Ásia", "barato", "asia"),
  d("singapura", "Singapura", "Singapura", "Ásia", "caro", "asia"),
  d("kuala-lumpur", "Kuala Lumpur", "Malásia", "Ásia", "barato", "asia"),
  d("hanoi", "Hanói e Ha Long", "Vietnã", "Ásia", "economico", "asia"),
  d("ho-chi-minh", "Ho Chi Minh", "Vietnã", "Ásia", "economico", "asia"),
  d("siem-reap", "Siem Reap e Angkor", "Camboja", "Ásia", "economico", "asia"),
  d("manila", "Manila", "Filipinas", "Ásia", "barato", "asia"),
  d("palawan", "Palawan e Boracay", "Filipinas", "Ásia", "barato", "asia"),
  d("nova-delhi", "Nova Délhi e Taj Mahal", "Índia", "Ásia", "economico", "asia", ["agra"]),
  d("jaipur", "Jaipur e Rajastão", "Índia", "Ásia", "economico", "asia"),
  d("goa", "Goa", "Índia", "Ásia", "economico", "asia"),
  d("mumbai", "Mumbai", "Índia", "Ásia", "barato", "asia"),
  d("katmandu", "Katmandu e Himalaia", "Nepal", "Ásia", "economico", "asia"),
  d("sri-lanka", "Sri Lanka", "Sri Lanka", "Ásia", "economico", "asia", ["colombo"]),
  d("maldivas", "Maldivas", "Maldivas", "Ásia", "premium", "asia"),

  // ---------- Oceania ----------
  d("sydney", "Sydney", "Austrália", "Oceania", "caro", "oceania"),
  d("melbourne", "Melbourne", "Austrália", "Oceania", "caro", "oceania"),
  d("brisbane", "Brisbane e Gold Coast", "Austrália", "Oceania", "medio", "oceania"),
  d("cairns", "Cairns e Grande Barreira", "Austrália", "Oceania", "medio", "oceania"),
  d("auckland", "Auckland", "Nova Zelândia", "Oceania", "medio", "oceania"),
  d("queenstown", "Queenstown", "Nova Zelândia", "Oceania", "caro", "oceania"),
  d("fiji", "Fiji", "Fiji", "Oceania", "caro", "oceania"),
  d("bora-bora", "Bora Bora e Taiti", "Polinésia Francesa", "Oceania", "premium", "oceania"),
];

/** Ordem em que as regiões aparecem na busca (mercado é brasileiro: Brasil primeiro). */
export const TRAVEL_REGIONS: TravelRegion[] = [
  "Brasil",
  "América do Sul",
  "América do Norte",
  "Caribe e América Central",
  "Europa",
  "África e Oriente Médio",
  "Ásia",
  "Oceania",
];

const BY_KEY = new Map(TRAVEL_DESTINATIONS.map((dest) => [dest.key, dest]));

export function findDestination(key: string): TravelDestination | null {
  return BY_KEY.get(key) ?? null;
}

/** Minúsculas e sem acento: quem digita "sao paulo" tem que achar "São Paulo". */
function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Busca por nome, país ou apelido ("NY", "Jeri"). Quem começa com o termo aparece primeiro
 * ("Rio de Janeiro" antes de "Rio Branco" quando se digita "rio").
 */
export function searchDestinations(query: string, limit = 30): TravelDestination[] {
  const q = normalize(query);
  if (!q) return TRAVEL_DESTINATIONS.slice(0, limit);
  const scored: { dest: TravelDestination; score: number }[] = [];
  for (const dest of TRAVEL_DESTINATIONS) {
    const label = normalize(dest.label);
    const country = normalize(dest.country);
    const aliases = (dest.aliases ?? []).map(normalize);
    let score = -1;
    if (label.startsWith(q)) score = 0;
    else if (aliases.some((a) => a.startsWith(q))) score = 1;
    else if (label.includes(q)) score = 2;
    else if (country.startsWith(q)) score = 3;
    else if (country.includes(q) || aliases.some((a) => a.includes(q))) score = 4;
    if (score >= 0) scored.push({ dest, score });
  }
  // Empate no tipo de acerto → vence a ordem do catálogo, que lista os destinos mais buscados
  // primeiro em cada região (o sort é estável, então basta não desempatar por nome: quem digita
  // "rio" quer Rio de Janeiro, não Rio Branco).
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.dest);
}

export type TripLeg = { destinationKey: string; days: number };

export type TripInput = {
  legs: TripLeg[];
  travelers: number;
  style: TravelStyle;
};

export type LegEstimate = {
  destination: TravelDestination;
  days: number;
  nights: number;
  lodging: number;
  food: number;
  activities: number;
  /** Diárias deste trecho (sem passagem — a passagem é da viagem toda). */
  subtotal: number;
};

export type TripEstimate = {
  legs: LegEstimate[];
  totalDays: number;
  travelers: number;
  style: TravelStyle;
  flights: number;
  lodging: number;
  food: number;
  activities: number;
  /** Margem de imprevistos (10% do subtotal) — câmbio, bagagem, aquele passeio extra. */
  buffer: number;
  total: number;
  perPerson: number;
};

/** Faixas sãs pros inputs (o cliente também limita, aqui é a garantia). */
export const TRIP_LIMITS = {
  minDays: 1,
  maxDays: 90,
  maxDaysPerLeg: 60,
  minTravelers: 1,
  maxTravelers: 10,
  maxLegs: 8,
} as const;

/** Teto por categoria quando a pessoa edita os valores na mão (contra dedo a mais em zero). */
export const MAX_CATEGORY_VALUE = 1_000_000;

/** Máximo de categorias extras criadas pela pessoa (compras, seguro, chip...). */
export const MAX_EXTRA_CATEGORIES = 10;

/** Valor editado pela pessoa, saneado: inteiro, nunca negativo, nunca absurdo, NaN vira 0. */
export function clampCategoryValue(value: number): number {
  return Math.min(Math.max(Math.round(value) || 0, 0), MAX_CATEGORY_VALUE);
}

/**
 * Margem de imprevistos (10%) e total a partir dos valores por categoria — as 4 fixas e as
 * extras criadas pela pessoa. Usado tanto pro cálculo estimado quanto pros valores EDITADOS
 * (a margem sempre acompanha o que estiver na lista).
 */
export function computeTripTotals(values: number[]): { subtotal: number; buffer: number; total: number } {
  const subtotal = values.reduce((sum, v) => sum + clampCategoryValue(v), 0);
  const buffer = Math.round(subtotal * 0.1);
  return { subtotal, buffer, total: subtotal + buffer };
}

/**
 * Passagem da viagem inteira: UMA ida e volta principal (o trecho mais caro manda — é o voo
 * longo que sai do Brasil) + as conexões entre os destinos. Somar ida e volta de cada destino
 * seria muito acima do real: quem faz Paris e Roma compra um voo pra Europa e um trecho curto
 * entre as duas.
 */
function estimateFlights(destinations: TravelDestination[]): number {
  if (destinations.length === 0) return 0;
  const mainTicket = Math.max(...destinations.map((dest) => FLIGHT_BAND[dest.band]));
  let hops = 0;
  for (let i = 1; i < destinations.length; i++) {
    const previous = destinations[i - 1];
    const current = destinations[i];
    hops +=
      previous.region === current.region
        ? HOP_SAME_REGION[current.region]
        : Math.round(FLIGHT_BAND[current.band] * 0.55);
  }
  return mainTicket + hops;
}

export function estimateTrip(input: TripInput): TripEstimate | null {
  const resolved = input.legs
    .map((leg) => ({ destination: findDestination(leg.destinationKey), days: leg.days }))
    .filter((leg): leg is { destination: TravelDestination; days: number } => leg.destination !== null)
    .slice(0, TRIP_LIMITS.maxLegs);
  if (resolved.length === 0) return null;

  const travelers = Math.min(
    Math.max(Math.round(input.travelers) || TRIP_LIMITS.minTravelers, TRIP_LIMITS.minTravelers),
    TRIP_LIMITS.maxTravelers,
  );
  const mult = STYLE_MULTIPLIER[input.style] ?? STYLE_MULTIPLIER.medio;
  const rooms = Math.ceil(travelers / 2);

  const legs: LegEstimate[] = resolved.map((leg, index) => {
    const days = Math.min(Math.max(Math.round(leg.days) || 1, TRIP_LIMITS.minDays), TRIP_LIMITS.maxDaysPerLeg);
    // Noites = dias em cada trecho, menos uma no ÚLTIMO (a última noite já é a volta pra casa).
    const isLast = index === resolved.length - 1;
    const nights = isLast ? Math.max(days - 1, 1) : days;
    const daily = TIER_DAILY[leg.destination.tier];
    const lodging = Math.round(daily.lodging * nights * rooms * mult.daily);
    const food = Math.round(daily.food * days * travelers * mult.daily);
    const activities = Math.round(daily.activities * days * travelers * mult.daily);
    return {
      destination: leg.destination,
      days,
      nights,
      lodging,
      food,
      activities,
      subtotal: lodging + food + activities,
    };
  });

  const flights = Math.round(estimateFlights(legs.map((leg) => leg.destination)) * travelers * mult.flight);
  const lodging = legs.reduce((sum, leg) => sum + leg.lodging, 0);
  const food = legs.reduce((sum, leg) => sum + leg.food, 0);
  const activities = legs.reduce((sum, leg) => sum + leg.activities, 0);
  const { buffer, total } = computeTripTotals([flights, lodging, food, activities]);

  return {
    legs,
    totalDays: legs.reduce((sum, leg) => sum + leg.days, 0),
    travelers,
    style: input.style,
    flights,
    lodging,
    food,
    activities,
    buffer,
    total,
    perPerson: Math.round(total / travelers),
  };
}
