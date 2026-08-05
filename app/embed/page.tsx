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
    fontSize?: string;
    textSize?: string;
    font?: string;
    btnSize?: string;
    buttonSize?: string;
    btn?: string;
    scale?: string;
    zoom?: string;
  }>;
}

export default async function EmbedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isTransparent = params.transparent === 'true' || params.transparent === '1' || params.bg === 'transparent';
  const fontSize = params.fontSize || params.textSize || params.font;
  const btnSize = params.btnSize || params.buttonSize || params.btn;
  const scale = params.scale || params.zoom;

  return (
    <main className="h-screen w-full flex flex-col items-center justify-center p-2 sm:p-4 bg-transparent overflow-hidden">
      <div className="w-full h-full flex flex-col flex-1 min-h-0 max-w-[880px] mx-auto">
        <ChatSection
          embedOnly={true}
          transparent={isTransparent}
          fontSize={fontSize}
          btnSize={btnSize}
          scale={scale}
        />
      </div>
    </main>
  );
}
