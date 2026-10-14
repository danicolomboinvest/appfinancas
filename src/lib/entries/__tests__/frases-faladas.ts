import type { ParentCategory } from "@prisma/client";
import type { ContextoDaFala } from "../categoria-da-fala";

/**
 * O conjunto de frases faladas que mede a voz (14/10/2026, pedido da Dani: "entender mais jeitos
 * de falar um gasto"). Cada frase tem a categoria esperada; as de NAO_CHUTAR não podem ganhar
 * categoria nenhuma. Usado pelo teste de taxa de acerto (vocabulario-falado.test.ts).
 */
export type FraseEsperada = {
  frase: string;
  mae: ParentCategory | null;
  sub?: string;
  /** A categoria que ELA criou (id), quando é essa a resposta. */
  custom?: string;
  contexto?: ContextoDaFala;
};

const PETS = { personalizadas: [{ id: "pets", name: "Pets" }] };
const BELEZA = { personalizadas: [{ id: "beleza", name: "Beleza" }] };
const FILHOS = { personalizadas: [{ id: "filhos", name: "Filhos" }] };

export const FRASES: FraseEsperada[] = [
  // Comida e bebida
  { frase: "gastei 35 reais no almoço", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "paguei 60 na janta", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "15 reais de café da manhã", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "comprei uma marmita 22 reais", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "quentinha 18 reais", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "paguei 8 reais num pastel", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "duas coxinhas 12 reais", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "gastei 25 no açaí", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "sorvete 14 reais", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "pizza 80 reais", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "gastei 45 num hambúrguer", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "sushi 120 reais", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "padaria 12 reais", mae: "ALIMENTACAO", sub: "Padaria" },
  { frase: "pãozinho 6 reais", mae: "ALIMENTACAO", sub: "Padaria" },
  { frase: "feira 70 reais", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "sacolão 45 reais", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "gastei 60 no hortifruti", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "supermercado 350", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "compras do mês 800 reais", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "fiz o rancho 600 reais", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "atacadão 400", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "pão de açúcar 230 reais", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "cervejinha 20 reais", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "chopp 30 reais", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "boteco 50", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "happy hour 90 reais", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "pedi comida 50 reais", mae: "ALIMENTACAO", sub: "Delivery" },
  { frase: "ifude 40 reais", mae: "ALIMENTACAO", sub: "Delivery" },
  { frase: "uber eats 35", mae: "ALIMENTACAO", sub: "Delivery" },
  { frase: "méqui 30 reais", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "mac donalds 28", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "lanchinho 10 reais", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "cafezinho 5 reais", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "gastei 40 no churrasquinho", mae: "ALIMENTACAO", sub: "Restaurante" },

  // Transporte
  { frase: "abasteci 200 reais", mae: "TRANSPORTE", sub: "Combustível" },
  { frase: "gastei 150 de álcool no carro", mae: "TRANSPORTE", sub: "Combustível" },
  { frase: "etanol 100", mae: "TRANSPORTE", sub: "Combustível" },
  { frase: "uber 23 reais", mae: "TRANSPORTE", sub: "Aplicativo" },
  { frase: "paguei 18 reais no noventa e nove", mae: "TRANSPORTE", sub: "Aplicativo" },
  { frase: "táxi 40", mae: "TRANSPORTE", sub: "Aplicativo" },
  { frase: "corrida 18 reais", mae: "TRANSPORTE", sub: "Aplicativo" },
  { frase: "ônibus 4,40", mae: "TRANSPORTE", sub: "Transporte público" },
  { frase: "metrô 5 reais", mae: "TRANSPORTE", sub: "Transporte público" },
  { frase: "passagem de trem 7 reais", mae: "TRANSPORTE", sub: "Transporte público" },
  { frase: "recarreguei o bilhete único 50 reais", mae: "TRANSPORTE", sub: "Transporte público" },
  { frase: "estacionamento 25", mae: "TRANSPORTE", sub: "Estacionamento" },
  { frase: "zona azul 6 reais", mae: "TRANSPORTE", sub: "Estacionamento" },
  { frase: "pedágio 12 reais", mae: "TRANSPORTE", sub: "Pedágio" },
  { frase: "lava jato 40", mae: "TRANSPORTE", sub: "Manutenção do veículo" },
  { frase: "mecânico 300", mae: "TRANSPORTE", sub: "Manutenção do veículo" },
  { frase: "troquei o pneu 400 reais", mae: "TRANSPORTE", sub: "Manutenção do veículo" },
  { frase: "revisão do carro 900", mae: "TRANSPORTE", sub: "Manutenção do veículo" },
  { frase: "IPVA 1200", mae: "IMPOSTOS", sub: "IPVA" },
  { frase: "licenciamento 160", mae: "IMPOSTOS", sub: "Taxas públicas" },
  { frase: "seguro do carro 250", mae: "OUTROS", sub: "Seguros" },

  // Casa
  { frase: "aluguel 1500", mae: "MORADIA", sub: "Aluguel" },
  { frase: "condomínio 600", mae: "MORADIA", sub: "Condomínio" },
  { frase: "conta de luz 180", mae: "MORADIA", sub: "Luz" },
  { frase: "paguei a água 90", mae: "MORADIA", sub: "Água" },
  { frase: "botijão de gás 120", mae: "MORADIA", sub: "Gás" },
  { frase: "wi-fi 100", mae: "MORADIA", sub: "Internet" },
  { frase: "conta do celular 60", mae: "MORADIA", sub: "Internet" },
  { frase: "recarga 20 reais", mae: "MORADIA", sub: "Internet" },
  { frase: "diarista 150", mae: "MORADIA", sub: "Faxina" },
  { frase: "encanador 200", mae: "MORADIA", sub: "Manutenção" },
  { frase: "eletricista 180", mae: "MORADIA", sub: "Manutenção" },
  { frase: "comprei um sofá 2 mil", mae: "MORADIA", sub: "Manutenção" },
  { frase: "material de construção 500", mae: "MORADIA", sub: "Manutenção" },

  // Saúde
  { frase: "farmácia 45", mae: "SAUDE", sub: "Farmácia" },
  { frase: "remedinho 30 reais", mae: "SAUDE", sub: "Farmácia" },
  { frase: "drogaria 60", mae: "SAUDE", sub: "Farmácia" },
  { frase: "consulta 250", mae: "SAUDE", sub: "Consultas" },
  { frase: "dentista 300", mae: "SAUDE", sub: "Consultas" },
  { frase: "exame de sangue 80", mae: "SAUDE", sub: "Exames" },
  { frase: "convênio 500", mae: "SAUDE", sub: "Plano de saúde" },
  { frase: "psicóloga 200", mae: "SAUDE", sub: "Terapia" },
  { frase: "academia 99 reais", mae: "SAUDE", sub: "Academia" },
  { frase: "pilates 280", mae: "SAUDE", sub: "Academia" },
  { frase: "whey 150", mae: "SAUDE", sub: "Academia" },

  // Educação
  { frase: "mensalidade da faculdade 900", mae: "EDUCACAO", sub: "Mensalidade" },
  { frase: "escola das crianças 1200", mae: "EDUCACAO", sub: "Escola" },
  { frase: "curso de inglês 300", mae: "EDUCACAO", sub: "Cursos" },
  { frase: "livro 50", mae: "EDUCACAO", sub: "Livros/Material" },
  { frase: "material escolar 200", mae: "EDUCACAO", sub: "Livros/Material" },

  // Lazer
  { frase: "cinema 60", mae: "LAZER", sub: "Cinema/Shows" },
  { frase: "ingresso do show 200", mae: "LAZER", sub: "Cinema/Shows" },
  { frase: "hotel 400", mae: "LAZER", sub: "Viagens" },
  { frase: "airbnb 800", mae: "LAZER", sub: "Viagens" },
  { frase: "passagem aérea 1200", mae: "LAZER", sub: "Viagens" },
  { frase: "netflix 55", mae: "LAZER", sub: "Streaming" },
  { frase: "spotify 22", mae: "LAZER", sub: "Streaming" },
  { frase: "presente de aniversário 100", mae: "LAZER", sub: "Presentes" },
  { frase: "balada 120", mae: "LAZER", sub: "Bar/Balada" },
  { frase: "joguinho 30 reais", mae: "LAZER", sub: "Hobbies" },

  // Cuidado pessoal (sem a categoria dela: Outros › Cuidado pessoal)
  { frase: "cortei o cabelo 60", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "manicure 40", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "barbeiro 45", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "comprei um tênis 300", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "calça 120", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "perfume 250", mae: "OUTROS", sub: "Cuidado pessoal" },

  // Pets e filhos (sem a categoria dela: Outros › Pet / Filhos)
  { frase: "ração 150", mae: "OUTROS", sub: "Pet" },
  { frase: "pet shop 80", mae: "OUTROS", sub: "Pet" },
  { frase: "veterinário 200", mae: "OUTROS", sub: "Pet" },
  { frase: "banho e tosa 70", mae: "OUTROS", sub: "Pet" },
  { frase: "fralda 90", mae: "OUTROS", sub: "Filhos" },
  { frase: "babá 300", mae: "OUTROS", sub: "Filhos" },

  // Doações
  { frase: "dízimo 200", mae: "OUTROS", sub: "Doações" },
  { frase: "oferta na igreja 50", mae: "OUTROS", sub: "Doações" },
  { frase: "doação 30", mae: "OUTROS", sub: "Doações" },

  // O reconhecedor escreveu torto
  { frase: "farmasia 30", mae: "SAUDE", sub: "Farmácia" },
  { frase: "estacionamentu 20", mae: "TRANSPORTE", sub: "Estacionamento" },
  { frase: "supermecado 200", mae: "ALIMENTACAO", sub: "Supermercado" },

  // A categoria que ela criou
  { frase: "ração da Mel 150", mae: null, custom: "pets", contexto: PETS },
  { frase: "manicure 40", mae: null, custom: "beleza", contexto: BELEZA },
  { frase: "fralda 90", mae: null, custom: "filhos", contexto: FILHOS },
];

