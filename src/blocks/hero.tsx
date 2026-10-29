import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { DotPattern } from '@/components/ui/dot-pattern';

export async function Hero() {
  const t = await getTranslations('landing');

  return (
    <section className="relative isolate flex flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-20 sm:pt-40 sm:pb-32">
      <DotPattern
        className={cn(
          '[mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]',
          'text-foreground/15'
        )}
      />
      <div className="relative max-w-3xl space-y-8 text-center">
        <h1 className="text-foreground font-serif text-5xl leading-[1.1] font-normal tracking-tight sm:text-6xl lg:text-7xl">
          {t('hero.headline')}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed sm:text-xl">
          {t('hero.subheadline')}
        </p>

        <div className="flex items-center justify-center gap-3 pt-4">
          <Link
            href="/workbench"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-12 gap-2 rounded-full px-8'
            )}
          >
            {t('hero.cta')}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
