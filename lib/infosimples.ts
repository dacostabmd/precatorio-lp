/**
 * Integração com a API InfoSimples para consulta processual por CPF.
 * Realiza buscas paralelas nos principais Tribunais Regionais Federais (TRFs)
 * e Tribunais Estaduais (TJs).
 */

export interface ProcessoExtraido {
  tribunal: string;
  numeroProcesso?: string;
  classe?: string;
  assunto?: string;
  vara?: string;
  valorCausa?: string;
  exequente?: string;
  executado?: string;
  partes?: string[];
  status?: string;
  isPrecatorio?: boolean;
  ultimaMovimentacao?: {
    data?: string;
    movimento?: string;
  };
  raw?: any;
}

export interface ResultadoConsultaInfoSimples {
  cpf: string;
  executado: boolean;
  encontrado: boolean;
  tempoTotalMs: number;
  totalProcessos: number;
  processos: ProcessoExtraido[];
  restricoes: { tribunal: string; detalhe: string }[];
  detalhesPorTribunal: {
    tribunal: string;
    slug: string;
    code: number;
    mensagem: string;
    encontrouDados: boolean;
    erros?: string[];
    tempoMs: number;
    dados?: any[];
  }[];
}

const TRIBUNAIS_ALVO = [
  { nome: 'TRF-1 (DF, GO, MT, BA, etc.)', slug: 'tribunal/trf1/processo', params: {} },
  { nome: 'TRF-2 (RJ e ES)', slug: 'tribunal/trf2/processo', params: {} },
  { nome: 'TRF-3 (SP e MS)', slug: 'tribunal/trf3/processo', params: {} },
  { nome: 'TRF-5 (Nordeste)', slug: 'tribunal/trf5/processo', params: {} },
  { nome: 'TRF-6 (Minas Gerais Federal)', slug: 'tribunal/trf6/processo', params: {} },
  { nome: 'TJSP (São Paulo Estadual)', slug: 'tribunal/tjsp/primeiro-grau', params: { pagina: 1 } },
  { nome: 'TJMG (Minas Gerais Estadual)', slug: 'tribunal/tjmg/processo', params: {} },
];

export async function consultarCpfInfoSimples(cpfLimpo: string): Promise<ResultadoConsultaInfoSimples> {
  const token = process.env.INFOSIMPLES_API_TOKEN;
  const startTotal = Date.now();

  const baseResult: ResultadoConsultaInfoSimples = {
    cpf: cpfLimpo,
    executado: false,
    encontrado: false,
    tempoTotalMs: 0,
    totalProcessos: 0,
    processos: [],
    restricoes: [],
    detalhesPorTribunal: [],
  };

  if (!token) {
    console.warn('[infosimples] INFOSIMPLES_API_TOKEN não configurada.');
    return baseResult;
  }

  baseResult.executado = true;

  const consultarTribunal = async (alvo: typeof TRIBUNAIS_ALVO[0]) => {
    const startReq = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout para resolução de captcha

      const res = await fetch(`https://api.infosimples.com/api/v2/consultas/${alvo.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          cpf: cpfLimpo,
          ...alvo.params,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({ code: 500, code_message: 'Resposta não-JSON' }));
      const elapsed = Date.now() - startReq;
      const encontrou = data.code === 200 && Array.isArray(data.data) && data.data.length > 0;

      return {
        tribunal: alvo.nome,
        slug: alvo.slug,
        code: data.code || res.status,
        mensagem: data.code_message || '',
        encontrouDados: encontrou,
        erros: data.errors || [],
        tempoMs: elapsed,
        dados: data.data || [],
        rawHeader: data.header,
      };
    } catch (err: any) {
      return {
        tribunal: alvo.nome,
        slug: alvo.slug,
        code: 504,
        mensagem: err.name === 'AbortError' ? 'Tempo limite esgotado (timeout)' : err.message || 'Erro de conexão',
        encontrouDados: false,
        erros: [err.message],
        tempoMs: Date.now() - startReq,
        dados: [],
      };
    }
  };

  // Executa consultas aos tribunais em paralelo
  const resultadosTribunais = await Promise.all(TRIBUNAIS_ALVO.map(consultarTribunal));

  baseResult.detalhesPorTribunal = resultadosTribunais;
  baseResult.tempoTotalMs = Date.now() - startTotal;

  for (const r of resultadosTribunais) {
    if (r.encontrouDados && r.dados) {
      // Alguns tribunais (como TJSP) retornam os processos dentro de data[0].processos
      const listaItens: any[] = [];
      for (const d of r.dados) {
        if (Array.isArray(d?.processos)) {
          listaItens.push(...d.processos);
        } else if (d && typeof d === 'object') {
          listaItens.push(d);
        }
      }

      if (listaItens.length > 0) {
        baseResult.encontrado = true;
      }

      for (const item of listaItens) {
        const numProc = item.processo || item.numero_processo || item.numero || item.cnj || item.outros_numeros?.[0];
        const classe = item.classe || item.classe_judicial || item.tipo || '';
        const assunto = item.assunto || item.natureza || '';
        const vara = item.vara ? (item.foro ? `${item.vara} - ${item.foro}` : item.vara) : undefined;
        const valor = item.valor_acao || item.valor_causa || item.valor || item.valor_execucao || '';
        const exeq = item.autor || item.reqte || item.exeqte || '';
        const exec = item.exectdo || item.reqdo || item.reu || '';

        const movs = Array.isArray(item.ultimas_movimentacoes) ? item.ultimas_movimentacoes : [];
        const ultimaMov = movs.length > 0 ? movs[0] : undefined;

        // Detecta se é precatório / cumprimento contra a fazenda / RPV
        const textoCompleto = `${classe} ${assunto} ${vara || ''} ${movs.map((m: any) => m.movimento || '').join(' ')}`.toLowerCase();
        const isPrecatorio = /precat|fazenda|requis|rpv|ipesp|inss|uni[aã]o|cumprimento de senten/i.test(textoCompleto);

        baseResult.processos.push({
          tribunal: r.tribunal,
          numeroProcesso: numProc,
          classe,
          assunto,
          vara,
          valorCausa: valor,
          exequente: exeq,
          executado: exec,
          partes: [exeq, exec].filter(Boolean),
          status: item.situacao || item.fase || 'Ativo',
          isPrecatorio,
          ultimaMovimentacao: ultimaMov,
          raw: item,
        });
      }
    }

    // Detecção de restrições ou processos em segredo de justiça
    if (r.code === 620 || (r.erros && r.erros.some((e: string) => /restrit|segredo|sigil/i.test(e)))) {
      baseResult.restricoes.push({
        tribunal: r.tribunal,
        detalhe: r.erros?.[0] || r.mensagem || 'Processo com acesso restrito / segredo',
      });
    }
  }

  baseResult.totalProcessos = baseResult.processos.length;

  return baseResult;
}
