import { NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  analisarOficioComLangChain,
  prepararEntradaDocumento,
  ErroDocumentoIlegivel,
} from '@/lib/langchain';
import { Persona } from '@/lib/calculator';
import { validarArquivoUpload, sanitizarNomeArquivo } from '@/lib/upload';

/**
 * Anexa o arquivo do ofício (base64) ao Negócio (Deal) já criado no Bitrix,
 * no pipeline "IA PRECATORIO CALC", através do campo customizado
 * UF_CRM_1763026532088 ("[P] Ofício Precatório" — tipo "file") — o Bitrix
 * armazena o arquivo no Drive interno do CRM e o expõe como showUrl/downloadUrl
 * no próprio card do negócio.
 *
 * NOTA: existem DOIS campos técnicos distintos que exibem o rótulo textual
 * "UF_CRM_OFICIO_PDF" no Bitrix (UF_CRM_OFICIO_PDF e UF_CRM_6A709A154B565) —
 * nenhum dos dois é o campo real do layout do pipeline de precatórios, que é
 * UF_CRM_1763026532088. Usar o campo errado grava o arquivo com sucesso (a
 * chamada retorna OK) mas ele nunca aparece no card, porque não está no
 * formulário visível dessa categoria — foi exatamente o bug relatado.
 *
 * Falha aqui nunca deve bloquear a análise via IA — apenas registra um aviso
 * no log do servidor.
 */
