'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import {
  MAX_ENTERPRISE_ASSET_MB,
  pitchApi,
  type ApiAsset,
} from './api-client';
import { emitAssetsChanged } from './events';

export function EnterpriseLibraryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [items, setItems] = useState<ApiAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setItems(await pitchApi.listAssets());
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function onFile(file: File | null) {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      await pitchApi.uploadAssetFile(file);
      emitAssetsChanged();
      await refresh();
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onAddNote() {
    if (!noteTitle.trim()) {
      setError('请填写资料标题');
      return;
    }
    setError('');
    try {
      await pitchApi.createAssetNote(noteTitle.trim(), noteBody);
      emitAssetsChanged();
      setNoteTitle('');
      setNoteBody('');
      await refresh();
    } catch (e: any) {
      setError(e.message || '保存失败');
    }
  }

  async function onDelete(id: string) {
    try {
      await pitchApi.deleteAsset(id);
      emitAssetsChanged();
      await refresh();
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>企业资料库</DialogTitle>
          <DialogDescription>
            上传工厂册、工艺说明、案例等。Cloudflare
            预发写入 R2（pitchpro-assets）；本地开发写入服务器磁盘。聊方案时可引用这些资料。单文件上限{' '}
            {MAX_ENTERPRISE_ASSET_MB}MB。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {loading ? '上传中…' : '上传文件'}
            </Button>
            <span className="text-muted-foreground self-center text-[11px]">
              支持 PDF／图片／文本等，单文件 ≤{MAX_ENTERPRISE_ASSET_MB}MB
            </span>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium">或快速记一条文本资料</p>
            <Input
              placeholder="标题，如：柔性注塑能力摘要"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <textarea
              className="border-input placeholder:text-muted-foreground min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none"
              placeholder="粘贴要点…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <Button type="button" size="sm" onClick={onAddNote}>
              保存到资料库
            </Button>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="max-h-56 space-y-2 overflow-y-auto">
            {loading && (
              <p className="text-muted-foreground text-xs">加载中…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="text-muted-foreground text-xs">暂无资料</p>
            )}
            {items.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 rounded-lg border p-2.5"
              >
                <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {a.fileName} · {(a.size / 1024).toFixed(1)} KB
                  </div>
                  {a.textPreview && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {a.textPreview}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onDelete(a.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
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
