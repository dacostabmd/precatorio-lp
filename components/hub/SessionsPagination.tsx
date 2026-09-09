import Link from 'next/link';

interface SessionsPaginationProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

export default function SessionsPagination({ page, totalPages, searchParams }: SessionsPaginationProps) {
  if (totalPages <= 1) return null;

  function hrefPara(p: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v && k !== 'page') params.set(k, v);
    });
    params.set('page', String(p));
    return `?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-4 justify-center mt-4 text-sm">
      <Link
        href={hrefPara(Math.max(1, page - 1))}
        className={page <= 1 ? 'pointer-events-none opacity-40' : 'text-blue-700 hover:underline'}
      >
        Anterior
      </Link>
      <span className="text-gray-500">
        Página {page} de {totalPages}
      </span>
      <Link
        href={hrefPara(Math.min(totalPages, page + 1))}
        className={page >= totalPages ? 'pointer-events-none opacity-40' : 'text-blue-700 hover:underline'}
      >
        Próxima
      </Link>
    </div>
  );
}
