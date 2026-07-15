export default function Footer() {
  const waNumber = '5521986450262';
  const footerWhatsappLink = `https://wa.me/${waNumber}`;

  return (
    <footer className="bg-[#1F2331] px-5 py-10 sm:px-8 md:px-16">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-8">
        <div className="flex-[1_1_260px]">
          <img src="/logo-white.png" alt="Premium Office Precatório" className="mb-3.5 block h-[50px] w-auto" />
          <p className="max-w-[320px] text-[13px] leading-[1.6] text-[#7C879C]">
            Antecipe seu precatório com segurança jurídica, transparência e estratégia.
          </p>
        </div>
        <div className="flex-[1_1_220px] text-[13px] leading-[1.9] text-[#8A96AC]">
          <div>Premium Office Precatório</div>
          <div>CNPJ 45.102.131/0001-18</div>
          <div>Av. das Américas, 3443 – Barra da Tijuca, RJ</div>
        </div>
        <div className="flex-[1_1_220px] text-[13px] leading-[1.9] text-[#8A96AC]">
          <div>felipeandrade@premiumofficeprecatorio.com</div>
          <a
            href={footerWhatsappLink}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-sky no-underline hover:text-white"
          >
            (21) 98645-0262 · WhatsApp
          </a>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-[1280px] text-xs leading-[1.6] text-[#5C6B85]">
        Aviso: os valores exibidos pela IA são estimativas indicativas. A proposta oficial e
        vinculante depende de validação documental e jurídica por um consultor.
      </p>
    </footer>
  );
}
