import ChatSection from '@/components/ChatSection';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calculadora Assistente de Cálculos Premium Office',
  description: 'Calculadora de precatórios com Inteligência Artificial.',
};

export default function EmbedPage() {
  return (
    <main className="min-h-screen bg-mist p-2 sm:p-4">
      <ChatSection />
    </main>
  );
}
