import { getTranslations } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground">{t('not_found.message')}</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        {t('not_found.back_home')}
      </Link>
    </div>
  );
}
