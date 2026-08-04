import { NextResponse } from 'next/server';
import { validarArquivoUpload, sanitizarNomeArquivo } from '@/lib/upload';

const MAX_ARQUIVOS_POR_ENVIO = 8;

interface ArquivoRecebido {
  fileBase64: string;
  fileName?: string;
}

/**
 * Publica os documentos complementares (RG, procuração, certidão etc.) como
 * uma única atividade na timeline do Negócio (Deal) no Bitrix, com todos os
 * arquivos válidos anexados de uma vez via `crm.timeline.comment.add` +
 * `FILES` — o mesmo mecanismo nativo de "atividade com anexo" que qualquer
 * usuário do Bitrix já reconhece no card, sem precisar de um campo
 * customizado dedicado (evita alterar schema do CRM de produção).
 */
async function publicarDocumentosNoBitrix(
  dealId: number,
  arquivos: { fileName: string; fileBase64: string }[]
): Promise<{ ok: boolean; erro?: string }> {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
  if (!webhookUrl || !dealId) return { ok: false, erro: 'Bitrix não configurado.' };

  try {
    const res = await fetch(`${webhookUrl.replace(/\/$/, '')}/crm.timeline.comment.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ENTITY_ID: dealId,
          ENTITY_TYPE: 'deal',
          COMMENT: `[IA] Documentos complementares enviados pelo cliente (${arquivos.length}):\n${arquivos
            .map((a) => `- ${a.fileName}`)
            .join('\n')}`,
          FILES: arquivos.map((a) => [a.fileName, a.fileBase64]),
        },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { ok: false, erro: data.error_description || data.error || 'Falha ao publicar no Bitrix.' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err?.message || 'Erro de rede ao publicar no Bitrix.' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bitrixDealId, arquivos } = body as { bitrixDealId?: number; arquivos?: ArquivoRecebido[] };

    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento enviado.' }, { status: 400 });
    }
    if (arquivos.length > MAX_ARQUIVOS_POR_ENVIO) {
      return NextResponse.json(
        { error: `Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} documentos por vez.` },
        { status: 400 }
      );
    }
    if (!bitrixDealId) {
      return NextResponse.json(
        { error: 'Não identificamos seu cadastro. Recarregue a página e tente novamente.' },
        { status: 400 }
      );
    }

    const validos: { fileName: string; fileBase64: string }[] = [];
    const rejeitados: string[] = [];

    for (const arquivo of arquivos) {
      const validacao = validarArquivoUpload(arquivo.fileBase64 || '');
      if (!validacao.ok) {
        rejeitados.push(`${arquivo.fileName || 'arquivo'}: ${validacao.erro}`);
        continue;
      }
      validos.push({
        fileName: sanitizarNomeArquivo(arquivo.fileName),
        fileBase64: arquivo.fileBase64,
      });
    }

    if (validos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dos arquivos enviados é válido.', rejeitados },
        { status: 400 }
      );
    }

    const publicacao = await publicarDocumentosNoBitrix(bitrixDealId, validos);
    if (!publicacao.ok) {
      console.error('[bitrix] Falha ao publicar documentos complementares:', publicacao.erro);
      return NextResponse.json(
        { error: 'Não conseguimos enviar seus documentos agora. Tente novamente em instantes.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, enviados: validos.length, rejeitados });
  } catch (error: any) {
    console.error('Erro na rota /api/documentos:', error);
    return NextResponse.json(
      { error: 'Não conseguimos enviar seus documentos agora. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
