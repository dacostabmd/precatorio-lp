import { ChatOpenAI } from '@langchain/openai';
import { PDFParse } from 'pdf-parse';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// O PDF.js (usado internamente por pdf-parse) exige um worker script — em
// runtime de servidor Next.js/Turbopack a resolução automática desse worker
// falha, então apontamos explicitamente para o arquivo físico em disco (como
// file:// URL — obrigatório no ESM loader do Node/Windows).
PDFParse.setWorker(
  pathToFileURL(path.join(process.cwd(), 'node_modules/pdf-parse/dist/worker/pdf.worker.mjs')).href
);
import { z } from 'zod';
import {
  executarCalculoPrecatorio,
  ParametrosOficio,
  ResultadoCalculo,
  Persona,
} from './calculator';
import { obterFatorAtualizacao, DetalheAtualizacao, parseCompetencia } from './indices';

// Abaixo deste tamanho de texto extraído, tratamos o PDF como "sem camada de
// texto" (escaneado) — PDFs digitais reais de ofício têm centenas/milhares de
// caracteres; ruído de metadados fica bem abaixo disso.
const MIN_TEXTO_PDF_VALIDO = 40;

// Páginas rasterizadas enviadas à visão. Ofícios requisitórios raramente passam
// de 3 páginas; o teto limita custo e latência sem perder o conteúdo relevante.
const MAX_PAGINAS_VISAO = 4;

// Escala de renderização. Em 2x uma página A4 sai ~1190x1684 px, resolução
// suficiente para o modelo ler valores monetários e nomes sem ambiguidade.
const ESCALA_RASTERIZACAO = 2;

export interface PaginaImagem {
  base64: string;
  mimeType: string;
}

export type EntradaAnalise =
  // `pdfBuffer` é preservado no caminho de texto para permitir o fallback para
  // visão quando a camada de texto existe mas não contém os dados do ofício
  // (típico de scan com OCR pobre embutido).
  | { tipo: 'texto'; texto: string; pdfBuffer?: Buffer }
  | { tipo: 'imagem'; paginas: PaginaImagem[] };

/**
 * Renderiza as primeiras páginas do PDF como PNG.
 *
 * Obrigatório para o caminho de visão: a API da OpenAI aceita apenas
 * PNG/JPEG/WEBP/GIF em `image_url` e rejeita `application/pdf` com
 * "Invalid MIME type" (HTTP 400) — enviar o PDF cru nunca funciona.
 */
async function rasterizarPdf(fileBuffer: Buffer): Promise<PaginaImagem[]> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const shot = await parser.getScreenshot({ scale: ESCALA_RASTERIZACAO });
    return shot.pages.slice(0, MAX_PAGINAS_VISAO).map((p) => ({
      base64: Buffer.from(p.data).toString('base64'),
      mimeType: 'image/png',
    }));
  } finally {
    await parser.destroy();
  }
}

/**
 * Decide como o documento do ofício deve ser processado: tenta primeiro a
 * camada de texto real do PDF (rápido e barato, via gpt-4o-mini). Se o PDF
 * não tiver texto selecionável (ofício escaneado), rasteriza as páginas em PNG
 * para a visão computacional (gpt-4o) — sem depender de OCR local.
 */
export async function prepararEntradaDocumento(
  fileBuffer: Buffer,
  mimeType: string
): Promise<EntradaAnalise> {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: fileBuffer });
    let texto = '';
    try {
      const textoResult = await parser.getText();
      texto = (textoResult.text || '').trim();
    } finally {
      await parser.destroy();
    }

    if (texto.length >= MIN_TEXTO_PDF_VALIDO) {
      return { tipo: 'texto', texto, pdfBuffer: fileBuffer };
    }

    // PDF escaneado — precisa virar imagem de verdade antes de ir à visão.
    return { tipo: 'imagem', paginas: await rasterizarPdf(fileBuffer) };
  }

  // Já é imagem (JPG/PNG/WEBP) — visão direta.
  return {
    tipo: 'imagem',
    paginas: [{ base64: fileBuffer.toString('base64'), mimeType }],
  };
}

