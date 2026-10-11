"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Bell, Check, ChevronRight, CircleHelp, Clock, ExternalLink, Gift, Menu, Mic, Tag, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast-context";
import { getSpeechRecognitionConstructor, joinFinalTranscript } from "@/app/(app)/mensal/VoiceRecorder";
import { lembrarReembolsoAction, pedirAntesDeCancelarAction, registrarMotivoAction } from "@/lib/cancelar/actions";
import { AREAS, MESES_GRATIS, MOTIVOS, PEDIDO_DO_MOTIVO, PRAZO_HORAS, proximaTela, telaInicial, type Motivo, type Tela, type TipoDePedido } from "@/lib/cancelar/regras";

export type DadosDoCancelar = {
  via: "site" | "apple";
  /** "15 de março de 2027" */
  renovaEm: string;
  /** Até 7 dias da compra: "12 de outubro", o último dia para pedir o dinheiro de volta. */
  reembolsoAte: string | null;
  /** O que ainda pode ser oferecido (cada tipo, uma vez a cada 12 meses). */
  disponivel: Record<TipoDePedido, boolean>;
};

/** Os links de cada caminho: a área de compras da Hubla e as assinaturas da Apple. */
const HUBLA = "https://app.hub.la";
const APPLE = "https://apps.apple.com/account/subscriptions";

const ICONE: Record<Motivo, LucideIcon> = { caro: Tag, dificil: CircleHelp, errado: AlertTriangle, naouso: Clock, outro: Menu };
const TINTA = "bg-[color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface))]";
const PRINCIPAL = "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent disabled:opacity-60";
const SEGUNDO = "flex min-h-12 w-full items-center justify-center rounded-full border border-border-strong bg-surface px-5 text-[15px] font-medium text-ink";

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="titulo-tema text-[24px] leading-tight text-ink">{children}</h3>;
}

