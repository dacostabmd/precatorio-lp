import { NextResponse } from 'next/server';
import { Persona } from '@/lib/calculator';
import { enviarLeadParaMeta } from '@/lib/metaConversionsApi';
import { consultarCpfInfoSimples, ResultadoConsultaInfoSimples } from '@/lib/infosimples';
import { UtmParams } from '@/lib/utms';

interface LeadPayload {
  nomeCompleto: string;
  cpf: string;
  persona: Persona;
  infoSimples?: ResultadoConsultaInfoSimples;
  utms?: UtmParams;
}

// Validação de CPF por dígito verificador (algoritmo padrão da Receita Federal).
function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcCheckDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += parseInt(cpf[i], 10) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calcCheckDigit(9) === parseInt(cpf[9], 10) && calcCheckDigit(10) === parseInt(cpf[10], 10);
}

// Pipeline (categoria) de Deal "[LP] PREMIUM OFFICE v2" no Bitrix — funil
// alvo desta LP. Estágio inicial "LP — Novo Lead" (C534:NEW, etapa de
// sistema) — não é o primeiro estágio por ordenação do pipeline (esse é
// "LP — Follow up"), por isso precisa ser explícito.
const BITRIX_DEAL_CATEGORY_ID = 534;
const BITRIX_DEAL_STAGE_ID = 'C534:NEW';
// Campo customizado "[MKT] Tipo de Tráfego" (lista) — item "Tráfego Pago".
const BITRIX_DEAL_UF_TIPO_TRAFEGO = 'UF_CRM_1761655904';
const BITRIX_DEAL_TIPO_TRAFEGO_PAGO_ID = '5428';
// Campos customizados de CPF já existentes no Bitrix
const BITRIX_CONTACT_UF_CPF = 'UF_CRM_CPF';
const BITRIX_CONTACT_UF_CPF_CNPJ = 'UF_CRM_1703187558515';
const BITRIX_CONTACT_UF_CPF_ALT = 'UF_CRM_1731681995';

const BITRIX_DEAL_UF_CPF = 'UF_CRM_CONSULT_CPF';
const BITRIX_DEAL_UF_CPF_CLIENTE = 'UF_CRM_1703254224613';
const BITRIX_DEAL_UF_CPF_BOT = 'UF_CRM_1728573121';
const BITRIX_DEAL_UF_NUMERO_PROCESSO = 'UF_CRM_1705005770426';

// Campos específicos do card do Bitrix vistos na interface
const BITRIX_DEAL_UF_NOME_CLIENTE = 'UF_CRM_1703254259078'; // [S] Nome Completo/Razão Social do cliente
const BITRIX_DEAL_UF_ESTADO = 'UF_CRM_1702986393274'; // [+] Estado (Enum)
const BITRIX_DEAL_UF_MKT_ESTADO = 'UF_CRM_1767120845991'; // [MKT] Estado (String)
const BITRIX_DEAL_UF_INFOS_EXTRAS = 'UF_CRM_1702986695'; // [+] INFORMAÇÕES EXTRAS
const BITRIX_DEAL_UF_VALOR_DESEJADO = 'UF_CRM_1736172629'; // [P] VALOR DESEJADO PELO CLIENTE
const BITRIX_DEAL_UF_TIPO_PRECATORIO = 'UF_CRM_1756758368'; // [P] TIPO DE PRECATORIO (Enum)
const BITRIX_DEAL_UF_TRIBUNAL_FEDERAL = 'UF_CRM_1767021573716'; // [P] TRIBUNAL FEDERAL (Enum)
const BITRIX_DEAL_UF_TRIBUNAL_ESTADUAL = 'UF_CRM_1767037264990'; // [P] TRIBUNAL ESTADUAL (Enum)
const BITRIX_DEAL_UF_LP_PRECATORIOS = 'UF_CRM_1772054165226'; // [LP] PRECATÓRIOS (Enum)

