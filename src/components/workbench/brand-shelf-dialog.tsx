'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { pitchApi, type ApiShelfBrand } from './api-client';
import { BrandCard } from './brand-card';

export function BrandShelfDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (brand: ApiShelfBrand) => void;
}) {
  const [items, setItems] = useState<ApiShelfBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    pitchApi
      .listShelf()
      .then(setItems)
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>我的品牌（企业私库）</DialogTitle>
          <DialogDescription>
            从轻搜索点选保存的品牌名片。点选后写入当前项目。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading && <p className="text-muted-foreground text-xs">加载中…</p>}
          {error && <p className="text-destructive text-xs">{error}</p>}
          {!loading && items.length === 0 && (
            <p className="text-muted-foreground text-xs">
              私库为空。先在聊方案里搜索品牌并「存到我的品牌」。
            </p>
          )}
          {items.map((b) => (
            <BrandCard
              key={b.id}
              brand={b}
              compact
              onSelect={() => {
                onPick(b);
                onOpenChange(false);
              }}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
