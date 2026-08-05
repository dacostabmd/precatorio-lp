'use client';

import React, { CSSProperties } from 'react';
import { Tabs, Button, Paper, Loader, Progress } from '@mantine/core';
import {
  analisarOficio,
  calcularAntecipacao,
  DEMO_OFICIO,
  DOCS_NECESSARIOS,
  formatBRL,
  MOCK_DOC,
  REVIEWS,
  type Analise,
} from '@/lib/data';
import { Persona } from '@/lib/calculator';

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------
type Stage =
  | 'qualify'
  | 'lead'
  | 'upload'
  | 'analyzing'
  | 'confirm'
  | 'calculating'
  | 'decision'
  | 'documents'
  | 'schedule'
  | 'done'
  | 'consultant'
  | 'revision';

let msgId = 0;
const aiText = (text: string): any => ({
  id: ++msgId,
  from: 'ai',
  kind: 'text',
  text,
  revealStart: performance.now(),
  revealed: 0,
});
// `noAnim` skips the fadeUp entrance — used when the message is committed by a
// flying bubble that already landed exactly where the bubble will render.
const userText = (text: string, noAnim = false): any => ({ id: ++msgId, from: 'user', kind: 'text', text, noAnim });
const aiTyping = (): any => ({ id: ++msgId, from: 'ai', kind: 'typing' });
const aiCard = (kind: string, extra: any): any => ({ id: ++msgId, from: 'ai', kind, ...extra });
const aiProcessing = (): any => ({ id: ++msgId, from: 'ai', kind: 'processing', stepIdx: 0 });

// Rótulos exibidos no card de "processando" enquanto a API responde — puramente
// cosméticos (não refletem chamadas reais além da requisição única ao /api/chat),
// mas dão ao usuário a sensação de progresso real durante a espera.
const PROCESSING_STEPS = [
  'Lendo o documento enviado…',
  'Extraindo dados do ofício…',
  'Aplicando atualização monetária…',
  'Calculando a proposta indicativa…',
];

const WELCOME =
  'Olá! Sou a IA da Premium Office Precatório. Vou te ajudar a entender, com clareza e segurança, a avaliação do seu precatório. Para começar, me conta rapidamente qual é a sua relação com o crédito:';

const ANALYSIS_STEPS = [
  {
    title: 'Envio do ofício',
    desc: 'O documento que você já tem em mãos é suficiente. Envie o PDF em ambiente seguro e protegido pela LGPD — sem filas, sem formulários e sem compromisso.',
  },
  {
    title: 'Análise da IA',
    desc: 'Em segundos, a IA lê o ofício e extrai credor, tribunal, ente devedor, natureza e valores para calcular sua proposta com precisão.',
  },
  {
    title: 'Proposta indicativa',
    desc: 'Com os dados confirmados, aplicamos as tabelas vigentes sobre o líquido real do seu crédito e apresentamos a faixa de valores da proposta.',
  },
  {
    title: 'Reunião com consultor',
    desc: 'Um especialista valida a análise juridicamente e apresenta a proposta oficial. Você decide com total clareza, no seu tempo — sem pressão e sem custo.',
  },
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// A fórmula de atualização monetária vigente superestima o valor devido em ~2x
// (juros de mora somados à SELIC + SELIC como taxa fixa) — ver CALCULO.md §3.
// Até a metodologia por trecho entrar, a LP segue lendo o ofício, captando o
// lead e anexando o documento ao Bitrix, mas NÃO exibe valores em reais ao
// usuário: uma proposta inflada é pior que nenhuma proposta.
// Reativar (junto com a nova fórmula validada) trocando para true.
const EXIBIR_VALORES_CALCULADOS = false;

const CHARS_PER_MS = 1 / 14;

// Bubble styles (ported 1:1 from the prototype) --------------------------------
const AI_BUBBLE: CSSProperties = {
  maxWidth: '82%',
  background: '#fff',
  border: '1px solid #EAEDF2',
  color: '#2B3346',
  padding: '12px 14px',
  borderRadius: '14px',
  borderTopLeftRadius: '3px',
  fontSize: '13.5px',
  lineHeight: 1.55,
  boxShadow: '0 8px 20px -6px rgba(11,27,51,0.16), 0 2px 6px rgba(11,27,51,0.06)',
};
const USER_BUBBLE: CSSProperties = {
  maxWidth: '82%',
  background: '#0B1B33',
  color: '#fff',
  padding: '12px 14px',
  borderRadius: '14px',
  borderTopRightRadius: '3px',
  fontSize: '13.5px',
  lineHeight: 1.55,
  fontWeight: 600,
  boxShadow: '0 8px 20px -6px rgba(11,27,51,0.28), 0 2px 6px rgba(11,27,51,0.1)',
};
const CARD_BUBBLE: CSSProperties = { ...AI_BUBBLE, maxWidth: '92%', padding: '16px' };
const AI_WRAP: CSSProperties = { display: 'flex', justifyContent: 'flex-start', position: 'relative', zIndex: 1, animation: 'aiIn 0.45s cubic-bezier(0.4,0,0.2,1)' };
const USER_WRAP: CSSProperties = { display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 1, animation: 'fadeUp 0.4s cubic-bezier(0.4,0,0.2,1)' };

const waNumber = '5521986450262';
const waMessage = encodeURIComponent('Olá! Estou analisando meu precatório na Premium Office.');
const whatsappLink = `https://wa.me/${waNumber}?text=${waMessage}`;

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Anima um valor monetário de R$ 0 até `target` — usado nos cards de resultado
// para dar a sensação de que o cálculo está "acontecendo" diante do usuário.
function CountUpValue({ target, durationMs = 900 }: { target: number; durationMs?: number }) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currencyFormatter.format(value)}</span>;
}

interface State {
  stage: Stage;
  messages: any[];
  activeTab: 'chat' | 'quick';
  perfilExiting: boolean;
  quickStage: 'idle' | 'analyzing' | 'result';
  quickAnalysis: Analise | null;
  flyingBubble: any | null;
  composerText: string;
  persona: Persona;
  leadNome: string;
  leadCelular: string;
  leadSubmitting: boolean;
  leadError: string | null;
  bitrixDealId: number | null;
  pendingDocs: File[];
  docsUploading: boolean;
  docsError: string | null;
}

export interface ChatSectionProps {
  embedOnly?: boolean;
  transparent?: boolean;
  fontSize?: string;
  textSize?: string;
  btnSize?: string;
  buttonSize?: string;
  scale?: string;
}

export default class ChatSection extends React.Component<ChatSectionProps, State> {
  chatRef = React.createRef<HTMLDivElement>();
  dropzoneRef = React.createRef<HTMLLabelElement>();
  quickDropRef = React.createRef<HTMLLabelElement>();
  revealRAF: number | null = null;
  revealLoopRunning = false;
  processingTimer: ReturnType<typeof setInterval> | null = null;

  state: State = {
    stage: 'qualify',
    messages: [aiText(WELCOME)],
    activeTab: 'chat',
    perfilExiting: false,
    quickStage: 'idle',
    quickAnalysis: null,
    flyingBubble: null,
    composerText: '',
    persona: 'autor',
    leadNome: '',
    leadCelular: '',
    leadSubmitting: false,
    leadError: null,
    bitrixDealId: null,
    pendingDocs: [],
    docsUploading: false,
    docsError: null,
  };

  componentDidMount() {
    this.startRevealLoop();
  }

  componentDidUpdate() {
    if (this.chatRef.current) {
      this.chatRef.current.scrollTop = this.chatRef.current.scrollHeight;
    }
  }

  componentWillUnmount() {
    if (this.revealRAF) {
      cancelAnimationFrame(this.revealRAF);
      this.revealRAF = null;
    }
    this.revealLoopRunning = false;
    this.stopProcessingCycle();
  }

