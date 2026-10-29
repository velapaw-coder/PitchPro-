import { CTA } from '@/blocks/cta';
import { FAQ } from '@/blocks/faq';
import { Features } from '@/blocks/features';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { Hero } from '@/blocks/hero';
import { Pricing } from '@/blocks/pricing';

/**
 * PitchPro marketing homepage. Copy lives in messages/{zh,en}/landing.json
 * aligned with /workspace/pitch-materials/doc.docx (呈品整体方案).
 */
export default function HomePage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
