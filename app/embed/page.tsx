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
    background?: string;
    chatBg?: string;
    fontSize?: string;
    textSize?: string;
    font?: string;
    btnSize?: string;
    buttonSize?: string;
    btn?: string;
    scale?: string;
    zoom?: string;
    headerBg?: string;
    headerColor?: string;
    headerTitle?: string;
    header?: string;
    showHeader?: string;
  }>;
}

export default async function EmbedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isTransparent =
    params.transparent === 'true' ||
    params.transparent === '1' ||
    params.bg === 'transparent' ||
    params.background === 'transparent';

  const bg = params.bg || params.background;
  const chatBg = params.chatBg;
  const fontSize = params.fontSize || params.textSize || params.font;
  const btnSize = params.btnSize || params.buttonSize || params.btn;
  const scale = params.scale || params.zoom;
  const headerBg = params.headerBg;
  const headerColor = params.headerColor;
  const headerTitle = params.headerTitle || params.header;
  const showHeader = params.showHeader !== 'false' && params.showHeader !== '0' && params.showHeader !== 'no';

  return (
    <main className="h-screen w-full flex flex-col items-center justify-center p-0 sm:p-2 bg-transparent overflow-hidden">
      <div className="w-full h-full flex flex-col flex-1 min-h-0 max-w-[880px] mx-auto">
        <ChatSection
          embedOnly={true}
          transparent={isTransparent}
          bg={bg}
          chatBg={chatBg}
          fontSize={fontSize}
          btnSize={btnSize}
          scale={scale}
          headerBg={headerBg}
          headerColor={headerColor}
          headerTitle={headerTitle}
          showHeader={showHeader}
        />
      </div>
    </main>
  );
}
