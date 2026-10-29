'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { AppSidebar, type NavItem } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { UserMenu } from '@/components/user-menu';

export function AppLayout({
  children,
  navItems,
  footerNavItems,
  brand,
  brandHref = '/',
  mobileBrand,
  headerExtra,
  profileHref,
  requirePermission,
  unauthorizedRedirect = '/settings',
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  footerNavItems?: NavItem[];
  brand: React.ReactNode;
  brandHref?: string;
  mobileBrand?: React.ReactNode;
  headerExtra?: React.ReactNode;
  profileHref?: string;
  requirePermission?: string;
  unauthorizedRedirect?: string;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const [authorized, setAuthorized] = useState(false);
  // Redirect to sign-in exactly once, so a re-render mid-navigation can't
  // recapture the callbackUrl as the sign-in path itself.
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      setAuthorized(false);
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      // Remember where the user was headed so sign-in can send them back.
      // Strip the locale prefix so the locale-aware router re-applies it.
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
      // Invite-only gate: a new user (incl. social logins) with no redeemed
      // invite must redeem one before entering the app. Admins are exempt
      // (computed server-side in /api/user/info).
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
      } catch {}
      if (cancelled) return;

      if (!requirePermission) {
        setAuthorized(true);
        return;
      }

      try {
        const res = await fetch('/api/user/permissions').then((r) => r.json());
        if (cancelled) return;
        if (res.code === 0 && res.data?.isAdmin === true) setAuthorized(true);
        else router.push(unauthorizedRedirect);
      } catch {
        if (!cancelled) router.push(unauthorizedRedirect);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isPending,
    session,
    router,
    locale,
    requirePermission,
    unauthorizedRedirect,
  ]);

  if (isPending || !authorized || !session?.user) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        brand={brand}
        brandHref={brandHref}
        navItems={navItems}
        footerNavItems={footerNavItems}
        footer={
          <UserMenu
            name={session.user.name || 'User'}
            email={session.user.email}
            image={session.user.image}
            profileHref={profileHref}
          />
        }
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="flex-1" />
          {headerExtra && (
            <div className="flex items-center gap-1 px-4">{headerExtra}</div>
          )}
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
