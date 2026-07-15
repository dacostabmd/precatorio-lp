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

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------
type Stage =
  | 'qualify'
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

const WELCOME =
  'Olá! Sou a IA da Premium Office Precatório. Vou te ajudar a entender, com clareza e segurança, se faz sentido antecipar seu crédito. Para direcionar a análise, qual o seu perfil?';

const ANALYSIS_STEPS = [
  {
    title: 'Envio do ofício',
    desc: 'O documento que você já tem em mãos é suficiente. Envie o PDF em ambiente seguro e protegido pela LGPD — sem filas, sem formulários e sem compromisso.',
  },
  {
    title: 'Análise da IA',
    desc: 'Em segundos, a IA lê o ofício e extrai credor, tribunal, ente devedor, natureza e valores — uma triagem que levaria dias no processo manual.',
  },
  {
    title: 'Proposta indicativa',
    desc: 'Com os dados confirmados, aplicamos as tabelas vigentes por esfera e LOA sobre o líquido real do seu crédito. Você vê a faixa de valores antes de falar com qualquer pessoa.',
  },
  {
    title: 'Reunião com consultor',
    desc: 'Um especialista valida a análise juridicamente e apresenta a proposta oficial. Você decide com total clareza, no seu tempo — sem pressão e sem custo.',
  },
];

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

interface State {
  stage: Stage;
  messages: any[];
  activeTab: 'chat' | 'quick';
  perfilExiting: boolean;
  quickStage: 'idle' | 'analyzing' | 'result';
  quickAnalysis: Analise | null;
  flyingBubble: any | null;
  composerText: string;
}

export default class ChatSection extends React.Component<{}, State> {
  chatRef = React.createRef<HTMLDivElement>();
  dropzoneRef = React.createRef<HTMLLabelElement>();
  quickDropRef = React.createRef<HTMLLabelElement>();
  revealRAF: number | null = null;
  revealLoopRunning = false;

