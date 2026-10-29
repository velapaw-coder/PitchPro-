import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';

export default async function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('common.pages');

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pt-8 md:px-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t('back_to_home')}
        </Link>
      </div>
      <div className="mx-auto max-w-3xl px-6 pt-6 pb-12 md:px-8 md:pt-8 md:pb-16">
        {children}
      </div>
    </div>
  );
}
