export default function Footer() {
  const waNumber = '5521986450262';
  const footerWhatsappLink = `https://wa.me/${waNumber}`;

  return (
    <footer className="bg-[#1F2331] px-4 py-10 pb-28 sm:px-6 md:px-16 md:pb-12">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center text-center gap-8 md:flex-row md:items-start md:justify-between md:text-left">
        <div className="flex flex-col items-center md:items-start">
          <img src="/logo-white.png" alt="Premium Office Precatório" className="mb-3.5 block h-[44px] sm:h-[50px] w-auto" />
          <p className="max-w-[320px] text-[13px] leading-[1.6] text-[#7C879C]">
            Antecipe seu precatório com segurança jurídica, transparência e estratégia.
          </p>
        </div>
        <div className="text-[13px] leading-[1.9] text-[#8A96AC]">
          <div>Premium Office Precatório</div>
          <div>CNPJ 45.102.131/0001-18</div>
          <div>Av. das Américas, 3443 – Barra da Tijuca, RJ</div>
        </div>
        <div className="text-[13px] leading-[1.9] text-[#8A96AC] flex flex-col items-center md:items-start">
          <div>felipeandrade@premiumofficeprecatorio.com</div>
          <a
            href={footerWhatsappLink}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex min-h-[44px] items-center font-bold text-sky no-underline transition-transform active:scale-[0.98] hover:text-white"
          >
            (21) 98645-0262 · WhatsApp
          </a>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-[1280px] text-center md:text-left text-xs leading-[1.6] text-[#5C6B85]">
        Aviso: os valores exibidos pela IA são estimativas indicativas. A proposta oficial e
        vinculante depende de validação documental e jurídica por um consultor.
      </p>
    </footer>
  );
}