function Prazo({ children }: { children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm text-ink ${TINTA}`}>
      <Clock size={16} className="shrink-0 text-accent-strong" aria-hidden /> <span>{children}</span>
    </p>
  );
}

/** A dúvida por voz: o mesmo reconhecimento do lançamento por voz. O áudio não sai do aparelho. */
function Ditado({ aoTexto }: { aoTexto: (t: string) => void }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [pode, setPode] = useState(false);
  const rec = useRef<{ stop: () => void } | null>(null);
  useEffect(() => {
    // O navegador só diz se tem o reconhecimento depois de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPode(getSpeechRecognitionConstructor() !== null);
  }, []);
  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [gravando]);
  if (!pode) return null;
  const alternar = () => {
    if (gravando) {
      rec.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => aoTexto(joinFinalTranscript(e.results).trim());
    r.onend = () => setGravando(false);
    r.onerror = () => setGravando(false);
    rec.current = r;
    setSegundos(0);
    setGravando(true);
    r.start();
  };
  return (
    <>
      <div className="flex items-center gap-3 text-[13px] text-ink-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>
      <button type="button" onClick={alternar} aria-pressed={gravando} className={`mx-auto inline-flex min-h-12 items-center gap-2.5 rounded-full border px-4 text-[15px] text-ink ${gravando ? "border-accent" : "border-border"} bg-surface`}>
        <span className="flex size-8 items-center justify-center rounded-full bg-accent-gradient text-on-accent">
          <Mic size={16} aria-hidden />
        </span>
        {gravando ? `Gravando 0:${String(segundos).padStart(2, "0")}, toque para parar` : "Gravar um áudio"}
      </button>
      <p className="text-center text-[13px] text-ink-muted">O áudio vira texto aqui mesmo e não é guardado.</p>
    </>
  );
}

/**
 * "Antes de cancelar", direção B "Folha" (cancelar-proposta.html, escolhida pela Dani em 11/10):
 * uma folha sobre as Configurações. Até 7 dias da compra começa pelo prazo do reembolso; depois,
 * pelo motivo. Cada motivo tem uma ajuda só, e o "Quero cancelar mesmo" está em toda tela, do
 * mesmo tamanho, chegando ao caminho da Hubla em no máximo 2 telas. Quem pagou no iPhone vê só
 * o caminho da Apple.
 */
export function CancelarAssinatura({ dados }: { dados: DadosDoCancelar }) {
  const inicio = telaInicial(dados.via, dados.reembolsoAte !== null);
  const [aberto, setAberto] = useState(false);
  const [tela, setTela] = useState<Tela>(inicio);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [texto, setTexto] = useState("");
  const [area, setArea] = useState<(typeof AREAS)[number] | null>(null);
  const [feito, setFeito] = useState<[string, string] | null>(null);
  const [salvando, iniciar] = useTransition();
  const { showError } = useToast();

  const abrir = () => {
    setTela(inicio);
    setMotivo(null);
    setTexto("");
    setArea(null);
    setFeito(null);
    setAberto(true);
  };
  const ir = (acao: Parameters<typeof proximaTela>[1]) => setTela((t) => proximaTela(t, acao));
  const cancelarMesmo = () => {
    void registrarMotivoAction({ motivo: motivo ?? "sem_motivo", escolha: "foi_cancelar", texto: motivo === "outro" ? texto : undefined });
    ir("cancelar");
  };
  const botaoCancelar = (
    <button type="button" onClick={cancelarMesmo} className={SEGUNDO}>
      Quero cancelar mesmo
    </button>
  );
  const pedir = (m: Motivo, ok: [string, string]) =>
    iniciar(async () => {
      const r = await pedirAntesDeCancelarAction({ motivo: m, texto: texto.trim() || undefined, area: area ?? undefined });
      if (!r.ok) return showError(r.erro);
      setFeito(ok);
      ir("aceitar");
    });

  const titulo = tela === "caminho" ? "Último passo" : tela === "oferta" && motivo ? MOTIVOS.find((x) => x.chave === motivo)!.rotulo : tela === "feito" ? "" : "Cancelar assinatura";
  let corpo: React.ReactNode = null;
  let pe: React.ReactNode = null;

  if (tela === "reembolso" && dados.reembolsoAte) {
    corpo = (
      <>
        <Titulo>Ainda dá tempo</Titulo>
        <div className={`flex flex-col items-center gap-2 rounded-3xl px-4 py-5 text-center ${TINTA}`}>
          <span className="flex size-12 items-center justify-center rounded-full bg-surface text-accent-strong">
            <Bell size={22} aria-hidden />
          </span>
          <p className="text-[15px] text-ink">
            Seu prazo para pedir o dinheiro de volta vai até <b className="font-medium">{dados.reembolsoAte}</b>.
          </p>
          <p className="text-sm text-ink-muted">Use mais uns dias. A gente te manda um e-mail 1 dia antes do prazo acabar.</p>
        </div>
        <button type="button" onClick={() => ir("contar")} className="mx-auto min-h-11 text-sm text-ink underline underline-offset-2">
          Prefiro contar o que aconteceu
        </button>
      </>
    );
    pe = (
      <>
        <button
          type="button"
          disabled={salvando}
          className={PRINCIPAL}
          onClick={() =>
            iniciar(async () => {
              const r = await lembrarReembolsoAction();
              if (!r.ok) return showError(r.erro);
              setFeito(["Lembrete combinado", `Um dia antes de ${dados.reembolsoAte}, chega um e-mail para você decidir com calma.`]);
              ir("aceitar");
            })
          }
        >
          Me avisa
        </button>
        {botaoCancelar}
      </>
    );
  } else if (tela === "motivos") {
    corpo = (
      <>
        <Titulo>O que aconteceu?</Titulo>
        <ul className={`overflow-hidden rounded-3xl ${TINTA}`}>
          {MOTIVOS.map(({ chave, rotulo }) => {
            const Icone = ICONE[chave];
            return (
              <li key={chave} className="border-t border-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] first:border-t-0">
                <button
                  type="button"
                  onClick={() => {
                    setMotivo(chave);
                    setTexto("");
                    setArea(null);
                    ir("escolher");
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent-strong">
                    <Icone size={17} aria-hidden />
                  </span>
                  <span className="flex-1 text-[15px] text-ink">{rotulo}</span>
                  <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
    pe = botaoCancelar;
  } else if (tela === "oferta" && motivo) {
    const disponivel = dados.disponivel[PEDIDO_DO_MOTIVO[motivo]];
    if (!disponivel) {
      corpo = (
        <>
          <Titulo>Já combinamos isso</Titulo>
          <p className="text-sm text-ink-muted">Você usou esta ajuda nos últimos 12 meses. Se precisar de algo, escreva para app@danicolombo.com.br.</p>
        </>
      );
      pe = botaoCancelar;
    } else if (motivo === "caro") {
      corpo = (
        <>
          <Titulo>Ganhe um tempo a mais</Titulo>
          <p className="text-sm text-ink-muted">A renovação anda para frente, sem cobrança agora.</p>
          <div className={`flex flex-col items-center gap-1 rounded-3xl px-4 py-5 text-center ${TINTA}`}>
            <Gift size={22} className="text-accent-strong" aria-hidden />
            <p className="titulo-tema text-[30px] leading-tight text-accent-strong">{MESES_GRATIS} meses</p>
            <p className="text-sm text-ink">grátis, somados ao seu plano</p>
          </div>
          <Prazo>A gente acrescenta {MESES_GRATIS} meses na sua assinatura em até {PRAZO_HORAS} horas.</Prazo>
        </>
      );
      pe = (
        <>
          <button type="button" disabled={salvando} className={PRINCIPAL} onClick={() => pedir("caro", ["Guardado", `A gente acrescenta ${MESES_GRATIS} meses na sua assinatura em até ${PRAZO_HORAS} horas. A confirmação chega no seu e-mail.`])}>
            Quero os meses
          </button>
          {botaoCancelar}
        </>
      );
    } else if (motivo === "dificil") {
      corpo = (
        <>
          <Titulo>Manda sua dúvida</Titulo>
          <p className="text-sm text-ink-muted">Quem responde é a equipe do SPI.</p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Sua dúvida" placeholder="Escreva aqui o que travou" rows={4} maxLength={4000} className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-accent" />
          <Ditado aoTexto={(t) => setTexto((x) => (x ? `${x} ${t}` : t))} />
          <Prazo>A resposta chega no seu e-mail, vinda de app@danicolombo.com.br.</Prazo>
        </>
      );
      pe = (
        <>
          <button type="button" disabled={salvando || !texto.trim()} className={PRINCIPAL} onClick={() => pedir("dificil", ["Dúvida enviada", "A resposta chega no seu e-mail. Sua assinatura segue igual."])}>
            Enviar dúvida
          </button>
          {botaoCancelar}
        </>
      );
    } else if (motivo === "errado") {
      corpo = (
        <>
          <Titulo>O que não está certo?</Titulo>
          <p className="text-sm text-ink-muted">Toque onde está o número estranho.</p>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(area === a ? null : a)} className={`min-h-10 rounded-full border px-4 text-sm ${area === a ? "border-accent bg-accent-soft text-accent-strong" : "border-border bg-surface text-ink"}`}>
                {a}
              </button>
            ))}
          </div>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="O que você esperava ver" placeholder="Qual valor você esperava ver?" rows={3} maxLength={4000} className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-accent" />
          <Prazo>A equipe confere e corrige em até {PRAZO_HORAS} horas.</Prazo>
        </>
      );
      pe = (
        <>
          <button type="button" disabled={salvando || !texto.trim()} className={PRINCIPAL} onClick={() => pedir("errado", ["Contestação recebida", `A equipe confere e corrige em até ${PRAZO_HORAS} horas. Você recebe um aviso no seu e-mail quando o número estiver certo.`])}>
            Contestar
          </button>
          {botaoCancelar}
        </>
      );
    } else if (motivo === "naouso") {
      corpo = (
        <>
          <Titulo>Sem pressa para decidir</Titulo>
          <p className="text-sm text-ink-muted">Seu acesso vai até {dados.renovaEm}, e nada é cobrado antes.</p>
          <div className={`flex flex-col items-center gap-2 rounded-3xl px-4 py-5 text-center ${TINTA}`}>
            <span className="flex size-12 items-center justify-center rounded-full bg-surface text-accent-strong">
              <Bell size={22} aria-hidden />
            </span>
            <p className="text-[15px] font-medium text-ink">Um aviso por e-mail 7 dias antes da renovação</p>
            <p className="text-sm text-ink-muted">Aí você decide com calma, perto da data.</p>
          </div>
        </>
      );
      pe = (
        <>
          <button type="button" disabled={salvando} className={PRINCIPAL} onClick={() => pedir("naouso", ["Aviso combinado", `Sete dias antes de ${dados.renovaEm}, chega um e-mail para você decidir.`])}>
            Quero o aviso
          </button>
          {botaoCancelar}
        </>
      );
    } else {
      corpo = (
        <>
          <Titulo>Conta pra gente</Titulo>
          <p className="text-sm text-ink-muted">Opcional. Ajuda a melhorar o app.</p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="O motivo" placeholder="O que fez você querer sair?" rows={4} maxLength={2000} className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-accent" />
        </>
      );
      pe = (
        <>
          <button type="button" onClick={cancelarMesmo} className={PRINCIPAL}>
            Continuar para cancelar
          </button>
          <button type="button" disabled={salvando} className={SEGUNDO} onClick={() => pedir("outro", ["Mensagem enviada", "A equipe responde no seu e-mail."])}>
            Prefiro falar com a equipe
          </button>
        </>
      );
    }
  } else if (tela === "feito" && feito) {
    corpo = (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Check size={28} aria-hidden />
        </span>
        <Titulo>{feito[0]}</Titulo>
        <p className="text-sm text-ink-muted">{feito[1]}</p>
      </div>
    );
    pe = (
      <>
        <button type="button" className={PRINCIPAL} onClick={() => setAberto(false)}>
          Voltar ao app
        </button>
        {botaoCancelar}
      </>
    );
  } else if (tela === "caminho") {
    const fica = [`Acesso a tudo até ${dados.renovaEm}`, "Nenhuma nova cobrança", "Dá para voltar quando quiser"];
    const site = dados.via === "site";
    corpo = (
      <>
        <Titulo>{site ? "Cancelar a renovação" : "Cancelar na Apple"}</Titulo>
        <p className="text-sm text-ink-muted">{site ? "O pagamento foi pela Hubla, então o cancelamento é lá." : "Você assinou pelo iPhone, então quem cancela é a Apple."}</p>
        <ul className={`rounded-3xl px-4 ${TINTA}`}>
          {fica.map((f) => (
            <li key={f} className="flex min-h-12 items-center gap-3 border-t border-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[15px] text-ink first:border-t-0">
              <Check size={16} className="shrink-0 text-accent-strong" aria-hidden /> {f}
            </li>
          ))}
        </ul>
        {site ? (
          <>
            <ol className={`rounded-3xl px-4 ${TINTA}`}>
              {["Entre com o e-mail da compra", "Abra suas assinaturas", "Toque em Cancelar assinatura"].map((p, i) => (
                <li key={p} className="flex min-h-12 items-center gap-3 border-t border-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[15px] text-ink first:border-t-0">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] text-accent-strong">{i + 1}</span> {p}
                </li>
              ))}
            </ol>
            <p className="text-center text-[13px] text-ink-muted">
              {dados.reembolsoAte
                ? `A Hubla manda o comprovante no seu e-mail. Até ${dados.reembolsoAte} dá para pedir o dinheiro de volta por lá.`
                : "A Hubla manda o comprovante no seu e-mail. Passados os 7 dias da compra, não há devolução: cancelar só impede a próxima renovação."}
            </p>
          </>
        ) : (
          <p className="text-center text-[13px] text-ink-muted">Em Ajustes do iPhone, toque no seu nome e depois em Assinaturas.</p>
        )}
      </>
    );
    pe = (
      <>
        <a
          href={site ? HUBLA : APPLE}
          target="_blank"
          rel="noopener"
          onClick={() => void registrarMotivoAction({ motivo: motivo ?? "sem_motivo", escolha: site ? "abriu_hubla" : "abriu_apple" })}
          className={PRINCIPAL}
        >
          <ExternalLink size={16} aria-hidden /> {site ? "Abrir a Hubla" : "Abrir assinaturas da Apple"}
        </a>
        <button type="button" className={SEGUNDO} onClick={() => setAberto(false)}>
          Voltar ao app
        </button>
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={abrir} className="mx-auto min-h-11 px-3 text-[13px] text-ink-muted underline-offset-2 hover:underline">
        Cancelar assinatura
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={titulo}>
        <div className="flex flex-col gap-4">
          {corpo}
          <div className="mt-1 flex flex-col gap-2.5">{pe}</div>
        </div>
      </Modal>
    </>
  );
}