  startProcessingCycle = () => {
    this.stopProcessingCycle();
    this.processingTimer = setInterval(() => {
      this.setState((s) => ({
        messages: s.messages.map((m) =>
          m.kind === 'processing' ? { ...m, stepIdx: Math.min(m.stepIdx + 1, PROCESSING_STEPS.length - 1) } : m
        ),
      }));
    }, 1400);
  };

  stopProcessingCycle = () => {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  };

  startRevealLoop = () => {
    if (this.revealLoopRunning) return;
    this.revealLoopRunning = true;
    const tick = () => {
      const now = performance.now();
      this.setState(
        (s) => {
          let changed = false;
          const messages = s.messages.map((m) => {
            if (m.from === 'ai' && m.kind === 'text' && m.revealed < m.text.length) {
              const count = Math.min(m.text.length, Math.floor((now - m.revealStart) * CHARS_PER_MS));
              if (count > m.revealed) {
                changed = true;
                return { ...m, revealed: count };
              }
            }
            return m;
          });
          return (changed ? { messages } : null) as any;
        },
        () => {
          const stillActive = this.state.messages.some(
            (m) => m.from === 'ai' && m.kind === 'text' && m.revealed < m.text.length
          );
          if (stillActive) {
            this.revealRAF = requestAnimationFrame(tick);
          } else {
            this.revealRAF = null;
            this.revealLoopRunning = false;
          }
        }
      );
    };
    this.revealRAF = requestAnimationFrame(tick);
  };

  pushMessages = (...msgs: any[]) => {
    this.setState((s) => ({ messages: [...s.messages, ...msgs] }));
    if (msgs.some((m) => m.from === 'ai' && m.kind === 'text')) this.startRevealLoop();
  };

  flyBubble = (label: string, targetEl: HTMLElement | null, commitFn: () => void) => {
    const container = this.chatRef.current;
    if (!targetEl || !container) {
      commitFn();
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const btnRect = targetEl.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const startLeft = btnRect.left - containerRect.left;
    const startTop = btnRect.top - containerRect.top + scrollTop;
    // Measure the exact box the committed bubble will occupy (same metrics as
    // USER_BUBBLE inside the p-6 container) so the flight lands pixel-perfect
    // and the text never re-wraps when the real message replaces the bubble.
    const contentWidth = container.clientWidth - 48;
    const probe = document.createElement('div');
    Object.assign(probe.style, {
      position: 'absolute',
      visibility: 'hidden',
      left: '-9999px',
      top: '0',
      width: 'max-content',
      maxWidth: contentWidth * 0.82 + 'px',
      boxSizing: 'border-box',
      padding: '12px 14px',
      fontSize: '13.5px',
      lineHeight: '1.55',
      fontWeight: '600',
    });
    probe.textContent = label;
    container.appendChild(probe);
    const probeRect = probe.getBoundingClientRect();
    const endWidth = probeRect.width;
    const endHeight = probeRect.height;
    container.removeChild(probe);
    const endLeft = container.clientWidth - endWidth - 24;
    const msgEls = [...container.children].filter((c) => getComputedStyle(c as Element).position !== 'absolute');
    const lastMsg = msgEls[msgEls.length - 1];
    const lastRect = lastMsg ? (lastMsg as Element).getBoundingClientRect() : null;
    const endTopFinal = lastRect ? lastRect.bottom - containerRect.top + scrollTop + 16 : startTop;

    this.setState({
      flyingBubble: {
        label,
        left: startLeft,
        top: startTop,
        width: btnRect.width,
        height: btnRect.height,
        endLeft,
        endTop: endTopFinal,
        endWidth,
        endHeight,
        phase: 'start',
      },
    });

    requestAnimationFrame(() => {
      this.setState((s) => (s.flyingBubble ? ({ flyingBubble: { ...s.flyingBubble, phase: 'end' } } as any) : null));
    });

    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });

