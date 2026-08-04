export type Persona = 'autor' | 'advogado' | 'broker';
export type Esfera = 'Federal' | 'Estadual' | 'Municipal';
export type Natureza = 'Alimentar' | 'Comum' | 'Comum Tributário';

export interface ParametrosOficio {
  credor?: string;
  cpfCnpj?: string;
  processo?: string;
  tribunal?: string;
  enteDevedor?: string;
  esfera: Esfera;
  natureza: Natureza;
  uf?: string; // SP, RJ, BA, etc.
  loa: number; // 2026, 2027, 2028...
  dataBase: string; // YYYY-MM ou MM/YYYY ou DD/MM/YYYY
  dataCalculo?: string; // YYYY-MM
  brutoOriginal: number;
  pssOriginal?: number;
  outrosOriginal?: number;
  parciaisOriginal?: number;
  penhorasOriginal?: number;
  honorariosPct?: number; // ex: 20 para 20%
  irInformado?: number; // Se houver IR fixado no ofício
  principalTributavel?: number; // Para RRA
  mesesRra?: number; // Para RRA
  margemAberturaPct?: number; // Padrão 5%
  persona?: Persona; // autor | advogado | broker
}

export interface ResultadoCalculo {
  mesesDecorridos: number;
  fatorF: number;
  brutoAtualizado: number;
  pssAtualizado: number;
  outrosAtualizados: number;
  parciaisAtualizados: number;
  penhorasAtualizadas: number;
  outrosTotal: number;
  liquidoIntermediario: number;
  honorariosValor: number;
  honorariosPct: number;
  principalTributavelAtualizado: number;
  irTotal: number;
  isIrInformado: boolean;
  liquidoFinal: number;
  percentualComercialPct: number;
  limiteInterno: number;
  propostaInicial: number;
  margemNegociacao: number;
  personaAplicada: Persona;
}

/**
 * Calcula a quantidade de meses decorridos entre a data-base e a data de cálculo (ou hoje).
 */
export function calcularMesesDecorridos(dataBaseStr: string, dataCalculoStr?: string): number {
  if (!dataBaseStr) return 0;

  let anoBase = 0;
  let mesBase = 0;

  // Trata formatos: YYYY-MM, DD/MM/YYYY, MM/YYYY
  if (dataBaseStr.includes('-')) {
    const parts = dataBaseStr.split('-');
    anoBase = parseInt(parts[0], 10);
    mesBase = parseInt(parts[1], 10);
  } else if (dataBaseStr.includes('/')) {
    const parts = dataBaseStr.split('/');
    if (parts.length === 3) {
      mesBase = parseInt(parts[1], 10);
      anoBase = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      mesBase = parseInt(parts[0], 10);
      anoBase = parseInt(parts[1], 10);
    }
  }

  if (!anoBase || !mesBase || isNaN(anoBase) || isNaN(mesBase)) {
    return 0;
  }

  const agora = dataCalculoStr ? new Date(dataCalculoStr) : new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1; // 1 to 12

  const meses = (anoAtual - anoBase) * 12 + (mesAtual - mesBase);
  return Math.max(0, meses);
}

/**
 * Tabela progressiva mensal do IR por RRA
 */