/** Frases sem pista nenhuma: a voz não pode chutar. */
export const NAO_CHUTAR: string[] = [
  "gastei 50 reais",
  "comprei umas coisas 30 reais",
  "paguei 100 pro fulano",
  "gastei 20 com besteira",
  "comprei um negócio de 40",
  "paguei a conta 80",
  "paguei o saldo 100",
  "dei 50 para minha mãe",
  "gastei 25 com a Joana",
  "gastei 60 numa coisa aí",
  "paguei 30 para o Marcelo",
  "gastei 45 na barraca",
  "comprei uma parada de 70",
  "paguei o boleto 200",
  "gastei 90 com o Carlos",
  "paguei 35 na lojinha",
  "comprei umas coisinhas 22",
];

/**
 * Conjunto cego: escrito depois do vocabulário, sem ajustar nada por ele. Mede o quanto a voz
 * entende fala que ninguém previu.
 */
export const FRASES_CEGAS: FraseEsperada[] = [
  { frase: "gastei 32 no almocinho de hoje", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "paguei 9 reais em dois pães de queijo", mae: "ALIMENTACAO", sub: "Padaria" },
  { frase: "comprei uns pastéis 20 reais", mae: "ALIMENTACAO", sub: "Lanche/Café" },
  { frase: "uma breja 12 reais", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "gastei 70 no barzinho com as amigas", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "pedi uma pizza 65 reais", mae: "ALIMENTACAO", sub: "Delivery" },
  { frase: "gastei 300 no rancho do mês", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "paguei 40 no açougue", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "comprei frutas 25 reais", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "50 reais de comida japonesa", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "enchi o tanque 280 reais", mae: "TRANSPORTE", sub: "Combustível" },
  { frase: "gastei 15 no uberzinho", mae: "TRANSPORTE", sub: "Aplicativo" },
  { frase: "busão 4 e 40", mae: "TRANSPORTE", sub: "Transporte público" },
  { frase: "paguei 30 de estacionamento no shopping", mae: "TRANSPORTE", sub: "Estacionamento" },
  { frase: "troca de óleo 180 reais", mae: "TRANSPORTE", sub: "Manutenção do veículo" },
  { frase: "lavei o carro 50 reais", mae: "TRANSPORTE", sub: "Manutenção do veículo" },
  { frase: "multa de trânsito 195", mae: "IMPOSTOS", sub: "Taxas públicas" },
  { frase: "paguei a conta da luz 210 reais", mae: "MORADIA", sub: "Luz" },
  { frase: "paguei a internet 120", mae: "MORADIA", sub: "Internet" },
  { frase: "coloquei crédito no celular 30 reais", mae: "MORADIA", sub: "Internet" },
  { frase: "faxineira 180 reais", mae: "MORADIA", sub: "Faxina" },
  { frase: "paguei o pedreiro 600", mae: "MORADIA", sub: "Manutenção" },
  { frase: "comprei uma geladeira 3 mil", mae: "MORADIA", sub: "Manutenção" },
  { frase: "gastei 80 de remédios", mae: "SAUDE", sub: "Farmácia" },
  { frase: "fui no médico 350 reais", mae: "SAUDE", sub: "Consultas" },
  { frase: "nutricionista 220 reais", mae: "SAUDE", sub: "Consultas" },
  { frase: "paguei a mensalidade da academia 110", mae: "SAUDE", sub: "Academia" },
  { frase: "creatina 90 reais", mae: "SAUDE", sub: "Academia" },
  { frase: "aula de espanhol 150", mae: "EDUCACAO", sub: "Cursos" },
  { frase: "caderno e caneta 45 reais", mae: "EDUCACAO", sub: "Livros/Material" },
  { frase: "ingressos do teatro 160 reais", mae: "LAZER", sub: "Cinema/Shows" },
  { frase: "pousada em Paraty 900", mae: "LAZER", sub: "Viagens" },
  { frase: "disney plus 34 reais", mae: "LAZER", sub: "Streaming" },
  { frase: "comprei um presentinho 40 reais", mae: "LAZER", sub: "Presentes" },
  { frase: "fiz a unha 45 reais", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "comprei uma blusinha 60", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "gastei 35 no barbeiro", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "areia do gato 40 reais", mae: "OUTROS", sub: "Pet" },
  { frase: "vacina do cachorro 120", mae: "OUTROS", sub: "Pet" },
  { frase: "pacote de fraldas 75", mae: "OUTROS", sub: "Filhos" },
  { frase: "dízimo da igreja 150", mae: "OUTROS", sub: "Doações" },
  { frase: "botei gás no fogão 110 reais", mae: "MORADIA", sub: "Gás" },
];

