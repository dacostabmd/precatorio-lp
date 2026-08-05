'use client';

import { useEffect, useRef } from 'react';

export default function ComoFunciona() {
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
      data-screen-label="Como Funciona"
      className="relative overflow-hidden bg-navy px-4 py-12 sm:px-6 sm:py-16 md:px-16 md:py-24"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.72)_0%,rgba(16,35,63,0.55)_55%,rgba(11,27,51,0.85)_100%)]" />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-8 sm:mb-10 text-center">
          <h2 className="mb-2.5 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-0.01em] text-white">
            Como funciona
          </h2>
          <p className="text-sm sm:text-base text-[#9AA6BC]">Do envio do ofício à reunião com consultor.</p>
        </div>

        <div className="mx-auto max-w-[820px] rounded-[20px] border border-navy-border bg-navy-panel px-5 py-6 sm:px-8 sm:py-7">
          <p className="mb-3.5 text-sm sm:text-[15px] leading-[1.75] text-[#C7CFDE] text-wrap-pretty">
            O <strong className="text-white">ofício requisitório</strong> é o documento emitido
            pela Justiça que reconhece, de forma definitiva, o seu direito de receber um valor do
            poder público — e é a partir dele que nasce o{' '}
            <strong className="text-white">precatório</strong>. Na prática, esse precatório é um
            ativo judicial real: um crédito já reconhecido pela Justiça, com valor definido, mas
            que costuma levar anos para ser efetivamente pago pelo governo.
          </p>
          <p className="text-sm sm:text-[15px] leading-[1.75] text-[#C7CFDE] text-wrap-pretty">
            Antecipar esse crédito significa transformar um direito que hoje só existe no papel em
            dinheiro disponível agora, sem esperar pelo prazo do governo. É exatamente isso que a
            nossa análise faz: entender o seu ofício, calcular o valor real do seu precatório e
            mostrar, com clareza e sem compromisso, se a antecipação faz sentido para você.
          </p>
        </div>
      </div>
    </section>
  );
}
