/**
 * Índices oficiais de atualização de precatórios, obtidos da API SGS do Banco
 * Central (pública, sem autenticação).
 *
 * Metodologia implementada — atualização POR TRECHO (ver CALCULO.md §5):
 *
 *   data-base ─────────► 11/2021 : IPCA-E (correção) + juros de mora 0,5%/mês
 *             12/2021 ─►  cálculo : SELIC acumulada (incidência única)
 *
 * Fundamento: até a EC 113/2021 vigia o regime do Tema 810/STF (RE 870947) —
 * IPCA-E como índice de correção monetária, com juros de mora à parte. A partir
 * da EC 113/2021 (art. 3º), a SELIC passa a incidir "uma única vez", já
 * abrangendo correção monetária, remuneração do capital e compensação da mora —
 * por isso NÃO se soma juros de mora ao trecho SELIC.
 *
 * PREMISSAS QUE PRECISAM DE VALIDAÇÃO JURÍDICA (documentadas em CALCULO.md):
 *  a) Juros de mora tratados como SIMPLES (não capitalizados) — padrão para
 *     Fazenda Pública. A fórmula antiga os capitalizava, o que era um erro.
 *  b) Índices aplicados a partir da competência SEGUINTE à data-base, até a
 *     competência do mês de cálculo (inclusive).
 *  c) Marco de virada de regime em 12/2021.
 *
 * Regra de segurança: se as séries oficiais não puderem ser obtidas, esta
 * função LANÇA erro. Nunca há fallback para taxa estimada — foi exatamente o
 * fallback silencioso que produziu propostas ~2x infladas (CALCULO.md §3).
 */

// Séries SGS do Banco Central.
// 4390  = Selic acumulada no mês (% no mês)
// 10764 = IPCA-15 / IPCA-E, variação mensal (% no mês) — idêntica à série 7478
const SERIE_SELIC = 4390;
const SERIE_IPCA_E = 10764;

// Primeira competência sob o regime da EC 113/2021 (SELIC isolada).
const MARCO_EC113 = { ano: 2021, mes: 12 };

// Juros de mora do regime pré-EC 113 (Tema 810/STF), simples, ao mês.
const JUROS_MORA_MENSAL = 0.005;

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie';
const TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — índices mudam no máximo 1x/mês

interface Competencia {
  ano: number;
  mes: number; // 1-12
}

/** valor percentual mensal, indexado por "YYYY-MM" */
type SerieMensal = Map<string, number>;

const cache = new Map<number, { emitidoEm: number; serie: SerieMensal }>();

export class ErroIndiceIndisponivel extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroIndiceIndisponivel';
  }
}

function chaveCompetencia(c: Competencia): string {
  return `${c.ano}-${String(c.mes).padStart(2, '0')}`;
}

/** Aceita YYYY-MM, YYYY-MM-DD, MM/YYYY e DD/MM/YYYY. */
export function parseCompetencia(valor: string): Competencia | null {
  if (!valor) return null;
  const s = valor.trim();

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    return { ano: Number(isoMatch[1]), mes: Number(isoMatch[2]) };
  }

  const partes = s.split('/');
  if (partes.length === 2) {
    return { ano: Number(partes[1]), mes: Number(partes[0]) };
  }
  if (partes.length === 3) {
    return { ano: Number(partes[2]), mes: Number(partes[1]) };
  }
  return null;
}

function competenciaValida(c: Competencia | null): c is Competencia {
  return (
    !!c &&
    Number.isInteger(c.ano) &&
    Number.isInteger(c.mes) &&
    c.ano >= 1980 &&
    c.ano <= 2100 &&
    c.mes >= 1 &&
    c.mes <= 12
  );
}

function indiceAbsoluto(c: Competencia): number {
  return c.ano * 12 + (c.mes - 1);
}

function proximaCompetencia(c: Competencia): Competencia {
  return c.mes === 12 ? { ano: c.ano + 1, mes: 1 } : { ano: c.ano, mes: c.mes + 1 };
}

/** Lista as competências no intervalo [inicio, fim], ambas inclusive. */
function competenciasNoIntervalo(inicio: Competencia, fim: Competencia): Competencia[] {
  const lista: Competencia[] = [];
  let atual = inicio;
  while (indiceAbsoluto(atual) <= indiceAbsoluto(fim)) {
    lista.push(atual);
    atual = proximaCompetencia(atual);
  }
  return lista;
}

