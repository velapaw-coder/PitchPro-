'use client';

import { BookmarkPlus, Check, ExternalLink, FolderPlus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { ApiBrandCard } from './api-client';

export function BrandCard({
  brand,
  onSelect,
  onSaveShelf,
  onOpenNew,
  onDismiss,
  selectLabel = '用于本项目',
  compact,
}: {
  brand: ApiBrandCard;
  onSelect?: () => void;
  onSaveShelf?: () => void;
  onOpenNew?: () => void;
  onDismiss?: () => void;
  selectLabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-background overflow-hidden rounded-xl border',
        compact ? 'p-2.5' : ''
      )}
    >
      {!compact && brand.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.imageUrl}
          alt={brand.name}
          className="h-28 w-full object-cover"
        />
      )}
      <div className={cn(compact ? '' : 'p-3')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{brand.name}</div>
            <div className="text-muted-foreground truncate text-xs">
              {brand.country}
              {brand.country && brand.track ? ' · ' : ''}
              {brand.track}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            检索结果，请确认
          </Badge>
        </div>
        {brand.tone && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
            {brand.tone}
          </p>
        )}
        {brand.matchReason && (
          <p className="text-muted-foreground/80 mt-1 text-[11px]">
            匹配：{brand.matchReason}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-0.5 text-[11px] hover:underline"
            >
              官网 <ExternalLink className="size-3" />
            </a>
          )}
          {brand.instagram && (
            <a
              href={brand.instagram}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-0.5 text-[11px] hover:underline"
            >
              IG <ExternalLink className="size-3" />
            </a>
          )}
          {brand.facebook && (
            <a
              href={brand.facebook}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-0.5 text-[11px] hover:underline"
            >
              FB <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {onSelect && (
            <Button size="xs" className="gap-1" onClick={onSelect}>
              <Check className="size-3" />
              {selectLabel}
            </Button>
          )}
          {onOpenNew && (
            <Button size="xs" variant="outline" className="gap-1" onClick={onOpenNew}>
              <FolderPlus className="size-3" />
              另开项目
            </Button>
          )}
          {onSaveShelf && (
            <Button size="xs" variant="outline" className="gap-1" onClick={onSaveShelf}>
              <BookmarkPlus className="size-3" />
              存到我的品牌
            </Button>
          )}
          {onDismiss && (
            <Button size="xs" variant="ghost" className="gap-1" onClick={onDismiss}>
              <X className="size-3" />
              不合适
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
