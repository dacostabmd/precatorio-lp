import { notFound } from 'next/navigation';
import SessaoDetalheView from '@/components/hub/SessaoDetalheView';
import { getChatSessionDetail } from '@/lib/hubQueries';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessaoDetalhePage({ params }: PageProps) {
  const { id } = await params;
  const { session, messages, events } = await getChatSessionDetail(id);

  if (!session) {
    notFound();
  }

  return <SessaoDetalheView session={session} messages={messages} events={events} />;
}
