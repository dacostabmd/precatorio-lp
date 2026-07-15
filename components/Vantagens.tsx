'use client';

import { useEffect, useRef } from 'react';

const VANTAGENS = [
  { icon: '$', title: 'Análise gratuita', description: 'Sem custo para enviar o ofício e receber a primeira estimativa.' },
  { icon: 'IA', title: 'IA com revisão humana', description: 'Toda proposta indicativa é revisada por um consultor antes de se tornar oficial.' },
  { icon: '§', title: '100% seguro e sigiloso', description: 'Dados e documentos tratados conforme a LGPD, sem compartilhamento com terceiros.' },
];

export default function Vantagens() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/beams')
      .then(({ mountBeams }) => {
        if (canvasRef.current) {
          cleanup = mountBeams(canvasRef.current, {
            lightColor: '#0D1F38',
            backgroundColor: '#0B1B33',
            diffuseColor: '#050B16',
          });
        }
      })
      .catch(() => {});
    return () => cleanup?.();
  }, []);

  return (
    <section
      data-screen-label="Vantagens"
      className="relative overflow-hidden bg-navy px-5 py-14 sm:px-8 sm:py-20 md:px-16 md:py-26"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.72)_0%,rgba(16,35,63,0.55)_55%,rgba(11,27,51,0.85)_100%)]" />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-12 text-center">
          <h2 className="mb-2.5 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] text-white">
            Segurança em cada etapa
          </h2>
          <p className="text-base text-[#9AA6BC]">IA para agilizar a triagem, consultores para validar.</p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
          {VANTAGENS.map((v) => (
            <div key={v.title} className="rounded-[20px] border border-navy-border bg-navy-panel p-7">
              <div className="mb-4.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(143,180,234,0.14)] text-lg font-extrabold text-sky">
                {v.icon}
              </div>
              <h4 className="mb-2 text-[17px] font-extrabold text-white">{v.title}</h4>
              <p className="text-sm leading-[1.55] text-[#9AA6BC]">{v.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
