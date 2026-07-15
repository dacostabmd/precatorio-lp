export type Esfera = 'Federal' | 'Estadual' | 'Municipal';

const TABELAS_RISCO: Record<string, any> = {
  Federal: { prazoAnos: 1.5, taxaDescontoAnual: 0.15 },
  Estadual: {
    SP: { prazoAnos: 4.0, taxaDescontoAnual: 0.22 },
    RJ: { prazoAnos: 8.0, taxaDescontoAnual: 0.25 },
    default: { prazoAnos: 5.0, taxaDescontoAnual: 0.23 },
  },
  Municipal: { prazoAnos: 6.0, taxaDescontoAnual: 0.24 },
};

export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function calcularAntecipacao(
  valorFace: number,
  esfera: Esfera,
  uf: string,
  possuiPrioridade: boolean
) {
  let config = TABELAS_RISCO[esfera];
  if (esfera === 'Estadual') {
    config = TABELAS_RISCO.Estadual[uf] || TABELAS_RISCO.Estadual.default;
  }
  if (!config) return { valorMinimo: 0, valorMaximo: 0 };
  let anosEspera = config.prazoAnos;
  if (possuiPrioridade) anosEspera = Math.max(1, anosEspera * 0.5);
  const valorPropostoBase = valorFace / Math.pow(1 + config.taxaDescontoAnual, anosEspera);
  return {
    valorMinimo: valorPropostoBase * 0.93,
    valorMaximo: valorPropostoBase * 1.05,
  };
}

export const MOCK_DOC = {
  credor: 'João Batista Ferreira',
  cpf: '***.456.789-**',
  processo: '0001234-56.2015.8.26.0053',
  tribunal: 'TJSP',
  devedor: 'Estado de São Paulo',
  esfera: 'Estadual' as Esfera,
  uf: 'SP',
  natureza: 'Alimentar',
  valorPrincipal: 480000,
  dataBase: '03/2024',
};

export const DOCS_NECESSARIOS = [
  'Cópia do RG/CNPJ do credor ou representante',
  'Procuração ou contrato social atualizado',
  'Certidão do processo atualizada',
  'Comprovante de residência ou sede',
];

export const FAQ_DATA = [
  {
    question: 'O que a IA realmente faz na análise?',
    answer:
      'Ela faz em segundos o que uma triagem manual levaria dias: lê o seu ofício ou precatório, identifica credor, ente devedor, tribunal, natureza e valores, e aplica as tabelas vigentes para calcular a faixa indicativa de antecipação. E antes de qualquer proposta oficial, nossa equipe jurídica e financeira revisa tudo — você tem a agilidade da tecnologia com a segurança da validação humana.',
  },
  {
    question: 'Preciso enviar o documento original?',
    answer:
      'Não. Um PDF legível do ofício ou precatório — o mesmo documento que você já recebeu da Justiça — é tudo o que a IA precisa para começar. Os demais documentos só são solicitados se você decidir avançar com a proposta, sempre por canal seguro.',
  },
  {
    question: 'Os valores apresentados são definitivos?',
    answer:
      'A faixa apresentada é uma estimativa séria, calculada sobre os dados reais do seu documento e as tabelas vigentes — não um número inflado para chamar sua atenção. O valor definitivo é confirmado após a revisão documental e jurídica do consultor, e você só decide depois de vê-lo preto no branco.',
  },
  {
    question: 'Meus dados e documentos estão protegidos?',
    answer:
      'Sim. Seus dados trafegam em ambiente seguro, são usados exclusivamente para a análise do seu crédito e tratados conforme a LGPD. Nada é compartilhado com terceiros, e você pode solicitar a exclusão a qualquer momento.',
  },
  {
    question: 'Existe custo para a análise?',
    answer:
      'Nenhum. A análise da IA, a revisão do consultor e a proposta são 100% gratuitas e sem compromisso. Você só avança se — e quando — fizer sentido para você. Conhecer o valor do seu direito não deve custar nada.',
  },
];

// ─── Motor de cálculo (conforme lógica anexada) ───────────────────────────
// Tabela progressiva mensal do IR/RRA (Rendimentos Recebidos Acumuladamente)
const TABELA_RRA = [
  { limite: 2428.8, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { limite: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { limite: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { limite: Infinity, aliquota: 0.275, deducao: 908.73 },
];

export function calcIrRra(principalTributavel: number, meses: number) {
  if (!principalTributavel || !meses) return 0;
  const base = principalTributavel / meses;
  const faixa = TABELA_RRA.find((f) => base <= f.limite)!;
  const irMensal = Math.max(0, base * faixa.aliquota - faixa.deducao);
  return irMensal * meses;
}

// Ofício de demonstração (Federal Alimentar, LOA 2027)
export const DEMO_OFICIO = {
  credor: 'João Batista Ferreira',
  cpf: '***.456.789-**',
  processo: '5001234-56.2021.4.03.6100',
  tribunal: 'TRF3',
  ente: 'União Federal',
  natureza: 'Federal Alimentar',
  loa: 2027,
  bruto: 480000,
  honorarios: 72000, // contratuais (15%)
  pss: 18000,
  principalTributavel: 300000,
  mesesRra: 36,
};

export type Analise = typeof DEMO_OFICIO & {
  irRra: number;
  liquido: number;
  percentual: number;
  margemAbertura: number;
  limiteInterno: number;
  propostaInicial: number;
  faixaMin: number;
  faixaMax: number;
};

// Regra de ouro: primeiro apura o líquido disponível para cessão, só depois aplica a tabela comercial.
export function analisarOficio(doc: typeof DEMO_OFICIO): Analise {
  const irRra = calcIrRra(doc.principalTributavel, doc.mesesRra);
  const liquido = doc.bruto - doc.honorarios - irRra - doc.pss;
  const percentual = 0.72; // Federal Alimentar 2027
  const margemAbertura = 0.05; // padrão
  const limiteInterno = liquido * percentual;
  const propostaInicial = limiteInterno * (1 - margemAbertura);
  return {
    ...doc,
    irRra,
    liquido,
    percentual,
    margemAbertura,
    limiteInterno,
    propostaInicial,
    faixaMin: propostaInicial,
    faixaMax: limiteInterno,
  };
}

export const REVIEWS = [
  { name: 'Família Frota', initials: 'FF', image: '/FamiliaFrota.png', quote: 'Graças a essa negociação, conseguimos viver um momento que jamais esqueceremos.' },
  { name: 'Sra. Ana Paula', initials: 'AP', image: '/Sra.AnaPaula.jpg', quote: 'Depois de 20 anos esperando, hoje estamos com nossa vitória nas mãos.' },
  { name: 'Sr. Kléber', initials: 'K', image: '/Kleber.jpg', quote: 'Eles cumpriram exatamente tudo o que prometeram.' },
  { name: 'Sr. Alexandre e Sra. Rita', initials: 'AR', image: '/Sr.AlexandreeSra.Rita.jpg', quote: 'O dinheiro caiu na hora, exatamente como foi prometido.' },
];