async function buscarSerie(serie: number): Promise<SerieMensal> {
  const emCache = cache.get(serie);
  if (emCache && Date.now() - emCache.emitidoEm < CACHE_TTL_MS) {
    return emCache.serie;
  }

  const url = `${BCB_BASE}/bcdata.sgs.${serie}/dados?formato=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new ErroIndiceIndisponivel(`SGS ${serie} respondeu HTTP ${res.status}`);
    }
    const dados = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(dados) || dados.length === 0) {
      throw new ErroIndiceIndisponivel(`SGS ${serie} retornou série vazia`);
    }

    const mapa: SerieMensal = new Map();
    for (const linha of dados) {
      // formato SGS: "01/02/2020"
      const [, mes, ano] = linha.data.split('/');
      const valor = Number(linha.valor);
      if (!Number.isFinite(valor)) continue;
      mapa.set(`${ano}-${mes.padStart(2, '0')}`, valor);
    }

    cache.set(serie, { emitidoEm: Date.now(), serie: mapa });
    return mapa;
  } catch (err: any) {
    if (err instanceof ErroIndiceIndisponivel) throw err;
    throw new ErroIndiceIndisponivel(
      `Falha ao consultar a série ${serie} no Banco Central: ${err?.message || err}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Produtório de (1 + i/100) das competências informadas. */
function acumular(serie: SerieMensal, competencias: Competencia[], nomeSerie: string): number {
  let fator = 1;
  const ausentes: string[] = [];

  for (const c of competencias) {
    const chave = chaveCompetencia(c);
    const valor = serie.get(chave);
    if (valor === undefined) {
      ausentes.push(chave);
      continue;
    }
    fator *= 1 + valor / 100;
  }

  // Competências ausentes só são toleráveis no mês corrente (índice ainda não
  // divulgado). Um buraco no meio da série invalidaria a atualização.
  if (ausentes.length > 1) {
    throw new ErroIndiceIndisponivel(
      `Série ${nomeSerie} sem dados para as competências: ${ausentes.join(', ')}`
    );
  }

  return fator;
}

export interface DetalheAtualizacao {
  fator: number;
  mesesTotal: number;
  /** Trecho pré-EC 113/2021: IPCA-E + juros de mora simples. */
  trechoIpcaE: { de: string; ate: string; meses: number; fatorCorrecao: number; fatorJuros: number } | null;
  /** Trecho pós-EC 113/2021: SELIC isolada. */
  trechoSelic: { de: string; ate: string; meses: number; fator: number } | null;
  competenciaCalculo: string;
}

/**
 * Fator de atualização da data-base até a competência de cálculo, aplicando o
 * regime vigente em cada trecho. Lança ErroIndiceIndisponivel se as séries
 * oficiais não estiverem acessíveis — nunca estima.
 */
export async function obterFatorAtualizacao(
  dataBase: string,
  dataCalculo?: string
): Promise<DetalheAtualizacao> {
  const base = parseCompetencia(dataBase);
  if (!competenciaValida(base)) {
    throw new ErroIndiceIndisponivel(`Data-base inválida para atualização: "${dataBase}"`);
  }

  const agora = new Date();
  const calculo = dataCalculo
    ? parseCompetencia(dataCalculo)
    : { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
  if (!competenciaValida(calculo)) {
    throw new ErroIndiceIndisponivel(`Data de cálculo inválida: "${dataCalculo}"`);
  }

  // Índices incidem a partir da competência seguinte à data-base.
  const primeira = proximaCompetencia(base);

  if (indiceAbsoluto(primeira) > indiceAbsoluto(calculo)) {
    // Data-base no mês corrente (ou futura): nada a atualizar.
    return {
      fator: 1,
      mesesTotal: 0,
      trechoIpcaE: null,
      trechoSelic: null,
      competenciaCalculo: chaveCompetencia(calculo),
    };
  }

  // Última competência do regime antigo = mês anterior ao marco da EC 113.
  const ultimaPreEc: Competencia =
    MARCO_EC113.mes === 1
      ? { ano: MARCO_EC113.ano - 1, mes: 12 }
      : { ano: MARCO_EC113.ano, mes: MARCO_EC113.mes - 1 };

  // O trecho pré-EC nunca passa da competência de cálculo (data-base recente).
  const fimPreEc = indiceAbsoluto(ultimaPreEc) <= indiceAbsoluto(calculo) ? ultimaPreEc : calculo;
  const competenciasPreEc =
    indiceAbsoluto(primeira) <= indiceAbsoluto(fimPreEc)
      ? competenciasNoIntervalo(primeira, fimPreEc)
      : [];
  const inicioSelic =
    indiceAbsoluto(primeira) > indiceAbsoluto(MARCO_EC113) ? primeira : MARCO_EC113;
  const competenciasSelic =
    indiceAbsoluto(inicioSelic) <= indiceAbsoluto(calculo)
      ? competenciasNoIntervalo(inicioSelic, calculo)
      : [];

  let trechoIpcaE: DetalheAtualizacao['trechoIpcaE'] = null;
  let fatorTotal = 1;

  if (competenciasPreEc.length > 0) {
    const serieIpca = await buscarSerie(SERIE_IPCA_E);
    const fatorCorrecao = acumular(serieIpca, competenciasPreEc, 'IPCA-E');
    // Juros de mora simples sobre o período do trecho.
    const fatorJuros = 1 + JUROS_MORA_MENSAL * competenciasPreEc.length;
    fatorTotal *= fatorCorrecao * fatorJuros;
    trechoIpcaE = {
      de: chaveCompetencia(competenciasPreEc[0]),
      ate: chaveCompetencia(competenciasPreEc[competenciasPreEc.length - 1]),
      meses: competenciasPreEc.length,
      fatorCorrecao,
      fatorJuros,
    };
  }

  let trechoSelic: DetalheAtualizacao['trechoSelic'] = null;

  if (competenciasSelic.length > 0) {
    const serieSelic = await buscarSerie(SERIE_SELIC);
    const fator = acumular(serieSelic, competenciasSelic, 'SELIC');
    fatorTotal *= fator;
    trechoSelic = {
      de: chaveCompetencia(competenciasSelic[0]),
      ate: chaveCompetencia(competenciasSelic[competenciasSelic.length - 1]),
      meses: competenciasSelic.length,
      fator,
    };
  }

  return {
    fator: fatorTotal,
    mesesTotal: competenciasPreEc.length + competenciasSelic.length,
    trechoIpcaE,
    trechoSelic,
    competenciaCalculo: chaveCompetencia(calculo),
  };
}
