'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { defaultLocale } from '@/config/locale';
import { Badge } from '@/components/ui/badge';
import { SiteUserMenu } from '@/components/site-user-menu';

import { WorkbenchSidebar } from './workbench-sidebar';

export function WorkbenchShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('workbench');
  const [authorized, setAuthorized] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      setAuthorized(false);
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      let callbackUrl = window.location.pathname + window.location.search;
      if (locale !== defaultLocale) {
        if (callbackUrl === `/${locale}`) callbackUrl = '/';
        else if (callbackUrl.startsWith(`/${locale}/`))
          callbackUrl = callbackUrl.slice(locale.length + 1);
      }
      if (!callbackUrl.startsWith('/')) callbackUrl = '/';
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    let cancelled = false;
    setAuthorized(false);
    (async () => {
      try {
        const info = await fetch('/api/user/info').then((r) => r.json());
        if (cancelled) return;
        if (info.code === 0 && info.data?.needsInvite) {
          if (!redirectingRef.current) {
            redirectingRef.current = true;
            router.push('/redeem-invite');
          }
          return;
        }
      } catch {
        /* ignore — allow local shell if info endpoint fails */
      }
      if (!cancelled) setAuthorized(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, session, router, locale]);

  if (isPending || !authorized || !session?.user) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-muted-foreground text-sm">{t('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 md:px-4">
        <BrandLogo href="/workbench" height={28} />
        <div className="flex-1" />
        <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
          <Coins className="size-3" />
          {t('credits')} · —
        </Badge>
        <SiteUserMenu
          name={session.user.name || 'User'}
          email={session.user.email}
          image={session.user.image}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <WorkbenchSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
