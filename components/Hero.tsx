'use client';

import { useEffect, useRef } from 'react';

export default function Hero() {
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
      data-screen-label="Hero"
      className="relative overflow-hidden bg-navy px-5 py-12 sm:px-8 sm:py-14 md:px-16 md:py-16"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.72)_0%,rgba(16,35,63,0.55)_55%,rgba(11,27,51,0.85)_100%)]" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center justify-center pt-8">
        <div className="mx-auto flex w-full max-w-[800px] flex-col items-center text-center">
          <img
            src="/logo-white.png"
            alt="Premium Office Precatório"
            className="mb-7 block h-[81px] w-auto"
          />

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(13,31,56,0.35)] bg-[rgba(13,31,56,0.16)] px-3.5 py-1.5 text-[13px] font-semibold text-sky">
            Especialistas em precatórios · Titulares, herdeiros e advogados
          </div>

          <h1 className="mb-5 max-w-[720px] text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.2] tracking-[-0.02em] text-white text-wrap-pretty">
            Você já conquistou o direito de receber.
          </h1>

          <p className="mb-8 max-w-[560px] text-[clamp(17px,2vw,20px)] leading-[1.65] text-[#C7CFDE] text-wrap-pretty">
            A Premium Office ajuda você a entender se faz sentido transformar esse crédito futuro
            em dinheiro disponível agora — com análise, clareza e segurança, sem compromisso.
          </p>

          <div className="flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <a
              href="#ia"
              className="rounded-full border border-[rgba(143,180,234,0.45)] bg-navy-accent px-7 py-4 text-base font-extrabold text-white no-underline shadow-[0_12px_32px_rgba(13,31,56,0.35)] transition-all duration-250 ease-out hover:-translate-y-px hover:border-[#F7F5F1] hover:bg-[#F7F5F1] hover:text-navy-accent hover:shadow-[0_16px_38px_rgba(13,31,56,0.45)]"
            >
              Solicitar análise gratuita
            </a>
            <span className="text-sm text-[#7C879C] sm:ml-2">Sem compromisso · Sem pressão</span>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-5">
            {['Site seguro', 'Seus dados protegidos', 'Segurança jurídica em cada etapa'].map(
              (label) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-navy-accent" />
                  <span className="text-sm font-medium text-[#C7CFDE]">{label}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