// Mapeia tribunal identificado para os IDs exatos de enumeração do Bitrix
function mapTribunalToBitrixIds(tribunal?: string) {
  const trib = (tribunal || '').toUpperCase();
  let estadoEnum = '';
  let estadoSigla = '';
  let tipoPrecatorio = '';
  let tribunalFederal = '';
  let tribunalEstadual = '';
  let lpPrecatorios = '';

  if (trib.includes('TRF1')) {
    tipoPrecatorio = '4648'; // FEDERAL
    tribunalFederal = '5960'; // TRF1
    lpPrecatorios = '7496'; // TRF1
    estadoSigla = 'DF';
    estadoEnum = '117'; // DF
  } else if (trib.includes('TRF2')) {
    tipoPrecatorio = '4648';
    tribunalFederal = '5954'; // TRF2
    lpPrecatorios = '7498'; // TRF2
    estadoSigla = 'RJ';
    estadoEnum = '141'; // RJ
  } else if (trib.includes('TRF3')) {
    tipoPrecatorio = '4648';
    tribunalFederal = '5956'; // TRF3
    lpPrecatorios = '7500'; // TRF3
    estadoSigla = 'SP';
    estadoEnum = '155'; // SP
  } else if (trib.includes('TRF4')) {
    tipoPrecatorio = '4648';
    tribunalFederal = '5962'; // TRF4
    lpPrecatorios = '7502'; // TRF4
    estadoSigla = 'RS';
    estadoEnum = '149'; // RS
  } else if (trib.includes('TRF5')) {
    tipoPrecatorio = '4648';
    tribunalFederal = '5958'; // TRF5
    lpPrecatorios = '7504'; // TRF5
    estadoSigla = 'PE';
    estadoEnum = '135'; // PE
  } else if (trib.includes('TRF6')) {
    tipoPrecatorio = '4648';
    tribunalFederal = '5966'; // TRF6
    lpPrecatorios = '7506'; // TRF6
    estadoSigla = 'MG';
    estadoEnum = '125'; // MG
  } else if (trib.includes('TJSP')) {
    tipoPrecatorio = '4652'; // ESTADUAL
    tribunalEstadual = '6068'; // TJSP – São Paulo
    lpPrecatorios = '7510'; // ESTADO DE SAO PAULO
    estadoSigla = 'SP';
    estadoEnum = '155'; // SP
  } else if (trib.includes('TJRJ')) {
    tipoPrecatorio = '4652';
    tribunalEstadual = '6056'; // TJRJ – Rio de Janeiro
    lpPrecatorios = '7508'; // ESTADO RIO DE JANEIRO
    estadoSigla = 'RJ';
    estadoEnum = '141'; // RJ
  } else if (trib.includes('TJMG')) {
    tipoPrecatorio = '4652';
    tribunalEstadual = '6044'; // TJMG – Minas Gerais
    estadoSigla = 'MG';
    estadoEnum = '125'; // MG
  }

  return { estadoEnum, estadoSigla, tipoPrecatorio, tribunalFederal, tribunalEstadual, lpPrecatorios };
}

// Uma automação desse pipeline descarta deals sem responsável atribuído —
// confirmado via teste direto na API (deal sem ASSIGNED_BY_ID some
// silenciosamente logo após a criação). Enquanto não há uma fila/usuário
// definitivo, atribui ao dono do Inbound Webhook.
const BITRIX_DEAL_ASSIGNED_BY_ID = 178968;

