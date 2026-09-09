import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Premium Office - Painel do Chatbot',
  description: 'Hub interno de controle e observabilidade do chatbot de captação de precatórios.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className="font-sans bg-mist text-ink">
        <MantineProvider defaultColorScheme="light">{children}</MantineProvider>
      </body>
    </html>
  );
}
