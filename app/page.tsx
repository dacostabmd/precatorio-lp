import Hero from '@/components/Hero';
import ChatSection from '@/components/ChatSection';
import ComoFunciona from '@/components/ComoFunciona';
import Faq from '@/components/Faq';
import Footer from '@/components/Footer';
import StickyBottomBar from '@/components/StickyBottomBar';

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-mist text-ink font-sans pb-20 md:pb-0">
      <Hero />
      <ChatSection />
      <ComoFunciona />
      <Faq />
      <Footer />
      <StickyBottomBar />
    </div>
  );
}