async function bitrixCall(webhookUrl: string, method: string, payload: object) {
  const res = await fetch(`${webhookUrl.replace(/\/$/, '')}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `Falha ao chamar ${method} no Bitrix`);
  }
  return data.result;
}

/**
 * Cria o Contato (nome + CPF em todos os campos) e o Negócio (Deal) vinculado a ele,
 * preenchendo todos os campos de CPF, Processo, Oportunidade, UTMs e Relatório Completo.
 */
async function enviarLeadParaBitrix(payload: LeadPayload) {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      '[bitrix] BITRIX_WEBHOOK_URL não configurada — negócio não enviado ao Bitrix:',
      payload
    );
    return { enviado: false };
  }

  const personaLabel: Record<Persona, string> = {
    autor: 'Titular do crédito',
    advogado: 'Advogado(a)',
    broker: 'Associado / Broker',
  };

  const info = payload.infoSimples;
  let infoTribunaisTexto = '=== CONSULTA AUTOMÁTICA DE PRECATÓRIOS (INFOSIMPLES) ===\n';
  infoTribunaisTexto += `👤 Nome: ${payload.nomeCompleto}\n`;
  infoTribunaisTexto += `🪪 CPF: ${payload.cpf}\n`;
  infoTribunaisTexto += `🏢 Perfil: ${personaLabel[payload.persona] || payload.persona}\n\n`;

  let processoPrincipalNum = '';
  let oportunidadeValor = 0;
  let valorDesejadoTexto = '';
  let tribunalDestaque = '';
  let infoExtrasTexto = '';

  if (info?.executado) {
    if (info.encontrado && info.processos.length > 0) {
      infoTribunaisTexto += `🎯 PROCESSOS ENCONTRADOS (${info.totalProcessos}):\n`;
      
      // Ordena colocando precatórios primeiro
      const ordenados = [...info.processos].sort((a, b) => (b.isPrecatorio ? 1 : 0) - (a.isPrecatorio ? 1 : 0));
      const principal = ordenados[0];
      if (principal?.numeroProcesso) {
        processoPrincipalNum = principal.numeroProcesso;
        tribunalDestaque = principal.tribunal;
      }

      // Prepara o resumo visualmente limpo e espaçado para o campo [+] INFORMAÇÕES EXTRAS
      infoExtrasTexto = ordenados.map((p, i) => {
        const titulo = p.isPrecatorio ? `⭐ [PRECATÓRIO / CRÉDITO PÚBLICO] #${i + 1}` : `📋 [PROCESSO JUDICIAL] #${i + 1}`;
        let bloco = `========================================\n`;
        bloco += `${titulo}\n`;
        bloco += `========================================\n\n`;
        bloco += `• Nº Processo: ${p.numeroProcesso || 'S/N'}\n\n`;
        bloco += `• Tribunal: ${p.tribunal}\n\n`;
        if (p.classe) bloco += `• Classe: ${p.classe}\n\n`;
        if (p.assunto) bloco += `• Assunto: ${p.assunto}\n\n`;
        if (p.vara) bloco += `• Vara / Foro: ${p.vara}\n\n`;
        if (p.valorCausa) {
          const rawNum = p.valorCausa.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
          const parsed = parseFloat(rawNum);
          if (!isNaN(parsed) && parsed <= 10) {
            bloco += `• Valor de Capa: ${p.valorCausa} (Simbólico de distribuição no TJ — valor real do crédito consta no ofício/DEPRE)\n\n`;
          } else {
            bloco += `• Valor da Causa: ${p.valorCausa}\n\n`;
          }
        }
        if (p.exequente) bloco += `• Exequente / Autor: ${p.exequente}\n\n`;
        if (p.executado) bloco += `• Executado / Réu: ${p.executado}\n\n`;
        if (p.ultimaMovimentacao?.movimento) {
          bloco += `• Última Movimentação:\n  ${p.ultimaMovimentacao.movimento}\n`;
        }
        return bloco;
      }).join('\n\n\n');

      ordenados.forEach((p, idx) => {
        const estrela = p.isPrecatorio ? '⭐ ' : '';
        infoTribunaisTexto += `\n${idx + 1}. ${estrela}[${p.tribunal}] ${p.numeroProcesso || 'S/N'}\n`;
        if (p.classe) infoTribunaisTexto += `   • Classe: ${p.classe}\n`;
        if (p.assunto) infoTribunaisTexto += `   • Assunto: ${p.assunto}\n`;
        if (p.vara) infoTribunaisTexto += `   • Vara: ${p.vara}\n`;
        if (p.valorCausa) {
          infoTribunaisTexto += `   • Valor: ${p.valorCausa}\n`;
          // Tenta extrair número para oportunidade se for o principal (ignora valores simbólicos como R$ 0,01 ou R$ 1,00)
          if (idx === 0) {
            const rawNum = p.valorCausa.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(rawNum);
            if (!isNaN(parsed) && parsed > 10) {
              if (!oportunidadeValor) oportunidadeValor = parsed;
              valorDesejadoTexto = p.valorCausa;
            } else {
              valorDesejadoTexto = 'A apurar no ofício (cadastrado como R$ 0,01 simbólico no TJSP)';
            }
          }
        }
        if (p.exequente) infoTribunaisTexto += `   • Exequente: ${p.exequente}\n`;
        if (p.executado) infoTribunaisTexto += `   • Executado: ${p.executado}\n`;
        if (p.ultimaMovimentacao?.movimento) {
          infoTribunaisTexto += `   • Última Movimentação: ${p.ultimaMovimentacao.movimento}\n`;
        }
      });


    } else {
      infoTribunaisTexto += `Nenhum processo público localizado nos tribunais consultados.`;
    }

    if (info.restricoes.length > 0) {
      infoTribunaisTexto += `\n\n⚠️ TRIBUNAIS COM ACESSO RESTRITO / SEGREDO:\n` +
        info.restricoes.map(r => `• ${r.tribunal}: ${r.detalhe}`).join('\n');
    }
  }

  if (payload.utms && Object.keys(payload.utms).length > 0) {
    infoTribunaisTexto += `\n\n🎯 ORIGEM DO TRÁFEGO (MARKETING):\n`;
    if (payload.utms.utm_source) infoTribunaisTexto += `• Origem (source): ${payload.utms.utm_source}\n`;
    if (payload.utms.utm_medium) infoTribunaisTexto += `• Mídia (medium): ${payload.utms.utm_medium}\n`;
    if (payload.utms.utm_campaign) infoTribunaisTexto += `• Campanha: ${payload.utms.utm_campaign}\n`;
    if (payload.utms.utm_content) infoTribunaisTexto += `• Conteúdo: ${payload.utms.utm_content}\n`;
    if (payload.utms.utm_term) infoTribunaisTexto += `• Termo: ${payload.utms.utm_term}\n`;
    if (payload.utms.referrer) infoTribunaisTexto += `• Referrer: ${payload.utms.referrer}\n`;
  }

  // 1. Cria ou Atualiza Contato com todos os campos de CPF e UTMs
  const contactFields: Record<string, any> = {
    NAME: payload.nomeCompleto,
    [BITRIX_CONTACT_UF_CPF]: [payload.cpf],
    [BITRIX_CONTACT_UF_CPF_CNPJ]: payload.cpf,
    [BITRIX_CONTACT_UF_CPF_ALT]: payload.cpf,
    COMMENTS: infoTribunaisTexto,
    SOURCE_ID: 'WEB',
  };

  if (payload.utms?.utm_source) contactFields.UTM_SOURCE = payload.utms.utm_source;
  if (payload.utms?.utm_medium) contactFields.UTM_MEDIUM = payload.utms.utm_medium;
  if (payload.utms?.utm_campaign) contactFields.UTM_CAMPAIGN = payload.utms.utm_campaign;
  if (payload.utms?.utm_content) contactFields.UTM_CONTENT = payload.utms.utm_content;
  if (payload.utms?.utm_term) contactFields.UTM_TERM = payload.utms.utm_term;

  const contactId = await bitrixCall(webhookUrl, 'crm.contact.add', {
    fields: contactFields,
  });

  // Título dinâmico que já mostra o tribunal e o CPF na capa do card
  let dealTitle = `${payload.nomeCompleto}`;
  if (tribunalDestaque) {
    dealTitle += ` - Precatório ${tribunalDestaque}`;
  } else {
    dealTitle += ` - LP Calculadora`;
  }
  dealTitle += ` (${payload.cpf})`;

  // 2. Cria o Negócio (Deal) preenchendo todos os campos customizados
  const dealFields: Record<string, any> = {
    TITLE: dealTitle,
    CATEGORY_ID: BITRIX_DEAL_CATEGORY_ID,
    STAGE_ID: BITRIX_DEAL_STAGE_ID,
    CONTACT_ID: contactId,
    ASSIGNED_BY_ID: BITRIX_DEAL_ASSIGNED_BY_ID,
    SOURCE_ID: 'WEB',
    SOURCE_DESCRIPTION: 'Calculadora de Precatórios - LP',
    COMMENTS: infoTribunaisTexto,
    [BITRIX_DEAL_UF_CPF]: payload.cpf,
    [BITRIX_DEAL_UF_CPF_CLIENTE]: payload.cpf,
    [BITRIX_DEAL_UF_CPF_BOT]: payload.cpf,
    [BITRIX_DEAL_UF_NOME_CLIENTE]: payload.nomeCompleto,
    [BITRIX_DEAL_UF_TIPO_TRAFEGO]: BITRIX_DEAL_TIPO_TRAFEGO_PAGO_ID,
  };

  if (payload.utms?.utm_source) dealFields.UTM_SOURCE = payload.utms.utm_source;
  if (payload.utms?.utm_medium) dealFields.UTM_MEDIUM = payload.utms.utm_medium;
  if (payload.utms?.utm_campaign) dealFields.UTM_CAMPAIGN = payload.utms.utm_campaign;
  if (payload.utms?.utm_content) dealFields.UTM_CONTENT = payload.utms.utm_content;
  if (payload.utms?.utm_term) dealFields.UTM_TERM = payload.utms.utm_term;

  if (processoPrincipalNum) {
    dealFields[BITRIX_DEAL_UF_NUMERO_PROCESSO] = processoPrincipalNum;
  }

  if (infoExtrasTexto) {
    dealFields[BITRIX_DEAL_UF_INFOS_EXTRAS] = infoExtrasTexto;
  }

  if (valorDesejadoTexto) {
    dealFields[BITRIX_DEAL_UF_VALOR_DESEJADO] = valorDesejadoTexto;
  }

  const mapping = mapTribunalToBitrixIds(tribunalDestaque);
  if (mapping.estadoEnum) dealFields[BITRIX_DEAL_UF_ESTADO] = mapping.estadoEnum;
  if (mapping.estadoSigla) dealFields[BITRIX_DEAL_UF_MKT_ESTADO] = mapping.estadoSigla;
  if (mapping.tipoPrecatorio) dealFields[BITRIX_DEAL_UF_TIPO_PRECATORIO] = mapping.tipoPrecatorio;
  if (mapping.tribunalFederal) dealFields[BITRIX_DEAL_UF_TRIBUNAL_FEDERAL] = mapping.tribunalFederal;
  if (mapping.tribunalEstadual) dealFields[BITRIX_DEAL_UF_TRIBUNAL_ESTADUAL] = mapping.tribunalEstadual;
  if (mapping.lpPrecatorios) dealFields[BITRIX_DEAL_UF_LP_PRECATORIOS] = mapping.lpPrecatorios;

  if (oportunidadeValor > 0) {
    dealFields.OPPORTUNITY = oportunidadeValor;
    dealFields.CURRENCY_ID = 'BRL';
  }

  const dealId = await bitrixCall(webhookUrl, 'crm.deal.add', {
    fields: dealFields,
    params: { REGISTER_SONET_EVENT: 'Y' },
  });

  return { enviado: true, leadId: dealId, contactId };
}


