import ChatSection from '@/components/ChatSection';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calculadora Assistente de Cálculos Premium Office',
  description: 'Calculadora de precatórios com Inteligência Artificial.',
};

interface PageProps {
  searchParams: Promise<{
    transparent?: string;
    bg?: string;
  }>;
}

export default async function EmbedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isTransparent = params.transparent === 'true' || params.transparent === '1' || params.bg === 'transparent';

  return (
    <main className="min-h-screen flex items-center justify-center p-0 bg-transparent">
      <div className="w-full max-w-[880px] mx-auto">
        <ChatSection embedOnly={true} transparent={isTransparent} />
      </div>
    </main>
  );
}
