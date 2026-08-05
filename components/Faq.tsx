'use client';

import { Accordion } from '@mantine/core';
import { FAQ_DATA } from '@/lib/data';

export default function Faq() {
  return (
    <section data-screen-label="FAQ" className="bg-white px-4 py-12 sm:px-6 sm:py-16 md:px-16 md:py-24">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8 sm:mb-10 text-center">
          <h2 className="mb-2.5 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-0.01em] text-navy">
            Perguntas frequentes
          </h2>
        </div>

        <div className="flex flex-col items-stretch gap-10 lg:flex-row lg:gap-16">
          <div className="w-full flex-1">
            <Accordion
              variant="separated"
              chevronPosition="right"
              styles={{
                item: { backgroundColor: '#F4F6F9', border: 'none', borderBottom: '1px solid #EAEDF2', borderRadius: '12px', padding: '4px 12px', marginBottom: '8px' },
                control: { padding: '16px 4px', minHeight: '48px' },
                label: { fontSize: 15, fontWeight: 700, color: '#0B1B33' },
                content: { padding: '0 4px 16px', fontSize: 14, color: '#5B6478', lineHeight: 1.65 },
                chevron: { color: '#0D1F38' },
              }}
            >
              {FAQ_DATA.map((f, i) => (
                <Accordion.Item key={i} value={String(i)}>
                  <Accordion.Control>{f.question}</Accordion.Control>
                  <Accordion.Panel>{f.answer}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </div>
          
          <div className="hidden flex-1 lg:block">
            <img 
              src="/criativo-premium-office-celular.png" 
              alt="Premium Office Precatório" 
              className="h-full w-full rounded-2xl object-cover shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