export async function POST(request: Request) {
  try {
    const { nomeCompleto, cpf, persona, utms } = await request.json();

    if (!nomeCompleto || typeof nomeCompleto !== 'string' || nomeCompleto.trim().length < 3) {
      return NextResponse.json({ error: 'Nome completo inválido.' }, { status: 400 });
    }
    if (!cpf || typeof cpf !== 'string' || !isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
    }

    const cpfDigitos = cpf.replace(/\D/g, '');

    // Consulta InfoSimples por CPF em paralelo com os tribunais
    let infoSimplesResult: ResultadoConsultaInfoSimples | undefined;
    try {
      infoSimplesResult = await consultarCpfInfoSimples(cpfDigitos);
    } catch (apiErr) {
      console.error('[lead-api] Erro ao consultar InfoSimples:', apiErr);
    }

    const resultado = await enviarLeadParaBitrix({
      nomeCompleto: nomeCompleto.trim(),
      cpf: cpf.trim(),
      persona: (persona as Persona) || 'autor',
      infoSimples: infoSimplesResult,
      utms: (utms as UtmParams) || undefined,
    });

    // Card criado no Bitrix -> dispara o evento "Lead" para a Meta Conversions API
    if (resultado.enviado && resultado.leadId) {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined;
      const userAgent = request.headers.get('user-agent') || undefined;

      await enviarLeadParaMeta({
        nomeCompleto: nomeCompleto.trim(),
        cpf: cpf.trim(),
        eventId: `bitrix-deal-${resultado.leadId}`,
        ip,
        userAgent,
      }).catch((error) => {
        console.error('Erro ao enviar evento Lead para a Meta Conversions API:', error);
      });
    }

    return NextResponse.json({
      ok: true,
      ...resultado,
      apiExtractedData: infoSimplesResult || null,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/lead (Bitrix):', error);
    return NextResponse.json(
      { error: 'Falha ao registrar o lead. Tente novamente.' },
      { status: 500 }
    );
  }
}

