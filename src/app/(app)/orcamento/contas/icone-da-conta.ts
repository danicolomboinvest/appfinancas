import { Building2, CalendarClock, Car, Droplet, Flame, GraduationCap, HeartPulse, Home, type LucideIcon, Shield, Sparkles, Wifi, Zap } from "lucide-react";

const REGRAS: [RegExp, LucideIcon][] = [
  [/aluguel|financiamento|apartamento|\bape\b|\bapê\b|casa/i, Home],
  [/condom/i, Building2],
  [/luz|energia|enel|cemig|copel|light|eletro/i, Zap],
  [/agua|água|sabesp|saneamento/i, Droplet],
  [/\bgas\b|\bgás\b|comg/i, Flame],
  [/internet|fibra|wi-?fi|telefone|celular|vivo|claro|tim\b|oi\b/i, Wifi],
  [/diarista|faxina|limpeza/i, Sparkles],
  [/ipva|carro|licenciamento|estacionamento|garagem/i, Car],
  [/seguro/i, Shield],
  [/escola|curso|faculdade|matr[ií]cula|material/i, GraduationCap],
  [/plano de sa[uú]de|sa[uú]de|academia|dentista/i, HeartPulse],
];

/** O ícone de traço de uma conta pelo nome (quando não há logo da marca). */
export function iconeDaConta(nome: string): LucideIcon {
  return REGRAS.find(([r]) => r.test(nome))?.[1] ?? CalendarClock;
}