// Schema Zod para extração de dados do Ofício (OCR / Texto)
export const oficioExtractionSchema = z.object({
  credor: z
    .string()
    .optional()
    .describe(
      'Nome completo do credor (titular do crédito) — em ofícios requisitórios costuma vir logo após o rótulo "Autor:" na seção "DADOS PROCESSUAIS" / "Partes", junto com "Réu:" (devedor) e "Procurador:" (advogado). Também pode aparecer como "Requerente:", "Credor:", "Exequente:" ou "Beneficiário:". É SEMPRE o nome ao lado de "Autor" ou "Requerente" — NUNCA o nome ao lado de "Réu", "Procurador", "Executado" ou o tribunal. Deixe vazio apenas se realmente não constar no documento.'
    ),
  cpfCnpj: z.string().optional().describe('CPF ou CNPJ do credor'),
  processo: z.string().optional().describe('Número do processo judicial (CNJ)'),
  tribunal: z.string().optional().describe('Tribunal expedidor (ex: TRF3, TJSP, TRF1)'),
  enteDevedor: z.string().optional().describe('Ente devedor (ex: União Federal, Estado de SP, Município de SP)'),
  // Os campos críticos abaixo NÃO têm valor default: um default silencioso faria
  // a calculadora produzir uma proposta em reais com aparência de certeza a
  // partir de um dado inventado (ex: data-base fictícia => meses decorridos
  // fictícios; LOA/UF fictícias => tabela comercial errada). Quando ausentes,
  // `validarExtracao` sinaliza e a UI marca o campo como não identificado.
  // `.catch(undefined)` em todo campo com tipo restrito (enum/number/boolean):
  // quando o documento está ilegível ou o modelo "desiste", ele por vezes ecoa o
  // próprio rótulo do campo como valor (ex.: loa="ANO LOA", esfera="") em vez de
  // omitir o campo. Sem o catch, esse valor incompatível quebra a validação do
  // `functionCalling` inteira — o objeto inteiro falha a parsear e a extração
  // vira uma exceção genérica (500), em vez de cair no fluxo normal de
  // "campo ausente" que `validarExtracao` já trata. Strings livres não precisam
  // do catch: qualquer string é um valor válido para elas.
  esfera: z.enum(['Federal', 'Estadual', 'Municipal']).optional().catch(undefined).describe('Esfera devedora'),
  natureza: z
    .enum(['Alimentar', 'Comum', 'Comum Tributário'])
    .optional()
    .catch(undefined)
    .describe(
      'Natureza do CRÉDITO. ATENÇÃO À ARMADILHA: use o TÍTULO do ofício (ex: "OFÍCIO REQUISITÓRIO DE PAGAMENTO DE VERBA ALIMENTAR" => Alimentar) e não o campo "natureza da obrigação (assunto)", que descreve o RITO PROCESSUAL — "Procedimento Comum" ali NÃO significa natureza Comum. Indícios de Alimentar: título com "verba alimentar", condição de servidor/pensionista/aposentado, salários, proventos, pensão, benefício previdenciário. Se o ofício declarar "Não é Tributário", NUNCA classifique como "Comum Tributário".'
    ),
  uf: z.string().optional().describe('UF do Tribunal / Ente devedor'),
  loa: z
    .number()
    .optional()
    .catch(undefined)
    .describe(
      'Ano previsto para pagamento na LOA, APENAS se declarado explicitamente no ofício. Não infira a partir de datas de trânsito em julgado ou do ano do documento — deixe vazio se não constar.'
    ),
  dataBase: z.string().optional().describe('Data-base do cálculo (YYYY-MM ou MM/YYYY)'),
  brutoOriginal: z
    .number()
    .optional()
    .catch(undefined)
    .describe('Valor bruto da requisição / valor bruto original expedido no ofício'),
  pssOriginal: z
    .number()
    .optional()
    .catch(undefined)
    .describe(
      'Valor do desconto previdenciário / contribuição PSS retida (ex: item "valor do desconto previdenciário")'
    ),
  outrosOriginal: z.number().optional().catch(undefined).describe('Outros descontos ou deduções legais'),
  penhorasOriginal: z.number().optional().catch(undefined).describe('Valores de penhoras averbadas'),
  parciaisOriginal: z.number().optional().catch(undefined).describe('Valores já recebidos em parciais'),
  // Honorário CONTRATUAL é acordo privado entre credor e advogado — não consta
  // de ofício requisitório. Sem default: é perguntado ao usuário no chat e, se
  // ausente, entra em `camposAssumidos`.
  honorariosPct: z
    .number()
    .optional()
    .catch(undefined)
    .describe(
      'Percentual de honorários advocatícios CONTRATUAIS (%), somente se explicitamente informado. Normalmente NÃO consta em ofício requisitório — deixe vazio nesse caso.'
    ),
  principalTributavel: z
    .number()
    .optional()
    .catch(undefined)
    .describe(
      'Valor Principal (parcela principal do crédito, base tributável do IR por RRA). Nos ofícios do TJ costuma vir no item "Valor Principal", separado de "Valor Juros" e "Correção Monetária".'
    ),
  valorJuros: z
    .number()
    .optional()
    .catch(undefined)
    .describe('Valor dos Juros discriminado no ofício (item "Valor Juros"), quando informado separadamente.'),
  correcaoMonetaria: z
    .number()
    .optional()
    .catch(undefined)
    .describe('Valor de Correção Monetária discriminado no ofício, quando informado separadamente.'),
  // O modelo erra aritmética de calendário; extraímos o período bruto e o número
  // de meses é calculado em código (ver derivarMesesRra).
  periodoPagamentosInicio: z
    .string()
    .optional()
    .describe(
      'Início do período de competência dos valores cobrados, no formato YYYY-MM. Vem do item "Pagamentos pleiteados na ação" (ex: "05/1990 a 04/2013" => 1990-05).'
    ),
  periodoPagamentosFim: z
    .string()
    .optional()
    .describe('Fim do período de competência dos valores cobrados, no formato YYYY-MM (ex: "05/1990 a 04/2013" => 2013-04).'),
  mesesRra: z
    .number()
    .optional()
    .catch(undefined)
    .describe(
      'Quantidade de meses de RRA, apenas se o ofício declarar o número explicitamente. Prefira preencher periodoPagamentosInicio/Fim — a contagem é feita em código.'
    ),
  irInformado: z.number().optional().catch(undefined).describe('Imposto de renda retido fixado se houver no ofício'),
  incideIr: z
    .boolean()
    .optional()
    .catch(undefined)
    .describe('true se o ofício declarar que incide Imposto de Renda (ex: item "Incide IR").'),
  isTributario: z
    .boolean()
    .optional()
    .catch(undefined)
    .describe('false se o ofício declarar "Não é Tributário"; true se declarar que é tributário.'),
  tipoRequisicao: z
    .string()
    .optional()
    .describe('Tipo de requisição declarado no ofício (ex: "Originária", "Complementar").'),
  // Dados de preferência constitucional (§2º do art. 100 da CF) — determinam
  // prioridade na fila de pagamento e, portanto, o prazo esperado de recebimento.
  dataNascimento: z
    .string()
    .optional()
    .describe(
      'Data de nascimento do beneficiário/credor no formato YYYY-MM-DD, quando o ofício informar (usada para preferência de idoso).'
    ),
  portadorDoencaGrave: z
    .boolean()
    .optional()
    .catch(undefined)
    .describe('true se o ofício indicar que o beneficiário é portador de doença grave.'),
  pessoaComDeficiencia: z
    .boolean()
    .optional()
    .catch(undefined)
    .describe('true se o ofício indicar que o beneficiário é pessoa com deficiência.'),
});

