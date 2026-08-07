// Sanitização do payload de /api/chat contra manipulação do papel da mensagem
// e prompt-injection — o corpo da requisição vem direto do navegador do
// usuário (ou de qualquer chamada HTTP externa), então nada nele pode ser
// tratado como instrução de sistema sem passar por aqui primeiro.

import { Persona } from './calculator';

const PERSONAS_VALIDAS: Persona[] = ['autor', 'advogado', 'broker'];

export function sanitizarPersona(valor: unknown): Persona {
  return PERSONAS_VALIDAS.includes(valor as Persona) ? (valor as Persona) : 'autor';
}

// Impede que o corpo da requisição injete uma segunda mensagem "system" (ou
// qualquer role fora do previsto) na conversa enviada à OpenAI — só o backend
// decide o system prompt. Qualquer role diferente de 'assistant' oriunda do
// cliente é rebaixada para 'user', que é tratada como conteúdo a interpretar,
// nunca como instrução com autoridade de sistema.
const MAX_MENSAGENS_HISTORICO = 40;
const MAX_CHARS_POR_MENSAGEM = 4000;

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
}

export function sanitizarHistoricoChat(mensagens: unknown): MensagemChat[] {
  if (!Array.isArray(mensagens)) return [];

  return mensagens.slice(-MAX_MENSAGENS_HISTORICO).map((m: any) => {
    const role: MensagemChat['role'] = m?.role === 'assistant' || m?.from === 'ai' ? 'assistant' : 'user';
    const contentBruto = typeof m?.content === 'string' ? m.content : typeof m?.text === 'string' ? m.text : '';
    return { role, content: contentBruto.slice(0, MAX_CHARS_POR_MENSAGEM) };
  });
}
