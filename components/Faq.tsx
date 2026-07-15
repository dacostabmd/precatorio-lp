'use client';

import { Accordion } from '@mantine/core';
import { FAQ_DATA } from '@/lib/data';

export default function Faq() {
  return (
    <section data-screen-label="FAQ" className="bg-white px-5 py-14 sm:px-8 sm:py-20 md:px-16 md:py-26">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <h2 className="mb-2.5 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] text-navy">
            Perguntas frequentes
          </h2>
        </div>

        <div className="flex flex-col items-stretch gap-10 lg:flex-row lg:gap-16">
          <div className="flex-[1_1_50%]">
            <Accordion
              variant="separated"
              chevronPosition="right"
              styles={{
                item: { backgroundColor: '#F4F6F9', border: 'none', borderBottom: '1px solid #EAEDF2', borderRadius: '10px', padding: '4px 16px' },
                control: { padding: '16px 4px' },
                label: { fontSize: 16, fontWeight: 700, color: '#0B1B33' },
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
          
          <div className="hidden flex-[1_1_50%] lg:block">
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