async function anexarArquivoAoLeadBitrix(dealId: number, fileName: string, fileBase64: string) {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
  if (!webhookUrl || !dealId) return;

  try {
    const res = await fetch(`${webhookUrl.replace(/\/$/, '')}/crm.deal.update.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dealId,
        fields: {
          UF_CRM_1763026532088: { fileData: [fileName, fileBase64] },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.warn('[bitrix] Falha ao anexar ofício ao negócio:', data.error_description || data.error);
    }
  } catch (err) {
    console.warn('[bitrix] Erro ao anexar ofício ao negócio:', err);
  }
}

function formatarBRL(valor: number | undefined): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/**
 * Monta e publica, como comentário na timeline do Negócio (Deal), os dados de
 * qualificação extraídos do ofício — o consultor humano vê tudo o que a IA
 * leu do documento (e o resultado do cálculo interno) direto no card, sem
 * precisar reabrir o chat da LP. Complementa o anexo do PDF: aqui vai o dado
 * estruturado, lá vai o documento original para conferência.
 *
 * Os valores calculados são explicitamente marcados como estimativa interna
 * sujeita à validação (ver EXIBIR_VALORES_CALCULADOS em ChatSection.tsx e
 * CALCULO.md §3/§5) — a mensagem NUNCA deve ser confundida com uma proposta
 * já fechada.
 */
async function enviarQualificacaoAoBitrix(
  dealId: number,
  extraido: any,
  resultado: any,
  validacao: any,
  preferencia: any,
  mesesRra: number
) {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
  if (!webhookUrl || !dealId) return;

  const linhas: string[] = ['[IA] Dados extraídos do ofício requisitório'];

  linhas.push(`Credor: ${extraido.credor || 'não identificado'}`);
  if (extraido.cpfCnpj) linhas.push(`CPF/CNPJ: ${extraido.cpfCnpj}`);
  if (extraido.processo) linhas.push(`Processo: ${extraido.processo}`);
  if (extraido.tribunal) linhas.push(`Tribunal: ${extraido.tribunal}`);
  if (extraido.enteDevedor) linhas.push(`Ente devedor: ${extraido.enteDevedor}`);
  linhas.push(`Esfera / Natureza: ${extraido.esfera || '—'} / ${extraido.natureza || '—'}`);
  linhas.push(`UF: ${extraido.uf || '—'} · LOA: ${extraido.loa || '—'}`);
  linhas.push(`Data-base: ${extraido.dataBase || '—'}`);
  linhas.push(`Valor bruto original: ${formatarBRL(extraido.brutoOriginal)}`);
  if (typeof extraido.pssOriginal === 'number') linhas.push(`Desconto previdenciário (PSS): ${formatarBRL(extraido.pssOriginal)}`);
  if (typeof extraido.principalTributavel === 'number') linhas.push(`Valor Principal: ${formatarBRL(extraido.principalTributavel)}`);
  if (typeof extraido.valorJuros === 'number') linhas.push(`Valor Juros: ${formatarBRL(extraido.valorJuros)}`);
  if (extraido.periodoPagamentosInicio && extraido.periodoPagamentosFim) {
    linhas.push(`Período de competência: ${extraido.periodoPagamentosInicio} a ${extraido.periodoPagamentosFim} (${mesesRra} meses)`);
  }
  linhas.push(`Incide IR: ${extraido.incideIr ? 'sim' : 'não'} · Tributário: ${extraido.isTributario ? 'sim' : 'não'}`);

  if (preferencia?.temPreferencia) {
    linhas.push(`⚠ Preferência constitucional (art. 100 §2º CF): ${preferencia.motivos.join(', ')}`);
  }

  if (resultado) {
    linhas.push('');
    linhas.push('[IA] Estimativa interna do cálculo (sujeita a validação do consultor):');
    linhas.push(`Valor atualizado (${resultado.mesesDecorridos} meses): ${formatarBRL(resultado.brutoAtualizado)}`);
    linhas.push(`Líquido final do credor: ${formatarBRL(resultado.liquidoFinal)}`);
    linhas.push(`Faixa de proposta indicativa: ${formatarBRL(resultado.propostaInicial)} a ${formatarBRL(resultado.limiteInterno)}`);
  }

  if (validacao?.camposAssumidos?.length) {
    linhas.push(`Campos assumidos por premissa (confirmar com o cliente): ${validacao.camposAssumidos.join(', ')}`);
  }
  if (validacao?.camposSuspeitos?.length) {
    linhas.push(`⚠ Campos não confirmados no texto do documento (conferir manualmente): ${validacao.camposSuspeitos.join(', ')}`);
  }

  try {
    const res = await fetch(`${webhookUrl.replace(/\/$/, '')}/crm.timeline.comment.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ENTITY_ID: dealId,
          ENTITY_TYPE: 'deal',
          COMMENT: linhas.join('\n'),
        },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.warn('[bitrix] Falha ao publicar dados de qualificação no negócio:', data.error_description || data.error);
    }
  } catch (err) {
    console.warn('[bitrix] Erro ao publicar dados de qualificação no negócio:', err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, persona = 'autor', fileBase64, fileName, bitrixDealId } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não está configurada no servidor.' },
        { status: 500 }
      );
    }

    // Se houver arquivo anexado (ex: imagem ou PDF em base64) ou se for uma solicitação explícita de cálculo
    if (fileBase64) {
      const validacao = validarArquivoUpload(fileBase64);
      if (!validacao.ok) {
        return NextResponse.json({ error: validacao.erro }, { status: 400 });
      }
      const fileNameSeguro = sanitizarNomeArquivo(fileName);

      if (bitrixDealId) {
        anexarArquivoAoLeadBitrix(bitrixDealId, fileNameSeguro, fileBase64);
      }

      const entrada = await prepararEntradaDocumento(validacao.buffer, validacao.mimeTypeReal);
      const analise = await analisarOficioComLangChain(entrada, persona as Persona);

      if (bitrixDealId) {
        enviarQualificacaoAoBitrix(
          bitrixDealId,
          analise.extraido,
          analise.resultado,
          analise.validacao,
          analise.preferencia,
          analise.mesesRra
        );
      }

      return NextResponse.json({
        text: analise.respostaFormatada,
        extraido: analise.extraido,
        resultado: analise.resultado,
        validacao: analise.validacao,
        preferencia: analise.preferencia,
        mesesRra: analise.mesesRra,
        atualizacao: analise.atualizacao,
      });
    }

    // NOTA: havia aqui uma branch de "demonstração" acionada por qualquer
    // mensagem contendo "exemplo" — palavra comum o bastante para disparar sem
    // intenção ("por exemplo, quanto eu receberia?"). Ela expunha o percentual
    // da tabela comercial por perfil, o nome das etapas internas e as taxas da
    // fórmula, além de usar a atualização monetária defeituosa (CALCULO.md §3).
    // Foi removida: o chat conversacional abaixo já explica o cálculo em
    // linguagem simples, sem vazar regra comercial.

    // Chat Conversacional via LangChain ChatOpenAI
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: apiKey,
    });

    const systemPrompt = `Você é um assistente virtual especialista da Premium Office Precatório.
Seu papel é orientar credores, advogados e associados sobre a antecipação de precatórios federais, estaduais e municipais.
O perfil atual do usuário nesta conversa é: "${persona.toUpperCase()}".
Instruções:
- Seja sempre cortês, profissional, transparente e didático.
- Nunca mencione termos técnicos internos como "LangChain", "OCR", "persona", "prompt" ou nomes de bibliotecas — fale sempre em linguagem simples, como "nossa IA" ou "nossa análise".
- Se o nome completo e o celular do usuário ainda não tiverem sido informados nesta conversa, sua prioridade é conduzir a coleta desses dois dados antes de avançar para o cálculo:
  - Peça um de cada vez, de forma natural (primeiro o nome completo, depois o celular).
  - Ao receber o celular, valide se contém DDD + número (10 ou 11 dígitos). Se vier incompleto ou parecer inválido, peça gentilmente que reenvie no formato (DDD) 9XXXX-XXXX.
  - Só depois de ter nome e celular válidos, convide o usuário a enviar o arquivo do ofício (PDF ou imagem) para liberar o cálculo exato.
- Explique o cálculo em termos simples quando perguntado: atualização monetária do valor, descontos, honorários, imposto de renda e proposta final — sem citar fórmulas internas ou nomes de etapas técnicas.
- O percentual de honorários contratuais do advogado NUNCA consta no ofício (é contrato particular entre credor e advogado). Se o usuário já enviou o ofício e ainda não informou esse percentual, pergunte de forma leve: "Você tem contrato de honorários com advogado nesse precatório? Se sim, qual o percentual?". Se ele não souber ou não tiver, siga normalmente e diga que o consultor confirma depois.
- Se o usuário já enviou nome, celular e o ofício, siga direto para orientar sobre o resultado da análise.`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role || (m.from === 'ai' ? 'assistant' : 'user'),
        content: m.content || m.text || '',
      })),
    ];

    const response = await llm.invoke(formattedMessages);

    return NextResponse.json({
      text: response.content,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/chat:', error);

    // Documento ilegível é problema do arquivo enviado, não falha do servidor:
    // a mensagem é escrita para o usuário e explica o que fazer em seguida.
    if (error instanceof ErroDocumentoIlegivel) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Falha interna: nunca expor detalhe técnico nem nome de biblioteca na tela.
    return NextResponse.json(
      { error: 'Não conseguimos concluir a análise agora. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