const TABELA_PROGRESSIVA_RRA = [
  { limite: 2428.80, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { limite: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { limite: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { limite: Infinity, aliquota: 0.275, deducao: 908.73 },
];

/**
 * Passo 5: Apuração do Imposto de Renda RRA
 */
export function calcularIrRra(
  irInformado: number | undefined,
  fatorF: number,
  principalTributavel: number | undefined,
  mesesRra: number | undefined
): { irTotal: number; isIrInformado: boolean; ptAtualizado: number } {
  if (irInformado !== undefined && irInformado !== null && irInformado >= 0) {
    return {
      irTotal: irInformado * fatorF,
      isIrInformado: true,
      ptAtualizado: (principalTributavel || 0) * fatorF,
    };
  }

  if (principalTributavel && mesesRra && mesesRra > 0) {
    const ptAtualizado = principalTributavel * fatorF;
    const baseMensal = ptAtualizado / mesesRra;

    const faixa = TABELA_PROGRESSIVA_RRA.find((f) => baseMensal <= f.limite)!;
    const irMensal = Math.max(0, baseMensal * faixa.aliquota - faixa.deducao);
    const irTotal = irMensal * mesesRra;

    return {
      irTotal,
      isIrInformado: false,
      ptAtualizado,
    };
  }

  return {
    irTotal: 0,
    isIrInformado: false,
    ptAtualizado: 0,
  };
}

/**
 * Passo 7: Determina o Percentual Comercial (% Tabela) com regras por Persona
 */
export function obterPercentualComercial(
  esfera: Esfera,
  natureza: Natureza,
  loa: number,
  uf: string = 'SP',
  persona: Persona = 'autor'
): number {
  let pctBase = 0;

  if (esfera === 'Federal') {
    if (natureza === 'Alimentar') {
      pctBase = loa <= 2027 ? 72 : 62.5;
    } else if (natureza === 'Comum Tributário') {
      pctBase = loa <= 2027 ? 69.5 : 59;
    } else {
      // Comum
      pctBase = loa <= 2027 ? 68.5 : 57.5;
    }
  } else if (esfera === 'Estadual') {
    const state = (uf || 'SP').toUpperCase();
    if (state === 'SP') {
      pctBase = loa <= 2026 ? 30.5 : loa === 2027 ? 25 : 20;
    } else if (state === 'RJ') {
      pctBase = loa <= 2026 ? 20.5 : loa === 2027 ? 20.5 : 20;
    } else if (state === 'BA') {
      pctBase = loa <= 2026 ? 31 : loa === 2027 ? 25 : 25;
    } else {
      pctBase = loa <= 2026 ? 28 : loa === 2027 ? 23 : 18;
    }
  } else {
    // Municipal
    pctBase = loa <= 2026 ? 25 : loa === 2027 ? 20 : 15;
  }

  // --- Regras por Persona ---
  // Broker (Associado): recebe +1% sobre a tabela
  // Advogado: 2027 -> 70% (ou +1%), 2028 -> 60% + 1% = 61%
  // Autor (Credor): tabela base
  if (persona === 'broker') {
    pctBase += 1.0;
  } else if (persona === 'advogado') {
    if (loa <= 2027) {
      pctBase = Math.max(pctBase + 1.0, 70.0);
    } else {
      pctBase = Math.max(pctBase + 1.0, 61.0);
    }
  }

  return pctBase;
}

/**
 * Motor Principal: Executa as 8 Etapas do Cálculo de Precatórios.
 *
 * O fator de atualização monetária é INJETADO (`fatorF`), não calculado aqui —
 * ele vem de `obterFatorAtualizacao` em lib/indices.ts, que aplica os índices
 * oficiais do Banco Central por trecho de regime (IPCA-E + juros até 11/2021,
 * SELIC isolada a partir de 12/2021).
 *
 * Essa injeção é deliberada: a versão anterior calculava o fator internamente
 * com taxas fixas (juros de mora 0,5%/mês MULTIPLICADO por uma "SELIC" fixa de
 * 1,1875%/mês), o que superestimava o valor devido em ~2x — 3,71x contra 1,87x
 * da SELIC real em 78 meses. Ver CALCULO.md §3. Mantendo o motor puro e sem
 * fonte de índice embutida, fica impossível voltar a estimar taxa por acidente.
 *
 * @param fatorF fator de atualização da data-base até a data de cálculo
 */
export function executarCalculoPrecatorio(
  params: ParametrosOficio,
  fatorF: number
): ResultadoCalculo {
  const persona: Persona = params.persona || 'autor';
  const margemAberturaPct = params.margemAberturaPct ?? 5.0;
  const honorariosPct = params.honorariosPct ?? 0;

  // Passo 1: Atualização Monetária (Data-Base -> Data de cálculo)
  const mesesDecorridos = calcularMesesDecorridos(params.dataBase, params.dataCalculo);

  if (!Number.isFinite(fatorF) || fatorF < 1) {
    throw new Error(
      `Fator de atualização inválido (${fatorF}). O fator deve vir de obterFatorAtualizacao().`
    );
  }

  const brutoAtualizado = params.brutoOriginal * fatorF;
  const pssAtualizado = (params.pssOriginal || 0) * fatorF;
  const outrosAtualizados = (params.outrosOriginal || 0) * fatorF;
  const parciaisAtualizados = (params.parciaisOriginal || 0) * fatorF;
  const penhorasAtualizadas = (params.penhorasOriginal || 0) * fatorF;

  // Passo 2: Consolidação dos Outros Descontos
  const outrosTotal = pssAtualizado + outrosAtualizados + parciaisAtualizados + penhorasAtualizadas;

  // Passo 3: Líquido Intermediário
  const liquidoIntermediario = brutoAtualizado - outrosTotal;

  // Passo 4: Honorários Advocatícios Contratuais
  const honorariosValor = Math.max(0, liquidoIntermediario) * (honorariosPct / 100);

  // Passo 5: Imposto de Renda por RRA
  const { irTotal, isIrInformado, ptAtualizado } = calcularIrRra(
    params.irInformado,
    fatorF,
    params.principalTributavel,
    params.mesesRra
  );

  // Passo 6: Líquido Final do Credor
  const liquidoFinal = liquidoIntermediario - honorariosValor - irTotal;

  // Passo 7: Tabela Comercial & Regras por Persona
  const percentualComercialPct = obterPercentualComercial(
    params.esfera,
    params.natureza,
    params.loa,
    params.uf,
    persona
  );

  // Passo 8: Formação da Proposta Comercial e Margem de Negociação
  const limiteInterno = liquidoFinal * (percentualComercialPct / 100);
  const propostaInicial = limiteInterno * (1 - margemAberturaPct / 100);
  const margemNegociacao = limiteInterno - propostaInicial;

  return {
    mesesDecorridos,
    fatorF,
    brutoAtualizado,
    pssAtualizado,
    outrosAtualizados,
    parciaisAtualizados,
    penhorasAtualizadas,
    outrosTotal,
    liquidoIntermediario,
    honorariosValor,
    honorariosPct,
    principalTributavelAtualizado: ptAtualizado,
    irTotal,
    isIrInformado,
    liquidoFinal,
    percentualComercialPct,
    limiteInterno,
    propostaInicial,
    margemNegociacao,
    personaAplicada: persona,
  };
}
