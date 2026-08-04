// Validação de upload compartilhada entre /api/chat (ofício) e /api/documentos
// (documentos complementares) — mesma política de segurança para qualquer
// arquivo que entra no servidor vindo do navegador.

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Assinaturas binárias reais (magic bytes) dos formatos aceitos — não confiamos
// no `mimeType` enviado pelo cliente, que pode ser forjado para disfarçar
// executáveis ou outros arquivos maliciosos como PDF/imagem.
const FILE_SIGNATURES: { mimeType: string; check: (buf: Buffer) => boolean }[] = [
  { mimeType: 'application/pdf', check: (buf) => buf.subarray(0, 4).toString('latin1') === '%PDF' },
  { mimeType: 'image/jpeg', check: (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff },
  {
    mimeType: 'image/png',
    check: (buf) => buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    check: (buf) =>
      buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export type ValidacaoArquivo = { ok: true; buffer: Buffer; mimeTypeReal: string } | { ok: false; erro: string };

export function validarArquivoUpload(fileBase64: string): ValidacaoArquivo {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(fileBase64, 'base64');
  } catch {
    return { ok: false, erro: 'Arquivo inválido.' };
  }

  if (buffer.length === 0) {
    return { ok: false, erro: 'Arquivo vazio.' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, erro: 'Arquivo muito grande. O tamanho máximo permitido é 10 MB.' };
  }
  const assinatura = FILE_SIGNATURES.find((sig) => sig.check(buffer));
  if (!assinatura) {
    return { ok: false, erro: 'Formato de arquivo não reconhecido. Envie um PDF, JPG, PNG ou WEBP.' };
  }
  return { ok: true, buffer, mimeTypeReal: assinatura.mimeType };
}

export function sanitizarNomeArquivo(fileName: string | undefined): string {
  const base = (fileName || 'arquivo').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  return safe || 'arquivo.pdf';
}
