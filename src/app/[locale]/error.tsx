'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-6xl font-bold">{t('error.title')}</h1>
      <p className="text-muted-foreground">{t('error.message')}</p>
      {process.env.NODE_ENV === 'development' && error?.message ? (
        <pre className="bg-muted text-destructive max-w-xl overflow-auto rounded-md p-3 text-left text-xs">
          {error.message}
        </pre>
      ) : null}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="border-border hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium transition-colors"
        >
          {t('error.retry')}
        </button>
        <Link href="/" className="text-sm underline underline-offset-4">
          {t('error.back_home')}
        </Link>
      </div>
    </div>
  );
}
