import { getTranslations } from 'next-intl/server';

import {
  SiteFooter,
  type FooterColumn,
} from '@/components/site-footer';

export async function Footer() {
  const t = await getTranslations('landing');

  const columns: FooterColumn[] = [
    {
      title: t('footer.product'),
      links: [
        { label: t('footer.workbench'), href: '/workbench' },
        { label: t('nav.pricing'), href: '/pricing' },
        { label: t('nav.features'), href: '/#features' },
      ],
    },
    {
      title: t('footer.feature'),
      links: [
        { label: t('footer.settings'), href: '/settings' },
        { label: t('footer.admin'), href: '/admin' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.privacy'), href: '/privacy-policy' },
        { label: t('footer.terms'), href: '/terms-of-service' },
      ],
    },
  ];

  return (
    <SiteFooter
      tagline={t('footer.tagline')}
      columns={columns}
      socials={[]}
    />
  );
}