    setTimeout(() => {
      commitFn();
      this.setState({ flyingBubble: null });
      requestAnimationFrame(() => {
        if (this.chatRef.current) this.chatRef.current.scrollTo({ top: this.chatRef.current.scrollHeight, behavior: 'smooth' });
      });
    }, 700);
  };

  onSelectTab = (tab: 'chat' | 'quick') => this.setState({ activeTab: tab });

  onSelectPerfil = (label: string) => {
    let p: Persona = 'autor';
    if (label.toLowerCase().includes('advogado')) p = 'advogado';
    if (label.toLowerCase().includes('associado') || label.toLowerCase().includes('broker')) p = 'broker';

    this.pushMessages(
      userText(label, true),
      aiText('Perfeito! Para liberar sua calculadora personalizada, preciso só do seu nome completo e um número de celular para contato.')
    );
    this.setState({ stage: 'lead', persona: p });
  };

  onSelectPerfilClick = (label: string, e: React.MouseEvent) => {
    this.setState({ perfilExiting: true });
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.onSelectPerfil(label);
      this.setState({ perfilExiting: false });
    });
  };

  runAnalysis = async (fileLabel: string, fileObj?: File) => {
    this.pushMessages(userText(`Documento enviado: ${fileLabel}`, true), aiProcessing());
    this.setState({ stage: 'analyzing' });
    this.startProcessingCycle();

    try {
      let fileBase64 = '';
      let mimeType = 'text/plain';

      if (fileObj) {
        mimeType = fileObj.type || 'application/octet-stream';
        const buffer = await fileObj.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString('base64');
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Analise o documento ${fileLabel} para a persona ${this.state.persona}` }],
          persona: this.state.persona,
          fileBase64: fileBase64 || undefined,
          mimeType: fileBase64 ? mimeType : undefined,
          fileName: fileLabel,
          bitrixDealId: this.state.bitrixDealId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro na análise');
      }

      const data = await res.json();
      this.stopProcessingCycle();

      const validacao = data.validacao;
      const extractItems = this.buildExtractItems(
        data.extraido,
        validacao,
        data.preferencia,
        data.mesesRra
      );
      const calcItems =
        EXIBIR_VALORES_CALCULADOS && data.resultado ? this.buildCalcItems(data.resultado) : null;
      const precisaConferir = !!validacao?.exigeConfirmacao;

      const suspeitos: string[] = validacao?.camposSuspeitos || [];
      const mensagemFinal = !EXIBIR_VALORES_CALCULADOS
        ? 'Recebemos e registramos seu ofício com segurança. Os dados acima foram lidos diretamente do documento. A avaliação final é conferida por um dos nossos especialistas antes de ir para você — assim o valor que apresentamos é exato, e não uma estimativa automática. Um consultor entra em contato em breve com a proposta.'
        : suspeitos.length
          ? 'Atenção: alguns dados acima não pudemos confirmar diretamente no texto do documento (marcados como "conferir"). Antes de seguir, confirme se estão corretos — nosso consultor também valida isso com você.'
          : !data.extraido?.credor
            ? 'Não conseguimos identificar o nome do credor neste ofício — isso não impede a estimativa, mas nosso consultor vai confirmar esse dado com você.'
            : 'Análise concluída! Veja acima os dados lidos do ofício e a proposta indicativa.';

      this.setState(
        (s) => ({
          messages: [
            ...s.messages.filter((m) => m.kind !== 'processing'),
            ...(extractItems ? [aiCard('extract-card', { items: extractItems })] : []),
            ...(calcItems
              ? [aiCard('calc-card', { items: calcItems, animateIn: true, provisorio: precisaConferir })]
              : []),
            aiText(mensagemFinal),
          ],
          stage: 'decision',
        }),
        () => {
          this.startRevealLoop();
        }
      );
    } catch (err: any) {
      console.error(err);
      this.stopProcessingCycle();
      const mensagem =
        err?.message && err.message !== 'Erro na análise'
          ? err.message
          : 'Ocorreu um erro ao processar o documento com a IA. Tente novamente em instantes.';
      this.setState(
        (s) => ({
          messages: [
            ...s.messages.filter((m) => m.kind !== 'processing'),
            aiText(mensagem),
          ],
          stage: 'upload',
        }),
        () => {
          this.startRevealLoop();
        }
      );
    }
  };

  // Cada linha carrega a ORIGEM do dado: 'lido' (extraído do documento),
  // 'ausente' (não localizado) ou 'suspeito' (extraído mas não confirmado no
  // texto-fonte). Sem isso o usuário não consegue distinguir leitura de
  // suposição — foi exatamente o que gerou dados fantasma na tela.
  buildExtractItems = (extraido: any, validacao?: any, preferencia?: any, mesesRra?: number) => {
    if (!extraido) return null;
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const faltando: string[] = validacao?.camposFaltando || [];
    const suspeitos: string[] = validacao?.camposSuspeitos || [];
    const assumidos: string[] = validacao?.camposAssumidos || [];

    const statusDe = (campo: string) =>
      suspeitos.includes(campo)
        ? 'suspeito'
        : faltando.includes(campo) || assumidos.includes(campo)
          ? 'ausente'
          : 'lido';

    const itens: any[] = [
      { label: 'Credor', value: extraido.credor || 'Não identificado no ofício', status: statusDe('credor') },
      {
        label: 'Ente devedor / Tribunal',
        value: extraido.enteDevedor || extraido.tribunal || 'Não identificado no ofício',
        status: extraido.enteDevedor || extraido.tribunal ? 'lido' : 'ausente',
      },
      {
        label: 'Natureza / LOA',
        value: `${extraido.natureza || 'Alimentar'} · LOA ${extraido.loa || '—'}`,
        status: statusDe('natureza') === 'lido' && statusDe('loa') === 'lido' ? 'lido' : 'ausente',
      },
      {
        label: 'Valor bruto original',
        value: typeof extraido.brutoOriginal === 'number' ? formatter.format(extraido.brutoOriginal) : '—',
        status: statusDe('brutoOriginal'),
      },
      {
        label: 'Data-base',
        value: extraido.dataBase || '—',
        status: statusDe('dataBase'),
      },
    ];

    if (typeof extraido.principalTributavel === 'number' && extraido.principalTributavel > 0) {
      itens.push({
        label: 'Valor principal',
        value: formatter.format(extraido.principalTributavel),
        status: 'lido',
      });
    }
    if (typeof extraido.valorJuros === 'number' && extraido.valorJuros > 0) {
      itens.push({ label: 'Valor juros', value: formatter.format(extraido.valorJuros), status: 'lido' });
    }
    if (typeof extraido.pssOriginal === 'number' && extraido.pssOriginal > 0) {
      itens.push({
        label: 'Desconto previdenciário',
        value: formatter.format(extraido.pssOriginal),
        status: 'lido',
      });
    }
    if (mesesRra && mesesRra > 0) {
      itens.push({ label: 'Período de competência', value: `${mesesRra} meses`, status: 'lido' });
    }
    // Preferência do art. 100, §2º, CF — vantagem concreta do credor, vale
    // destacar no card mesmo antes de influenciar a tabela comercial.
    if (preferencia?.temPreferencia) {
      itens.push({
        label: 'Preferência legal',
        value: preferencia.motivos.join(', '),
        status: 'destaque',
      });
    }

    return itens;
  };

  buildCalcItems = (resultado: any) => {
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    return [
      { label: 'Valor atualizado (juros + SELIC)', value: formatter.format(resultado.brutoAtualizado || 0), target: resultado.brutoAtualizado || 0 },
      { label: 'Líquido final do credor', value: formatter.format(resultado.liquidoFinal || 0), target: resultado.liquidoFinal || 0 },
      {
        label: 'Faixa de proposta indicativa',
        value: `${formatter.format(resultado.propostaInicial || 0)} a ${formatter.format(resultado.limiteInterno || 0)}`,
      },
    ];
  };

  onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      this.pushMessages(aiText('Formato não suportado. Envie o ofício em PDF, JPG, PNG ou WEBP.'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.pushMessages(aiText('Arquivo muito grande. O tamanho máximo permitido é 10 MB.'));
      return;
    }

    const label = file.name;
    this.flyBubble(`Documento enviado: ${label}`, this.dropzoneRef.current, () => this.runAnalysis(label, file));
  };

  onLeadNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ leadNome: e.target.value, leadError: null });
  };

  onLeadCelularChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    this.setState({ leadCelular: formatted, leadError: null });
  };

  onLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeCompleto = this.state.leadNome.trim();
    const celular = this.state.leadCelular.trim();

    if (nomeCompleto.length < 3) {
      this.setState({ leadError: 'Informe seu nome completo.' });
      return;
    }
    if (celular.replace(/\D/g, '').length < 10) {
      this.setState({ leadError: 'Informe um celular válido com DDD.' });
      return;
    }

    this.setState({ leadSubmitting: true, leadError: null });

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeCompleto, celular, persona: this.state.persona }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Não foi possível registrar seus dados.');
      }

      const data = await res.json().catch(() => ({}));

      this.pushMessages(
        userText(`${nomeCompleto} · ${celular}`, true),
        aiText('Obrigado! Agora envie o arquivo do ofício (PDF/Imagem) para liberar sua análise personalizada.')
      );
      this.setState({ stage: 'upload', leadSubmitting: false, bitrixDealId: data.leadId || null });
    } catch (err: any) {
      this.setState({ leadSubmitting: false, leadError: err.message || 'Erro ao enviar seus dados. Tente novamente.' });
    }
  };

  onCorrigirDados = (e: React.MouseEvent) => {
    this.flyBubble('Corrigir dados', e.currentTarget as HTMLElement, () => {
      this.pushMessages(
        userText('Corrigir dados', true),
        aiText('Sem problemas. Encaminhei o documento para revisão manual da nossa equipe, que entrará em contato para ajustar os dados.')
      );
      this.setState({ stage: 'revision' });
    });
  };

  onConfirmarDados = (e: React.MouseEvent) => {
    this.flyBubble('Dados confirmados', e.currentTarget as HTMLElement, () => this.confirmarDadosCommit());
  };

  confirmarDadosCommit = () => {
    this.pushMessages(userText('Dados confirmados', true), aiTyping());
    this.setState({ stage: 'calculating' });
    setTimeout(() => {
      const valorAtualizado = MOCK_DOC.valorPrincipal * 1.09;
      const projecaoFutura = valorAtualizado * 1.28;
      const { valorMinimo, valorMaximo } = calcularAntecipacao(valorAtualizado, MOCK_DOC.esfera, MOCK_DOC.uf, false);
      const items = [
        { label: 'Valor atualizado hoje', value: formatBRL(valorAtualizado) },
        { label: 'Projeção futura (cenário 3 anos)', value: formatBRL(projecaoFutura) },
        { label: 'Proposta indicativa de antecipação', value: `${formatBRL(valorMinimo)} – ${formatBRL(valorMaximo)}` },
      ];
      this.setState((s) => ({
        messages: [
          ...s.messages.filter((m) => m.kind !== 'typing'),
          aiCard('calc-card', { items }),
          aiText('Como você gostaria de prosseguir?'),
        ],
        stage: 'decision',
      }));
      this.startRevealLoop();
    }, 2000);
  };

  runQuickAnalysis = () => {
    this.setState({ quickStage: 'analyzing' });
    setTimeout(() => {
      this.setState({ quickStage: 'result', quickAnalysis: analisarOficio(DEMO_OFICIO) });
    }, 1800);
  };
  onQuickFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.runQuickAnalysis();
  };
  onQuickReset = () => this.setState({ quickStage: 'idle', quickAnalysis: null });

  onAceitar = (e: React.MouseEvent) => {
    this.flyBubble('Aceitar proposta', e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText('Aceitar proposta', true), aiCard('doc-list', { items: DOCS_NECESSARIOS.map((d) => ({ label: d })) }));
      this.setState({ stage: 'documents' });
    });
  };

  onDocFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const aceitos: File[] = [];
    const motivos: string[] = [];
    for (const file of files) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        motivos.push(`${file.name}: formato não suportado`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        motivos.push(`${file.name}: maior que 10 MB`);
        continue;
      }
      aceitos.push(file);
    }

    this.setState((s) => ({
      pendingDocs: [...s.pendingDocs, ...aceitos],
      docsError: motivos.length ? motivos.join(' · ') : null,
    }));
  };

  onRemovePendingDoc = (index: number) => {
    this.setState((s) => ({ pendingDocs: s.pendingDocs.filter((_, i) => i !== index) }));
  };

  onEnviarDocumentos = async (e: React.MouseEvent) => {
    const arquivos = this.state.pendingDocs;
    if (arquivos.length === 0) {
      this.setState({ docsError: 'Selecione ao menos um documento antes de enviar.' });
      return;
    }

    this.setState({ docsUploading: true, docsError: null });

    try {
      const arquivosBase64 = await Promise.all(
        arquivos.map(async (file) => ({
          fileName: file.name,
          fileBase64: Buffer.from(await file.arrayBuffer()).toString('base64'),
        }))
      );

      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bitrixDealId: this.state.bitrixDealId || undefined,
          arquivos: arquivosBase64,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Não foi possível enviar os documentos.');
      }

      this.setState({ docsUploading: false, pendingDocs: [] });

      this.flyBubble(`Documentos enviados (${arquivos.length})`, e.currentTarget as HTMLElement, () => {
        this.pushMessages(
          userText(`Documentos enviados (${arquivos.length})`, true),
          aiText('Documentos recebidos! Vamos agendar uma reunião com um consultor especializado. Escolha um horário:')
        );
        this.setState({ stage: 'schedule' });
      });
    } catch (err: any) {
      this.setState({
        docsUploading: false,
        docsError: err?.message || 'Erro ao enviar documentos. Tente novamente.',
      });
    }
  };

  onSelectSlot = (label: string, e: React.MouseEvent) => {
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText(label, true), aiText('Combinado! Reunião confirmada.'), aiCard('meeting-card', { slot: label }));
      this.setState({ stage: 'done' });
    });
  };

  onFalarConsultor = (e: React.MouseEvent) => {
    this.flyBubble('Falar com consultor', e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText('Falar com consultor', true), aiText('Sem problemas! Um consultor humano pode te atender agora mesmo pelo WhatsApp.'));
      this.setState({ stage: 'consultant' });
    });
  };

  onSolicitarRevisao = (e: React.MouseEvent) => {
    this.flyBubble('Solicitar revisão', e.currentTarget as HTMLElement, () => {
      this.pushMessages(
        userText('Solicitar revisão', true),
        aiText('Entendido. Seus dados serão encaminhados para revisão manual da nossa equipe jurídica e financeira antes de qualquer proposta.')
      );
      this.setState({ stage: 'revision' });
    });
  };

  onEnviarOutro = (e: React.MouseEvent) => {
    this.flyBubble('Enviar outro ofício', e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText('Enviar outro ofício', true), aiText('Sem problemas, envie o novo documento.'));
      this.setState({ stage: 'upload' });
    });
  };

  onRestart = () => {
    this.setState({
      stage: 'qualify',
      messages: [aiText(WELCOME)],
      perfilExiting: false,
      flyingBubble: null,
      composerText: '',
    });
    this.startRevealLoop();
  };

  onComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ composerText: e.target.value });
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  };

  onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.onComposerSend();
    }
  };

  onComposerSend = async () => {
    const text = this.state.composerText.trim();
    if (!text) return;
    this.setState({ composerText: '' });

    // Prepara o histórico ANTES de adicionar o indicador de typing
    const historyForApi = this.state.messages
      .filter((m) => m.kind === 'text')
      .map((m) => ({
        role: m.from === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));
    historyForApi.push({ role: 'user', content: text });

    this.pushMessages(userText(text), aiTyping());

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          persona: this.state.persona,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha na resposta da API');
      }

      const data = await res.json();

      this.setState(
        (s) => ({
          messages: [
            ...s.messages.filter((m) => m.kind !== 'typing'),
            aiText(data.text || 'A API respondeu, mas não encontrei o texto da resposta.'),
          ],
        }),
        () => {
          this.startRevealLoop();
        }
      );
    } catch (error: any) {
      console.error(error);
      const mensagem =
        error?.message && error.message !== 'Falha na resposta da API'
          ? error.message
          : 'Desculpe, ocorreu um erro de conexão com a IA.';
      this.setState(
        (s) => ({
          messages: [
            ...s.messages.filter((m) => m.kind !== 'typing'),
            aiText(mensagem),
          ],
        }),
        () => {
          this.startRevealLoop();
        }
      );
    }
  };

  // -------------------------------------------------------------------------
  renderTabs() {
    const { activeTab } = this.state;
    return (
      <Tabs
        value={activeTab}
        onChange={(value) => this.onSelectTab((value as 'chat' | 'quick') ?? 'chat')}
        variant="default"
        color="dark"
        styles={{
          list: { borderBottom: '1.5px solid #DDE2EA', gap: '4px' },
          tab: { fontWeight: 700, fontSize: '14px', padding: '10px 6px' },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="chat"
            style={{ color: activeTab === 'chat' ? '#0D1F38' : '#5B6478' }}
            leftSection={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            }
          >
            Chat com IA
          </Tabs.Tab>
          <Tabs.Tab
            value="quick"
            style={{ color: activeTab === 'quick' ? '#0D1F38' : '#5B6478' }}
            leftSection={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 11 14 10 22 21 10 13 10 13 2"></polygon>
              </svg>
            }
          >
            Análise Rápida
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    );
  }

  renderMessage(m: any) {
    const wrapStyle = m.from === 'ai' ? AI_WRAP : USER_WRAP;
    const isAiText = m.kind === 'text' && m.from === 'ai';

    if (m.kind === 'typing') {
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={AI_BUBBLE}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#8A96AC', marginRight: '4px', animation: 'blink 1.2s infinite' }} />
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#8A96AC', marginRight: '4px', animation: 'blink 1.2s infinite 0.2s' }} />
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#8A96AC', animation: 'blink 1.2s infinite 0.4s' }} />
          </Paper>
        </div>
      );
    }

    if (m.kind === 'processing') {
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={{ ...CARD_BUBBLE, position: 'relative', overflow: 'hidden' }}>
            <div
              className="animate-scanLine"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: '40%',
                background: 'linear-gradient(180deg, rgba(13,31,56,0) 0%, rgba(13,31,56,0.06) 50%, rgba(13,31,56,0) 100%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', position: 'relative' }}>
              <span
                className="animate-pulseDot"
                style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: '#12805C', flexShrink: 0 }}
              />
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33' }}>Analisando o ofício</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
              {PROCESSING_STEPS.map((step, i) => {
                const isDone = i < m.stepIdx;
                const isCurrent = i === m.stepIdx;
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isDone || isCurrent ? 1 : 0.35, transition: 'opacity 0.4s ease' }}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        fontSize: '10px',
                        fontWeight: 800,
                        color: isDone ? '#fff' : isCurrent ? '#0D1F38' : '#93A0B4',
                        background: isDone ? '#12805C' : 'transparent',
                        border: isDone ? 'none' : `1.5px solid ${isCurrent ? '#0D1F38' : '#DDE2EA'}`,
                      }}
                    >
                      {isDone ? '✓' : ''}
                    </span>
                    <span
                      className={isCurrent ? 'animate-pulseDot' : ''}
                      style={{ fontSize: '12.5px', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#0B1B33' : isDone ? '#3B4457' : '#93A0B4' }}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </Paper>
        </div>
      );
    }

    if (m.kind === 'text' && m.from === 'user') {
      return (
        <div key={m.id} style={m.noAnim ? { ...wrapStyle, animation: 'none' } : wrapStyle}>
          <Paper style={USER_BUBBLE}>{m.text}</Paper>
        </div>
      );
    }

    if (isAiText) {
      // Chars are grouped per word inside a nowrap span so the line only
      // breaks between words — per-char inline-blocks alone would let the
      // browser wrap mid-word.
      let charIdx = 0;
      const words = m.text.split(' ').map((word: string, wi: number) => {
        const wordStart = charIdx;
        charIdx += word.length + 1;
        return (
          <React.Fragment key={wi}>
            {wi > 0 && <span style={{ display: 'inline-block', width: '0.3em', fontSize: '13.5px' }} />}
            <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
              {word.split('').map((ch: string, ci: number) => {
                const i = wordStart + ci;
                return (
                  <span
                    key={ci}
                    style={{
                      display: 'inline-block',
                      fontSize: '13.5px',
                      lineHeight: 1.55,
                      opacity: i < m.revealed ? 1 : 0,
                      transform: i < m.revealed ? 'translateY(0)' : 'translateY(-0.35em)',
                      filter: i < m.revealed ? 'blur(0px)' : 'blur(3px)',
                      transition: 'opacity 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1), filter 0.28s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          </React.Fragment>
        );
      });
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={AI_BUBBLE}>{words}</Paper>
        </div>
      );
    }

    if (m.kind === 'extract-card') {
      const temRessalva = m.items.some(
        (it: any) => it.status === 'ausente' || it.status === 'suspeito'
      );
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={CARD_BUBBLE}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33', marginBottom: '10px' }}>Dados extraídos do documento</div>
            {m.items.map((item: any) => {
              const status = item.status || 'lido';
              const cor =
                status === 'suspeito'
                  ? '#B4541E'
                  : status === 'ausente'
                    ? '#93A0B4'
                    : status === 'destaque'
                      ? '#0F6B4F'
                      : '#1C2331';
              return (
                <div
                  key={item.label}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid #EEF1F5' }}
                >
                  <span style={{ color: '#5B6478', flexShrink: 0 }}>{item.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', textAlign: 'right' }}>
                    <span style={{ color: cor, fontWeight: status === 'ausente' ? 500 : 700, fontStyle: status === 'ausente' ? 'italic' : 'normal' }}>
                      {item.value}
                    </span>
                    {status === 'suspeito' && (
                      <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 800, color: '#B4541E', background: '#FBEEE6', border: '1px solid #EBD3C2', borderRadius: '999px', padding: '1px 6px', whiteSpace: 'nowrap' }}>
                        conferir
                      </span>
                    )}
                    {status === 'destaque' && (
                      <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 800, color: '#0F6B4F', background: '#E7F4EC', border: '1px solid #BFE0CC', borderRadius: '999px', padding: '1px 6px', whiteSpace: 'nowrap' }}>
                        prioridade
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {temRessalva && (
              <p style={{ fontSize: '11.5px', color: '#8A94A8', margin: '10px 0 0', lineHeight: 1.5 }}>
                Campos em cinza não constavam de forma legível no documento; os marcados como &ldquo;conferir&rdquo; não pudemos
                confirmar no texto e precisam da sua validação.
              </p>
            )}
          </Paper>
        </div>
      );
    }

    if (m.kind === 'calc-card') {
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={CARD_BUBBLE}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33' }}>Resultado da análise</span>
              {m.provisorio && (
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#B4541E', background: '#FBEEE6', border: '1px solid #EBD3C2', borderRadius: '999px', padding: '1px 7px', whiteSpace: 'nowrap' }}>
                  estimativa provisória
                </span>
              )}
            </div>
            {m.items.map((item: any, i: number) => (
              <div
                key={item.label}
                className={m.animateIn ? 'animate-infoIn' : ''}
                style={{ marginBottom: '10px', animationDelay: m.animateIn ? `${i * 0.12}s` : undefined }}
              >
                <div style={{ color: '#5B6478', fontSize: '12px', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ color: '#0B1B33', fontSize: '17px', fontWeight: 800 }}>
                  {m.animateIn && typeof item.target === 'number' ? <CountUpValue target={item.target} /> : item.value}
                </div>
              </div>
            ))}
            <p style={{ fontSize: '11.5px', color: '#93A0B4', margin: '8px 0 0', lineHeight: 1.5 }}>Valores indicativos, sujeitos a validação documental e jurídica.</p>
          </Paper>
        </div>
      );
    }

    if (m.kind === 'doc-list') {
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={CARD_BUBBLE}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33', marginBottom: '10px' }}>Documentos necessários</div>
            {m.items.map((doc: any) => (
              <div key={doc.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', color: '#2B3346' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0D1F38', flexShrink: 0 }} />
                {doc.label}
              </div>
            ))}
          </Paper>
        </div>
      );
    }

    // meeting-card
    return (
      <div key={m.id} style={wrapStyle}>
        <Paper style={CARD_BUBBLE}>
          <div style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33', marginBottom: '8px' }}>Reunião confirmada</div>
          <div style={{ color: '#0B1B33', fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>{m.slot}</div>
          <div style={{ color: '#5B6478', fontSize: '12px' }}>Videochamada com um consultor especializado da Premium Office.</div>
        </Paper>
      </div>
    );
  }

  renderFlyingBubble() {
    const fb = this.state.flyingBubble;
    if (!fb) return null;
    const isEnd = fb.phase === 'end';
    const style: CSSProperties = {
      position: 'absolute',
      zIndex: 20,
      boxSizing: 'border-box',
      overflow: 'hidden',
      left: (isEnd ? fb.endLeft : fb.left) + 'px',
      top: (isEnd ? fb.endTop : fb.top) + 'px',
      width: (isEnd ? fb.endWidth : fb.width) + 'px',
      height: (isEnd ? fb.endHeight : fb.height) + 'px',
      display: isEnd ? 'block' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: isEnd ? 'left' : 'center',
      padding: isEnd ? '12px 14px' : '0 14px',
      background: isEnd ? '#0B1B33' : '#0D1F38',
      color: isEnd ? '#fff' : '#F7F5F1',
      fontWeight: isEnd ? 600 : 700,
      fontSize: '13.5px',
      lineHeight: 1.55,
      borderRadius: isEnd ? '14px' : '999px',
      borderTopRightRadius: isEnd ? '3px' : '999px',
      transition:
        'left 0.6s cubic-bezier(0.4,0,0.2,1), top 0.6s cubic-bezier(0.4,0,0.2,1), width 0.6s ease, height 0.6s ease, border-radius 0.5s ease, background 0.5s ease, padding 0.5s ease, color 0.3s ease',
    };
    return <div style={style}>{fb.label}</div>;
  }

  renderComposer() {
    const canSend = this.state.composerText.trim().length > 0;
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '10px' }}>
        <textarea
          value={this.state.composerText}
          onChange={this.onComposerChange}
          onKeyDown={this.onComposerKeyDown}
          placeholder="Ou escreva sua mensagem para a IA…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1.5px solid #DDE2EA',
            borderRadius: '12px',
            padding: '11px 14px',
            fontSize: '13px',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            color: '#1C2331',
            background: '#fff',
            outline: 'none',
            minHeight: '42px',
            maxHeight: '96px',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={this.onComposerSend}
          aria-label="Enviar mensagem"
          disabled={!canSend}
          className="transition-colors duration-250 hover:bg-[#1A2947]"
          style={{
            width: '42px',
            height: '42px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            border: 'none',
            background: canSend ? '#0D1F38' : '#B9C1D0',
            cursor: canSend ? 'pointer' : 'default',
            padding: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    );
  }

  renderChatInput() {
    const { stage } = this.state;
    if (stage === 'qualify') {
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            opacity: this.state.perfilExiting ? 0 : 1,
            transform: this.state.perfilExiting ? 'translateY(-16px)' : 'translateY(0)',
            transition: 'opacity 1.5s ease, transform 1.5s ease',
          }}
        >
          {['Sou o titular do crédito', 'Sou herdeiro / representante', 'Sou advogado(a)', 'Outro'].map((label) => (
            <Button
              key={label}
              onClick={(e) => this.onSelectPerfilClick(label, e)}
              className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent"
              style={{ height: 'auto', minHeight: '42px', padding: '12px 16px', borderRadius: '999px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#F7F5F1', fontWeight: 700, fontSize: '12.5px', textAlign: 'center', lineHeight: 1.4 }}
            >
              {label}
            </Button>
          ))}
        </div>
      );
    }
    if (stage === 'lead') {
      const { leadNome, leadCelular, leadSubmitting, leadError } = this.state;
      return (
        <form onSubmit={this.onLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            value={leadNome}
            onChange={this.onLeadNomeChange}
            placeholder="Nome completo"
            autoComplete="name"
            disabled={leadSubmitting}
            style={{
              border: '1.5px solid #DDE2EA',
              borderRadius: '10px',
              padding: '11px 14px',
              fontSize: '13px',
              fontFamily: 'inherit',
              color: '#1C2331',
              background: '#fff',
              outline: 'none',
            }}
          />
          <input
            type="tel"
            value={leadCelular}
            onChange={this.onLeadCelularChange}
            placeholder="Celular com DDD (ex: (21) 98765-4321)"
            autoComplete="tel"
            disabled={leadSubmitting}
            style={{
              border: '1.5px solid #DDE2EA',
              borderRadius: '10px',
              padding: '11px 14px',
              fontSize: '13px',
              fontFamily: 'inherit',
              color: '#1C2331',
              background: '#fff',
              outline: 'none',
            }}
          />
          {leadError && (
            <div style={{ fontSize: '12px', color: '#C4392B', fontWeight: 600 }}>{leadError}</div>
          )}
          <Button
            type="submit"
            loading={leadSubmitting}
            className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent"
            style={{ height: 'auto', minHeight: '42px', width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 700, fontSize: '13px', lineHeight: 1.4 }}
          >
            Liberar minha calculadora
          </Button>
          <p style={{ fontSize: '11px', color: '#93A0B4', margin: 0, lineHeight: 1.5 }}>
            Seus dados são usados apenas para contato sobre sua análise, conforme a LGPD.
          </p>
        </form>
      );
    }
    if (stage === 'upload') {
      return (
        <div>
          <label ref={this.dropzoneRef} style={{ display: 'block', border: '1.5px dashed #A9D9BE', borderRadius: '14px', padding: '14px', textAlign: 'center', cursor: 'pointer', marginBottom: '10px', background: '#E9F6EF' }}>
            <input type="file" onChange={this.onFileSelected} style={{ display: 'none' }} />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2B3346' }}>Enviar ofício / precatório (PDF)</div>
            <div style={{ fontSize: '12px', color: '#93A0B4', marginTop: '2px' }}>Clique para selecionar um arquivo</div>
          </label>
        </div>
      );
    }
    if (stage === 'confirm') {
      return (
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={this.onCorrigirDados} className="transition-colors duration-250 hover:!bg-[#5B6478] hover:!text-white" style={{ height: 'auto', minHeight: '42px', flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #DDE2EA', background: '#fff', color: '#5B6478', fontWeight: 700, fontSize: '13px', lineHeight: 1.4 }}>
            Corrigir dados
          </Button>
          <Button onClick={this.onConfirmarDados} className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent" style={{ height: 'auto', minHeight: '42px', flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 700, fontSize: '13px', lineHeight: 1.4 }}>
            Confirmar dados
          </Button>
        </div>
      );
    }
    if (stage === 'decision') {
      const outline: CSSProperties = { height: 'auto', minHeight: '42px', flex: '1 1 auto', padding: '12px', borderRadius: '10px', border: '1.5px solid #DDE2EA', background: '#fff', color: '#1C2331', fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 };
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Button onClick={this.onAceitar} className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent" style={{ height: 'auto', minHeight: '42px', flex: '1 1 100%', padding: '13px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 800, fontSize: '13px', lineHeight: 1.4 }}>
            Aceitar proposta
          </Button>
          <Button onClick={this.onFalarConsultor} className="transition-colors duration-250 hover:!bg-[#1C2331] hover:!text-white" style={outline}>Falar com consultor</Button>
          <Button onClick={this.onSolicitarRevisao} className="transition-colors duration-250 hover:!bg-[#1C2331] hover:!text-white" style={outline}>Solicitar revisão</Button>
          <Button onClick={this.onEnviarOutro} className="transition-colors duration-250 hover:!bg-[#1C2331] hover:!text-white" style={outline}>Enviar outro ofício</Button>
        </div>
      );
    }
    if (stage === 'documents') {
      const { pendingDocs, docsUploading, docsError } = this.state;
      return (
        <div>
          <label style={{ display: 'block', border: '1.5px dashed #A9D9BE', borderRadius: '14px', padding: '14px', textAlign: 'center', cursor: docsUploading ? 'not-allowed' : 'pointer', marginBottom: '10px', background: '#E9F6EF', opacity: docsUploading ? 0.6 : 1 }}>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={this.onDocFilesSelected} disabled={docsUploading} style={{ display: 'none' }} />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2B3346' }}>Enviar documentos (PDF ou imagem)</div>
            <div style={{ fontSize: '12px', color: '#93A0B4', marginTop: '2px' }}>Clique para selecionar um ou mais arquivos</div>
          </label>

          {pendingDocs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {pendingDocs.map((file, i) => (
                <div key={`${file.name}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #EAEDF2', background: '#fff', fontSize: '12px', color: '#2B3346' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => this.onRemovePendingDoc(i)}
                    disabled={docsUploading}
                    style={{ border: 'none', background: 'none', color: '#93A0B4', cursor: 'pointer', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {docsError && (
            <div style={{ fontSize: '11.5px', color: '#B4541E', marginBottom: '8px', lineHeight: 1.4 }}>{docsError}</div>
          )}

          <Button
            onClick={this.onEnviarDocumentos}
            disabled={docsUploading || pendingDocs.length === 0}
            className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent"
            style={{ height: 'auto', minHeight: '42px', width: '100%', padding: '13px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 800, fontSize: '13px', lineHeight: 1.4, opacity: docsUploading || pendingDocs.length === 0 ? 0.6 : 1 }}
          >
            {docsUploading
              ? 'Enviando…'
              : pendingDocs.length > 0
                ? `Enviar ${pendingDocs.length} documento${pendingDocs.length > 1 ? 's' : ''}`
                : 'Selecione ao menos um documento'}
          </Button>
        </div>
      );
    }
    if (stage === 'schedule') {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['Amanhã, 10h', 'Amanhã, 15h', 'Quinta-feira, 11h'].map((label) => (
            <Button key={label} onClick={(e) => this.onSelectSlot(label, e)} className="transition-colors duration-250 hover:!bg-[#1C2331] hover:!text-[#F9FAFC]" style={{ height: 'auto', minHeight: '42px', flex: '1 1 auto', padding: '12px', borderRadius: '10px', border: '1.5px solid #DDE2EA', background: '#F9FAFC', color: '#1C2331', fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 }}>
              {label}
            </Button>
          ))}
        </div>
      );
    }
    if (stage === 'done') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button component="a" href={whatsappLink} target="_blank" rel="noreferrer" className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent" style={{ height: 'auto', minHeight: '42px', textAlign: 'center', textDecoration: 'none', padding: '13px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 800, fontSize: '13px', lineHeight: 1.4 }}>
            Falar agora no WhatsApp
          </Button>
          <Button variant="subtle" onClick={this.onRestart} style={{ height: 'auto', background: 'transparent', border: 'none', color: '#5B6478', fontWeight: 700, fontSize: '13px', textDecoration: 'underline' }}>
            Iniciar nova simulação
          </Button>
        </div>
      );
    }
    if (stage === 'consultant' || stage === 'revision') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button component="a" href={whatsappLink} target="_blank" rel="noreferrer" className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent" style={{ height: 'auto', textAlign: 'center', textDecoration: 'none', padding: '11px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 800, fontSize: '13px' }}>
            Falar com consultor no WhatsApp
          </Button>
          <Button variant="subtle" onClick={this.onRestart} style={{ height: 'auto', background: 'transparent', border: 'none', color: '#5B6478', fontWeight: 700, fontSize: '13px', textDecoration: 'underline' }}>
            Iniciar nova simulação
          </Button>
        </div>
      );
    }
    return null;
  }

  renderQuickResult() {
    const a = this.state.quickAnalysis;
    if (!a) return null;
    const seg = (label: string, valor: number, color: string) => ({
      label,
      value: formatBRL(valor),
      style: { width: (valor / a.bruto) * 100 + '%', background: color, height: '100%' } as CSSProperties,
      dotStyle: { width: '9px', height: '9px', borderRadius: '3px', background: color, flexShrink: 0 } as CSSProperties,
    });
    const fade = (i: number): CSSProperties => ({ animation: 'infoIn 0.55s ease both', animationDelay: i * 0.16 + 's' });
    const pctLiquido = a.percentual * 100;
    const compSegments = [
      seg('Líquido disponível', a.liquido, '#12805C'),
      seg('Honorários contratuais', a.honorarios, '#0D1F38'),
      seg('IR / RRA', a.irRra, '#5B6478'),
      seg('PSS', a.pss, '#A9B4C6'),
    ];
    const quickDados = [
      { label: 'Credor', value: a.credor },
      { label: 'Nº do processo', value: a.processo },
      { label: 'Tribunal', value: a.tribunal },
      { label: 'Ente devedor', value: a.ente },
      { label: 'Natureza', value: a.natureza },
      { label: 'Valor de face (bruto)', value: formatBRL(a.bruto) },
    ];
    const quickFaixa = `${formatBRL(a.faixaMin)} – ${formatBRL(a.faixaMax)}`;
    const quickPctTxt = `${pctLiquido.toFixed(0)}%`;
    const quickSummary = `Analisamos o ofício de ${a.credor} (${a.tribunal}), de natureza ${a.natureza}. Após deduzir honorários contratuais, IR/RRA e PSS do valor bruto, o líquido disponível para cessão é de ${formatBRL(
      a.liquido
    )}. Aplicando a tabela vigente (LOA ${a.loa}), a proposta indicativa de antecipação fica entre ${formatBRL(a.faixaMin)} e ${formatBRL(a.faixaMax)}.`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={fade(0)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#12805C' }} />
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#12805C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documento analisado</span>
          </div>
          {quickDados.map((d) => (
            <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid #EEF1F5' }}>
              <span style={{ color: '#5B6478' }}>{d.label}</span>
              <span style={{ color: '#1C2331', fontWeight: 700, textAlign: 'right' }}>{d.value}</span>
            </div>
          ))}
        </div>

        <div style={fade(1)}>
          <p style={{ fontSize: '13.5px', color: '#3B4457', lineHeight: 1.7, margin: 0 }}>{quickSummary}</p>
        </div>

        <div style={fade(2)}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B1B33', marginBottom: '12px' }}>Composição do crédito</div>
          <Progress.Root size={20} radius="10px" style={{ boxShadow: 'inset 0 0 0 1px #EAEDF2' }}>
            {compSegments.map((s) => (
              <Progress.Section key={s.label} value={(parseFloat(s.style.width as string))} color={s.dotStyle.background as string} />
            ))}
          </Progress.Root>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px', marginTop: '14px' }}>
            {compSegments.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#5B6478' }}>
                  <span style={s.dotStyle} />
                  {s.label}
                </span>
                <span style={{ color: '#1C2331', fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={fade(3)}>
          <div style={{ background: '#0B1B33', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '12px', color: '#8FB4EA', fontWeight: 700, marginBottom: '6px' }}>Proposta indicativa de antecipação</div>
            <div style={{ fontSize: 'clamp(24px,4vw,30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{quickFaixa}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
              <Progress
                value={pctLiquido}
                color="#8FB4EA"
                size={8}
                radius="4px"
                style={{ flex: 1, background: 'rgba(255,255,255,0.14)', animation: 'barGrow 0.7s cubic-bezier(0.4,0,0.2,1) 0.6s both' }}
                transitionDuration={0}
              />
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#8FB4EA', flexShrink: 0 }}>{quickPctTxt}</span>
            </div>
            <p style={{ fontSize: '12px', color: '#9AA6BC', margin: '12px 0 0', lineHeight: 1.55 }}>
              Equivale a {quickPctTxt} do valor líquido disponível para cessão ({formatBRL(a.liquido)}), conforme a tabela vigente (LOA {a.loa}).
            </p>
          </div>
          <p style={{ fontSize: '11.5px', color: '#93A0B4', margin: '12px 0 0', lineHeight: 1.5 }}>
            Estimativa indicativa, sujeita a validação documental e jurídica. Envie o documento no Chat com IA para acompanhar cada etapa.
          </p>
          <button onClick={this.onQuickReset} style={{ marginTop: '8px', background: 'transparent', border: 'none', color: '#5B6478', fontWeight: 700, fontSize: '13px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            Analisar outro ofício
          </button>
        </div>
      </div>
    );
  }

  render() {
    const { activeTab, stage } = this.state;
    const isTransparent = Boolean(this.props.transparent);
    const isEmbedOnly = Boolean(this.props.embedOnly);

    const fontSizeProp = this.props.fontSize || this.props.textSize;
    const btnSizeProp = this.props.btnSize || this.props.buttonSize;
    const scaleProp = this.props.scale;

    let cardFontSize: string | undefined = undefined;
    if (fontSizeProp) {
      const fontMap: Record<string, string> = {
        xs: '12px',
        sm: '13.5px',
        md: '15px',
        lg: '17px',
        xl: '19px',
        '2xl': '21px',
      };
      const key = fontSizeProp.toLowerCase();
      cardFontSize = fontMap[key] || (/\d/.test(fontSizeProp) ? fontSizeProp : undefined);
      if (cardFontSize && !cardFontSize.endsWith('px') && !cardFontSize.endsWith('rem') && !cardFontSize.endsWith('%') && !cardFontSize.endsWith('em')) {
        cardFontSize = `${cardFontSize}px`;
      }
    }

    let btnMinHeight: string | undefined = undefined;
    let btnPadding: string | undefined = undefined;
    let btnFontSize: string | undefined = undefined;
    if (btnSizeProp) {
      const b = btnSizeProp.toLowerCase();
      if (b === 'xs') {
        btnMinHeight = '32px';
        btnPadding = '6px 10px';
        btnFontSize = '11px';
      } else if (b === 'sm') {
        btnMinHeight = '38px';
        btnPadding = '8px 14px';
        btnFontSize = '12px';
      } else if (b === 'md') {
        btnMinHeight = '44px';
        btnPadding = '12px 16px';
        btnFontSize = '14px';
      } else if (b === 'lg') {
        btnMinHeight = '52px';
        btnPadding = '14px 22px';
        btnFontSize = '16px';
      } else if (b === 'xl') {
        btnMinHeight = '60px';
        btnPadding = '18px 28px';
        btnFontSize = '18px';
      }
    }

    let cardTransform: string | undefined = undefined;
    if (scaleProp) {
      const num = parseFloat(scaleProp);
      if (!isNaN(num) && num > 0.4 && num < 2.5) {
        cardTransform = `scale(${num})`;
      }
    }

    const hasCustomStyles = cardFontSize || btnMinHeight || btnPadding || btnFontSize || cardTransform;

    const STAGE_STEP: Record<Stage, number> = {
      qualify: 0, lead: 0, upload: 0, analyzing: 1, confirm: 1, calculating: 2, decision: 2, documents: 3, schedule: 3, done: 3, consultant: 3, revision: 3,
    };
    const currentStepIdx = STAGE_STEP[stage] ?? 0;

    const chatCard = (
      <div className={`chat-embed-custom animate-fadeUp flex flex-col w-full ${isEmbedOnly ? 'h-full min-h-0' : ''} overflow-hidden rounded-2xl sm:rounded-3xl border border-[#EAEDF2] ${isTransparent ? 'bg-transparent' : 'bg-white'} shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]`}>
        {hasCustomStyles && (
          <style>{`
            ${cardFontSize ? `
            .chat-embed-custom,
            .chat-embed-custom p,
            .chat-embed-custom input,
            .chat-embed-custom span,
            .chat-embed-custom label,
            .chat-embed-custom textarea {
              font-size: ${cardFontSize} !important;
            }
            ` : ''}
            ${btnFontSize || btnMinHeight || btnPadding ? `
            .chat-embed-custom button,
            .chat-embed-custom .mantine-Button-root,
            .chat-embed-custom a.mantine-Button-root {
              ${btnFontSize ? `font-size: ${btnFontSize} !important;` : ''}
              ${btnMinHeight ? `min-height: ${btnMinHeight} !important; height: auto !important;` : ''}
              ${btnPadding ? `padding: ${btnPadding} !important;` : ''}
            }
            ` : ''}
            ${cardTransform ? `
            .chat-embed-custom {
              transform: ${cardTransform};
              transform-origin: top center;
            }
            ` : ''}
          `}</style>
        )}
        <div className="flex flex-shrink-0 items-center justify-center border-b border-[#16233F] bg-navy px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="text-xs sm:text-sm font-extrabold text-white text-center">Calculadora Assistente de Cálculos Premium Office</div>
        </div>

        <div ref={this.chatRef} data-chat-scroll className={`relative flex ${isEmbedOnly ? 'flex-1 min-h-0 h-full' : 'h-[500px] sm:h-[600px]'} flex-col gap-4 overflow-y-auto ${isTransparent ? 'bg-transparent' : 'bg-[#EEF0F3]'} p-4 sm:p-6`} style={{ scrollbarWidth: 'none' }}>
          <img src="/chat-watermark.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[65%] max-w-[260px] -translate-x-1/2 -translate-y-1/2 opacity-50" />
          {this.renderFlyingBubble()}
          {this.state.messages.map((m) => this.renderMessage(m))}
        </div>

        <div className={`flex-shrink-0 border-t border-[#EAEDF2] ${isTransparent ? 'bg-transparent' : 'bg-[#EEF0F3]'} px-4 py-3.5 sm:px-5 sm:py-4.5`}>
          {this.renderChatInput()}
          {this.renderComposer()}
        </div>
      </div>
    );

    if (isEmbedOnly) {
      return chatCard;
    }

    return (
      <section id="ia" data-screen-label="Chatbox IA" className="bg-mist px-4 py-10 sm:px-6 sm:py-14 md:px-16 md:py-24">
        <div className="mx-auto mb-8 sm:mb-10 max-w-[880px] text-center">
          <h2 className="mb-3 text-2xl sm:text-3xl md:text-4xl font-extrabold leading-[1.25] tracking-[-0.01em] text-navy">
            Use nossa calculadora com IA e descubra agora quanto você pode receber pelo seu precatório
          </h2>
          <p className="text-sm sm:text-[15px] leading-[1.6] text-[#5B6478]">
            Em poucos minutos, nossa Inteligência Artificial lê seu ofício, calcula a atualização do valor
            e projeta quanto dinheiro pode cair na sua conta — sem compromisso e 100% gratuito.
          </p>
        </div>
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-10">
          {/* LEFT: chat / quick */}
          <div className="w-full min-w-0 max-w-[880px] flex-1">
            {activeTab === 'chat' && chatCard}

            {activeTab === 'quick' && (
              <div>
                <p className="mb-4 text-center text-sm sm:text-base text-[#5B6478]">Envie o ofício e a IA lê o documento, aplica o cálculo e apresenta a estimativa.</p>
                {this.renderTabs()}
                <div className="animate-fadeUp rounded-b-3xl border border-t-0 border-[#EAEDF2] bg-white p-5 sm:p-7 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
                  {this.state.quickStage === 'idle' && (
                    <div>
                      <label ref={this.quickDropRef} className="mb-3 block cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-[#A9D9BE] bg-[#E9F6EF] px-4 py-6 text-center transition-transform active:scale-[0.99]">
                        <input type="file" onChange={this.onQuickFileSelected} style={{ display: 'none' }} />
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#12805C]">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                        </div>
                        <div className="text-sm font-bold text-[#2B3346]">Enviar ofício / precatório (PDF)</div>
                        <div className="mt-0.5 text-[12.5px] text-[#93A0B4]">Clique para selecionar — a IA lê e calcula automaticamente</div>
                      </label>
                    </div>
                  )}

                  {this.state.quickStage === 'analyzing' && (
                    <div className="flex flex-col items-center gap-4 py-12">
                      <Loader color="#0D1F38" size={40} />
                      <div className="text-[13.5px] font-bold text-[#5B6478]">Lendo o documento e aplicando o cálculo…</div>
                    </div>
                  )}

                  {this.state.quickStage === 'result' && this.renderQuickResult()}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: progress */}
          <div className="flex w-full min-w-0 max-w-full lg:max-w-[320px] lg:min-w-[260px] flex-col self-stretch">
            <div className="flex h-full flex-col rounded-[20px] border border-[#EAEDF2] bg-[#EEF0F3] p-5 sm:p-6 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
              <div className="mb-4.5 text-[12.5px] font-extrabold uppercase tracking-[0.05em] text-[#5B6478]">Progresso da análise</div>
              <div className="flex flex-1 flex-col py-1">
                {ANALYSIS_STEPS.map((step, i) => {
                  const isLast = i === ANALYSIS_STEPS.length - 1;
                  const isDone = i <= currentStepIdx;
                  return (
                    <div key={step.title} className={`relative ${isLast ? '' : 'flex-1 pb-5'}`}>
                      {!isLast && <div className="pointer-events-none absolute bottom-0 left-[13px] top-[32px] w-[2px] bg-[#DDE2EA]" />}
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: isDone ? '#0D1F38' : '#EEF0F3', color: isDone ? '#fff' : '#0B1B33', border: isDone ? 'none' : '1.5px solid #0B1B33' }}>
                          {i + 1}
                        </div>
                        <span className="text-[13.5px] font-bold text-navy">{step.title}</span>
                      </div>
                      <p className="mb-0 mt-2 pl-10 text-xs leading-[1.65]" style={{ color: isDone ? '#3B4457' : '#8A94A8' }}>
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials grid */}
        <div className="mx-auto mt-12 sm:mt-16 max-w-[1480px]">
          <div className="mb-6 sm:mb-8 text-center">
            <h2 className="mb-2 text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-[-0.01em] text-navy">Nossos clientes</h2>
            <p className="text-sm text-[#5B6478]">Histórias de quem buscou clareza, segurança e orientação.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REVIEWS.map((review) => (
              <div
                key={review.name}
                className="flex flex-col items-center rounded-[20px] border-solid border-[1.5px] border-[#8FB4EA] bg-[#EEF0F3] p-5 sm:p-6 text-center shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)] transition-transform active:scale-[0.99]"
              >
                <div className="mb-4 sm:mb-5 h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden rounded-full border-solid border-[1.5px] border-[#8FB4EA] shadow-sm transition-transform duration-300 hover:scale-110">
                  <img src={review.image} alt={review.name} className="h-full w-full object-cover" />
                </div>
                <p className="mb-4 sm:mb-5 flex-1 text-sm sm:text-base font-medium leading-[1.65] text-[#3B4457]">&ldquo;{review.quote}&rdquo;</p>
                <div>
                  <div className="text-sm sm:text-[15px] font-extrabold text-navy">{review.name}</div>
                  <div className="text-xs text-[#93A0B4]">Cliente Premium Office</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
}