/** Os casos difíceis do casamento: palavra dentro de palavra e expressão que muda o sentido. */
export const CASOS_DIFICEIS: FraseEsperada[] = [
  { frase: "barbeiro 40", mae: "OUTROS", sub: "Cuidado pessoal" },
  { frase: "bar 40", mae: "ALIMENTACAO", sub: "Bar" },
  { frase: "gás 120", mae: "MORADIA", sub: "Gás" },
  { frase: "gasolina 120", mae: "TRANSPORTE", sub: "Combustível" },
  { frase: "pão 8 reais", mae: "ALIMENTACAO", sub: "Padaria" },
  { frase: "pão de açúcar 300", mae: "ALIMENTACAO", sub: "Supermercado" },
  { frase: "cachorro quente 15", mae: "ALIMENTACAO", sub: "Restaurante" },
  { frase: "ração do cachorro 150", mae: "OUTROS", sub: "Pet" },
  { frase: "uber 20", mae: "TRANSPORTE", sub: "Aplicativo" },
  { frase: "uber eats 40", mae: "ALIMENTACAO", sub: "Delivery" },
  { frase: "zona azul 5", mae: "TRANSPORTE", sub: "Estacionamento" },
  { frase: "passagem aérea 900", mae: "LAZER", sub: "Viagens" },
  { frase: "passagem de ônibus 6", mae: "TRANSPORTE", sub: "Transporte público" },
];
