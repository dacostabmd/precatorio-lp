import SessionFilters from '@/components/hub/SessionFilters';
import SessionsTable from '@/components/hub/SessionsTable';
import SessionsPagination from '@/components/hub/SessionsPagination';
import { listChatSessions } from '@/lib/hubQueries';

interface PageProps {
  searchParams: Promise<{
    persona?: string;
    resultado?: string;
    busca?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 25;

export default async function SessoesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, parseInt(params.page, 10) || 1) : 1;

  const { sessions, total } = await listChatSessions({
    persona: params.persona,
    resultado: params.resultado,
    busca: params.busca,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-ink">
        Sessões de chat
      </h1>
      <SessionFilters persona={params.persona} resultado={params.resultado} busca={params.busca} />
      <SessionsTable sessions={sessions} />
      <SessionsPagination page={page} totalPages={totalPages} searchParams={params} />
    </div>
  );
}