export type OficioExtraido = z.infer<typeof oficioExtractionSchema>;

/**
 * Erro cuja mensagem é segura e útil para exibir ao usuário final: o documento
 * enviado não permite um cálculo confiável. Distingue-se de falhas internas
 * (rede, chave de API, bug), que nunca devem vazar detalhe técnico na tela.
 */
export class ErroDocumentoIlegivel extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroDocumentoIlegivel';
  }
}

// Valores usados quando um campo crítico não vem do documento. Ficam explícitos
// aqui (e não como `.default()` no schema) justamente para que a origem do dado
// seja rastreável: todo campo preenchido daqui entra em `camposAssumidos`.
const FALLBACKS = {
  esfera: 'Federal' as const,
  natureza: 'Alimentar' as const,
  uf: 'SP',
  loa: 2027,
  // Honorário contratual não consta em ofício. 15% é a premissa mais comum de
  // mercado; assumir 0% seria pior, pois inflaria o líquido e, com ele, a
  // proposta. Fica registrado em camposAssumidos e deve ser confirmado no chat.
  honorariosPct: 15,
};

export interface ValidacaoExtracao {
  /** Campos essenciais que a IA não conseguiu ler no documento. */
  camposFaltando: string[];
  /** Campos preenchidos por fallback interno — o cálculo é estimativa, não leitura. */
  camposAssumidos: string[];
  /** Campos cujo valor extraído não foi localizado no texto do documento (possível alucinação). */
  camposSuspeitos: string[];
  /** true quando faltam dados que mudam materialmente o resultado financeiro. */
  exigeConfirmacao: boolean;
}

const LABELS_CAMPOS: Record<string, string> = {
  credor: 'Nome do credor',
  brutoOriginal: 'Valor bruto original',
  dataBase: 'Data-base',
  loa: 'Ano da LOA',
  esfera: 'Esfera devedora',
  natureza: 'Natureza do crédito',
  uf: 'UF',
  honorariosPct: 'Honorários contratuais',
  baseIr: 'Base de cálculo do IR',
  composicaoValores: 'Composição dos valores (principal + juros)',
};

