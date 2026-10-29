'use client';

import { useLocale } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';

/** Locale product name: zh → 呈品, else → pitchpro. No logo image. */
export function brandNameForLocale(locale: string) {
  return locale === 'zh' || locale.startsWith('zh') ? '呈品' : 'pitchpro';
}

export function BrandLogoMark({
  className,
}: {
  className?: string;
  /** ignored — kept for call-site compat */
  height?: number;
}) {
  const locale = useLocale();
  const name = brandNameForLocale(locale);
  return (
    <span className={cn('font-serif text-lg italic leading-none', className)}>
      {name}
    </span>
  );
}

export function BrandLogo({
  href = '/',
  className,
  height,
  priority,
}: {
  href?: string;
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  void height;
  void priority;
  const locale = useLocale();
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center', className)}
      aria-label={brandNameForLocale(locale)}
    >
      <BrandLogoMark />
    </Link>
  );
}
