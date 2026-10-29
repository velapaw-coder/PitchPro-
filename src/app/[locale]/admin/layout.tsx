'use client';

import {
  CreditCard,
  FolderOpen,
  Home,
  LayoutDashboard,
  Settings,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BrandLogoMark } from '@/components/brand-logo';
import { AppLayout } from '@/components/app-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  const group = tc('systems.admin');
  const navItems = [
    { href: '/admin', label: t('nav.overview'), icon: LayoutDashboard, group },
    {
      href: '/admin/users',
      label: t('nav.rbac'),
      icon: Shield,
      group,
      items: [
        { href: '/admin/users', label: t('nav.users') },
        { href: '/admin/invite-codes', label: t('nav.invite_codes') },
        { href: '/admin/roles', label: t('nav.roles') },
        { href: '/admin/permissions', label: t('nav.permissions') },
      ],
    },
    {
      href: '/admin/categories',
      label: t('nav.content'),
      icon: FolderOpen,
      group,
      items: [
        { href: '/admin/categories', label: t('nav.categories') },
        { href: '/admin/posts', label: t('nav.posts') },
      ],
    },
    {
      href: '/admin/payments',
      label: t('nav.billing'),
      icon: CreditCard,
      group,
      items: [
        { href: '/admin/payments', label: t('nav.payments') },
        { href: '/admin/subscriptions', label: t('nav.subscriptions') },
        { href: '/admin/credits', label: t('nav.credits') },
      ],
    },
  ];

  const footerNavItems = [
    { href: '/workbench', label: tc('systems.workbench'), icon: Sparkles },
    { href: '/admin/settings', label: t('nav.settings'), icon: Settings },
    { href: '/', label: tc('systems.home'), icon: Home, newTab: true },
  ];

  return (
    <AppLayout
      navItems={navItems}
      footerNavItems={footerNavItems}
      brand={<BrandLogoMark height={28} />}
      brandHref="/admin"
      profileHref="/settings/profile"
      requirePermission="admin.*"
    >
      {children}
    </AppLayout>
  );
}