/** Normaliza para comparação tolerante a acento, caixa e espaçamento. */
function normalizarTexto(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Quando o documento está ilegível, o modelo às vezes "desiste" ecoando o
// próprio rótulo do campo como se fosse o dado lido (ex.: credor="NOME DO
// CREDOR", dataBase="DATA BASE"). Para campos numéricos/enum o `.catch()` do
// Zod acima já neutraliza isso, mas campos de texto livre aceitam qualquer
// string — sem este filtro, o rótulo ecoado passaria como leitura legítima
// (o mesmo problema de dado fantasma corrigido antes para nomes plausíveis,
// só que aqui o padrão é o texto da própria descrição do schema).
const PLACEHOLDERS_POR_CAMPO: Record<string, string[]> = {
  credor: ['NOME DO CREDOR', 'CREDOR', 'NOME DO BENEFICIARIO', 'BENEFICIARIO', 'NOME COMPLETO DO CREDOR'],
  cpfCnpj: ['CPF DO CREDOR', 'CPF/CNPJ', 'CPF OU CNPJ', 'CPF OU CNPJ DO CREDOR', 'CPF DO BENEFICIARIO'],
  processo: ['NUMERO DO PROCESSO', 'NUMERO DO PROCESSO JUDICIAL', 'NUMERO DO PROCESSO (CNJ)'],
  tribunal: ['TRIBUNAL EXPEDIDOR', 'TRIBUNAL'],
  enteDevedor: ['NOME DO ENTE DEVEDOR', 'ENTE DEVEDOR'],
  uf: ['UF DO TRIBUNAL', 'UF DO TRIBUNAL / ENTE DEVEDOR', 'UF'],
  dataBase: ['DATA BASE', 'DATA-BASE', 'DATA BASE DO CALCULO'],
  tipoRequisicao: ['TIPO DE REQUISICAO', 'TIPO DE REQUISICAO DECLARADO NO OFICIO'],
  dataNascimento: ['DATA DE NASCIMENTO', 'DATA DE NASCIMENTO DO BENEFICIARIO'],
  periodoPagamentosInicio: ['PERIODO INICIO', 'INICIO DO PERIODO'],
  periodoPagamentosFim: ['PERIODO FIM', 'FIM DO PERIODO'],
};

function ehPlaceholderEcoado(campo: string, valor: string): boolean {
  const candidatos = PLACEHOLDERS_POR_CAMPO[campo];
  if (!candidatos) return false;
  const norm = normalizarTexto(valor);
  return candidatos.some((c) => normalizarTexto(c) === norm);
}

/**
 * Remove valores de campos de texto que são apenas o rótulo do campo ecoado
 * de volta pelo modelo — trata como campo não lido, não como dado real.
 */
function sanitizarPlaceholders(extraido: OficioExtraido): OficioExtraido {
  const limpo = { ...extraido };
  for (const campo of Object.keys(PLACEHOLDERS_POR_CAMPO) as (keyof OficioExtraido)[]) {
    const valor = limpo[campo];
    if (typeof valor === 'string' && ehPlaceholderEcoado(campo, valor)) {
      delete limpo[campo];
    }
  }
  return limpo;
}

/** Verifica se um número extraído aparece no texto em alguma grafia usual pt-BR. */
function numeroApareceNoTexto(valor: number, texto: string): boolean {
  const semEspacos = texto.replace(/\s/g, '');
  const inteiro = Math.round(valor);
  const variantes = [
    inteiro.toLocaleString('pt-BR'),
    valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    String(inteiro),
  ];
  return variantes.some((v) => semEspacos.includes(v.replace(/\s/g, '')));
}

/**
 * Confere a extração contra o documento de origem. No caminho de texto podemos
 * validar por ancoragem — se o nome ou o valor extraído não existe no texto do
 * PDF, é alucinação do modelo, não leitura. No caminho de visão não há texto
 * confiável para comparar, então só checamos ausência de campos.
 */
export function validarExtracao(extraido: OficioExtraido, textoFonte?: string): ValidacaoExtracao {
  const camposFaltando: string[] = [];
  const camposAssumidos: string[] = [];
  const camposSuspeitos: string[] = [];

  if (!extraido.credor || extraido.credor.trim().length < 3) camposFaltando.push('credor');
  if (typeof extraido.brutoOriginal !== 'number' || extraido.brutoOriginal <= 0) {
    camposFaltando.push('brutoOriginal');
  }
  if (!extraido.dataBase) camposFaltando.push('dataBase');

  // honorariosPct entra aqui porque honorário contratual é acordo privado e não
  // consta de ofício requisitório — assumir um percentual muda o líquido final.
  for (const campo of ['esfera', 'natureza', 'loa', 'honorariosPct'] as const) {
    if (extraido[campo] === undefined || extraido[campo] === null) {
      camposAssumidos.push(campo);
    }
  }

  // A UF só é "assumida" se nem a extração nem a derivação pelo tribunal/ente
  // conseguirem determiná-la.
  if (!derivarUf(extraido)) camposAssumidos.push('uf');

  // Sem o Valor Principal e sem o período de competência não há base para o IR
  // por RRA — o imposto sairia zerado mesmo em ofício que declara "Incide IR".
  if (extraido.incideIr) {
    const semPrincipal = !extraido.principalTributavel || extraido.principalTributavel <= 0;
    const semPeriodo = derivarMesesRra(extraido) <= 0;
    if (semPrincipal || semPeriodo) camposAssumidos.push('baseIr');
  }

  // Conferência de consistência: Principal + Juros + Correção deve fechar com o
  // bruto. Divergência indica leitura errada de algum dos valores.
  if (
    typeof extraido.brutoOriginal === 'number' &&
    typeof extraido.principalTributavel === 'number' &&
    typeof extraido.valorJuros === 'number' &&
    extraido.principalTributavel > 0 &&
    extraido.valorJuros > 0
  ) {
    const soma = extraido.principalTributavel + extraido.valorJuros + (extraido.correcaoMonetaria || 0);
    const divergencia = Math.abs(soma - extraido.brutoOriginal);
    // tolera 1% de diferença (arredondamentos do próprio ofício)
    if (divergencia > extraido.brutoOriginal * 0.01) {
      camposSuspeitos.push('composicaoValores');
    }
  }

  if (textoFonte) {
    const textoNorm = normalizarTexto(textoFonte);
    if (extraido.credor && !textoNorm.includes(normalizarTexto(extraido.credor))) {
      camposSuspeitos.push('credor');
    }
    if (typeof extraido.brutoOriginal === 'number' && extraido.brutoOriginal > 0) {
      if (!numeroApareceNoTexto(extraido.brutoOriginal, textoFonte)) {
        camposSuspeitos.push('brutoOriginal');
      }
    }
  }

  // Faltar valor bruto ou data-base inviabiliza um número confiável; nome do
  // credor sozinho não impede o cálculo (o consultor confirma depois).
  const exigeConfirmacao =
    camposFaltando.some((c) => c === 'brutoOriginal' || c === 'dataBase') ||
    camposSuspeitos.length > 0;

  return { camposFaltando, camposAssumidos, camposSuspeitos, exigeConfirmacao };
}

export function rotuloCampo(campo: string): string {
  return LABELS_CAMPOS[campo] || campo;
}

/**
 * Número de meses de RRA a partir do período de competência do crédito.
 * Feito em código porque LLM erra contagem de calendário: "05/1990 a 04/2013"
 * são 276 meses, e um erro aqui distorce a base mensal do IR e, com ela, a
 * alíquota da tabela progressiva.
 */
export function derivarMesesRra(extraido: OficioExtraido): number {
  const ini = parseCompetencia(extraido.periodoPagamentosInicio || '');
  const fim = parseCompetencia(extraido.periodoPagamentosFim || '');

  if (ini && fim) {
    const meses = (fim.ano - ini.ano) * 12 + (fim.mes - ini.mes) + 1; // ambos inclusive
    if (meses > 0 && meses < 1200) return meses;
  }

  // Fallback: número declarado explicitamente pelo ofício.
  if (typeof extraido.mesesRra === 'number' && extraido.mesesRra > 0) {
    return extraido.mesesRra;
  }
  return 0;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// Nome do estado -> sigla, para quando o ofício só traz "Estado do Rio de Janeiro".
const NOMES_ESTADOS: [string, string][] = [
  ['RIO DE JANEIRO', 'RJ'], ['SAO PAULO', 'SP'], ['MINAS GERAIS', 'MG'],
  ['RIO GRANDE DO SUL', 'RS'], ['RIO GRANDE DO NORTE', 'RN'], ['ESPIRITO SANTO', 'ES'],
  ['MATO GROSSO DO SUL', 'MS'], ['MATO GROSSO', 'MT'], ['SANTA CATARINA', 'SC'],
  ['BAHIA', 'BA'], ['PARANA', 'PR'], ['PERNAMBUCO', 'PE'], ['CEARA', 'CE'],
  ['GOIAS', 'GO'], ['PARAIBA', 'PB'], ['PARA', 'PA'], ['PIAUI', 'PI'],
  ['MARANHAO', 'MA'], ['ALAGOAS', 'AL'], ['SERGIPE', 'SE'], ['AMAZONAS', 'AM'],
  ['RONDONIA', 'RO'], ['RORAIMA', 'RR'], ['ACRE', 'AC'], ['AMAPA', 'AP'],
  ['TOCANTINS', 'TO'], ['DISTRITO FEDERAL', 'DF'],
];

// Sede de cada TRF, usada quando o ofício é federal.
const UF_TRF: Record<string, string> = {
  TRF1: 'DF', TRF2: 'RJ', TRF3: 'SP', TRF4: 'RS', TRF5: 'PE', TRF6: 'MG',
};

/**
 * Deriva a UF a partir do tribunal / ente devedor quando a extração não a
 * preencheu. A UF define a tabela comercial no ramo Estadual — deixá-la cair no
 * fallback 'SP' aplicaria o percentual de São Paulo a um precatório de outro
 * estado (ex: 25% de SP contra 20,5% do RJ na LOA 2027).
 */
export function derivarUf(extraido: OficioExtraido): string | undefined {
  if (extraido.uf) {
    const candidato = extraido.uf.trim().toUpperCase();
    if (UFS.includes(candidato)) return candidato;
  }

  const contexto = normalizarTexto(
    [extraido.tribunal, extraido.enteDevedor].filter(Boolean).join(' ')
  );
  if (!contexto) return undefined;

  const trf = contexto.match(/TRF\s*-?\s*([1-6])/);
  if (trf) return UF_TRF[`TRF${trf[1]}`];

  // "TJRJ", "TJERJ", "TJ-RJ"
  const tj = contexto.match(/TJ\s*E?\s*-?\s*([A-Z]{2})\b/);
  if (tj && UFS.includes(tj[1])) return tj[1];

  for (const [nome, sigla] of NOMES_ESTADOS) {
    if (contexto.includes(nome)) return sigla;
  }
  return undefined;
}

export interface PreferenciaCredor {
  temPreferencia: boolean;
  idade: number | null;
  motivos: string[];
}

// Idade mínima para a preferência do §2º do art. 100 da CF.
const IDADE_PREFERENCIA = 60;

/**
 * Preferência constitucional (§2º do art. 100 da CF): idosos, portadores de
 * doença grave e pessoas com deficiência têm prioridade na fila de pagamento.
 *
 * NOTA: por ora isto é apenas DETECTADO e reportado — ainda não altera o
 * percentual da tabela comercial, porque a regra de negócio (quanto a
 * preferência vale em desconto) não está definida. Ver CALCULO.md §7.
 */
export function avaliarPreferencia(
  extraido: OficioExtraido,
  referencia: Date = new Date()
): PreferenciaCredor {
  const motivos: string[] = [];
  let idade: number | null = null;

  if (extraido.dataNascimento) {
    const nasc = new Date(extraido.dataNascimento);
    if (!Number.isNaN(nasc.getTime())) {
      let anos = referencia.getFullYear() - nasc.getFullYear();
      const passouAniversario =
        referencia.getMonth() > nasc.getMonth() ||
        (referencia.getMonth() === nasc.getMonth() && referencia.getDate() >= nasc.getDate());
      if (!passouAniversario) anos -= 1;
      if (anos >= 0 && anos < 130) {
        idade = anos;
        if (anos >= IDADE_PREFERENCIA) motivos.push(`idoso(a) — ${anos} anos`);
      }
    }
  }

  if (extraido.portadorDoencaGrave) motivos.push('portador(a) de doença grave');
  if (extraido.pessoaComDeficiencia) motivos.push('pessoa com deficiência');

  return { temPreferencia: motivos.length > 0, idade, motivos };
}

const SYSTEM_PROMPT_EXTRACAO = `Você é um especialista jurídico-financeiro da Premium Office Precatório.
Analise o ofício requisitório (texto ou imagem/documento) e extraia com exatidão todos os campos do formulário para o cálculo.

Atenção especial ao nome do credor — a maioria dos ofícios traz uma seção "DADOS PROCESSUAIS" ou "Partes" no formato:
  Autor: NOME DO CREDOR
  Réu: NOME DO ENTE DEVEDOR
  Procurador: NOME DO ADVOGADO
Nesse caso, o campo "credor" é exatamente o nome que aparece ao lado de "Autor" (ou "Requerente"/"Exequente"/"Credor"/"Beneficiário" quando o documento usar esses termos). NUNCA use o nome ao lado de "Réu", "Executado" ou "Procurador" — esses são o devedor e o advogado, não o credor. Leia o documento inteiro (cabeçalho, corpo e rodapé) antes de decidir. Nunca invente ou reutilize um nome de exemplo — extraia exatamente o texto do documento, e só deixe o campo vazio se, depois de examinar tudo, nenhum nome puder ser razoavelmente identificado como titular do crédito.

Ofícios requisitórios de Tribunal de Justiça / TRF costumam trazer os dados em itens numerados em romano. Mapeamento típico:

- "número do processo de execução" → processo
- "partes" → Autor = credor · Réu = ente devedor · Procurador = advogado (NUNCA o credor)
- "natureza da obrigação (assunto)" → é o RITO PROCESSUAL, não a natureza do crédito. Ignore para o campo natureza.
- "Pagamentos pleiteados na ação: 05/1990 a 04/2013" → periodoPagamentosInicio=1990-05, periodoPagamentosFim=2013-04
- "Não é Tributário" → isTributario=false
- "nome do beneficiário" / "CPF do beneficiário" → credor e cpfCnpj
- "Data de nascimento do beneficiário" → dataNascimento (YYYY-MM-DD)
- "Portador de doença grave" / "Pessoa com deficiência" → booleanos correspondentes
- "tipo de requisição" → tipoRequisicao
- "valor bruto da requisição" + "data base do cálculo" → brutoOriginal e dataBase
- "valor do desconto previdenciário" → pssOriginal
- "Incide IR" → incideIr=true
- "Valor Principal" → principalTributavel · "Valor Juros" → valorJuros · "Correção Monetária" → correcaoMonetaria

Regras importantes:
- A NATUREZA vem do título do ofício (ex: "PAGAMENTO DE VERBA ALIMENTAR" ⇒ Alimentar), não do campo "assunto".
- A UF é OBRIGATÓRIA e quase sempre derivável do cabeçalho ou do tribunal, mesmo sem estar escrita como sigla. Exemplos: "Estado do Rio de Janeiro" / "Tribunal de Justiça do Estado do Rio de Janeiro" / "TJERJ" / "TJRJ" ⇒ uf="RJ"; "TJSP" / "Estado de São Paulo" ⇒ "SP"; "TRF3" ⇒ "SP"; "TRF2" ⇒ "RJ"; "TRF1" ⇒ "DF". Preencha sempre a sigla de 2 letras. A UF define a tabela comercial aplicável — deixá-la vazia distorce o resultado.
- Campos booleanos declarados de forma negativa no documento devem vir como false, não vazios. Ex: "Portador de doença grave: Não" ⇒ portadorDoencaGrave=false; "Pessoa com deficiência: Não" ⇒ pessoaComDeficiencia=false.
- Extraia valores monetários como número puro (1059599.54), sem "R$" nem separador de milhar.
- Não preencha um campo por dedução ou semelhança: se o dado não está escrito no documento, deixe vazio.
- Se a data-base for indicada em meses/anos passados, forneça no formato YYYY-MM.`;

/**
 * Uma passada de extração estruturada sobre a entrada informada.
 * gpt-4o-mini para texto (rápido/barato); gpt-4o para imagens (leitura de
 * documento digitalizado).
 */
async function extrairCampos(
  entrada: EntradaAnalise,
  apiKey: string
): Promise<OficioExtraido> {
  const llm = new ChatOpenAI({
    modelName: entrada.tipo === 'imagem' ? 'gpt-4o' : 'gpt-4o-mini',
    temperature: 0.1,
    openAIApiKey: apiKey,
  });

  // method: 'functionCalling' porque o schema usa campos opcionais (nem todo
  // ofício informa todos os dados) — o modo jsonSchema/strict da OpenAI exige
  // 100% dos campos em `required`, o que rejeitaria este schema com erro 400.
  const structuredLlm = llm.withStructuredOutput(oficioExtractionSchema, { method: 'functionCalling' });

  const userContent =
    entrada.tipo === 'texto'
      ? entrada.texto
      : [
          {
            type: 'text',
            text:
              entrada.paginas.length > 1
                ? `Leia este ofício requisitório (${entrada.paginas.length} páginas em imagem) e extraia os dados para o cálculo.`
                : 'Leia este ofício requisitório (imagem/documento) e extraia os dados para o cálculo.',
          },
          // Uma entrada image_url por página — a OpenAI aceita apenas formatos
          // de imagem aqui, por isso as páginas já vêm rasterizadas em PNG.
          ...entrada.paginas.map((pagina) => ({
            type: 'image_url',
            image_url: { url: `data:${pagina.mimeType};base64,${pagina.base64}` },
          })),
        ];

  const promptExtracao = [
    { role: 'system', content: SYSTEM_PROMPT_EXTRACAO },
    { role: 'user', content: userContent as any },
  ];

  let extraido: OficioExtraido;
  try {
    extraido = (await structuredLlm.invoke(promptExtracao)) as OficioExtraido;
  } catch (err) {
    // O `.catch(undefined)` no schema neutraliza a maioria dos valores fora do
    // tipo esperado, mas continua existindo um resíduo de erro de parsing do
    // functionCalling (ex.: a própria chamada de função vier malformada). Sem
    // este catch, essa exceção do LangChain subia crua até o catch genérico da
    // rota e virava "Não conseguimos concluir a análise agora" — mensagem que
    // parece bug de servidor quando na verdade o problema é o documento.
    console.warn('[analise] Falha ao interpretar a extração do modelo:', err);
    throw new ErroDocumentoIlegivel(
      'Não conseguimos interpretar os dados deste ofício com segurança. Tente enviar o PDF original ou uma foto mais nítida e bem enquadrada do documento.'
    );
  }

  return sanitizarPlaceholders(extraido);
}

/**
 * true quando o resultado do caminho de texto é ruim o bastante para valer uma
 * segunda tentativa por visão: faltando qualquer campo essencial, ou com valor
 * que não se ancora no texto-fonte (sinal de que o texto extraído não
 * corresponde ao que está impresso na página).
 */
function precisaFallbackVisao(validacao: ValidacaoExtracao): boolean {
  return validacao.camposFaltando.length > 0 || validacao.camposSuspeitos.length > 0;
}

/**
 * Processa a extração dos dados do ofício e roda a calculadora em 8 etapas com a persona selecionada.
 * Fluxo híbrido: entrada `texto` (PDF com camada de texto real) usa gpt-4o-mini
 * (mais rápido e barato); entrada `imagem` (PDF escaneado ou foto do ofício)
 * usa gpt-4o com visão computacional, sem depender de OCR local.
 */
export async function analisarOficioComLangChain(
  entrada: EntradaAnalise,
  persona: Persona = 'autor'
): Promise<{
  extraido: OficioExtraido;
  resultado: ResultadoCalculo;
  respostaFormatada: string;
  validacao: ValidacaoExtracao;
  preferencia: PreferenciaCredor;
  atualizacao: DetalheAtualizacao;
  mesesRra: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no ambiente.');
  }
  if (entrada.tipo === 'texto' && entrada.texto.trim().length < MIN_TEXTO_PDF_VALIDO) {
    throw new ErroDocumentoIlegivel(
      'Não foi possível ler o conteúdo do documento. Envie um PDF ou imagem mais nítida do ofício.'
    );
  }

  // 1. Primeira tentativa pelo caminho escolhido em prepararEntradaDocumento.
  let extraido = await extrairCampos(entrada, apiKey);
  let validacao = validarExtracao(extraido, entrada.tipo === 'texto' ? entrada.texto : undefined);

  // 2. Fallback texto -> visão. Um PDF escaneado pode ter uma camada de texto
  // esparsa (OCR pobre do próprio digitalizador) que passa o limite mínimo mas
  // não contém os dados do ofício. Nesse caso o texto é inútil e a página
  // renderizada é a única fonte real — rasteriza e tenta de novo com visão.
  if (entrada.tipo === 'texto' && entrada.pdfBuffer && precisaFallbackVisao(validacao)) {
    try {
      const paginas = await rasterizarPdf(entrada.pdfBuffer);
      const entradaVisao: EntradaAnalise = { tipo: 'imagem', paginas };
      const extraidoVisao = await extrairCampos(entradaVisao, apiKey);
      const validacaoVisao = validarExtracao(extraidoVisao, undefined);

      // Adota a visão se recuperou campos que faltavam, ou se o texto trazia
      // valor não ancorado (alucinação) e a visão não regrediu — nesse caso a
      // página renderizada é a fonte mais confiável das duas.
      const recuperouCampos = validacaoVisao.camposFaltando.length < validacao.camposFaltando.length;
      const substituiSuspeita =
        validacao.camposSuspeitos.length > 0 &&
        validacaoVisao.camposFaltando.length <= validacao.camposFaltando.length;

      if (recuperouCampos || substituiSuspeita) {
        extraido = extraidoVisao;
        validacao = validacaoVisao;
      }
    } catch (err) {
      console.warn('[analise] Fallback para visão falhou:', err);
    }
  }

  // 3. Sem valor bruto ou sem data-base não existe cálculo honesto a apresentar
  // — qualquer número aqui seria ficção com aparência de proposta formal.
  if (validacao.camposFaltando.includes('brutoOriginal') || validacao.camposFaltando.includes('dataBase')) {
    const faltantes = validacao.camposFaltando.map(rotuloCampo).join(', ');
    throw new ErroDocumentoIlegivel(
      `Não foi possível ler com segurança os dados essenciais do ofício (${faltantes}). ` +
        'Confira se enviou a página do ofício requisitório que traz o valor e a data-base do precatório.'
    );
  }

  // 4. Executa o Motor de Cálculo em 8 Etapas, com fallbacks explícitos para os
  // campos secundários ausentes (já registrados em validacao.camposAssumidos).
  // mesesRra é derivado em código a partir do período de competência — o modelo
  // erra contagem de calendário e isso distorceria a alíquota do IR por RRA.
  const mesesRra = derivarMesesRra(extraido);
  const preferencia = avaliarPreferencia(extraido);
  const ufDerivada = derivarUf(extraido);

  const parametrosCalc: ParametrosOficio = {
    ...extraido,
    brutoOriginal: extraido.brutoOriginal as number,
    dataBase: extraido.dataBase as string,
    esfera: extraido.esfera ?? FALLBACKS.esfera,
    natureza: extraido.natureza ?? FALLBACKS.natureza,
    uf: ufDerivada ?? FALLBACKS.uf,
    loa: extraido.loa ?? FALLBACKS.loa,
    honorariosPct: extraido.honorariosPct ?? FALLBACKS.honorariosPct,
    principalTributavel: extraido.principalTributavel ?? 0,
    mesesRra,
    persona,
  };

  // Fator de atualização pelos índices oficiais do BCB, por trecho de regime.
  // Se as séries não estiverem acessíveis, a análise falha — não há estimativa
  // de reserva (ver CALCULO.md §3 sobre o custo de estimar taxa).
  let atualizacao: DetalheAtualizacao;
  try {
    atualizacao = await obterFatorAtualizacao(parametrosCalc.dataBase, parametrosCalc.dataCalculo);
  } catch (err: any) {
    console.error('[analise] Índices de atualização indisponíveis:', err);
    throw new ErroDocumentoIlegivel(
      'Não conseguimos consultar os índices oficiais de atualização neste momento. ' +
        'Tente novamente em alguns minutos — seu ofício já foi registrado com a nossa equipe.'
    );
  }

  const resultado = executarCalculoPrecatorio(parametrosCalc, atualizacao.fator);

  // 5. Formata a resposta explicativa personalizada para a Persona
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const avisoConfianca =
    validacao.camposSuspeitos.length > 0
      ? `\n\n⚠️ **Confirme estes dados:** não localizamos no texto do documento o(s) campo(s) ${validacao.camposSuspeitos
          .map(rotuloCampo)
          .join(', ')}. Nosso consultor vai validar com você antes de qualquer proposta oficial.`
      : validacao.camposAssumidos.length > 0
        ? `\n\n_Obs.: ${validacao.camposAssumidos
            .map(rotuloCampo)
            .join(', ')} não constavam de forma explícita no ofício — usamos a premissa mais comum para a estimativa e o consultor confirma na validação._`
        : '';

  const linhaPreferencia = preferencia.temPreferencia
    ? `\n- **Preferência constitucional:** sim — ${preferencia.motivos.join(', ')} (art. 100, §2º, CF)`
    : '';

  const respostaFormatada = `
**Análise Concluída pela IA da Premium Office**

📄 **Dados Identificados no Ofício:**
- **Credor:** ${extraido.credor || 'Não identificado'}
- **Ente Devedor / Tribunal:** ${extraido.enteDevedor || extraido.tribunal || 'Não identificado'} (${parametrosCalc.esfera})
- **Natureza / LOA:** ${parametrosCalc.natureza} · LOA ${parametrosCalc.loa}
- **Valor Bruto Original:** ${formatter.format(parametrosCalc.brutoOriginal)} (Data-base: ${parametrosCalc.dataBase})${linhaPreferencia}

🧮 **Resumo da Avaliação:**
- **Valor Atualizado:** ${formatter.format(resultado.brutoAtualizado)} (${resultado.mesesDecorridos} meses decorridos)
- **Descontos Legais (PSS / Outros):** ${formatter.format(resultado.outrosTotal)}
- **Honorários Contratuais (${resultado.honorariosPct}%):** ${formatter.format(resultado.honorariosValor)}
- **Imposto de Renda:** ${formatter.format(resultado.irTotal)}${resultado.isIrInformado ? ' (Conforme informado)' : mesesRra > 0 ? ` (RRA, ${mesesRra} meses)` : ''}
- **Líquido Final do Credor:** ${formatter.format(resultado.liquidoFinal)}

💰 **Proposta Indicativa de Antecipação:**
- **Faixa de Valores:** ${formatter.format(resultado.propostaInicial)} a ${formatter.format(resultado.limiteInterno)}
- **Margem de Negociação:** ${formatter.format(resultado.margemNegociacao)}${avisoConfianca}
`.trim();

  return {
    extraido,
    resultado,
    respostaFormatada,
    validacao,
    preferencia,
    atualizacao,
    mesesRra,
  };
}