  state: State = {
    stage: 'qualify',
    messages: [aiText(WELCOME)],
    activeTab: 'chat',
    perfilExiting: false,
    quickStage: 'idle',
    quickAnalysis: null,
    flyingBubble: null,
    composerText: '',
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
  }

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
    this.pushMessages(
      userText(label, true),
      aiText('Entendido. Agora, envie o ofício ou precatório em PDF para que eu possa extrair os dados principais.')
    );
    this.setState({ stage: 'upload' });
  };

  onSelectPerfilClick = (label: string, e: React.MouseEvent) => {
    this.setState({ perfilExiting: true });
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.onSelectPerfil(label);
      this.setState({ perfilExiting: false });
    });
  };

  runAnalysis = (fileLabel: string) => {
    this.pushMessages(userText(`Documento enviado: ${fileLabel}`, true), aiTyping());
    this.setState({ stage: 'analyzing' });
    setTimeout(() => {
      const items = [
        { label: 'Credor', value: MOCK_DOC.credor },
        { label: 'CPF', value: MOCK_DOC.cpf },
        { label: 'Nº do processo', value: MOCK_DOC.processo },
        { label: 'Tribunal', value: MOCK_DOC.tribunal },
        { label: 'Ente devedor', value: MOCK_DOC.devedor },
        { label: 'Natureza', value: MOCK_DOC.natureza },
        { label: 'Valor principal', value: formatBRL(MOCK_DOC.valorPrincipal) },
        { label: 'Data-base', value: MOCK_DOC.dataBase },
      ];
      this.setState((s) => ({
        messages: [
          ...s.messages.filter((m) => m.kind !== 'typing'),
          aiCard('extract-card', { items }),
          aiText('Os dados acima conferem com o documento enviado?'),
        ],
        stage: 'confirm',
      }));
      this.startRevealLoop();
    }, 2000);
  };

  onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    const label = `Documento enviado: ${file ? file.name : 'ofício.pdf'}`;
    this.flyBubble(label, this.dropzoneRef.current, () => this.runAnalysis(file ? file.name : 'ofício.pdf'));
  };
  onSimulateUpload = (e: React.MouseEvent) => {
    const label = 'Documento enviado: oficio-exemplo.pdf';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => this.runAnalysis('oficio-exemplo.pdf'));
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
  onQuickExample = () => this.runQuickAnalysis();
  onQuickReset = () => this.setState({ quickStage: 'idle', quickAnalysis: null });

  onAceitar = (e: React.MouseEvent) => {
    this.flyBubble('Aceitar proposta', e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText('Aceitar proposta', true), aiCard('doc-list', { items: DOCS_NECESSARIOS.map((d) => ({ label: d })) }));
      this.setState({ stage: 'documents' });
    });
  };

  onEnviarDocumentos = (e: React.MouseEvent) => {
    this.flyBubble('Documentos enviados', e.currentTarget as HTMLElement, () => {
      this.pushMessages(
        userText('Documentos enviados', true),
        aiText('Documentos recebidos! Vamos agendar uma reunião com um consultor especializado. Escolha um horário:')
      );
      this.setState({ stage: 'schedule' });
    });
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
        body: JSON.stringify({ messages: historyForApi }),
      });

      if (!res.ok) {
        throw new Error('Falha na resposta da API');
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
    } catch (error) {
      console.error(error);
      this.setState(
        (s) => ({
          messages: [
            ...s.messages.filter((m) => m.kind !== 'typing'),
            aiText('Desculpe, ocorreu um erro de conexão com a IA.'),
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
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={CARD_BUBBLE}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33', marginBottom: '10px' }}>Dados extraídos do documento</div>
            {m.items.map((item: any) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '5px 0', fontSize: '13px', borderBottom: '1px solid #EEF1F5' }}>
                <span style={{ color: '#5B6478' }}>{item.label}</span>
                <span style={{ color: '#1C2331', fontWeight: 700, textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </Paper>
        </div>
      );
    }

    if (m.kind === 'calc-card') {
      return (
        <div key={m.id} style={wrapStyle}>
          <Paper style={CARD_BUBBLE}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0B1B33', marginBottom: '12px' }}>Resultado da análise</div>
            {m.items.map((item: any) => (
              <div key={item.label} style={{ marginBottom: '10px' }}>
                <div style={{ color: '#5B6478', fontSize: '12px', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ color: '#0B1B33', fontSize: '17px', fontWeight: 800 }}>{item.value}</div>
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
    if (stage === 'upload') {
      return (
        <div>
          <label ref={this.dropzoneRef} style={{ display: 'block', border: '1.5px dashed #A9D9BE', borderRadius: '14px', padding: '14px', textAlign: 'center', cursor: 'pointer', marginBottom: '10px', background: '#E9F6EF' }}>
            <input type="file" onChange={this.onFileSelected} style={{ display: 'none' }} />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2B3346' }}>Enviar ofício / precatório (PDF)</div>
            <div style={{ fontSize: '12px', color: '#93A0B4', marginTop: '2px' }}>Clique para selecionar um arquivo</div>
          </label>
          <Button
            onClick={this.onSimulateUpload}
            className="transition-colors duration-250 hover:!bg-[#12805C] hover:!text-[#DCEFE3]"
            style={{ height: 'auto', minHeight: '42px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#DCEFE3', color: '#12805C', fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 }}
          >
            Usar ofício de exemplo para a demonstração
          </Button>
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
      return (
        <Button onClick={this.onEnviarDocumentos} className="transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent" style={{ height: 'auto', minHeight: '42px', width: '100%', padding: '13px', borderRadius: '10px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#fff', fontWeight: 800, fontSize: '13px', lineHeight: 1.4 }}>
          Enviar documentos (simulado)
        </Button>
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
    const STAGE_STEP: Record<Stage, number> = {
      qualify: 0, upload: 0, analyzing: 1, confirm: 1, calculating: 2, decision: 2, documents: 3, schedule: 3, done: 3, consultant: 3, revision: 3,
    };
    const currentStepIdx = STAGE_STEP[stage] ?? 0;

    return (
      <section id="ia" data-screen-label="Chatbox IA" className="bg-mist px-5 py-10 sm:px-8 sm:py-14 md:px-16 md:py-24">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-start gap-10">
          {/* LEFT: progress */}
          <div className="flex min-w-[260px] max-w-[320px] flex-[1_1_260px] flex-col self-stretch">
            <div className="flex h-full flex-col rounded-[20px] border border-[#EAEDF2] bg-[#EEF0F3] p-6 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
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

          {/* RIGHT: chat / quick */}
          <div className="min-w-[340px] max-w-[760px] flex-[2_1_400px]">
            {activeTab === 'chat' && (
              <div>
                <div className="animate-fadeUp overflow-hidden rounded-3xl border border-[#EAEDF2] bg-white shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
                  <div className="flex items-center gap-2.5 border-b border-[#16233F] bg-navy px-5 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-accent text-xs font-extrabold text-white">IA</div>
                    <div>
                      <div className="text-sm font-extrabold text-white">Assistente Premium Office</div>
                      <div className="text-xs text-[#7C879C]">Análise de precatórios · online</div>
                    </div>
                  </div>

                  <div ref={this.chatRef} data-chat-scroll className="relative flex h-[600px] flex-col gap-4 overflow-y-auto bg-[#EEF0F3] p-6" style={{ scrollbarWidth: 'none' }}>
                    <img src="/chat-watermark.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[65%] max-w-[260px] -translate-x-1/2 -translate-y-1/2 opacity-50" />
                    {this.renderFlyingBubble()}
                    {this.state.messages.map((m) => this.renderMessage(m))}
                  </div>

                  <div className="border-t border-[#EAEDF2] bg-[#EEF0F3] px-5 py-4.5">
                    {this.renderChatInput()}
                    {this.renderComposer()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'quick' && (
              <div>
                <p className="mb-4 text-center text-base text-[#5B6478]">Envie o ofício e a IA lê o documento, aplica o cálculo e apresenta a estimativa.</p>
                {this.renderTabs()}
                <div className="animate-fadeUp rounded-b-3xl border border-t-0 border-[#EAEDF2] bg-white p-7 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
                  {this.state.quickStage === 'idle' && (
                    <div>
                      <label ref={this.quickDropRef} className="mb-3 block cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-[#A9D9BE] bg-[#E9F6EF] px-4.5 py-6.5 text-center">
                        <input type="file" onChange={this.onQuickFileSelected} style={{ display: 'none' }} />
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#12805C]">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                        </div>
                        <div className="text-sm font-bold text-[#2B3346]">Enviar ofício / precatório (PDF)</div>
                        <div className="mt-0.5 text-[12.5px] text-[#93A0B4]">Clique para selecionar — a IA lê e calcula automaticamente</div>
                      </label>
                      <button onClick={this.onQuickExample} className="w-full rounded-[10px] border-none bg-[#DCEFE3] px-3 py-3 text-[13px] font-bold text-[#12805C] transition-colors duration-250 hover:bg-[#12805C] hover:text-[#DCEFE3]">
                        Usar ofício de exemplo para a demonstração
                      </button>
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

          {/* RIGHT: promotional banner & example card */}
          <div className="hidden min-w-[280px] max-w-[360px] flex-[1.2_1_280px] self-stretch lg:flex flex-col items-center justify-start gap-6">
            <img
              src="/side_banner.png"
              alt="Antecipe hoje seu precatório — receba sua proposta 100% online e segura"
              className="w-full rounded-[20px] object-cover shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]"
            />
            
            <div className="w-full rounded-[20px] border border-navy-border bg-navy-panel p-5 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A96AC]">
                Exemplo de análise da IA
              </div>
              <div className="mb-3.5 flex gap-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#1A2947] text-[10px] font-extrabold text-sky">
                  IA
                </div>
                <div className="rounded-xl rounded-tl-sm bg-navy-card px-3 py-2.5 text-[11.5px] leading-[1.5] text-[#C7CFDE]">
                  Documento lido. Ente devedor: Estado de São Paulo · Natureza: Alimentar · Valor: R$ 480.000
                </div>
              </div>
              <div className="mb-4.5 flex flex-row-reverse gap-2.5">
                <div className="rounded-xl rounded-tr-sm bg-navy-accent px-3 py-2.5 text-[11.5px] font-semibold leading-[1.5] text-white">
                  Confirmado, pode calcular.
                </div>
              </div>
              <div className="mb-1 text-[clamp(18px,2vw,22px)] font-extrabold tracking-[-0.02em] text-white">
                R$ 315.400 – R$ 356.200
              </div>
              <div className="text-[10px] font-bold text-sky">Proposta indicativa de antecipação</div>
            </div>
          </div>
        </div>

        {/* Testimonials grid */}
        <div className="mx-auto mt-16 max-w-[1480px]">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.01em] text-navy">Nossos clientes</h2>
            <p className="text-sm text-[#5B6478]">Histórias de quem buscou clareza, segurança e orientação.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {REVIEWS.map((review) => (
              <div
                key={review.name}
                className="flex flex-col items-center rounded-[20px] border-solid border-[1.5px] border-[#8FB4EA] bg-[#EEF0F3] p-6 text-center shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]"
              >
                <div className="mb-5 h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-solid border-[1.5px] border-[#8FB4EA] shadow-sm transition-transform duration-300 hover:scale-150">
                  <img src={review.image} alt={review.name} className="h-full w-full object-cover" />
                </div>
                <p className="mb-5 flex-1 text-base font-medium leading-[1.65] text-[#3B4457]">&ldquo;{review.quote}&rdquo;</p>
                <div>
                  <div className="text-[15px] font-extrabold text-navy">{review.name}</div>
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
